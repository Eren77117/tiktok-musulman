import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database';
import { requireAdmin } from '../middleware/auth';
import { z } from 'zod';

const banUserSchema = z.object({ reason: z.string().min(1) });
const moderatePostSchema = z.object({ status: z.enum(['ACTIVE', 'REMOVED']), reason: z.string().optional() });
const resolveReportSchema = z.object({
  status: z.enum(['REVIEWED', 'RESOLVED', 'DISMISSED']),
  note: z.string().optional(),
});
const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  icon_url: z.string().url().optional(),
});

export async function adminRoutes(app: FastifyInstance) {
  app.get('/stats', { preHandler: requireAdmin }, async (_req, reply) => {
    const [users, posts, reports, activeUsers] = await Promise.all([
      prisma.user.count(),
      prisma.post.count({ where: { status: 'ACTIVE' } }),
      prisma.report.count({ where: { status: 'PENDING' } }),
      prisma.user.count({ where: { created_at: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
    ]);
    return reply.send({ total_users: users, total_posts: posts, pending_reports: reports, new_users_30d: activeUsers });
  });

  app.get('/users', { preHandler: requireAdmin }, async (req, reply) => {
    const { cursor, limit = '20', search, banned } = req.query as {
      cursor?: string;
      limit?: string;
      search?: string;
      banned?: string;
    };

    const users = await prisma.user.findMany({
      where: {
        ...(search ? { OR: [{ username: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } : {}),
        ...(banned !== undefined ? { is_banned: banned === 'true' } : {}),
      },
      take: parseInt(limit) + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { created_at: 'desc' },
      select: {
        id: true, username: true, email: true, display_name: true,
        gender: true, role: true, is_banned: true, ban_reason: true,
        follower_count: true, post_count: true, created_at: true,
      },
    });

    const hasMore = users.length > parseInt(limit);
    const items = hasMore ? users.slice(0, -1) : users;
    return reply.send({ items, next_cursor: hasMore ? items[items.length - 1].id : null });
  });

  app.post('/users/:id/ban', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = banUserSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const user = await prisma.user.update({
      where: { id },
      data: { is_banned: true, ban_reason: parsed.data.reason },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.currentUser!.id,
        action: 'BAN_USER',
        entity: 'User',
        entity_id: id,
        metadata: { reason: parsed.data.reason },
      },
    });

    return reply.send({ success: true, user: { id: user.id, is_banned: user.is_banned } });
  });

  app.post('/users/:id/unban', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.user.update({ where: { id }, data: { is_banned: false, ban_reason: null } });
    return reply.send({ success: true });
  });

  app.patch('/users/:id/role', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { role } = req.body as { role: string };
    if (!['USER', 'MODERATOR', 'ADMIN'].includes(role)) {
      return reply.status(400).send({ error: 'Invalid role' });
    }
    const user = await prisma.user.update({ where: { id }, data: { role: role as any } });
    return reply.send({ id: user.id, role: user.role });
  });

  app.get('/posts', { preHandler: requireAdmin }, async (req, reply) => {
    const { cursor, limit = '20', status } = req.query as { cursor?: string; limit?: string; status?: string };

    const posts = await prisma.post.findMany({
      where: status ? { status: status as any } : {},
      take: parseInt(limit) + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { created_at: 'desc' },
      include: {
        user: { select: { id: true, username: true, display_name: true } },
        _count: { select: { reports: true } },
      },
    });

    const hasMore = posts.length > parseInt(limit);
    const items = hasMore ? posts.slice(0, -1) : posts;
    return reply.send({ items, next_cursor: hasMore ? items[items.length - 1].id : null });
  });

  app.patch('/posts/:id/status', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = moderatePostSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    await prisma.post.update({ where: { id }, data: { status: parsed.data.status } });
    await prisma.auditLog.create({
      data: {
        user_id: req.currentUser!.id,
        action: 'MODERATE_POST',
        entity: 'Post',
        entity_id: id,
        metadata: parsed.data,
      },
    });

    return reply.send({ success: true });
  });

  app.get('/reports', { preHandler: requireAdmin }, async (req, reply) => {
    const { cursor, limit = '20', status } = req.query as { cursor?: string; limit?: string; status?: string };

    const reports = await prisma.report.findMany({
      where: status ? { status: status as any } : { status: 'PENDING' },
      take: parseInt(limit) + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { created_at: 'desc' },
      include: {
        reporter: { select: { id: true, username: true } },
        reported_user: { select: { id: true, username: true } },
        reported_post: { select: { id: true, caption: true, thumbnail_url: true } },
      },
    });

    const hasMore = reports.length > parseInt(limit);
    const items = hasMore ? reports.slice(0, -1) : reports;
    return reply.send({ items, next_cursor: hasMore ? items[items.length - 1].id : null });
  });

  app.patch('/reports/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = resolveReportSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    await prisma.report.update({
      where: { id },
      data: { status: parsed.data.status, moderator_note: parsed.data.note },
    });
    return reply.send({ success: true });
  });

  app.get('/tickets', { preHandler: requireAdmin }, async (req, reply) => {
    const { status } = req.query as { status?: string };
    const tickets = await prisma.supportTicket.findMany({
      where: status ? { status: status as any } : {},
      orderBy: { created_at: 'desc' },
      include: { user: { select: { id: true, username: true, email: true } } },
    });
    return reply.send(tickets);
  });

  app.patch('/tickets/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { admin_reply, status } = req.body as { admin_reply?: string; status?: string };
    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: {
        ...(admin_reply ? { admin_reply } : {}),
        ...(status ? { status: status as any } : {}),
      },
    });
    return reply.send(ticket);
  });

  app.post('/categories', { preHandler: requireAdmin }, async (req, reply) => {
    const parsed = createCategorySchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });
    const category = await prisma.category.create({ data: parsed.data });
    return reply.status(201).send(category);
  });

  app.get('/audit-logs', { preHandler: requireAdmin }, async (req, reply) => {
    const { limit = '50' } = req.query as { limit?: string };
    const logs = await prisma.auditLog.findMany({
      take: parseInt(limit),
      orderBy: { created_at: 'desc' },
      include: { user: { select: { id: true, username: true } } },
    });
    return reply.send(logs);
  });

  // AlgoConfig — read/write algo weights
  app.get('/algo-config', { preHandler: requireAdmin }, async (_req, reply) => {
    const configs = await prisma.algoConfig.findMany({ orderBy: { key: 'asc' } });
    return reply.send(configs);
  });

  app.put('/algo-config/:key', { preHandler: requireAdmin }, async (req, reply) => {
    const { key } = req.params as { key: string };
    const { value, description } = req.body as { value: number; description?: string };
    if (typeof value !== 'number') return reply.code(400).send({ error: 'value must be number' });
    const config = await prisma.algoConfig.upsert({
      where: { key },
      update: { value, ...(description ? { description } : {}) },
      create: { key, value, description: description ?? null },
    });
    return reply.send(config);
  });

  // Analytics overview
  app.get('/analytics', { preHandler: requireAdmin }, async (req, reply) => {
    const { days = '7' } = req.query as { days?: string };
    const since = new Date(Date.now() - parseInt(days) * 86400000);
    const [totalViews, totalLikes, topPosts] = await Promise.all([
      prisma.postView.count({ where: { created_at: { gte: since } } }),
      prisma.like.count({ where: { created_at: { gte: since } } }),
      prisma.post.findMany({
        where: { status: 'ACTIVE', created_at: { gte: since } },
        orderBy: { view_count: 'desc' },
        take: 10,
        select: { id: true, caption: true, view_count: true, like_count: true, user: { select: { username: true } } },
      }),
    ]);
    return reply.send({ total_views: totalViews, total_likes: totalLikes, top_posts: topPosts, period_days: parseInt(days) });
  });
}
