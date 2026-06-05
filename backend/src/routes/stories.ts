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

export async function storyRoutes(app: FastifyInstance) {
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
      },
      include: {
        user: { select: { id: true, username: true, display_name: true, avatar_url: true } },
        views: { where: { viewer_id: userId }, select: { id: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    return reply.send(stories.map((s) => ({ ...s, is_viewed: s.views.length > 0, views: undefined })));
  });

  app.post('/', { preHandler: authenticate }, async (req, reply) => {
    const parsed = createStorySchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const story = await prisma.story.create({
      data: { user_id: req.currentUser!.id, expires_at, ...parsed.data },
    });

    return reply.status(201).send(story);
  });

  app.post('/:id/view', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
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
