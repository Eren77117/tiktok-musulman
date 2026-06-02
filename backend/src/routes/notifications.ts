import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';

export async function notificationRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: authenticate }, async (req, reply) => {
    const { cursor, limit = '20' } = req.query as { cursor?: string; limit?: string };

    const notifications = await prisma.notification.findMany({
      where: { user_id: req.currentUser!.id },
      take: parseInt(limit) + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { created_at: 'desc' },
    });

    const hasMore = notifications.length > parseInt(limit);
    const items = hasMore ? notifications.slice(0, -1) : notifications;
    return reply.send({ items, next_cursor: hasMore ? items[items.length - 1].id : null });
  });

  app.patch('/read-all', { preHandler: authenticate }, async (req, reply) => {
    await prisma.notification.updateMany({
      where: { user_id: req.currentUser!.id, is_read: false },
      data: { is_read: true },
    });
    return reply.send({ success: true });
  });

  app.patch('/:id/read', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.notification.updateMany({
      where: { id, user_id: req.currentUser!.id },
      data: { is_read: true },
    });
    return reply.send({ success: true });
  });

  app.get('/unread-count', { preHandler: authenticate }, async (req, reply) => {
    const count = await prisma.notification.count({
      where: { user_id: req.currentUser!.id, is_read: false },
    });
    return reply.send({ count });
  });
}
