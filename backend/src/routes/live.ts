import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';

const startLiveSchema = z.object({ title: z.string().min(1).max(100) });

export async function liveRoutes(app: FastifyInstance) {
  app.post('/start', { preHandler: authenticate }, async (req, reply) => {
    const parsed = startLiveSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    await prisma.liveSession.updateMany({
      where: { user_id: req.currentUser!.id, is_active: true },
      data: { is_active: false, ended_at: new Date() },
    });

    const session = await prisma.liveSession.create({
      data: { user_id: req.currentUser!.id, title: parsed.data.title },
    });

    return reply.status(201).send(session);
  });

  app.post('/:id/end', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = await prisma.liveSession.findUnique({ where: { id } });
    if (!session || session.user_id !== req.currentUser!.id) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    await prisma.liveSession.update({
      where: { id },
      data: { is_active: false, ended_at: new Date() },
    });
    return reply.send({ success: true });
  });

  app.get('/active', { preHandler: authenticate }, async (req, reply) => {
    const { cursor, limit = '10' } = req.query as { cursor?: string; limit?: string };
    const sessions = await prisma.liveSession.findMany({
      where: { is_active: true },
      take: parseInt(limit) + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        user: { select: { id: true, username: true, display_name: true, avatar_url: true, is_verified: true } },
      },
      orderBy: { viewer_count: 'desc' },
    });

    const hasMore = sessions.length > parseInt(limit);
    const items = hasMore ? sessions.slice(0, -1) : sessions;
    return reply.send({ items, next_cursor: hasMore ? items[items.length - 1].id : null });
  });
}
