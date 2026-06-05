import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';

export async function soundRoutes(app: FastifyInstance) {
  // GET /sounds — liste des sons (trending en premier)
  app.get('/', { preHandler: authenticate }, async (req, reply) => {
    const { limit = '30', q } = req.query as { limit?: string; q?: string };
    const lim = Math.min(parseInt(limit), 50);

    const sounds = await prisma.sound.findMany({
      where: q ? {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { artist: { contains: q, mode: 'insensitive' } },
        ],
      } : undefined,
      take: lim,
      orderBy: [
        { is_trending: 'desc' },
        { use_count: 'desc' },
      ],
      select: {
        id: true,
        title: true,
        artist: true,
        url: true,
        duration: true,
        use_count: true,
        is_trending: true,
      },
    });

    return reply.send(sounds);
  });

  // GET /sounds/:id — détail d'un son + ses vidéos
  app.get('/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };

    const sound = await prisma.sound.findUnique({
      where: { id },
      include: {
        posts: {
          where: { status: 'ACTIVE', is_public: true },
          take: 30,
          orderBy: { like_count: 'desc' },
          select: {
            id: true,
            thumbnail_url: true,
            video_url: true,
            view_count: true,
            like_count: true,
          },
        },
      },
    });

    if (!sound) return reply.status(404).send({ error: 'Son introuvable' });
    return reply.send(sound);
  });
}
