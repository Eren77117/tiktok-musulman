# 07 — ENDPOINTS BACKEND MANQUANTS
## Créer ces routes dans le backend avant d'implémenter les features frontend correspondantes

Backend path: `/Users/aymen/eren/tiktok-musulman/backend/`
Framework: Fastify + Prisma + PostgreSQL

---

## ✅ CHECKLIST BACKEND

- [ ] BE-01 : `GET /users/by-username/:username`
- [ ] BE-02 : `GET /notifications/unread-count`
- [ ] BE-03 : `GET /users/suggested`
- [ ] BE-04 : Collections CRUD (5 endpoints)
- [ ] BE-05 : Hashtags follow (3 endpoints)
- [ ] BE-06 : `GET /hashtags/:tag/stats`
- [ ] BE-07 : `POST /posts/:id/view` enrichi (rewatch, skip, completion_ratio)
- [ ] BE-08 : `GET /posts/:id/comments?sort=likes|recent`
- [ ] BE-09 : `POST /comments/:id/like`
- [ ] BE-10 : Socket.IO typing indicators

---

## BE-01 : `GET /users/by-username/:username`

```typescript
// backend/src/routes/users.ts

fastify.get('/users/by-username/:username', {
  schema: {
    params: z.object({ username: z.string() }),
  },
}, async (req, reply) => {
  const { username } = req.params;
  
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: {
      id: true,
      username: true,
      display_name: true,
      avatar_url: true,
      bio: true,
      is_verified: true,
      follower_count: true,
    },
  });

  if (!user) return reply.status(404).send({ error: 'Utilisateur non trouvé' });
  return reply.send(user);
});
```

---

## BE-02 : `GET /notifications/unread-count`

```typescript
fastify.get('/notifications/unread-count', {
  preHandler: [authenticate], // middleware auth JWT
}, async (req, reply) => {
  const userId = req.user.id;

  const count = await prisma.notification.count({
    where: {
      recipient_id: userId,
      is_read: false,
    },
  });

  return reply.send({ count });
});
```

---

## BE-03 : `GET /users/suggested`

```typescript
// Suggestion basée sur : comptes populaires que l'utilisateur ne suit pas encore
fastify.get('/users/suggested', {
  preHandler: [authenticate],
  schema: {
    querystring: z.object({ limit: z.coerce.number().default(10) }),
  },
}, async (req, reply) => {
  const { limit } = req.query;
  const userId = req.user.id;

  // Récupérer les IDs déjà suivis
  const following = await prisma.follow.findMany({
    where: { follower_id: userId },
    select: { following_id: true },
  });
  const followingIds = following.map(f => f.following_id);
  
  // Exclure soi-même + déjà suivis
  const excluded = [...followingIds, userId];

  const users = await prisma.user.findMany({
    where: {
      id: { notIn: excluded },
      gender: { not: null }, // comptes complets
    },
    orderBy: { follower_count: 'desc' },
    take: limit,
    select: {
      id: true,
      username: true,
      display_name: true,
      avatar_url: true,
      follower_count: true,
      is_verified: true,
    },
  });

  return reply.send({
    items: users.map(u => ({ ...u, is_following: false })),
  });
});
```

---

## BE-04 : Collections CRUD

```typescript
// Schéma Prisma à ajouter dans schema.prisma :
model Collection {
  id         String   @id @default(cuid())
  name       String
  user_id    String
  created_at DateTime @default(now())
  user       User     @relation(fields: [user_id], references: [id], onDelete: Cascade)
  posts      CollectionPost[]

  @@unique([user_id, name])
  @@index([user_id])
}

model CollectionPost {
  collection_id String
  post_id       String
  saved_at      DateTime @default(now())
  collection    Collection @relation(fields: [collection_id], references: [id], onDelete: Cascade)
  post          Post       @relation(fields: [post_id], references: [id], onDelete: Cascade)

  @@id([collection_id, post_id])
}

// Après modification du schema :
// npx prisma db push  (ou migration)
// npx prisma generate

// Routes :
// Lister mes collections
fastify.get('/collections', {
  preHandler: [authenticate],
  schema: {
    querystring: z.object({ postId: z.string().optional() }),
  },
}, async (req, reply) => {
  const userId = req.user.id;
  const { postId } = req.query;

  const collections = await prisma.collection.findMany({
    where: { user_id: userId },
    include: {
      posts: {
        take: 1,
        orderBy: { saved_at: 'desc' },
        include: { post: { select: { thumbnail_url: true } } },
      },
      _count: { select: { posts: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  const items = await Promise.all(collections.map(async (coll) => {
    let has_post = false;
    if (postId) {
      has_post = !!(await prisma.collectionPost.findUnique({
        where: { collection_id_post_id: { collection_id: coll.id, post_id: postId } },
      }));
    }
    return {
      id: coll.id,
      name: coll.name,
      post_count: coll._count.posts,
      thumbnail_url: coll.posts[0]?.post.thumbnail_url ?? null,
      has_post,
    };
  }));

  return reply.send({ items });
});

// Créer une collection
fastify.post('/collections', {
  preHandler: [authenticate],
  schema: {
    body: z.object({ name: z.string().min(1).max(30) }),
  },
}, async (req, reply) => {
  const userId = req.user.id;
  const { name } = req.body;

  const collection = await prisma.collection.create({
    data: { name: name.trim(), user_id: userId },
    select: { id: true, name: true },
  });

  return reply.status(201).send(collection);
});

// Ajouter un post à une collection
fastify.post('/collections/:id/posts', {
  preHandler: [authenticate],
  schema: {
    params: z.object({ id: z.string() }),
    body: z.object({ postId: z.string() }),
  },
}, async (req, reply) => {
  const userId = req.user.id;
  const { id: collectionId } = req.params;
  const { postId } = req.body;

  // Vérifier ownership
  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, user_id: userId },
  });
  if (!collection) return reply.status(403).send({ error: 'Non autorisé' });

  await prisma.collectionPost.upsert({
    where: { collection_id_post_id: { collection_id: collectionId, post_id: postId } },
    create: { collection_id: collectionId, post_id: postId },
    update: {},
  });

  return reply.send({ success: true });
});

// Retirer un post
fastify.delete('/collections/:id/posts/:postId', {
  preHandler: [authenticate],
  schema: {
    params: z.object({ id: z.string(), postId: z.string() }),
  },
}, async (req, reply) => {
  const userId = req.user.id;
  const { id: collectionId, postId } = req.params;

  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, user_id: userId },
  });
  if (!collection) return reply.status(403).send({ error: 'Non autorisé' });

  await prisma.collectionPost.deleteMany({
    where: { collection_id: collectionId, post_id: postId },
  });

  return reply.send({ success: true });
});

// Supprimer une collection
fastify.delete('/collections/:id', {
  preHandler: [authenticate],
}, async (req, reply) => {
  const userId = req.user.id;
  const { id } = req.params as { id: string };

  await prisma.collection.deleteMany({
    where: { id, user_id: userId },
  });

  return reply.send({ success: true });
});

// Posts d'une collection
fastify.get('/collections/:id/posts', {
  preHandler: [authenticate],
  schema: {
    params: z.object({ id: z.string() }),
    querystring: z.object({ cursor: z.string().optional(), limit: z.coerce.number().default(12) }),
  },
}, async (req, reply) => {
  const { id: collectionId } = req.params;
  const { cursor, limit } = req.query;

  const items = await prisma.collectionPost.findMany({
    where: { collection_id: collectionId },
    take: limit + 1,
    cursor: cursor ? { collection_id_post_id: { collection_id: collectionId, post_id: cursor } } : undefined,
    skip: cursor ? 1 : 0,
    orderBy: { saved_at: 'desc' },
    include: {
      post: {
        include: { user: { select: { id: true, username: true, avatar_url: true } } },
      },
    },
  });

  const hasMore = items.length > limit;
  const results = hasMore ? items.slice(0, -1) : items;

  return reply.send({
    items: results.map(cp => cp.post),
    next_cursor: hasMore ? results[results.length - 1].post_id : null,
  });
});
```

---

## BE-05 : Hashtags follow

```typescript
// Schéma Prisma :
model HashtagFollow {
  user_id    String
  tag        String
  created_at DateTime @default(now())
  user       User     @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@id([user_id, tag])
  @@index([tag])
}

// Routes :
fastify.post('/hashtags/:tag/follow', {
  preHandler: [authenticate],
}, async (req, reply) => {
  const { tag } = req.params as { tag: string };
  const userId = req.user.id;

  await prisma.hashtagFollow.upsert({
    where: { user_id_tag: { user_id: userId, tag } },
    create: { user_id: userId, tag },
    update: {},
  });

  return reply.send({ success: true });
});

fastify.delete('/hashtags/:tag/follow', {
  preHandler: [authenticate],
}, async (req, reply) => {
  const { tag } = req.params as { tag: string };
  const userId = req.user.id;

  await prisma.hashtagFollow.deleteMany({
    where: { user_id: userId, tag },
  });

  return reply.send({ success: true });
});

fastify.get('/hashtags/:tag/follow-status', {
  preHandler: [authenticate],
}, async (req, reply) => {
  const { tag } = req.params as { tag: string };
  const userId = req.user.id;

  const follow = await prisma.hashtagFollow.findUnique({
    where: { user_id_tag: { user_id: userId, tag } },
  });

  return reply.send({ following: !!follow });
});
```

---

## BE-06 : `GET /hashtags/:tag/stats`

```typescript
fastify.get('/hashtags/:tag/stats', async (req, reply) => {
  const { tag } = req.params as { tag: string };

  const video_count = await prisma.post.count({
    where: {
      caption: { contains: `#${tag}`, mode: 'insensitive' },
      is_published: true,
    },
  });

  return reply.send({ tag, video_count });
});
```

---

## BE-07 : `POST /posts/:id/view` enrichi

```typescript
// Mettre à jour le handler existant pour accepter les nouveaux champs :
fastify.post('/posts/:id/view', {
  preHandler: [authenticate],
  schema: {
    body: z.object({
      watch_time: z.number().min(0),
      completed: z.boolean().optional(),
      // NOUVEAUX CHAMPS :
      rewatch_count: z.number().min(0).default(0),
      completion_ratio: z.number().min(0).max(1).default(0),
      was_skipped: z.boolean().default(false),
      pause_count: z.number().min(0).default(0),
      interacted: z.boolean().default(false),
    }),
  },
}, async (req, reply) => {
  const { id: postId } = req.params as { id: string };
  const { watch_time, rewatch_count, completion_ratio, was_skipped, interacted } = req.body;

  // Calculer un engagement score par view
  // (utile pour l'algo sans recalculer sur chaque requête feed)
  const viewScore =
    watch_time * 2 +
    rewatch_count * 5 +
    completion_ratio * 20 +
    (interacted ? 15 : 0) -
    (was_skipped ? 8 : 0);

  // Incrémenter view_count + mettre à jour les stats moyennes
  await prisma.post.update({
    where: { id: postId },
    data: {
      view_count: { increment: 1 },
      // Si tu as ces colonnes :
      // avg_watch_time, avg_completion_ratio, etc.
      // Utiliser une formule de moving average
    },
  });

  return reply.send({ success: true });
});
```

---

## BE-08 : `GET /posts/:id/comments?sort=likes|recent`

```typescript
// Mettre à jour le handler existant :
fastify.get('/posts/:id/comments', {
  preHandler: [authenticate],
  schema: {
    querystring: z.object({
      cursor: z.string().optional(),
      limit: z.coerce.number().default(20),
      sort: z.enum(['likes', 'recent']).default('likes'),
    }),
  },
}, async (req, reply) => {
  const { id: postId } = req.params as { id: string };
  const { cursor, limit, sort } = req.query;
  const userId = req.user.id;

  // Vérifier si l'utilisateur connecté est l'auteur du post
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { user_id: true },
  });

  const comments = await prisma.comment.findMany({
    where: { post_id: postId, parent_id: null }, // top-level seulement
    take: limit + 1,
    orderBy: sort === 'likes' ? { like_count: 'desc' } : { created_at: 'desc' },
    include: {
      user: { select: { id: true, username: true, display_name: true, avatar_url: true } },
      _count: { select: { replies: true, likes: true } },
      likes: userId ? { where: { user_id: userId }, select: { user_id: true } } : false,
    },
  });

  const hasMore = comments.length > limit;
  const results = hasMore ? comments.slice(0, -1) : comments;

  return reply.send({
    items: results.map(c => ({
      id: c.id,
      content: c.content,
      created_at: c.created_at,
      like_count: c._count.likes,
      reply_count: c._count.replies,
      is_liked: c.likes?.length > 0,
      creator_liked: false, // TODO: chercher si post.user_id a liké ce commentaire
      user: c.user,
    })),
    next_cursor: hasMore ? results[results.length - 1].id : null,
  });
});
```

---

## BE-09 : `POST /comments/:id/like`

```typescript
fastify.post('/comments/:id/like', {
  preHandler: [authenticate],
}, async (req, reply) => {
  const { id: commentId } = req.params as { id: string };
  const userId = req.user.id;

  const existing = await prisma.commentLike.findUnique({
    where: { user_id_comment_id: { user_id: userId, comment_id: commentId } },
  });

  if (existing) {
    await prisma.commentLike.delete({
      where: { user_id_comment_id: { user_id: userId, comment_id: commentId } },
    });
    await prisma.comment.update({ where: { id: commentId }, data: { like_count: { decrement: 1 } } });
    return reply.send({ liked: false });
  } else {
    await prisma.commentLike.create({ data: { user_id: userId, comment_id: commentId } });
    await prisma.comment.update({ where: { id: commentId }, data: { like_count: { increment: 1 } } });
    return reply.send({ liked: true });
  }
});
```

---

## BE-10 : Socket.IO typing indicators

```typescript
// Dans le handler Socket.IO existant (backend/src/socket.ts ou similar) :

io.on('connection', (socket) => {
  // ... handlers existants

  socket.on('typing:start', ({ conversationId }: { conversationId: string }) => {
    const userId = socket.data.userId; // récupéré depuis le auth middleware socket
    // Broadcaster aux autres membres de la conversation
    socket.to(`conversation:${conversationId}`).emit('typing:start', { userId });
  });

  socket.on('typing:stop', ({ conversationId }: { conversationId: string }) => {
    const userId = socket.data.userId;
    socket.to(`conversation:${conversationId}`).emit('typing:stop', { userId });
  });
});
```

---

## 🔧 COMMANDES APRÈS AJOUT DE MODÈLES PRISMA

```bash
# Dans le dossier backend :
cd /Users/aymen/eren/tiktok-musulman/backend

# Push le schéma (développement)
DATABASE_URL="<railway_url>" npx prisma db push

# OU créer une migration propre :
DATABASE_URL="<railway_url>" npx prisma migrate dev --name "add_collections_hashtag_follows"

# Régénérer le client
npx prisma generate

# Vérifier que le backend compile
npx tsc --noEmit

# Redéployer sur Railway (si auto-deploy pas activé)
# Railway se redéploie automatiquement sur git push
git add -A && git commit -m "feat: backend collections, hashtag follow, typing indicators"
git push origin main
```
