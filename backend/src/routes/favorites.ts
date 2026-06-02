import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';

export async function favoriteRoutes(app: FastifyInstance) {
  app.post('/posts/:postId', { preHandler: authenticate }, async (req, reply) => {
    const { postId } = req.params as { postId: string };
    const userId = req.currentUser!.id;

    const existing = await prisma.favorite.findUnique({
      where: { user_id_post_id: { user_id: userId, post_id: postId } },
    });

    if (existing) {
      await prisma.favorite.delete({
        where: { user_id_post_id: { user_id: userId, post_id: postId } },
      });
      return reply.send({ saved: false });
    }

    await prisma.favorite.create({ data: { user_id: userId, post_id: postId } });
    return reply.send({ saved: true });
  });

  app.get('/', { preHandler: authenticate }, async (req, reply) => {
    const { cursor, limit = '12' } = req.query as { cursor?: string; limit?: string };

    const favorites = await prisma.favorite.findMany({
      where: { user_id: req.currentUser!.id },
      take: parseInt(limit) + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { created_at: 'desc' },
      include: {
        post: {
          include: {
            user: { select: { id: true, username: true, display_name: true, avatar_url: true } },
          },
        },
      },
    });

    const hasMore = favorites.length > parseInt(limit);
    const items = hasMore ? favorites.slice(0, -1) : favorites;
    return reply.send({ items: items.map((f) => f.post), next_cursor: hasMore ? items[items.length - 1].id : null });
  });
}
