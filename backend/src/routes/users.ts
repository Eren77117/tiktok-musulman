import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';

// Only fields that exist in the User DB model
const updateProfileSchema = z.object({
  display_name: z.string().min(1).max(50).optional(),
  bio: z.string().max(300).optional().nullable(),
  avatar_url: z.string().optional().nullable(),
  cover_url: z.string().optional().nullable(),
  bio_links: z.array(z.string().url()).max(5).optional(),
  profile_category: z.string().max(50).optional().nullable(),
}).passthrough(); // allow extra keys from mobile settings

const USER_SELECT_PUBLIC = {
  id: true, username: true, display_name: true, bio: true,
  bio_links: true, profile_category: true,
  avatar_url: true, cover_url: true, is_verified: true, gender: true,
  follower_count: true, following_count: true, post_count: true,
  like_count: true, created_at: true,
} as const;

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
      select: USER_SELECT_PUBLIC,
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
    const { display_name, bio, avatar_url, cover_url, bio_links, profile_category } = parsed.data;
    const updateData: Record<string, unknown> = {};
    if (display_name !== undefined) updateData.display_name = display_name;
    if (bio !== undefined) updateData.bio = bio;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
    if (cover_url !== undefined) updateData.cover_url = cover_url;
    if (bio_links !== undefined) updateData.bio_links = bio_links;
    if (profile_category !== undefined) updateData.profile_category = profile_category;

    const ME_SELECT = {
      id: true, username: true, display_name: true, bio: true,
      bio_links: true, profile_category: true,
      avatar_url: true, cover_url: true, is_verified: true,
    } as const;

    if (Object.keys(updateData).length === 0) {
      // Nothing to update in DB (e.g. settings-only patch)
      const me = await prisma.user.findUnique({ where: { id: req.currentUser!.id }, select: ME_SELECT });
      return reply.send(me);
    }

    const user = await prisma.user.update({
      where: { id: req.currentUser!.id },
      data: updateData,
      select: ME_SELECT,
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

    const follower = await prisma.user.findUnique({ where: { id: currentId }, select: { username: true, display_name: true } });
    await prisma.notification.create({
      data: {
        user_id: id,
        type: 'FOLLOW',
        title: `@${follower?.username ?? 'quelqu\'un'} s'est abonné à vous`,
        body: follower?.display_name ? `${follower.display_name} s'est abonné à votre compte` : 'Quelqu\'un s\'est abonné à vous',
        data: { follower_id: currentId },
      },
    }).catch(() => {});

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

  app.get('/:id/following', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { cursor, limit = '20' } = req.query as { cursor?: string; limit?: string };

    const follows = await prisma.follow.findMany({
      where: { follower_id: id },
      take: parseInt(limit) + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        following: {
          select: { id: true, username: true, display_name: true, avatar_url: true, is_verified: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const hasMore = follows.length > parseInt(limit);
    const items = hasMore ? follows.slice(0, -1) : follows;
    return reply.send({
      items: items.map((f) => f.following),
      next_cursor: hasMore ? items[items.length - 1].id : null,
    });
  });

  // ── CREATOR STATS ────────────────────────────────────────────────────────────
  app.get('/me/stats', { preHandler: authenticate }, async (req, reply) => {
    const userId = req.currentUser!.id;
    const [posts, views] = await Promise.all([
      prisma.post.findMany({
        where: { user_id: userId },
        select: { id: true, caption: true, view_count: true, like_count: true, comment_count: true, share_count: true, thumbnail_url: true, created_at: true },
        orderBy: { view_count: 'desc' },
        take: 20,
      }),
      prisma.postView.aggregate({
        where: { post: { user_id: userId } },
        _count: { id: true },
        _sum: { watch_time_ms: true },
      }),
    ]);

    const completedViews = await prisma.postView.count({
      where: { post: { user_id: userId }, completed: true },
    });

    const totalViews = views._count.id;
    const completionRate = totalViews > 0 ? Math.round((completedViews / totalViews) * 100) : 0;
    const totalWatchMs = views._sum.watch_time_ms ?? 0;

    return reply.send({
      total_views: posts.reduce((s, p) => s + p.view_count, 0),
      total_likes: posts.reduce((s, p) => s + p.like_count, 0),
      total_comments: posts.reduce((s, p) => s + p.comment_count, 0),
      completion_rate: completionRate,
      total_watch_ms: totalWatchMs,
      top_posts: posts.slice(0, 10),
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

  // ADV-06 : suggested accounts (friends-of-friends + popular)
  app.get('/suggested', { preHandler: authenticate }, async (req, reply) => {
    const currentId = req.currentUser!.id;
    const { limit = '20' } = req.query as { limit?: string };
    const lim = Math.min(parseInt(limit), 50);

    // IDs already followed
    const following = await prisma.follow.findMany({
      where: { follower_id: currentId },
      select: { following_id: true },
    });
    const followingIds = new Set(following.map(f => f.following_id));
    followingIds.add(currentId);

    // Friends-of-friends
    const fof = await prisma.follow.findMany({
      where: { follower_id: { in: [...followingIds] }, following_id: { notIn: [...followingIds] } },
      select: { following_id: true },
      distinct: ['following_id'],
      take: lim,
    });
    const fofIds = fof.map(f => f.following_id);

    // Fill rest with popular accounts not followed
    const needed = lim - fofIds.length;
    const popular = needed > 0 ? await prisma.user.findMany({
      where: { id: { notIn: [...followingIds, ...fofIds] }, is_banned: false },
      orderBy: { follower_count: 'desc' },
      take: needed,
      select: { id: true, username: true, display_name: true, avatar_url: true, is_verified: true, follower_count: true },
    }) : [];

    const fofUsers = fofIds.length > 0 ? await prisma.user.findMany({
      where: { id: { in: fofIds } },
      select: { id: true, username: true, display_name: true, avatar_url: true, is_verified: true, follower_count: true },
    }) : [];

    return reply.send({ items: [...fofUsers, ...popular] });
  });

  // DEEP-03: similar accounts (shared followers + same category)
  app.get('/:id/similar', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const viewerId = req.currentUser!.id;

    // Find users who follow the target and are followed by viewer
    const targetFollowers = await prisma.follow.findMany({
      where: { following_id: id },
      select: { follower_id: true },
    });
    const targetFollowerIds = targetFollowers.map(f => f.follower_id);

    const viewerFollowing = await prisma.follow.findMany({
      where: { follower_id: viewerId },
      select: { following_id: true },
    });
    const viewerFollowingIds = new Set(viewerFollowing.map(f => f.following_id));
    viewerFollowingIds.add(viewerId);
    viewerFollowingIds.add(id);

    // Intersection = similar accounts
    const sharedFollowers = targetFollowerIds.filter(fid => !viewerFollowingIds.has(fid));
    const similar = sharedFollowers.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: sharedFollowers.slice(0, 8) }, is_banned: false },
          select: { id: true, username: true, display_name: true, avatar_url: true, is_verified: true, follower_count: true },
          orderBy: { follower_count: 'desc' },
          take: 8,
        })
      : await prisma.user.findMany({
          where: { id: { notIn: [...viewerFollowingIds] }, is_banned: false },
          orderBy: { follower_count: 'desc' },
          take: 8,
          select: { id: true, username: true, display_name: true, avatar_url: true, is_verified: true, follower_count: true },
        });

    return reply.send({ items: similar });
  });
}
