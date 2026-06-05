import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';

const createPostSchema = z.object({
  caption: z.string().max(500).optional(),
  video_url: z.string().min(1),
  thumbnail_url: z.string().optional(),
  duration: z.number().min(0),
  sound_id: z.string().uuid().optional(),
  category_ids: z.array(z.string().uuid()).optional(),
  is_public: z.boolean().default(true),
});

const POST_INCLUDE = {
  user: {
    select: { id: true, username: true, display_name: true, avatar_url: true, is_verified: true },
  },
  sound: { select: { id: true, title: true, artist: true, url: true } },
  post_categories: { include: { category: { select: { id: true, name: true, slug: true } } } },
} as const;

// TikTok-style engagement score with watch time
function engagementScore(post: {
  like_count: number;
  comment_count: number;
  share_count: number;
  view_count: number;
  created_at: Date;
  avg_watch_ms?: number;
  duration?: number;
}, categoryBoost = 1.0): number {
  const ageHours = (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60);
  const decayFactor = Math.pow(0.97, ageHours);

  // Watch time completion rate bonus (0 to 25 points)
  const durationMs = (post.duration ?? 15) * 1000;
  const completionRate = post.avg_watch_ms ? Math.min(post.avg_watch_ms / durationMs, 1) : 0;
  const watchBonus = completionRate * 25;

  const base =
    post.like_count * 10 +
    post.comment_count * 15 +
    post.share_count * 8 +
    Math.min(post.view_count, 10000) * 0.5 +
    watchBonus * Math.min(post.view_count, 1000);

  return base * decayFactor * categoryBoost;
}

async function getUserPreferredCategories(userId: string): Promise<Set<string>> {
  const recentLikes = await prisma.like.findMany({
    where: { user_id: userId, post_id: { not: null } },
    orderBy: { created_at: 'desc' },
    take: 50,
    include: {
      post: {
        include: { post_categories: { select: { category_id: true } } },
      },
    },
  });

  const cats = new Set<string>();
  for (const like of recentLikes) {
    like.post?.post_categories.forEach(pc => cats.add(pc.category_id));
  }
  return cats;
}

async function buildFeedItems(userId: string, seenIds: string[], poolSize = 80) {
  const preferredCats = await getUserPreferredCategories(userId);

  const posts = await prisma.post.findMany({
    where: {
      status: 'ACTIVE',
      is_public: true,
      video_url: { not: '' },
      NOT: seenIds.length > 0 ? { id: { in: seenIds } } : undefined,
    },
    take: poolSize,
    orderBy: { created_at: 'desc' },
    include: {
      ...POST_INCLUDE,
      _count: { select: { likes: true, comments: true } },
    },
  });

  const scored = posts.map(p => {
    const postCats = new Set(p.post_categories.map(pc => pc.category_id));
    const boost = preferredCats.size > 0 && [...postCats].some(c => preferredCats.has(c)) ? 1.5 : 1.0;
    return { post: p, score: engagementScore(p, boost) };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.post);
}

export async function postRoutes(app: FastifyInstance) {
  // ── FOLLOWING FEED ──────────────────────────────────────────────────
  app.get('/following', { preHandler: authenticate }, async (req, reply) => {
    const userId = req.currentUser!.id;
    const { cursor, limit = '10' } = req.query as { cursor?: string; limit?: string };
    const lim = Math.min(parseInt(limit), 20);

    const follows = await prisma.follow.findMany({
      where: { follower_id: userId },
      select: { following_id: true },
    });
    const ids = follows.map(f => f.following_id);
    if (ids.length === 0) return reply.send({ items: [], next_cursor: null });

    const posts = await prisma.post.findMany({
      where: {
        user_id: { in: ids },
        status: 'ACTIVE', is_public: true, video_url: { not: '' },
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      take: lim + 1,
      orderBy: { created_at: 'desc' },
      include: {
        ...POST_INCLUDE,
        _count: { select: { likes: true, comments: true } },
      },
    });

    const hasMore = posts.length > lim;
    const items = hasMore ? posts.slice(0, lim) : posts;

    const likedIds = await prisma.like.findMany({
      where: { user_id: userId, post_id: { in: items.map(p => p.id) } },
      select: { post_id: true },
    });
    const likedSet = new Set(likedIds.map(l => l.post_id));

    return reply.send({
      items: items.map(p => ({
        ...p, is_liked: likedSet.has(p.id),
        like_count: p.like_count, comment_count: p.comment_count,
      })),
      next_cursor: hasMore ? items[items.length - 1].id : null,
    });
  });

  // ── FEED (TikTok algorithm) ─────────────────────────────────────────
  app.get('/feed', { preHandler: authenticate }, async (req, reply) => {
    const { cursor, limit = '10', seen } = req.query as {
      cursor?: string; limit?: string; seen?: string;
    };
    const lim = Math.min(parseInt(limit), 20);
    const seenIds = seen ? seen.split(',').filter(Boolean) : [];

    const allScored = await buildFeedItems(req.currentUser!.id, seenIds);

    // Cursor: find index of cursor post, skip forward
    let startIdx = 0;
    if (cursor) {
      const idx = allScored.findIndex(p => p.id === cursor);
      startIdx = idx >= 0 ? idx + 1 : 0;
    }

    const page = allScored.slice(startIdx, startIdx + lim + 1);
    const hasMore = page.length > lim;
    const items = hasMore ? page.slice(0, lim) : page;

    const likedIds = await prisma.like.findMany({
      where: { user_id: req.currentUser!.id, post_id: { in: items.map(p => p.id) } },
      select: { post_id: true },
    });
    const likedSet = new Set(likedIds.map(l => l.post_id));

    const result = items.map(p => ({
      ...p,
      like_count: p.like_count,
      comment_count: p.comment_count,
      is_liked: likedSet.has(p.id),
      categories: p.post_categories.map(pc => pc.category),
      post_categories: undefined,
    }));

    return reply.send({ items: result, next_cursor: hasMore ? items[items.length - 1].id : null });
  });

  // ── TRENDING ────────────────────────────────────────────────────────
  app.get('/trending', { preHandler: authenticate }, async (req, reply) => {
    const { category, limit = '20' } = req.query as { category?: string; limit?: string };
    const lim = parseInt(limit);

    const where: Record<string, unknown> = { video_url: { not: '' } };

    if (category && category !== 'all') {
      const cat = await prisma.category.findFirst({ where: { slug: category } });
      if (cat) {
        where.post_categories = { some: { category_id: cat.id } };
      }
    }

    const posts = await prisma.post.findMany({
      where,
      take: lim * 3,
      orderBy: { created_at: 'desc' },
      include: {
        user: { select: { id: true, username: true, display_name: true } },
        post_categories: { include: { category: { select: { id: true, name: true, slug: true } } } },
      },
    });

    const scored = posts
      .map(p => ({ post: p, score: engagementScore(p) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, lim);

    return reply.send({
      items: scored.map(s => ({
        ...s.post,
        categories: s.post.post_categories.map(pc => pc.category),
        post_categories: undefined,
      })),
    });
  });

  // ── VIEW TRACKING + WATCH TIME ─────────────────────────────────────
  app.post('/:id/view', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { watch_time = 0, completed = false } = req.body as { watch_time?: number; completed?: boolean };
    const userId = req.currentUser!.id;

    await prisma.post.update({
      where: { id },
      data: { view_count: { increment: 1 } },
    }).catch(() => {});

    // Store watch time for personalization algo
    if (watch_time > 0) {
      await prisma.postView.upsert({
        where: { user_id_post_id: { user_id: userId, post_id: id } },
        create: { user_id: userId, post_id: id, watch_time_ms: Math.round(watch_time * 1000), completed },
        update: { watch_time_ms: { increment: Math.round(watch_time * 1000) }, completed: completed || undefined },
      }).catch(() => {});
    }

    return reply.send({ ok: true });
  });

  // ── CREATE POST ─────────────────────────────────────────────────────
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

  // ── GET ONE ─────────────────────────────────────────────────────────
  app.get('/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const post = await prisma.post.findUnique({
      where: { id, status: 'ACTIVE' },
      include: { ...POST_INCLUDE, _count: { select: { likes: true, comments: true } } },
    });
    if (!post) return reply.status(404).send({ error: 'Post not found' });

    await prisma.post.update({ where: { id }, data: { view_count: { increment: 1 } } });

    const isLiked = await prisma.like.findUnique({
      where: { user_id_post_id: { user_id: req.currentUser!.id, post_id: id } },
    });

    return reply.send({
      ...post,
      is_liked: !!isLiked,
      categories: post.post_categories.map(pc => pc.category),
      post_categories: undefined,
    });
  });

  // ── DELETE ──────────────────────────────────────────────────────────
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

  // ── LIKE / UNLIKE ───────────────────────────────────────────────────
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
          title: 'Nouveau like',
          body: 'Quelqu\'un a aimé votre publication',
          data: { post_id: id, liker_id: userId },
        },
      });
    }

    return reply.send({ liked: true });
  });

  // ── LIKED POSTS ─────────────────────────────────────────────────────
  app.get('/liked', { preHandler: authenticate }, async (req, reply) => {
    const userId = req.currentUser!.id;
    const { cursor, limit = '12' } = req.query as { cursor?: string; limit?: string };

    // Only real video posts (exclude threads: video_url != '')
    const likes = await prisma.like.findMany({
      where: {
        user_id: userId,
        post_id: { not: null },
        post: { video_url: { not: '' }, status: 'ACTIVE' },
      },
      take: parseInt(limit) + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { created_at: 'desc' },
      include: {
        post: {
          select: { id: true, thumbnail_url: true, video_url: true, view_count: true, like_count: true },
        },
      },
    });

    const hasMore = likes.length > parseInt(limit);
    const items = hasMore ? likes.slice(0, -1) : likes;
    return reply.send({
      items: items.map((l) => l.post).filter(Boolean),
      next_cursor: hasMore ? items[items.length - 1].id : null,
    });
  });

  // ── USER POSTS ──────────────────────────────────────────────────────
  app.get('/user/:userId', { preHandler: authenticate }, async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const { cursor, limit = '12' } = req.query as { cursor?: string; limit?: string };

    const posts = await prisma.post.findMany({
      where: { user_id: userId, status: 'ACTIVE', is_public: true, video_url: { not: '' } },
      take: parseInt(limit) + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { created_at: 'desc' },
      select: {
        id: true, thumbnail_url: true, video_url: true, view_count: true,
        like_count: true, comment_count: true, created_at: true,
      },
    });

    const hasMore = posts.length > parseInt(limit);
    const items = hasMore ? posts.slice(0, -1) : posts;
    return reply.send({ items, next_cursor: hasMore ? items[items.length - 1].id : null });
  });
}
