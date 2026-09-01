import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { authMiddleware } from '../common/middleware.js';
import { ok, getRequestId, ERR } from '../common/response.js';
import { prisma } from '../database/prisma.js';

export async function quizRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  app.get('/', async (req, reply) => {
    const quizzes = await prisma.quiz.findMany({
      where: { ownerId: req.userId!, status: { not: 'DELETED' } },
      include: { questions: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return ok(quizzes, getRequestId(req));
  });

  app.post('/', async (req, reply) => {
    const body = z.object({
      title: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      categoryId: z.string().optional(),
      visibility: z.enum(['PUBLIC', 'FRIENDS', 'PRIVATE']).default('PRIVATE'),
      timeLimit: z.number().optional(),
      questions: z.array(z.object({
        text: z.string(),
        type: z.string().default('multiple_choice'),
        options: z.array(z.string()).optional(),
        correctAnswer: z.string().optional(),
        order: z.number().default(0),
      })).optional(),
    }).parse(req.body);

    const quiz = await prisma.quiz.create({
      data: {
        ownerId: req.userId!,
        title: body.title,
        description: body.description,
        categoryId: body.categoryId,
        visibility: body.visibility,
        timeLimit: body.timeLimit,
        questions: body.questions ? { create: body.questions } : undefined,
      },
      include: { questions: true },
    });
    return ok(quiz, getRequestId(req));
  });

  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const quiz = await prisma.quiz.findUnique({ where: { id }, include: { questions: { orderBy: { order: 'asc' } } } });
    if (!quiz || quiz.status === 'DELETED') throw ERR.NOT_FOUND;
    if (quiz.visibility === 'PRIVATE' && quiz.ownerId !== req.userId) throw ERR.FORBIDDEN;
    return ok(quiz, getRequestId(req));
  });

  app.post('/:id/publish', async (req, reply) => {
    const { id } = req.params as { id: string };
    const quiz = await prisma.quiz.findUnique({ where: { id } });
    if (!quiz || quiz.ownerId !== req.userId) throw ERR.FORBIDDEN;
    const shareCode = randomBytes(4).toString('hex').toUpperCase();
    const updated = await prisma.quiz.update({ where: { id }, data: { status: 'PUBLISHED', shareCode } });
    return ok(updated, getRequestId(req));
  });

  app.post('/:id/attempts', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      solverName: z.string(),
      answers: z.record(z.string()),
    }).parse(req.body);
    const quiz = await prisma.quiz.findUnique({ where: { id }, include: { questions: true } });
    if (!quiz || quiz.status !== 'PUBLISHED') throw ERR.NOT_FOUND;

    let score = 0;
    for (const q of quiz.questions) {
      const ans = body.answers[q.id];
      if (ans && q.correctAnswer && ans.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) score++;
    }

    const result = await prisma.quizResult.create({
      data: {
        quizId: id,
        solverId: req.userId,
        solverName: body.solverName,
        score,
        totalQuestions: quiz.questions.length,
        answers: body.answers,
      },
    });
    return ok(result, getRequestId(req));
  });
}
