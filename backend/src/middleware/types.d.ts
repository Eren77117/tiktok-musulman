import { Role, Gender } from '@prisma/client';

declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: {
      id: string;
      role: Role;
      is_banned: boolean;
      gender: Gender;
    };
  }
}
