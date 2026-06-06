import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';

export async function searchRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: authenticate }, async (req, reply) => {
    const { q, type = 'all', cursor, limit = '20' } = req.query as {
      q: string;
      type?: 'all' | 'users' | 'posts' | 'categories';
      cursor?: string;
      limit?: string;
    };

    if (!q || q.trim().length < 1) {
      return reply.status(400).send({ error: 'Query required' });
    }

    const lim = parseInt(limit);
    const result: Record<string, unknown> = {};

    if (type === 'all' || type === 'users') {
      result.users = await prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: q, mode: 'insensitive' } },
            { display_name: { contains: q, mode: 'insensitive' } },
          ],
          is_banned: false,
        },
        take: lim,
        select: {
          id: true, username: true, display_name: true,
          avatar_url: true, is_verified: true, follower_count: true,
        },
      });
    }

    if (type === 'all' || type === 'posts') {
      result.posts = await prisma.post.findMany({
        where: {
          caption: { contains: q, mode: 'insensitive' },
          status: 'ACTIVE',
          is_public: true,
        },
        take: lim,
        include: {
          user: { select: { id: true, username: true, display_name: true, avatar_url: true } },
          _count: { select: { likes: true } },
        },
        orderBy: { like_count: 'desc' },
      });
    }

    if (type === 'all' || type === 'categories') {
      const cats = await prisma.category.findMany({
        where: { name: { contains: q, mode: 'insensitive' } },
        take: lim,
        orderBy: { post_count: 'desc' },
      });
      result.categories = cats;
      result.hashtags = cats.map((c) => ({ tag: c.name, count: c.post_count ?? 0 }));
    }

    return reply.send(result);
  });

  app.get('/suggestions', { preHandler: authenticate }, async (req, reply) => {
    const { q } = req.query as { q?: string };
    if (!q || q.trim().length < 2) return reply.send({ users: [], hashtags: [] });

    const [users, hashtags] = await Promise.all([
      prisma.user.findMany({
        where: {
          OR: [{ username: { startsWith: q, mode: 'insensitive' } }, { display_name: { contains: q, mode: 'insensitive' } }],
          is_banned: false,
        },
        take: 5,
        orderBy: { follower_count: 'desc' },
        select: { id: true, username: true, display_name: true, avatar_url: true, is_verified: true },
      }),
      prisma.category.findMany({
        where: { name: { contains: q, mode: 'insensitive' } },
        take: 5,
        orderBy: { post_count: 'desc' },
        select: { name: true, post_count: true, slug: true },
      }),
    ]);
    return reply.send({ users, hashtags: hashtags.map(h => ({ tag: h.name, slug: h.slug, count: h.post_count })) });
  });

  app.get('/trending', { preHandler: authenticate }, async (req, reply) => {
    const [trendingUsers, categories] = await Promise.all([
      prisma.user.findMany({
        where: { is_banned: false },
        take: 10,
        orderBy: { follower_count: 'desc' },
        select: { id: true, username: true, display_name: true, avatar_url: true, is_verified: true, follower_count: true },
      }),
      prisma.category.findMany({
        take: 15,
        orderBy: { post_count: 'desc' },
      }),
    ]);
    return reply.send({
      users: trendingUsers,
      hashtags: categories.map((c) => ({ tag: c.name, count: c.post_count ?? 0 })),
    });
  });
}
