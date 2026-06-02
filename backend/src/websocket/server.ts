import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { env } from '../config/env';
import { prisma } from '../config/database';

interface AuthSocket extends Socket {
  userId?: string;
}

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGIN, methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  });

  const userSockets = new Map<string, Set<string>>();

  io.use(async (socket: AuthSocket, next) => {
    const token = socket.handshake.auth.token as string;
    if (!token) return next(new Error('Auth required'));

    try {
      // Verify JWT manually
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('Invalid token');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      if (payload.type !== 'access' || payload.exp * 1000 < Date.now()) {
        throw new Error('Token expired');
      }
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, is_banned: true },
      });
      if (!user || user.is_banned) throw new Error('Unauthorized');
      socket.userId = payload.sub;
      next();
    } catch (err) {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket: AuthSocket) => {
    const userId = socket.userId!;

    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId)!.add(socket.id);

    socket.join(`user:${userId}`);

    socket.on('join:conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('leave:conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on('message:send', async (data: { conversationId: string; content: string }) => {
      const conversation = await prisma.conversation.findUnique({
        where: { id: data.conversationId },
        include: { request: true },
      });
      if (!conversation) return;

      const { requester_id, recipient_id } = conversation.request;
      if (userId !== requester_id && userId !== recipient_id) return;

      const message = await prisma.$transaction(async (tx) => {
        const m = await tx.message.create({
          data: { conversation_id: data.conversationId, sender_id: userId, content: data.content },
          include: {
            sender: { select: { id: true, username: true, display_name: true, avatar_url: true } },
          },
        });
        await tx.conversation.update({ where: { id: data.conversationId }, data: { updated_at: new Date() } });
        return m;
      });

      io.to(`conversation:${data.conversationId}`).emit('message:new', message);
    });

    socket.on('live:join', (sessionId: string) => {
      socket.join(`live:${sessionId}`);
      prisma.liveSession.update({
        where: { id: sessionId },
        data: { viewer_count: { increment: 1 } },
      }).catch(() => {});
    });

    socket.on('live:leave', (sessionId: string) => {
      socket.leave(`live:${sessionId}`);
      prisma.liveSession.update({
        where: { id: sessionId },
        data: { viewer_count: { decrement: 1 } },
      }).catch(() => {});
    });

    socket.on('live:comment', async (data: { sessionId: string; text: string }) => {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, display_name: true, avatar_url: true },
      });
      io.to(`live:${data.sessionId}`).emit('live:comment', { user, text: data.text, timestamp: Date.now() });
    });

    socket.on('disconnect', () => {
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) userSockets.delete(userId);
      }
    });
  });

  return { io, userSockets };
}

export type SocketServer = ReturnType<typeof createSocketServer>;
