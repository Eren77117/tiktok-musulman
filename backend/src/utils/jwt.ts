import { FastifyInstance } from 'fastify';
import { prisma } from '../config/database';
import { env } from '../config/env';

export interface JwtPayload {
  sub: string;
  role: string;
  type: 'access' | 'refresh';
}

export function signAccessToken(app: FastifyInstance, payload: Omit<JwtPayload, 'type'>) {
  return app.jwt.sign({ ...payload, type: 'access' }, { expiresIn: '15m' });
}

export function signRefreshToken(app: FastifyInstance, payload: Omit<JwtPayload, 'type'>) {
  return app.jwt.sign({ ...payload, type: 'refresh' }, { expiresIn: '7d' });
}

export async function revokeRefreshToken(token: string) {
  await prisma.refreshToken.updateMany({
    where: { token },
    data: { revoked: true },
  });
}

export async function validateRefreshToken(token: string) {
  const record = await prisma.refreshToken.findUnique({ where: { token } });
  if (!record || record.revoked || record.expires_at < new Date()) return null;
  return record;
}
