import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';

const createStorySchema = z.object({
  media_url: z.string().url(),
  media_type: z.enum(['image', 'video']).default('image'),
  duration: z.number().int().min(1).max(60).default(5),
  linked_post_id: z.string().uuid().optional(),
});

const replySchema = z.object({ content: z.string().min(1).max(500) });

export async function storyRoutes(app: FastifyInstance) {
  // Feed — stories des gens suivis + les siennes
  app.get('/feed', { preHandler: authenticate }, async (req, reply) => {
    const userId = req.currentUser!.id;
    const following = await prisma.follow.findMany({
      where: { follower_id: userId },
      select: { following_id: true },
    });
    const followingIds = following.map((f) => f.following_id);

    const stories = await prisma.story.findMany({
      where: {
        user_id: { in: [...followingIds, userId] },
        expires_at: { gt: new Date() },
        archived: false,
      },
      include: {
        user: { select: { id: true, username: true, display_name: true, avatar_url: true, gender: true } },
        views: { where: { viewer_id: userId }, select: { id: true } },
        likes: { where: { user_id: userId }, select: { id: true } },
        _count: { select: { views: true, likes: true, replies: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    return reply.send(stories.map((s) => ({
      ...s,
      is_viewed: s.views.length > 0,
      is_liked: s.likes.length > 0,
      views_count: s._count.views,
      likes_count: s._count.likes,
      replies_count: s._count.replies,
      views: undefined,
      likes: undefined,
      _count: undefined,
    })));
  });

  // Créer une story
  app.post('/', { preHandler: authenticate }, async (req, reply) => {
    const parsed = createStorySchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const story = await prisma.story.create({
      data: { user_id: req.currentUser!.id, expires_at, ...parsed.data },
    });
    return reply.status(201).send(story);
  });

  // Marquer comme vue
  app.post('/:id/view', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const story = await prisma.story.findUnique({ where: { id } });
    if (!story) return reply.status(404).send({ error: 'Not found' });

    await prisma.storyView.upsert({
      where: { story_id_viewer_id: { story_id: id, viewer_id: req.currentUser!.id } },
      create: { story_id: id, viewer_id: req.currentUser!.id },
      update: {},
    });
    await prisma.story.update({ where: { id }, data: { view_count: { increment: 1 } } });
    return reply.send({ success: true });
  });

  // Get stories for a specific user (for StoriesScreen viewer)
  app.get('/', { preHandler: authenticate }, async (req, reply) => {
    const { user_id } = req.query as { user_id?: string };
    const targetId = user_id ?? req.currentUser!.id;
    const stories = await prisma.story.findMany({
      where: { user_id: targetId, expires_at: { gt: new Date() } },
      include: {
        user: { select: { id: true, username: true, display_name: true, avatar_url: true } },
        views: { where: { viewer_id: req.currentUser!.id }, select: { id: true } },
        linked_post: { select: { id: true, thumbnail_url: true, caption: true } },
      },
      orderBy: { created_at: 'asc' },
    });
    return reply.send(stories.map((s) => ({ ...s, is_viewed: s.views.length > 0, views: undefined })));
  });

  // Like / unlike
  app.post('/:id/like', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = req.currentUser!.id;
    const existing = await prisma.storyLike.findUnique({
      where: { story_id_user_id: { story_id: id, user_id: userId } },
    });
    if (existing) {
      await prisma.storyLike.delete({ where: { story_id_user_id: { story_id: id, user_id: userId } } });
      await prisma.story.update({ where: { id }, data: { like_count: { decrement: 1 } } });
      return reply.send({ liked: false });
    }
    await prisma.storyLike.create({ data: { story_id: id, user_id: userId } });
    await prisma.story.update({ where: { id }, data: { like_count: { increment: 1 } } });
    return reply.send({ liked: true });
  });

  // Répondre à une story (même sexe uniquement)
  app.post('/:id/reply', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = replySchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const sender = req.currentUser!;
    const story = await prisma.story.findUnique({
      where: { id },
      include: { user: { select: { gender: true } } },
    });
    if (!story) return reply.status(404).send({ error: 'Not found' });
    if (story.user.gender !== sender.gender) {
      return reply.status(403).send({ error: 'Réponse restreinte au même genre.' });
    }

    const reply_ = await prisma.storyReply.create({
      data: { story_id: id, sender_id: sender.id, content: parsed.data.content },
      include: { sender: { select: { id: true, username: true, display_name: true, avatar_url: true } } },
    });
    return reply.status(201).send(reply_);
  });

  // Vues d'une story (propriétaire uniquement)
  app.get('/:id/views', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const story = await prisma.story.findUnique({ where: { id } });
    if (!story || story.user_id !== req.currentUser!.id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const views = await prisma.storyView.findMany({
      where: { story_id: id },
      include: { viewer: { select: { id: true, username: true, display_name: true, avatar_url: true } } },
      orderBy: { created_at: 'desc' },
    });
    return reply.send(views);
  });

  // Réponses d'une story (propriétaire uniquement)
  app.get('/:id/replies', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const story = await prisma.story.findUnique({ where: { id } });
    if (!story || story.user_id !== req.currentUser!.id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const replies = await prisma.storyReply.findMany({
      where: { story_id: id },
      include: { sender: { select: { id: true, username: true, display_name: true, avatar_url: true } } },
      orderBy: { created_at: 'asc' },
    });
    return reply.send(replies);
  });

  // Archives — mes stories expirées
  app.get('/archive', { preHandler: authenticate }, async (req, reply) => {
    const userId = req.currentUser!.id;
    const stories = await prisma.story.findMany({
      where: {
        user_id: userId,
        OR: [{ expires_at: { lt: new Date() } }, { archived: true }],
      },
      include: {
        _count: { select: { views: true, likes: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    return reply.send(stories.map((s) => ({
      ...s,
      views_count: s._count.views,
      likes_count: s._count.likes,
      _count: undefined,
    })));
  });

  // Supprimer
  app.delete('/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const story = await prisma.story.findUnique({ where: { id } });
    if (!story || story.user_id !== req.currentUser!.id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    await prisma.story.delete({ where: { id } });
    return reply.send({ success: true });
  });
}
