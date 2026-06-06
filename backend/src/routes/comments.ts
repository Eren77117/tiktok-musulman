import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';
import { getIo } from '../websocket/instance';

const commentSchema = z.object({
  content: z.string().min(1).max(500),
  parent_id: z.string().uuid().optional(),
});

const BANNED_WORDS = ['haram', 'kafir', 'merde', 'connard', 'putain', 'enculé', 'fdp'];

function isSpam(content: string): boolean {
  const lower = content.toLowerCase();
  if (BANNED_WORDS.some(w => lower.includes(w))) return true;
  // Repeated chars (aaaaaaa)
  if (/(.)\1{6,}/.test(content)) return true;
  // ALL CAPS long text
  if (content.length > 20 && content === content.toUpperCase() && /[A-Z]/.test(content)) return true;
  return false;
}

// Per-user rate limit: max 5 comments per 30s
const userCommentTs = new Map<string, number[]>();
function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const window = 30000;
  const ts = (userCommentTs.get(userId) ?? []).filter(t => now - t < window);
  if (ts.length >= 5) return true;
  ts.push(now);
  userCommentTs.set(userId, ts);
  return false;
}

export async function commentRoutes(app: FastifyInstance) {
  app.get('/post/:postId', { preHandler: authenticate }, async (req, reply) => {
    const { postId } = req.params as { postId: string };
    const { cursor, limit = '20' } = req.query as { cursor?: string; limit?: string };

    const comments = await prisma.comment.findMany({
      where: { post_id: postId, parent_id: null },
      take: parseInt(limit) + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { created_at: 'desc' },
      include: {
        user: {
          select: { id: true, username: true, display_name: true, avatar_url: true },
        },
        _count: { select: { replies: true, likes: true } },
      },
    });

    const hasMore = comments.length > parseInt(limit);
    const items = hasMore ? comments.slice(0, -1) : comments;

    const likedIds = await prisma.like.findMany({
      where: { user_id: req.currentUser!.id, comment_id: { in: items.map(c => c.id) } },
      select: { comment_id: true },
    });
    const likedSet = new Set(likedIds.map(l => l.comment_id));

    // Smart sort: pinned first, then likes×3 + replies×5 + recency
    const scored = items.map(c => {
      const ageH = (Date.now() - new Date(c.created_at).getTime()) / 3600000;
      const score = c.is_pinned ? Infinity : (c.like_count * 3 + c._count.replies * 5 + Math.max(0, 48 - ageH));
      return { ...c, score };
    }).sort((a, b) => b.score - a.score);

    return reply.send({
      items: scored.map(c => ({
        ...c, is_liked: likedSet.has(c.id),
        like_count: c.like_count, reply_count: c._count.replies,
      })),
      next_cursor: hasMore ? items[items.length - 1].id : null,
    });
  });

  app.post('/post/:postId', { preHandler: authenticate }, async (req, reply) => {
    const { postId } = req.params as { postId: string };
    const parsed = commentSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    if (isRateLimited(req.currentUser!.id)) {
      return reply.code(429).send({ error: 'Trop de commentaires, attends un peu.' });
    }
    if (isSpam(parsed.data.content)) {
      return reply.code(400).send({ error: 'Commentaire non autorisé.' });
    }

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return reply.status(404).send({ error: 'Post not found' });

    const comment = await prisma.$transaction(async (tx) => {
      const c = await tx.comment.create({
        data: {
          post_id: postId,
          user_id: req.currentUser!.id,
          content: parsed.data.content,
          parent_id: parsed.data.parent_id,
        },
        include: {
          user: { select: { id: true, username: true, display_name: true, avatar_url: true } },
        },
      });
      await tx.post.update({ where: { id: postId }, data: { comment_count: { increment: 1 } } });
      return c;
    });

    if (post.user_id !== req.currentUser!.id) {
      await prisma.notification.create({
        data: {
          user_id: post.user_id,
          type: 'COMMENT',
          title: `@${comment.user.username} a commenté votre vidéo`,
          body: parsed.data.content.slice(0, 80),
          data: { post_id: postId, comment_id: comment.id },
        },
      });
    }

    // Broadcast new comment to everyone watching this post
    getIo()?.to(`post:${postId}`).emit('comment:new', {
      ...comment,
      like_count: 0,
      reply_count: 0,
      is_liked: false,
    });

    return reply.status(201).send(comment);
  });

  // GET replies for a comment
  app.get('/:id/replies', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const replies = await prisma.comment.findMany({
      where: { parent_id: id },
      orderBy: { created_at: 'asc' },
      include: {
        user: { select: { id: true, username: true, display_name: true, avatar_url: true } },
        _count: { select: { likes: true } },
      },
    });
    const likedIds = await prisma.like.findMany({
      where: { user_id: req.currentUser!.id, comment_id: { in: replies.map(r => r.id) } },
      select: { comment_id: true },
    });
    const likedSet = new Set(likedIds.map(l => l.comment_id));
    return reply.send({
      items: replies.map(r => ({
        ...r, is_liked: likedSet.has(r.id),
        like_count: r.like_count, reply_count: 0,
      })),
    });
  });

  // Like / unlike a comment
  app.post('/:id/like', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = req.currentUser!.id;
    const existing = await prisma.like.findUnique({
      where: { user_id_comment_id: { user_id: userId, comment_id: id } },
    });
    if (existing) {
      await prisma.$transaction([
        prisma.like.delete({ where: { user_id_comment_id: { user_id: userId, comment_id: id } } }),
        prisma.comment.update({ where: { id }, data: { like_count: { decrement: 1 } } }),
      ]);
      return reply.send({ liked: false });
    }
    await prisma.$transaction([
      prisma.like.create({ data: { user_id: userId, comment_id: id } }),
      prisma.comment.update({ where: { id }, data: { like_count: { increment: 1 } } }),
    ]);
    return reply.send({ liked: true });
  });

  // Creator pin/unpin
  app.patch('/:id/pin', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const comment = await prisma.comment.findUnique({ where: { id }, include: { post: { select: { user_id: true } } } });
    if (!comment) return reply.code(404).send({ error: 'Not found' });
    if (comment.post.user_id !== req.currentUser!.id) return reply.code(403).send({ error: 'Seul le créateur peut épingler' });
    // Unpin all other comments on this post first
    await prisma.comment.updateMany({ where: { post_id: comment.post_id, is_pinned: true }, data: { is_pinned: false } });
    const updated = await prisma.comment.update({ where: { id }, data: { is_pinned: !comment.is_pinned } });
    return reply.send({ is_pinned: updated.is_pinned });
  });

  app.delete('/:id', { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) return reply.status(404).send({ error: 'Not found' });
    if (comment.user_id !== req.currentUser!.id && req.currentUser!.role === 'USER') {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    await prisma.$transaction([
      prisma.comment.delete({ where: { id } }),
      prisma.post.update({ where: { id: comment.post_id }, data: { comment_count: { decrement: 1 } } }),
    ]);

    return reply.send({ success: true });
  });
}
