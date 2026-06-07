import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';

export async function hashtagRoutes(app: FastifyInstance) {
  // BE-06 : stats d'un hashtag (nb vidéos)
  app.get('/:tag/stats', async (req, reply) => {
    const { tag } = req.params as { tag: string };
    const video_count = await prisma.post.count({
      where: {
        caption: { contains: `#${tag}`, mode: 'insensitive' },
        is_public: true,
      },
    });
    return reply.send({ tag, video_count });
  });

  // BE-05 : follow / unfollow / statut d'un hashtag
  app.get('/:tag/follow-status', { preHandler: authenticate }, async (req, reply) => {
    const { tag } = req.params as { tag: string };
    const userId = req.currentUser!.id;
    const follow = await prisma.hashtagFollow.findUnique({
      where: { user_id_tag: { user_id: userId, tag } },
    });
    return reply.send({ following: !!follow });
  });

  app.post('/:tag/follow', { preHandler: authenticate }, async (req, reply) => {
    const { tag } = req.params as { tag: string };
    const userId = req.currentUser!.id;
    await prisma.hashtagFollow.upsert({
      where: { user_id_tag: { user_id: userId, tag } },
      create: { user_id: userId, tag },
      update: {},
    });
    return reply.send({ success: true });
  });

  app.delete('/:tag/follow', { preHandler: authenticate }, async (req, reply) => {
    const { tag } = req.params as { tag: string };
    const userId = req.currentUser!.id;
    await prisma.hashtagFollow.deleteMany({
      where: { user_id: userId, tag },
    });
    return reply.send({ success: true });
  });
}
