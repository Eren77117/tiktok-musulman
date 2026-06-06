import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';

interface AnalyticsEvent {
  post_id: string;
  watch_time: number;
  watch_percent: number;
  rewatch_count: number;
  was_skipped: boolean;
  liked: boolean;
  commented: boolean;
  shared: boolean;
  saved: boolean;
  session_id?: string;
}

export async function analyticsRoutes(app: FastifyInstance) {
  app.post('/batch', { preHandler: [authenticate] }, async (req, reply) => {
    const userId = (req as any).userId as string;
    const { events } = req.body as { events: AnalyticsEvent[] };

    if (!Array.isArray(events) || events.length === 0) {
      return reply.code(400).send({ error: 'events array required' });
    }

    const capped = events.slice(0, 100);

    await prisma.userVideoAnalytics.createMany({
      data: capped.map(e => ({
        user_id: userId,
        post_id: e.post_id,
        watch_time: e.watch_time ?? 0,
        watch_percent: e.watch_percent ?? 0,
        rewatch_count: e.rewatch_count ?? 0,
        was_skipped: e.was_skipped ?? false,
        liked: e.liked ?? false,
        commented: e.commented ?? false,
        shared: e.shared ?? false,
        saved: e.saved ?? false,
        session_id: e.session_id ?? null,
      })),
    });

    return reply.code(204).send();
  });
}
