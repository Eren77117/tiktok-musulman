import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';

const createSeriesSchema = z.object({
  title: z.string().min(1).max(80),
  description: z.string().max(300).optional(),
  thumbnail_url: z.string().url().optional(),
});

const addEpisodeSchema = z.object({
  post_id: z.string(),
  episode_num: z.number().int().min(1),
});

export async function seriesRoutes(app: FastifyInstance) {
  // List user's series
  app.get('/user/:userId', { preHandler: [authenticate] }, async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const series = await prisma.series.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      include: { _count: { select: { episodes: true } } },
    });
    return reply.send({ items: series.map((s: typeof series[number]) => ({ ...s, episode_count: s._count.episodes })) });
  });

  // Get single series with episodes
  app.get('/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const series = await prisma.series.findUnique({
      where: { id },
      include: {
        episodes: {
          orderBy: { episode_num: 'asc' },
          include: {
            post: {
              select: {
                id: true, video_url: true, thumbnail_url: true, caption: true,
                duration: true, view_count: true, like_count: true,
                user: { select: { id: true, username: true, display_name: true, avatar_url: true } },
              },
            },
          },
        },
      },
    });
    if (!series) return reply.code(404).send({ error: 'Série introuvable' });
    return reply.send(series);
  });

  // Create series
  app.post('/', { preHandler: [authenticate] }, async (req, reply) => {
    const userId = req.currentUser!.id;
    const parsed = createSeriesSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const series = await prisma.series.create({
      data: { user_id: userId, ...parsed.data },
    });
    return reply.code(201).send(series);
  });

  // Add episode to series
  app.post('/:id/episodes', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = req.currentUser!.id;
    const parsed = addEpisodeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const series = await prisma.series.findUnique({ where: { id } });
    if (!series || series.user_id !== userId) return reply.code(403).send({ error: 'Interdit' });

    const [episode] = await prisma.$transaction([
      prisma.seriesEpisode.create({
        data: { series_id: id, post_id: parsed.data.post_id, episode_num: parsed.data.episode_num },
      }),
      prisma.series.update({ where: { id }, data: { episode_count: { increment: 1 } } }),
    ]);
    return reply.code(201).send(episode);
  });

  // Delete series
  app.delete('/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = req.currentUser!.id;
    const series = await prisma.series.findUnique({ where: { id } });
    if (!series || series.user_id !== userId) return reply.code(403).send({ error: 'Interdit' });
    await prisma.series.delete({ where: { id } });
    return reply.code(204).send();
  });
}
