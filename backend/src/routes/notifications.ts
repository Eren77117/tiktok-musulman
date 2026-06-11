import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { NotificationType } from '@prisma/client';

export async function notificationRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: authenticate }, async (req, reply) => {
    const { cursor, limit = '20', tab } = req.query as {
      cursor?: string; limit?: string; tab?: string;
    };

    // tab filter: 'likes' | 'comments' | 'follows' | undefined (all)
    let typeFilter: NotificationType[] | undefined;
    if (tab === 'likes')    typeFilter = [NotificationType.LIKE];
    if (tab === 'comments') typeFilter = [NotificationType.COMMENT, NotificationType.MENTION];
    if (tab === 'follows')  typeFilter = [NotificationType.FOLLOW];

    const notifications = await prisma.notification.findMany({
      where: {
        user_id: req.currentUser!.id,
        ...(typeFilter ? { type: { in: typeFilter } } : {}),
      },
      take: parseInt(limit) + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { created_at: 'desc' },
    });

    const hasMore = notifications.length > parseInt(limit);
    const raw = hasMore ? notifications.slice(0, -1) : notifications;

    // Group consecutive LIKE notifications for the same post
    const grouped: typeof raw = [];
    for (const n of raw) {
      if (n.type !== 'LIKE') { grouped.push(n); continue; }
      const postId = (n.data as any)?.post_id;
      if (!postId) { grouped.push(n); continue; }
      const existing = grouped.find(
        g => g.type === 'LIKE' && (g.data as any)?.post_id === postId && !g.is_read
      );
      if (existing) {
        // Merge: update title to show count
        const count = ((existing.data as any)._group_count ?? 1) + 1;
        (existing.data as any)._group_count = count;
        const names = (existing.data as any)._group_names ?? [(existing.data as any).liker_name];
        const newName = (n.data as any).liker_name;
        if (newName && !names.includes(newName)) names.push(newName);
        (existing.data as any)._group_names = names;
        existing.title = names.length >= 2
          ? `@${names[0]} et ${count - 1} autre${count - 1 > 1 ? 's' : ''} ont aimé votre vidéo`
          : existing.title;
      } else {
        (n.data as any)._group_count = 1;
        grouped.push(n);
      }
    }

    return reply.send({ items: grouped, next_cursor: hasMore ? raw[raw.length - 1].id : null });
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
