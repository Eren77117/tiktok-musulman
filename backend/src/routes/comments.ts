import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';

const commentSchema = z.object({
  content: z.string().min(1).max(500),
  parent_id: z.string().uuid().optional(),
});

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
    return reply.send({ items, next_cursor: hasMore ? items[items.length - 1].id : null });
  });

  app.post('/post/:postId', { preHandler: authenticate }, async (req, reply) => {
    const { postId } = req.params as { postId: string };
    const parsed = commentSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

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
          title: 'New comment',
          body: parsed.data.content.slice(0, 80),
          data: { post_id: postId, comment_id: comment.id },
        },
      });
    }

    return reply.status(201).send(comment);
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
