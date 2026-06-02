import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database';
import { hashPassword, verifyPassword } from '../utils/password';
import { signAccessToken, signRefreshToken, validateRefreshToken, revokeRefreshToken } from '../utils/jwt';
import { registerSchema, loginSchema, refreshSchema } from '../schemas/auth';
import { authenticate } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const { username, email, password, display_name, gender } = parsed.data;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      return reply.status(409).send({ error: 'Email or username already in use' });
    }

    const password_hash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { username, email, password_hash, display_name, gender },
      select: { id: true, username: true, email: true, display_name: true, gender: true, role: true },
    });

    await prisma.auditLog.create({
      data: { user_id: user.id, action: 'REGISTER', entity: 'User', entity_id: user.id },
    });

    const access_token = signAccessToken(app, { sub: user.id, role: user.role });
    const refresh_token = signRefreshToken(app, { sub: user.id, role: user.role });

    await prisma.refreshToken.create({
      data: {
        token: refresh_token,
        user_id: user.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return reply.status(201).send({ user, access_token, refresh_token });
  });

  app.post('/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return reply.status(401).send({ error: 'Invalid credentials' });
    if (user.is_banned) return reply.status(403).send({ error: 'Account suspended' });

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return reply.status(401).send({ error: 'Invalid credentials' });

    const access_token = signAccessToken(app, { sub: user.id, role: user.role });
    const refresh_token = signRefreshToken(app, { sub: user.id, role: user.role });

    await prisma.refreshToken.create({
      data: {
        token: refresh_token,
        user_id: user.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return reply.send({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        gender: user.gender,
        role: user.role,
      },
      access_token,
      refresh_token,
    });
  });

  app.post('/refresh', async (req, reply) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid payload' });

    const record = await validateRefreshToken(parsed.data.refresh_token);
    if (!record) return reply.status(401).send({ error: 'Invalid or expired refresh token' });

    const user = await prisma.user.findUnique({ where: { id: record.user_id } });
    if (!user || user.is_banned) return reply.status(401).send({ error: 'Unauthorized' });

    await revokeRefreshToken(parsed.data.refresh_token);

    const access_token = signAccessToken(app, { sub: user.id, role: user.role });
    const new_refresh_token = signRefreshToken(app, { sub: user.id, role: user.role });

    await prisma.refreshToken.create({
      data: {
        token: new_refresh_token,
        user_id: user.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return reply.send({ access_token, refresh_token: new_refresh_token });
  });

  app.post('/logout', { preHandler: authenticate }, async (req, reply) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (parsed.success) {
      await revokeRefreshToken(parsed.data.refresh_token);
    }
    return reply.send({ success: true });
  });

  app.get('/me', { preHandler: authenticate }, async (req, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: req.currentUser!.id },
      select: {
        id: true, username: true, email: true, display_name: true,
        bio: true, avatar_url: true, gender: true, role: true,
        is_verified: true, follower_count: true, following_count: true,
        post_count: true, like_count: true, created_at: true,
      },
    });
    return reply.send(user);
  });
}
