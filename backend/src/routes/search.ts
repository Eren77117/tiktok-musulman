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
      result.categories = await prisma.category.findMany({
        where: { name: { contains: q, mode: 'insensitive' } },
        take: lim,
        orderBy: { post_count: 'desc' },
      });
    }

    return reply.send(result);
  });

  app.get('/trending', { preHandler: authenticate }, async (req, reply) => {
    const [sounds, categories] = await Promise.all([
      prisma.sound.findMany({
        where: { is_trending: true },
        take: 10,
        orderBy: { use_count: 'desc' },
      }),
      prisma.category.findMany({
        take: 10,
        orderBy: { post_count: 'desc' },
      }),
    ]);
    return reply.send({ sounds, categories });
  });
}
