import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';

const ticketSchema = z.object({
  subject: z.string().min(1).max(100),
  description: z.string().min(10).max(2000),
});

const reportSchema = z.object({
  reported_user_id: z.string().uuid().optional(),
  reported_post_id: z.string().uuid().optional(),
  reason: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

export async function supportRoutes(app: FastifyInstance) {
  app.post('/tickets', { preHandler: authenticate }, async (req, reply) => {
    const parsed = ticketSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const ticket = await prisma.supportTicket.create({
      data: { user_id: req.currentUser!.id, ...parsed.data },
    });
    return reply.status(201).send(ticket);
  });

  app.get('/tickets', { preHandler: authenticate }, async (req, reply) => {
    const tickets = await prisma.supportTicket.findMany({
      where: { user_id: req.currentUser!.id },
      orderBy: { created_at: 'desc' },
    });
    return reply.send(tickets);
  });

  app.post('/reports', { preHandler: authenticate }, async (req, reply) => {
    const parsed = reportSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    if (!parsed.data.reported_user_id && !parsed.data.reported_post_id) {
      return reply.status(400).send({ error: 'Must report a user or a post' });
    }

    const report = await prisma.report.create({
      data: { reporter_id: req.currentUser!.id, ...parsed.data },
    });
    return reply.status(201).send(report);
  });
}
