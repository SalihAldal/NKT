import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../common/middleware.js';
import { ok, fail, getRequestId } from '../common/response.js';
import { createPresignedUpload, storeLocalUpload, readLocalFile, validateUploadMeta } from '../providers/storage/storage.provider.js';
import { config } from '../config/index.js';

export async function storageRoutes(app: FastifyInstance) {
  app.post('/presign', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      purpose: z.enum(['avatar', 'cover', 'support']),
      mime: z.string(),
      size: z.number().positive(),
    }).parse(req.body);

    try {
      validateUploadMeta(body.mime, body.size);
    } catch {
      return reply.status(400).send(fail('INVALID_UPLOAD', 'Invalid file type or size', undefined, getRequestId(req)));
    }

    const intent = await createPresignedUpload(req.userId!, body.purpose);
    return ok(intent, getRequestId(req));
  });

  app.put('/upload/*', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    if (config.STORAGE_PROVIDER !== 'local') {
      return reply.status(501).send(fail('NOT_IMPLEMENTED', 'Direct upload only supported for local storage', undefined, getRequestId(req)));
    }
    const key = (req.params as { '*': string })['*'];
    if (!key.startsWith(`avatar/${req.userId}/`) && !key.startsWith(`cover/${req.userId}/`) && !key.startsWith(`support/${req.userId}/`)) {
      return reply.status(403).send(fail('FORBIDDEN', 'Cannot upload to this path', undefined, getRequestId(req)));
    }
    const mime = String(req.headers['content-type'] ?? 'application/octet-stream');
    const buffer = Buffer.from(await req.body as Buffer);
    try {
      validateUploadMeta(mime, buffer.length);
    } catch {
      return reply.status(400).send(fail('INVALID_UPLOAD', 'Invalid file', undefined, getRequestId(req)));
    }
    const stored = await storeLocalUpload(key, buffer, mime);
    return ok(stored, getRequestId(req));
  });

  app.get('/files/*', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const key = (req.params as { '*': string })['*'];
    if (!key.startsWith(`avatar/${req.userId}/`) && !key.startsWith(`cover/${req.userId}/`) && !key.startsWith(`support/${req.userId}/`)) {
      return reply.status(403).send(fail('FORBIDDEN', 'Unauthorized file access', undefined, getRequestId(req)));
    }
    const buffer = await readLocalFile(key);
    reply.header('Content-Type', 'image/jpeg');
    return reply.send(buffer);
  });
}
