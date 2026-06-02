import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import { env } from '../config/env';
import { v2 as cloudinary } from 'cloudinary';
import path from 'path';
import fs from 'fs';

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_VIDEO_BYTES = env.UPLOAD_MAX_SIZE_MB * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

if (env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
}

export async function uploadRoutes(app: FastifyInstance) {
  app.post('/video', { preHandler: authenticate }, async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.status(400).send({ error: 'No file provided' });

    if (!ALLOWED_VIDEO_TYPES.includes(data.mimetype)) {
      return reply.status(400).send({ error: 'Invalid video format. Use MP4 or MOV.' });
    }

    const buffer = await data.toBuffer();
    if (buffer.length > MAX_VIDEO_BYTES) {
      return reply.status(400).send({ error: `Video exceeds ${env.UPLOAD_MAX_SIZE_MB}MB limit` });
    }

    if (!env.CLOUDINARY_CLOUD_NAME) {
      // Local fallback for development
      const filename = `${Date.now()}-${data.filename}`;
      const uploadDir = path.join(process.cwd(), 'uploads');
      fs.mkdirSync(uploadDir, { recursive: true });
      fs.writeFileSync(path.join(uploadDir, filename), buffer);
      return reply.send({ url: `/uploads/${filename}` });
    }

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ resource_type: 'video', folder: 'tiktok-musulman/videos' }, (err, res) => {
          if (err || !res) return reject(err);
          resolve(res as { secure_url: string });
        })
        .end(buffer);
    });

    return reply.send({ url: result.secure_url });
  });

  app.post('/image', { preHandler: authenticate }, async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.status(400).send({ error: 'No file provided' });

    if (!ALLOWED_IMAGE_TYPES.includes(data.mimetype)) {
      return reply.status(400).send({ error: 'Invalid image format. Use JPEG, PNG or WebP.' });
    }

    const buffer = await data.toBuffer();
    if (buffer.length > MAX_IMAGE_BYTES) {
      return reply.status(400).send({ error: 'Image exceeds 10MB limit' });
    }

    if (!env.CLOUDINARY_CLOUD_NAME) {
      const filename = `${Date.now()}-${data.filename}`;
      const uploadDir = path.join(process.cwd(), 'uploads');
      fs.mkdirSync(uploadDir, { recursive: true });
      fs.writeFileSync(path.join(uploadDir, filename), buffer);
      return reply.send({ url: `/uploads/${filename}` });
    }

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ resource_type: 'image', folder: 'tiktok-musulman/images' }, (err, res) => {
          if (err || !res) return reject(err);
          resolve(res as { secure_url: string });
        })
        .end(buffer);
    });

    return reply.send({ url: result.secure_url });
  });
}
