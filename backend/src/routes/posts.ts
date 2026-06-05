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

interface UserPreferences {
  categoryWeights: Map<string, number>;   // catId → score
  creatorAffinity: Map<string, number>;   // userId → score
  followingSet: Set<string>;              // followed creator IDs
  blockedSet: Set<string>;                // blocked user IDs
  hiddenSet: Set<string>;                 // hidden user IDs
}

async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const [likes, watches, comments, favorites, follows, blocked, hidden] = await Promise.all([
    // Likes — signal fort (50 derniers)
    prisma.like.findMany({
      where: { user_id: userId, post_id: { not: null } },
      orderBy: { created_at: 'desc' },
      take: 50,
      include: { post: { include: { post_categories: { select: { category_id: true } } } } },
    }),
    // Watch time — signal fort (vidéos regardées à >60%)
    prisma.postView.findMany({
      where: { user_id: userId, completed: true },
      orderBy: { updated_at: 'desc' },
      take: 100,
      include: { post: { include: { post_categories: { select: { category_id: true } }, user: { select: { id: true } } } } },
    }),
    // Commentaires — signal très fort
    prisma.comment.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 30,
      include: { post: { include: { post_categories: { select: { category_id: true } }, user: { select: { id: true } } } } },
    }),
    // Favoris — signal fort
    prisma.favorite.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 30,
      include: { post: { include: { post_categories: { select: { category_id: true } }, user: { select: { id: true } } } } },
    }),
    // Suivis
    prisma.follow.findMany({ where: { follower_id: userId }, select: { following_id: true } }),
    // Bloqués
    prisma.blockedUser.findMany({ where: { blocker_id: userId }, select: { blocked_id: true } }),
    // Cachés
    prisma.hiddenUser.findMany({ where: { user_id: userId }, select: { hidden_id: true } }),
  ]);

  const categoryWeights = new Map<string, number>();
  const creatorAffinity = new Map<string, number>();

  const addCatWeight = (catIds: string[], weight: number) => {
    for (const cid of catIds) {
      categoryWeights.set(cid, (categoryWeights.get(cid) ?? 0) + weight);
    }
  };
  const addCreatorAffinity = (creatorId: string, weight: number) => {
    creatorAffinity.set(creatorId, (creatorAffinity.get(creatorId) ?? 0) + weight);
  };

  // Poids par signal
  for (const like of likes) {
    const cats = like.post?.post_categories.map((pc: { category_id: string }) => pc.category_id) ?? [];
    addCatWeight(cats, 1.0);
    if (like.post?.user_id) addCreatorAffinity(like.post.user_id, 0.8);
  }
  for (const view of watches) {
    const cats = view.post?.post_categories.map((pc: { category_id: string }) => pc.category_id) ?? [];
    addCatWeight(cats, 0.8);
    if (view.post?.user?.id) addCreatorAffinity(view.post.user.id, 0.5);
  }
  for (const comment of comments) {
    const cats = comment.post?.post_categories.map((pc: { category_id: string }) => pc.category_id) ?? [];
    addCatWeight(cats, 2.0);
    if (comment.post?.user?.id) addCreatorAffinity(comment.post.user.id, 1.5);
  }
  for (const fav of favorites) {
    const cats = fav.post?.post_categories.map((pc: { category_id: string }) => pc.category_id) ?? [];
    addCatWeight(cats, 1.5);
    if (fav.post?.user?.id) addCreatorAffinity(fav.post.user.id, 1.2);
  }

  return {
    categoryWeights,
    creatorAffinity,
    followingSet: new Set(follows.map((f: { following_id: string }) => f.following_id)),
    blockedSet: new Set(blocked.map((b: { blocked_id: string }) => b.blocked_id)),
    hiddenSet: new Set(hidden.map((h: { hidden_id: string }) => h.hidden_id)),
  };
}

async function buildFeedItems(userId: string, seenIds: string[], poolSize = 120) {
  const prefs = await getUserPreferences(userId);

  // Exclure bloqués, cachés, et déjà vus
  const excludedUserIds = [...prefs.blockedSet, ...prefs.hiddenSet];

  const posts = await prisma.post.findMany({
    where: {
      video_url: { not: '' },
      NOT: [
        ...(seenIds.length > 0 ? [{ id: { in: seenIds } }] : []),
        { not_interested: { some: { user_id: userId } } },
      ],
      ...(excludedUserIds.length > 0 ? { user_id: { notIn: excludedUserIds } } : {}),
    },
    take: poolSize,
    orderBy: { created_at: 'desc' },
    include: {
      ...POST_INCLUDE,
      _count: { select: { likes: true, comments: true } },
    },
  });

  // Score chaque post avec les préférences personnalisées
  const maxCatWeight = Math.max(...prefs.categoryWeights.values(), 1);
  const maxCreatorAffinity = Math.max(...prefs.creatorAffinity.values(), 1);

  const scored = posts.map((p: any) => {
    const postCats = p.post_categories.map((pc: { category_id: string }) => pc.category_id);

    // Boost catégorie (0 → 1.8)
    const catScore = postCats.reduce((sum: number, cid: string) => sum + (prefs.categoryWeights.get(cid) ?? 0), 0);
    const catBoost = 1.0 + (catScore / maxCatWeight) * 0.8;

    // Boost créateur affinité (0 → 1.5)
    const affinity = prefs.creatorAffinity.get(p.user_id) ?? 0;
    const affinityBoost = 1.0 + (affinity / maxCreatorAffinity) * 0.5;

    // Boost suivi (×1.3 si le créateur est suivi)
    const followBoost = prefs.followingSet.has(p.user_id) ? 1.3 : 1.0;

    const totalBoost = catBoost * affinityBoost * followBoost;
    return { post: p, score: engagementScore(p, totalBoost) };
  });

  scored.sort((a, b) => b.score - a.score);

  // Diversité : max 2 posts du même créateur par page
  const creatorCount = new Map<string, number>();
  const diversified: typeof scored = [];
  const overflow: typeof scored = [];

  for (const item of scored) {
    const count = creatorCount.get(item.post.user_id) ?? 0;
    if (count < 2) {
      diversified.push(item);
      creatorCount.set(item.post.user_id, count + 1);
    } else {
      overflow.push(item);
    }
  }

  // Compléter avec l'overflow si pas assez de posts variés
  const final = [...diversified, ...overflow];
  return final.map(s => s.post);
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
        video_url: { not: '' },
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

    const [likedIds, savedIds] = await Promise.all([
      prisma.like.findMany({
        where: { user_id: userId, post_id: { in: items.map(p => p.id) } },
        select: { post_id: true },
      }),
      prisma.favorite.findMany({
        where: { user_id: userId, post_id: { in: items.map(p => p.id) } },
        select: { post_id: true },
      }),
    ]);
    const likedSet = new Set(likedIds.map(l => l.post_id));
    const savedSet = new Set(savedIds.map(s => s.post_id));

    return reply.send({
      items: items.map(p => ({
        ...p, is_liked: likedSet.has(p.id), is_saved: savedSet.has(p.id),
        like_count: p.like_count, comment_count: p.comment_count,
        user: { ...p.user, is_following: true },
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

    const userIds = [...new Set(items.map(p => p.user.id))];
    const [likedIds, savedIds, followedIds] = await Promise.all([
      prisma.like.findMany({
        where: { user_id: req.currentUser!.id, post_id: { in: items.map(p => p.id) } },
        select: { post_id: true },
      }),
      prisma.favorite.findMany({
        where: { user_id: req.currentUser!.id, post_id: { in: items.map(p => p.id) } },
        select: { post_id: true },
      }),
      prisma.follow.findMany({
        where: { follower_id: req.currentUser!.id, following_id: { in: userIds } },
        select: { following_id: true },
      }),
    ]);
    const likedSet = new Set(likedIds.map(l => l.post_id));
    const savedSet = new Set(savedIds.map(s => s.post_id));
    const followedSet = new Set(followedIds.map(f => f.following_id));

    const result = items.map(p => ({
      ...p,
      like_count: p.like_count,
      comment_count: p.comment_count,
      is_liked: likedSet.has(p.id),
      is_saved: savedSet.has(p.id),
      categories: p.post_categories.map(pc => pc.category),
      post_categories: undefined,
      user: { ...p.user, is_following: followedSet.has(p.user.id) },
    }));

    return reply.send({ items: result, next_cursor: hasMore ? items[items.length - 1].id : null });
  });

  // ── TRENDING ────────────────────────────────────────────────────────
  app.get('/trending', { preHandler: authenticate }, async (req, reply) => {
    const { category, limit = '10', cursor } = req.query as { category?: string; limit?: string; cursor?: string };
    const lim = parseInt(limit);
    const userId = req.currentUser!.id;

    const where: Record<string, unknown> = {
      video_url: { not: '' }, status: 'ACTIVE', is_public: true,
      NOT: { not_interested: { some: { user_id: userId } } },
    };

    if (category && category !== 'all') {
      const cat = await prisma.category.findFirst({ where: { slug: category } });
      if (cat) where.post_categories = { some: { category_id: cat.id } };
    }

    const posts = await prisma.post.findMany({
      where,
      take: lim * 5,
      orderBy: { view_count: 'desc' },
      include: { ...POST_INCLUDE, _count: { select: { likes: true, comments: true } } },
    });

    const scored = posts
      .map(p => ({ post: p, score: engagementScore(p) }))
      .sort((a, b) => b.score - a.score);

    // Apply cursor-based pagination on scored list
    let startIdx = 0;
    if (cursor) {
      const idx = scored.findIndex(s => s.post.id === cursor);
      startIdx = idx >= 0 ? idx + 1 : 0;
    }
    const page = scored.slice(startIdx, startIdx + lim + 1);
    const hasMore = page.length > lim;
    const items = hasMore ? page.slice(0, lim) : page;

    const itemPosts = items.map(s => s.post);
    const userIds = [...new Set(itemPosts.map(p => p.user.id))];
    const [likedIds, savedIds, followedIds, activeStories] = await Promise.all([
      prisma.like.findMany({ where: { user_id: userId, post_id: { in: itemPosts.map(p => p.id) } }, select: { post_id: true } }),
      prisma.favorite.findMany({ where: { user_id: userId, post_id: { in: itemPosts.map(p => p.id) } }, select: { post_id: true } }),
      prisma.follow.findMany({ where: { follower_id: userId, following_id: { in: userIds } }, select: { following_id: true } }),
      prisma.story.findMany({ where: { user_id: { in: userIds }, expires_at: { gt: new Date() }, archived: false }, select: { user_id: true } }),
    ]);
    const likedSet = new Set(likedIds.map(l => l.post_id));
    const savedSet = new Set(savedIds.map(s => s.post_id));
    const followedSet = new Set(followedIds.map(f => f.following_id));
    const storyUserSet = new Set(activeStories.map(s => s.user_id));

    return reply.send({
      items: itemPosts.map(p => ({
        ...p,
        is_liked: likedSet.has(p.id),
        is_saved: savedSet.has(p.id),
        categories: p.post_categories.map(pc => pc.category),
        post_categories: undefined,
        user: { ...p.user, is_following: followedSet.has(p.user.id), has_story: storyUserSet.has(p.user.id) },
      })),
      next_cursor: hasMore ? items[items.length - 1].post.id : null,
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

    const [isLiked, isSaved] = await Promise.all([
      prisma.like.findUnique({
        where: { user_id_post_id: { user_id: req.currentUser!.id, post_id: id } },
      }),
      prisma.favorite.findUnique({
        where: { user_id_post_id: { user_id: req.currentUser!.id, post_id: id } },
      }),
    ]);

    return reply.send({
      ...post,
      is_liked: !!isLiked,
      is_saved: !!isSaved,
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
      const liker = await prisma.user.findUnique({ where: { id: userId }, select: { username: true, display_name: true } });
      await prisma.notification.create({
        data: {
          user_id: post.user_id,
          type: 'LIKE',
          title: `@${liker?.username ?? 'quelqu\'un'} a aimé votre vidéo`,
          body: liker?.display_name ? `${liker.display_name} a aimé votre publication` : 'Quelqu\'un a aimé votre publication',
          data: { post_id: id, liker_id: userId },
        },
      }).catch(() => {});
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
        post: { video_url: { not: '' } },
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

  // ── HASHTAG POSTS ──────────────────────────────────────────────────────
  app.get('/hashtag/:tag', { preHandler: authenticate }, async (req, reply) => {
    const { tag } = req.params as { tag: string };
    const { cursor, limit = '18' } = req.query as { cursor?: string; limit?: string };
    const lim = parseInt(limit);

    const category = await prisma.category.findFirst({ where: { name: { equals: tag, mode: 'insensitive' } } });
    const categoryId = category?.id;

    const where = categoryId
      ? { status: 'ACTIVE' as const, is_public: true, post_categories: { some: { category_id: categoryId } } }
      : { status: 'ACTIVE' as const, is_public: true, caption: { contains: `#${tag}`, mode: 'insensitive' as const } };

    const posts = await prisma.post.findMany({
      where,
      take: lim + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { view_count: 'desc' },
      select: {
        id: true, thumbnail_url: true, video_url: true,
        view_count: true, like_count: true, comment_count: true, caption: true,
        user: { select: { id: true, username: true, display_name: true, avatar_url: true } },
      },
    });

    const hasMore = posts.length > lim;
    const items = hasMore ? posts.slice(0, -1) : posts;
    return reply.send({ items, total: category?.post_count ?? items.length, next_cursor: hasMore ? items[items.length - 1].id : null });
  });

  // ── USER POSTS ──────────────────────────────────────────────────────
  app.get('/user/:userId', { preHandler: authenticate }, async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const { cursor, limit = '12' } = req.query as { cursor?: string; limit?: string };

    const posts = await prisma.post.findMany({
      where: { user_id: userId, video_url: { not: '' } },
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

  // ── REPOST ──────────────────────────────────────────────────────────
  app.post('/:id/repost', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = req.currentUser!.id;
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) return reply.status(404).send({ error: 'Not found' });

    const existing = await prisma.repost.findUnique({ where: { user_id_post_id: { user_id: userId, post_id: id } } });
    if (existing) {
      await prisma.repost.delete({ where: { id: existing.id } });
      await prisma.post.update({ where: { id }, data: { share_count: { decrement: 1 } } });
      return reply.send({ reposted: false });
    }
    await prisma.repost.create({ data: { user_id: userId, post_id: id } });
    await prisma.post.update({ where: { id }, data: { share_count: { increment: 1 } } });
    return reply.send({ reposted: true });
  });

  app.get('/user/:userId/reposts', { preHandler: authenticate }, async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const { cursor, limit = '12' } = req.query as { cursor?: string; limit?: string };
    const reposts = await prisma.repost.findMany({
      where: { user_id: userId },
      take: parseInt(limit) + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { created_at: 'desc' },
      include: {
        post: {
          select: { id: true, thumbnail_url: true, video_url: true, view_count: true, like_count: true, comment_count: true },
        },
        user: { select: { id: true, username: true, display_name: true, avatar_url: true } },
      },
    });
    const hasMore = reposts.length > parseInt(limit);
    const items = hasMore ? reposts.slice(0, -1) : reposts;
    return reply.send({ items, next_cursor: hasMore ? items[items.length - 1].id : null });
  });

  // ── NOT INTERESTED ──────────────────────────────────────────────────
  app.post('/:id/not-interested', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = req.currentUser!.id;
    await prisma.notInterested.upsert({
      where: { user_id_post_id: { user_id: userId, post_id: id } },
      create: { user_id: userId, post_id: id },
      update: {},
    });
    return reply.send({ success: true });
  });

  // ── SHARE CONTACTS ──────────────────────────────────────────────────
  app.get('/share-contacts', { preHandler: authenticate }, async (req, reply) => {
    const userId = req.currentUser!.id;
    const requests = await prisma.conversationRequest.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requester_id: userId }, { recipient_id: userId }],
      },
      orderBy: { updated_at: 'desc' },
      take: 20,
      include: {
        requester: { select: { id: true, username: true, display_name: true, avatar_url: true } },
        recipient: { select: { id: true, username: true, display_name: true, avatar_url: true } },
        conversation: { select: { id: true } },
      },
    });
    const contacts = requests.map(r => {
      const other = r.requester_id === userId ? r.recipient : r.requester;
      return { ...other, conversation_id: r.conversation?.id ?? null };
    });
    return reply.send({ items: contacts });
  });
}
