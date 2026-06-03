import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';

const createThreadSchema = z.object({
  content: z.string().min(1).max(280),
  reply_to_id: z.string().uuid().optional(),
});

export async function threadRoutes(app: FastifyInstance) {
  // GET /threads — paginated feed
  app.get('/', { preHandler: authenticate }, async (req, reply) => {
    const { cursor, limit = '15' } = req.query as { cursor?: string; limit?: string };
    const lim = parseInt(limit);

    const threads = await prisma.post.findMany({
      where: {
        status: 'ACTIVE',
        is_public: true,
        video_url: { equals: '' },
        caption: { not: null },
      },
      take: lim + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ like_count: 'desc' }, { created_at: 'desc' }],
      include: {
        user: {
          select: { id: true, username: true, display_name: true, avatar_url: true, is_verified: true },
        },
        _count: { select: { likes: true, comments: true } },
      },
    });

    const hasMore = threads.length > lim;
    const items = hasMore ? threads.slice(0, -1) : threads;

    const likedIds = await prisma.like.findMany({
      where: { user_id: req.currentUser!.id, post_id: { in: items.map(t => t.id) } },
      select: { post_id: true },
    });
    const likedSet = new Set(likedIds.map(l => l.post_id));

    const result = items.map(t => ({
      id: t.id,
      content: t.caption ?? '',
      like_count: t.like_count,
      reply_count: t._count.comments,
      repost_count: t.share_count,
      is_liked: likedSet.has(t.id),
      created_at: t.created_at,
      user: t.user,
    }));

    return reply.send({ items: result, next_cursor: hasMore ? items[items.length - 1].id : null });
  });

  // POST /threads — create a text thread
  app.post('/', { preHandler: authenticate }, async (req, reply) => {
    const parsed = createThreadSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const thread = await prisma.$transaction(async (tx) => {
      const t = await tx.post.create({
        data: {
          user_id: req.currentUser!.id,
          video_url: '',
          caption: parsed.data.content,
          duration: 0,
          is_public: true,
          status: 'ACTIVE',
        },
      });
      await tx.user.update({
        where: { id: req.currentUser!.id },
        data: { post_count: { increment: 1 } },
      });
      return t;
    });

    return reply.status(201).send({
      id: thread.id,
      content: thread.caption,
      like_count: 0,
      reply_count: 0,
      repost_count: 0,
      is_liked: false,
      created_at: thread.created_at,
    });
  });

  // POST /threads/:id/like
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

    await prisma.$transaction([
      prisma.like.create({ data: { user_id: userId, post_id: id } }),
      prisma.post.update({ where: { id }, data: { like_count: { increment: 1 } } }),
    ]);
    return reply.send({ liked: true });
  });
}
