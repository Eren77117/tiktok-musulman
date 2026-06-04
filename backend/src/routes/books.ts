import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';

const createBookSchema = z.object({
  title: z.string().min(1).max(100),
  author: z.string().max(100).optional(),
  cover_url: z.string().optional(),
  summary: z.string().min(10).max(2000),
  content_url: z.string().optional(),
  category: z.string().default('general'),
  is_public: z.boolean().default(true),
});

const BOOK_INCLUDE = {
  user: { select: { id: true, username: true, display_name: true, avatar_url: true, is_verified: true } },
} as const;

export async function bookRoutes(app: FastifyInstance) {
  // ── Feed (injected with videos at 1:3 ratio) ───────────────────────────────
  app.get('/feed', { preHandler: authenticate }, async (req, reply) => {
    const { cursor, limit = '10' } = req.query as { cursor?: string; limit?: string };
    const userId = req.currentUser!.id;

    const books = await prisma.book.findMany({
      where: { is_public: true },
      take: parseInt(limit) + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ like_count: 'desc' }, { created_at: 'desc' }],
      include: BOOK_INCLUDE,
    });

    const likedIds = await prisma.bookLike.findMany({
      where: { user_id: userId, book_id: { in: books.map(b => b.id) } },
      select: { book_id: true },
    });
    const likedSet = new Set(likedIds.map(l => l.book_id));

    const hasMore = books.length > parseInt(limit);
    const items = hasMore ? books.slice(0, -1) : books;

    return reply.send({
      items: items.map(b => ({ ...b, is_liked: likedSet.has(b.id) })),
      next_cursor: hasMore ? items[items.length - 1].id : null,
    });
  });

  // ── Create ─────────────────────────────────────────────────────────────────
  app.post('/', { preHandler: authenticate }, async (req, reply) => {
    const parsed = createBookSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const book = await prisma.book.create({
      data: { ...parsed.data, user_id: req.currentUser!.id },
      include: BOOK_INCLUDE,
    });
    return reply.status(201).send({ ...book, is_liked: false });
  });

  // ── Like / Unlike ──────────────────────────────────────────────────────────
  app.post('/:id/like', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = req.currentUser!.id;

    const existing = await prisma.bookLike.findUnique({
      where: { user_id_book_id: { user_id: userId, book_id: id } },
    });

    if (existing) {
      await prisma.$transaction([
        prisma.bookLike.delete({ where: { user_id_book_id: { user_id: userId, book_id: id } } }),
        prisma.book.update({ where: { id }, data: { like_count: { decrement: 1 } } }),
      ]);
      return reply.send({ liked: false });
    }
    await prisma.$transaction([
      prisma.bookLike.create({ data: { user_id: userId, book_id: id } }),
      prisma.book.update({ where: { id }, data: { like_count: { increment: 1 } } }),
    ]);
    return reply.send({ liked: true });
  });

  // ── View tracking ──────────────────────────────────────────────────────────
  app.post('/:id/view', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.book.update({ where: { id }, data: { view_count: { increment: 1 } } }).catch(() => {});
    return reply.send({ ok: true });
  });

  // ── Trending ───────────────────────────────────────────────────────────────
  app.get('/trending', { preHandler: authenticate }, async (req, reply) => {
    const { category, limit = '20' } = req.query as { category?: string; limit?: string };
    const books = await prisma.book.findMany({
      where: { is_public: true, ...(category ? { category } : {}) },
      take: parseInt(limit),
      orderBy: [{ like_count: 'desc' }, { view_count: 'desc' }],
      include: BOOK_INCLUDE,
    });
    return reply.send({ items: books.map(b => ({ ...b, is_liked: false })) });
  });
}
