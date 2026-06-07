import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';

export async function collectionRoutes(app: FastifyInstance) {
  // GET /collections — list my collections, optionally with has_post for a given postId
  app.get('/', { preHandler: authenticate }, async (req, reply) => {
    const userId = req.currentUser!.id;
    const { postId } = req.query as { postId?: string };

    const collections = await prisma.collection.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      include: {
        posts: postId ? { where: { post_id: postId } } : false,
        _count: { select: { posts: true } },
      },
    });

    const items = collections.map(c => ({
      id: c.id,
      name: c.name,
      thumbnail_url: c.thumbnail_url,
      post_count: c._count.posts,
      has_post: postId ? c.posts.length > 0 : undefined,
    }));

    return reply.send({ items });
  });

  // POST /collections — create collection
  app.post('/', { preHandler: authenticate }, async (req, reply) => {
    const userId = req.currentUser!.id;
    const { name } = req.body as { name: string };
    if (!name?.trim()) return reply.status(400).send({ error: 'Name required' });

    try {
      const collection = await prisma.collection.create({
        data: { name: name.trim(), user_id: userId },
      });
      return reply.status(201).send(collection);
    } catch {
      return reply.status(409).send({ error: 'Collection name already used' });
    }
  });

  // POST /collections/:id/posts — add post to collection
  app.post('/:id/posts', { preHandler: authenticate }, async (req, reply) => {
    const userId = req.currentUser!.id;
    const { id } = req.params as { id: string };
    const { postId } = req.body as { postId: string };

    const coll = await prisma.collection.findFirst({ where: { id, user_id: userId } });
    if (!coll) return reply.status(404).send({ error: 'Collection not found' });

    try {
      await prisma.collectionPost.create({
        data: { collection_id: id, post_id: postId },
      });

      // Update thumbnail with first post's thumbnail
      if (!coll.thumbnail_url) {
        const post = await prisma.post.findUnique({ where: { id: postId }, select: { thumbnail_url: true } });
        if (post?.thumbnail_url) {
          await prisma.collection.update({ where: { id }, data: { thumbnail_url: post.thumbnail_url } });
        }
      }
    } catch {
      // already in collection — ignore
    }

    return reply.send({ ok: true });
  });

  // GET /collections/:id — single collection info
  app.get('/:id', { preHandler: authenticate }, async (req, reply) => {
    const userId = req.currentUser!.id;
    const { id } = req.params as { id: string };
    const coll = await prisma.collection.findFirst({
      where: { id, user_id: userId },
      include: { _count: { select: { posts: true } } },
    });
    if (!coll) return reply.status(404).send({ error: 'Collection not found' });
    return reply.send({ ...coll, post_count: coll._count.posts, _count: undefined });
  });

  // DELETE /collections/:id/posts/:postId — remove post from collection
  app.delete('/:id/posts/:postId', { preHandler: authenticate }, async (req, reply) => {
    const userId = req.currentUser!.id;
    const { id, postId } = req.params as { id: string; postId: string };

    const coll = await prisma.collection.findFirst({ where: { id, user_id: userId } });
    if (!coll) return reply.status(404).send({ error: 'Collection not found' });

    await prisma.collectionPost.deleteMany({ where: { collection_id: id, post_id: postId } });
    return reply.send({ ok: true });
  });

  // DELETE /collections/:id — delete collection
  app.delete('/:id', { preHandler: authenticate }, async (req, reply) => {
    const userId = req.currentUser!.id;
    const { id } = req.params as { id: string };

    await prisma.collection.deleteMany({ where: { id, user_id: userId } });
    return reply.send({ ok: true });
  });

  // GET /collections/:id/posts — posts in a collection
  app.get('/:id/posts', { preHandler: authenticate }, async (req, reply) => {
    const userId = req.currentUser!.id;
    const { id } = req.params as { id: string };
    const { cursor, limit = '12' } = req.query as { cursor?: string; limit?: string };

    const coll = await prisma.collection.findFirst({ where: { id, user_id: userId } });
    if (!coll) return reply.status(404).send({ error: 'Collection not found' });

    const items = await prisma.collectionPost.findMany({
      where: { collection_id: id },
      take: parseInt(limit) + 1,
      ...(cursor ? { cursor: { collection_id_post_id: { collection_id: id, post_id: cursor } }, skip: 1 } : {}),
      orderBy: { saved_at: 'desc' },
      include: {
        post: {
          select: {
            id: true, video_url: true, thumbnail_url: true,
            view_count: true, like_count: true, caption: true,
          },
        },
      },
    });

    const hasMore = items.length > parseInt(limit);
    const posts = items.slice(0, parseInt(limit)).map(cp => cp.post);
    const next_cursor = hasMore ? posts[posts.length - 1]?.id : null;

    return reply.send({ items: posts, next_cursor });
  });
}
