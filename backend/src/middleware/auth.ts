import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../config/database';

export async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
    const payload = req.user as { sub: string; role: string; type: string };

    if (payload.type !== 'access') {
      return reply.status(401).send({ error: 'Invalid token type' });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, is_banned: true, gender: true },
    });

    if (!user) return reply.status(401).send({ error: 'User not found' });
    if (user.is_banned) return reply.status(403).send({ error: 'Account suspended' });

    req.currentUser = user;
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  await authenticate(req, reply);
  if (req.currentUser?.role !== 'ADMIN' && req.currentUser?.role !== 'MODERATOR') {
    return reply.status(403).send({ error: 'Forbidden' });
  }
}
