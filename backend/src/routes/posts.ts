import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';

const createPostSchema = z.object({
  caption: z.string().max(500).optional(),
  video_url: z.string().url(),
  thumbnail_url: z.string().url().optional(),
  duration: z.number().positive(),
  sound_id: z.string().uuid().optional(),
  category_ids: z.array(z.string().uuid()).optional(),
  is_public: z.boolean().default(true),
});

export async function postRoutes(app: FastifyInstance) {
  app.get('/feed', { preHandler: authenticate }, async (req, reply) => {
    const { cursor, limit = '10' } = req.query as { cursor?: string; limit?: string };

    const posts = await prisma.post.findMany({
      where: { status: 'ACTIVE', is_public: true },
      take: parseInt(limit) + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ view_count: 'desc' }, { created_at: 'desc' }],
      include: {
        user: {
          select: { id: true, username: true, display_name: true, avatar_url: true, is_verified: true },
        },
        sound: { select: { id: true, title: true, artist: true, url: true } },
        post_categories: { include: { category: { select: { id: true, name: true, slug: true } } } },
        _count: { select: { likes: true, comments: true } },
      },
    });

    const hasMore = posts.length > parseInt(limit);
    const items = hasMore ? posts.slice(0, -1) : posts;

    const likedIds = await prisma.like.findMany({
      where: {
        user_id: req.currentUser!.id,
        post_id: { in: items.map((p) => p.id) },
      },
      select: { post_id: true },
    });
    const likedSet = new Set(likedIds.map((l) => l.post_id));

    const result = items.map((p) => ({
      ...p,
      is_liked: likedSet.has(p.id),
      categories: p.post_categories.map((pc) => pc.category),
      post_categories: undefined,
    }));

    return reply.send({ items: result, next_cursor: hasMore ? items[items.length - 1].id : null });
  });

  app.post('/', { preHandler: authenticate }, async (req, reply) => {
    const parsed = createPostSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const { category_ids, ...data } = parsed.data;

    const post = await prisma.$transaction(async (tx) => {
      const p = await tx.post.create({
        data: { ...data, user_id: req.currentUser!.id },
      });
      if (category_ids?.length) {
        await tx.postCategory.createMany({
          data: category_ids.map((cid) => ({ post_id: p.id, category_id: cid })),
          skipDuplicates: true,
        });
      }
      await tx.user.update({
        where: { id: req.currentUser!.id },
        data: { post_count: { increment: 1 } },
      });
      return p;
    });

    return reply.status(201).send(post);
  });

  app.get('/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const post = await prisma.post.findUnique({
      where: { id, status: 'ACTIVE' },
      include: {
        user: {
          select: { id: true, username: true, display_name: true, avatar_url: true, is_verified: true },
        },
        sound: true,
        post_categories: { include: { category: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });
    if (!post) return reply.status(404).send({ error: 'Post not found' });

    await prisma.post.update({ where: { id }, data: { view_count: { increment: 1 } } });

    const isLiked = await prisma.like.findUnique({
      where: { user_id_post_id: { user_id: req.currentUser!.id, post_id: id } },
    });

    return reply.send({
      ...post,
      is_liked: !!isLiked,
      categories: post.post_categories.map((pc) => pc.category),
      post_categories: undefined,
    });
  });

  app.delete('/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) return reply.status(404).send({ error: 'Not found' });

    if (post.user_id !== req.currentUser!.id && req.currentUser!.role === 'USER') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    await prisma.$transaction([
      prisma.post.delete({ where: { id } }),
      prisma.user.update({ where: { id: post.user_id }, data: { post_count: { decrement: 1 } } }),
    ]);

    return reply.send({ success: true });
  });

  app.post('/:id/like', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = req.currentUser!.id;

    const existing = await prisma.like.findUnique({
      where: { user_id_post_id: { user_id: userId, post_id: id } },
    });

    if (existing) {
      await prisma.$transaction([
        prisma.like.delete({ where: { user_id_post_id: { user_id: userId, post_id: id } } }),
        prisma.post.update({ where: { id }, data: { like_count: { decrement: 1 } } }),
      ]);
      return reply.send({ liked: false });
    }

    const post = await prisma.post.findUnique({ where: { id }, select: { user_id: true } });
    if (!post) return reply.status(404).send({ error: 'Post not found' });

    await prisma.$transaction([
      prisma.like.create({ data: { user_id: userId, post_id: id } }),
      prisma.post.update({ where: { id }, data: { like_count: { increment: 1 } } }),
    ]);

    if (post.user_id !== userId) {
      await prisma.notification.create({
        data: {
          user_id: post.user_id,
          type: 'LIKE',
          title: 'New like',
          body: 'Someone liked your post',
          data: { post_id: id, liker_id: userId },
        },
      });
    }

    return reply.send({ liked: true });
  });

  app.get('/user/:userId', { preHandler: authenticate }, async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const { cursor, limit = '12' } = req.query as { cursor?: string; limit?: string };

    const posts = await prisma.post.findMany({
      where: { user_id: userId, status: 'ACTIVE', is_public: true },
      take: parseInt(limit) + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { created_at: 'desc' },
      select: {
        id: true, thumbnail_url: true, view_count: true,
        like_count: true, comment_count: true, created_at: true,
      },
    });

    const hasMore = posts.length > parseInt(limit);
    const items = hasMore ? posts.slice(0, -1) : posts;
    return reply.send({ items, next_cursor: hasMore ? items[items.length - 1].id : null });
  });
}
