import type { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { env } from '../config/env';
import { prisma } from '../config/database';

interface AuthSocket extends Socket {
  userId?: string;
}

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
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

    socket.on('live:join', async (sessionId: string) => {
      socket.join(`live:${sessionId}`);
      const session = await prisma.liveSession.update({
        where: { id: sessionId },
        data: { viewer_count: { increment: 1 } },
        select: { viewer_count: true },
      }).catch(() => null);
      if (session) io.to(`live:${sessionId}`).emit('live:viewer:count', session.viewer_count);
    });

    socket.on('live:leave', async (sessionId: string) => {
      socket.leave(`live:${sessionId}`);
      const session = await prisma.liveSession.update({
        where: { id: sessionId },
        data: { viewer_count: { decrement: 1 } },
        select: { viewer_count: true },
      }).catch(() => null);
      if (session) io.to(`live:${sessionId}`).emit('live:viewer:count', Math.max(0, session.viewer_count));
    });

    socket.on('live:comment', async (data: { sessionId: string; text: string }) => {
      if (!data.text?.trim()) return;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, display_name: true, avatar_url: true },
      });
      // Save to DB
      const msg = await prisma.liveMessage.create({
        data: { session_id: data.sessionId, user_id: userId, content: data.text.trim() },
      }).catch(() => null);
      io.to(`live:${data.sessionId}`).emit('live:comment', {
        id: msg?.id, user, text: data.text.trim(), timestamp: Date.now(),
      });
    });

    socket.on('live:reaction', (data: { sessionId: string; emoji: string }) => {
      io.to(`live:${data.sessionId}`).emit('live:reaction', { userId, emoji: data.emoji, timestamp: Date.now() });
    });

    // ── WebRTC Signaling ────────────────────────────────────────────────────
    // Broadcaster sends offer to a specific viewer
    socket.on('webrtc:offer', (data: { sessionId: string; viewerId: string; sdp: unknown }) => {
      io.to(`user:${data.viewerId}`).emit('webrtc:offer', {
        sessionId: data.sessionId, broadcasterId: userId, sdp: data.sdp,
      });
    });

    // Viewer sends answer back to broadcaster
    socket.on('webrtc:answer', (data: { sessionId: string; broadcasterId: string; sdp: unknown }) => {
      io.to(`user:${data.broadcasterId}`).emit('webrtc:answer', {
        sessionId: data.sessionId, viewerId: userId, sdp: data.sdp,
      });
    });

    // ICE candidate exchange
    socket.on('webrtc:ice', (data: { sessionId: string; targetId: string; candidate: unknown }) => {
      io.to(`user:${data.targetId}`).emit('webrtc:ice', {
        sessionId: data.sessionId, fromId: userId, candidate: data.candidate,
      });
    });

    // Viewer requests stream from broadcaster
    socket.on('live:viewer:join', (data: { sessionId: string; broadcasterId: string }) => {
      io.to(`user:${data.broadcasterId}`).emit('live:viewer:joined', {
        viewerId: userId, sessionId: data.sessionId,
      });
    });

    // Broadcaster signals stream ended
    socket.on('live:end', (sessionId: string) => {
      io.to(`live:${sessionId}`).emit('live:ended', { sessionId });
      prisma.liveSession.update({
        where: { id: sessionId, user_id: userId },
        data: { is_active: false, ended_at: new Date() },
      }).catch(() => {});
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
