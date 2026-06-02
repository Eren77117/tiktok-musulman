import 'dotenv/config';
import './config/env';
import { createServer } from 'http';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import path from 'path';
import { env } from './config/env';
import { prisma } from './config/database';
import { createSocketServer } from './websocket/server';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { postRoutes } from './routes/posts';
import { commentRoutes } from './routes/comments';
import { messageRoutes } from './routes/messages';
import { notificationRoutes } from './routes/notifications';
import { storyRoutes } from './routes/stories';
import { searchRoutes } from './routes/search';
import { favoriteRoutes } from './routes/favorites';
import { liveRoutes } from './routes/live';
import { uploadRoutes } from './routes/upload';
import { adminRoutes } from './routes/admin';
import { supportRoutes } from './routes/support';

const app = Fastify({
  logger: env.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty' } }
    : true,
});

async function bootstrap() {
  await app.register(cors, {
    origin: true, // allow all origins (mobile app has no origin header)
    credentials: true,
  });

  await app.register(jwt, {
    secret: env.JWT_ACCESS_SECRET,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  await app.register(multipart, {
    limits: { fileSize: env.UPLOAD_MAX_SIZE_MB * 1024 * 1024 },
  });

  const uploadsDir = path.join(process.cwd(), 'uploads');
  const fs = await import('fs');
  fs.mkdirSync(uploadsDir, { recursive: true });

  await app.register(staticFiles, { root: uploadsDir, prefix: '/uploads/' });

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(userRoutes, { prefix: '/api/users' });
  await app.register(postRoutes, { prefix: '/api/posts' });
  await app.register(commentRoutes, { prefix: '/api/comments' });
  await app.register(messageRoutes, { prefix: '/api/messages' });
  await app.register(notificationRoutes, { prefix: '/api/notifications' });
  await app.register(storyRoutes, { prefix: '/api/stories' });
  await app.register(searchRoutes, { prefix: '/api/search' });
  await app.register(favoriteRoutes, { prefix: '/api/favorites' });
  await app.register(liveRoutes, { prefix: '/api/live' });
  await app.register(uploadRoutes, { prefix: '/api/upload' });
  await app.register(adminRoutes, { prefix: '/api/admin' });
  await app.register(supportRoutes, { prefix: '/api/support' });

  app.setErrorHandler((error, _req, reply) => {
    app.log.error(error);
    if (error.statusCode) return reply.status(error.statusCode).send({ error: error.message });
    return reply.status(500).send({ error: 'Internal server error' });
  });

  const httpServer = createServer(app.server);
  createSocketServer(httpServer);

  await app.ready();

  httpServer.listen(env.PORT, '0.0.0.0', () => {
    console.log(`Backend running on http://localhost:${env.PORT}`);
  });

  const shutdown = async () => {
    await prisma.$disconnect();
    httpServer.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
