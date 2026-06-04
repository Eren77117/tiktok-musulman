import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';

// Only fields that exist in the User DB model
const updateProfileSchema = z.object({
  display_name: z.string().min(1).max(50).optional(),
  bio: z.string().max(300).optional().nullable(),
  avatar_url: z.string().optional().nullable(),
}).passthrough(); // allow extra keys from mobile settings

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
        avatar_url: true, is_verified: true, gender: true,
        follower_count: true, following_count: true, post_count: true,
        like_count: true, created_at: true,
      },
    });
    if (!user) return reply.status(404).send({ error: 'User not found' });

    const [isFollowing, activeLive] = await Promise.all([
      prisma.follow.findUnique({
        where: { follower_id_following_id: { follower_id: req.currentUser!.id, following_id: user.id } },
      }),
      prisma.liveSession.findFirst({
        where: { user_id: user.id, is_active: true },
        select: { id: true },
      }),
    ]);

    return reply.send({ ...user, is_following: !!isFollowing, active_live_session_id: activeLive?.id ?? null });
  });

  app.patch('/me', { preHandler: authenticate }, async (req, reply) => {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    // Only update fields that exist in User model
    const { display_name, bio, avatar_url } = parsed.data;
    const updateData: Record<string, unknown> = {};
    if (display_name !== undefined) updateData.display_name = display_name;
    if (bio !== undefined) updateData.bio = bio;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;

    if (Object.keys(updateData).length === 0) {
      // Nothing to update in DB (e.g. settings-only patch)
      const me = await prisma.user.findUnique({ where: { id: req.currentUser!.id }, select: { id: true, username: true, display_name: true, bio: true, avatar_url: true, is_verified: true } });
      return reply.send(me);
    }

    const user = await prisma.user.update({
      where: { id: req.currentUser!.id },
      data: updateData,
      select: { id: true, username: true, display_name: true, bio: true, avatar_url: true, is_verified: true },
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

  // ── BLOCK / UNBLOCK ─────────────────────────────────────────────────────────
  app.post('/:id/block', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const blockerId = req.currentUser!.id;
    if (id === blockerId) return reply.status(400).send({ error: 'Cannot block yourself' });

    const existing = await prisma.blockedUser.findUnique({
      where: { blocker_id_blocked_id: { blocker_id: blockerId, blocked_id: id } },
    });
    if (existing) {
      await prisma.blockedUser.delete({ where: { blocker_id_blocked_id: { blocker_id: blockerId, blocked_id: id } } });
      return reply.send({ blocked: false });
    }
    await prisma.blockedUser.create({ data: { blocker_id: blockerId, blocked_id: id } });
    return reply.send({ blocked: true });
  });

  // ── HIDE FROM FEED ───────────────────────────────────────────────────────────
  app.post('/:id/hide', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = req.currentUser!.id;
    await prisma.hiddenUser.upsert({
      where: { user_id_hidden_id: { user_id: userId, hidden_id: id } },
      create: { user_id: userId, hidden_id: id },
      update: {},
    });
    return reply.send({ hidden: true });
  });

  // ── REPORTS ──────────────────────────────────────────────────────────────────
  app.post('/reports', { preHandler: authenticate }, async (req, reply) => {
    const { target_type, target_id, reason } = req.body as { target_type: string; target_id: string; reason: string };
    if (!target_type || !target_id || !reason) return reply.status(400).send({ error: 'Champs manquants' });

    await prisma.report.create({
      data: {
        reporter_id: req.currentUser!.id,
        [target_type === 'user' ? 'reported_user_id' : 'post_id']: target_id,
        reason,
      },
    }).catch(() => {});
    return reply.send({ success: true });
  });

  app.delete('/me/account', { preHandler: authenticate }, async (req, reply) => {
    await prisma.user.delete({ where: { id: req.currentUser!.id } });
    await prisma.auditLog.create({
      data: { user_id: req.currentUser!.id, action: 'DELETE_ACCOUNT', entity: 'User' },
    });
    return reply.send({ success: true });
  });
}
