import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';

const updateProfileSchema = z.object({
  display_name: z.string().min(1).max(50).optional(),
  bio: z.string().max(200).optional(),
});

export async function userRoutes(app: FastifyInstance) {
  app.get('/search', { preHandler: authenticate }, async (req, reply) => {
    const { q, cursor, limit = '20' } = req.query as { q: string; cursor?: string; limit?: string };
    if (!q) return reply.status(400).send({ error: 'Query required' });

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { display_name: { contains: q, mode: 'insensitive' } },
        ],
        is_banned: false,
      },
      take: parseInt(limit) + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true, username: true, display_name: true,
        avatar_url: true, is_verified: true, follower_count: true,
      },
    });

    const hasMore = users.length > parseInt(limit);
    const items = hasMore ? users.slice(0, -1) : users;
    return reply.send({ items, next_cursor: hasMore ? items[items.length - 1].id : null });
  });

  app.get('/:username', { preHandler: authenticate }, async (req, reply) => {
    const { username } = req.params as { username: string };
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true, username: true, display_name: true, bio: true,
        avatar_url: true, is_verified: true, follower_count: true,
        following_count: true, post_count: true, like_count: true,
        created_at: true,
      },
    });
    if (!user) return reply.status(404).send({ error: 'User not found' });

    const isFollowing = await prisma.follow.findUnique({
      where: {
        follower_id_following_id: {
          follower_id: req.currentUser!.id,
          following_id: user.id,
        },
      },
    });

    return reply.send({ ...user, is_following: !!isFollowing });
  });

  app.patch('/me', { preHandler: authenticate }, async (req, reply) => {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const user = await prisma.user.update({
      where: { id: req.currentUser!.id },
      data: parsed.data,
      select: {
        id: true, username: true, display_name: true,
        bio: true, avatar_url: true, is_verified: true,
      },
    });
    return reply.send(user);
  });

  app.post('/:id/follow', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const currentId = req.currentUser!.id;

    if (id === currentId) return reply.status(400).send({ error: 'Cannot follow yourself' });

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return reply.status(404).send({ error: 'User not found' });

    const existing = await prisma.follow.findUnique({
      where: { follower_id_following_id: { follower_id: currentId, following_id: id } },
    });

    if (existing) {
      await prisma.$transaction([
        prisma.follow.delete({
          where: { follower_id_following_id: { follower_id: currentId, following_id: id } },
        }),
        prisma.user.update({ where: { id: currentId }, data: { following_count: { decrement: 1 } } }),
        prisma.user.update({ where: { id }, data: { follower_count: { decrement: 1 } } }),
      ]);
      return reply.send({ following: false });
    }

    await prisma.$transaction([
      prisma.follow.create({ data: { follower_id: currentId, following_id: id } }),
      prisma.user.update({ where: { id: currentId }, data: { following_count: { increment: 1 } } }),
      prisma.user.update({ where: { id }, data: { follower_count: { increment: 1 } } }),
    ]);

    await prisma.notification.create({
      data: {
        user_id: id,
        type: 'FOLLOW',
        title: 'New follower',
        body: `${(await prisma.user.findUnique({ where: { id: currentId }, select: { display_name: true } }))?.display_name} started following you`,
        data: { follower_id: currentId },
      },
    });

    return reply.send({ following: true });
  });

  app.get('/:id/followers', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { cursor, limit = '20' } = req.query as { cursor?: string; limit?: string };

    const follows = await prisma.follow.findMany({
      where: { following_id: id },
      take: parseInt(limit) + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        follower: {
          select: { id: true, username: true, display_name: true, avatar_url: true, is_verified: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const hasMore = follows.length > parseInt(limit);
    const items = hasMore ? follows.slice(0, -1) : follows;
    return reply.send({
      items: items.map((f) => f.follower),
      next_cursor: hasMore ? items[items.length - 1].id : null,
    });
  });

  app.delete('/me/account', { preHandler: authenticate }, async (req, reply) => {
    await prisma.user.delete({ where: { id: req.currentUser!.id } });
    await prisma.auditLog.create({
      data: { user_id: req.currentUser!.id, action: 'DELETE_ACCOUNT', entity: 'User' },
    });
    return reply.send({ success: true });
  });
}
