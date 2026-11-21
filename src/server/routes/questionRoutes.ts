import { Router } from 'express';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import { questionOptions, questions, quizzes, subjects } from '../../db/schema.ts';
import { type AuthRequest, requireAuth, requireRole } from '../auth.ts';
import { recalculateQuizStats } from './quizRoutes.ts';

const router = Router();

const questionSchema = z.object({
  quizId: z.number().int().positive().nullable().optional(),
  subjectId: z.number().int().positive().nullable().optional(),
  topic: z.string().trim().min(1).max(100).default('General'),
  questionType: z.enum(['mcq', 'true_false']),
  questionText: z.string().trim().min(5, 'Question text must be at least 5 characters.'),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  marks: z.number().int().min(1).max(100).default(1),
  explanation: z.string().trim().max(1000).optional().default(''),
  inBank: z.boolean().optional().default(true),
  options: z
    .array(
      z.object({
        optionText: z.string().trim().min(1, 'Option text cannot be empty.'),
        isCorrect: z.boolean(),
      }),
    )
    .min(2)
    .max(6),
});

router.get('/', requireAuth, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const subjectIdParam = typeof req.query.subjectId === 'string' ? Number(req.query.subjectId) : null;
    const difficultyParam = typeof req.query.difficulty === 'string' ? req.query.difficulty : '';
    const topicParam = typeof req.query.topic === 'string' ? req.query.topic.trim().toLowerCase() : '';
    const searchParam = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const quizIdParam = typeof req.query.quizId === 'string' ? Number(req.query.quizId) : null;
    const bankOnly = req.query.bankOnly === 'true';

    const rows = await db
      .select({
        id: questions.id,
        quizId: questions.quizId,
        teacherId: questions.teacherId,
        subjectId: questions.subjectId,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        topic: questions.topic,
        questionType: questions.questionType,
        questionText: questions.questionText,
        difficulty: questions.difficulty,
        marks: questions.marks,
        explanation: questions.explanation,
        inBank: questions.inBank,
        createdAt: questions.createdAt,
        updatedAt: questions.updatedAt,
      })
      .from(questions)
      .leftJoin(subjects, eq(questions.subjectId, subjects.id))
      .where(eq(questions.teacherId, req.user!.id))
      .orderBy(desc(questions.createdAt));

    const filtered = rows.filter((q) => {
      if (bankOnly && !q.inBank) return false;
      if (subjectIdParam && q.subjectId !== subjectIdParam) return false;
      if (quizIdParam && q.quizId !== quizIdParam) return false;
      if (difficultyParam && difficultyParam !== 'all' && q.difficulty !== difficultyParam) return false;
      if (topicParam && !q.topic.toLowerCase().includes(topicParam)) return false;
      if (
        searchParam &&
        !q.questionText.toLowerCase().includes(searchParam) &&
        !q.topic.toLowerCase().includes(searchParam)
      ) {
        return false;
      }
      return true;
    });

    const qIds = filtered.map((q) => q.id);
    const options =
      qIds.length > 0
        ? await db
            .select()
            .from(questionOptions)
            .where(inArray(questionOptions.questionId, qIds))
            .orderBy(asc(questionOptions.optionOrder))
        : [];

    const optionsByQ = new Map<number, typeof options>();
    for (const opt of options) {
      const list = optionsByQ.get(opt.questionId) ?? [];
      list.push(opt);
      optionsByQ.set(opt.questionId, list);
    }

    return res.json({
      questions: filtered.map((q) => ({
        ...q,
        options: optionsByQ.get(q.id) ?? [],
      })),
    });
  } catch (error) {
    console.error('List questions error:', error);
    return res.status(500).json({ error: 'Failed to load questions.' });
  }
});

router.post('/', requireAuth, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const parsed = questionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid question payload.' });
    }

    const data = parsed.data;
    if (!data.options.some((o) => o.isCorrect)) {
      return res.status(400).json({ error: 'At least one option must be marked as correct.' });
    }

    let resolvedSubjectId = data.subjectId ?? null;
    if (data.quizId) {
      const quizRows = await db
        .select()
        .from(quizzes)
        .where(and(eq(quizzes.id, data.quizId), eq(quizzes.teacherId, req.user!.id)))
        .limit(1);
      if (!quizRows[0]) {
        return res.status(403).json({ error: 'Quiz not found or not owned by you.' });
      }
      resolvedSubjectId = resolvedSubjectId ?? quizRows[0].subjectId;
    }

    const result = await db.transaction(async (tx) => {
      const [qRow] = await tx
        .insert(questions)
        .values({
          quizId: data.quizId ?? null,
          teacherId: req.user!.id,
          subjectId: resolvedSubjectId,
          topic: data.topic,
          questionType: data.questionType,
          questionText: data.questionText,
          difficulty: data.difficulty,
          marks: data.marks,
          explanation: data.explanation ?? '',
          inBank: data.inBank ?? true,
        })
        .returning();

      const optRows = await tx
        .insert(questionOptions)
        .values(
          data.options.map((o, idx) => ({
            questionId: qRow.id,
            optionText: o.optionText,
            isCorrect: o.isCorrect,
            optionOrder: idx,
          })),
        )
        .returning();

      return { ...qRow, options: optRows };
    });

    if (data.quizId) {
      await recalculateQuizStats(data.quizId);
    }

    return res.status(201).json({ question: result });
  } catch (error) {
    console.error('Create question error:', error);
    return res.status(500).json({ error: 'Failed to create question.' });
  }
});

router.put('/:id', requireAuth, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const questionId = Number(req.params.id);
    if (!Number.isInteger(questionId) || questionId <= 0) {
      return res.status(400).json({ error: 'Invalid question ID.' });
    }

    const existing = await db.select().from(questions).where(eq(questions.id, questionId)).limit(1);
    if (!existing[0]) {
      return res.status(404).json({ error: 'Question not found.' });
    }
    if (existing[0].teacherId !== req.user!.id) {
      return res.status(403).json({ error: 'You can only edit your own questions.' });
    }

    const parsed = questionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid question payload.' });
    }

    const data = parsed.data;
    if (!data.options.some((o) => o.isCorrect)) {
      return res.status(400).json({ error: 'At least one option must be marked as correct.' });
    }

    const updated = await db.transaction(async (tx) => {
      const [qRow] = await tx
        .update(questions)
        .set({
          subjectId: data.subjectId ?? existing[0].subjectId,
          topic: data.topic,
          questionType: data.questionType,
          questionText: data.questionText,
          difficulty: data.difficulty,
          marks: data.marks,
          explanation: data.explanation ?? '',
          inBank: data.inBank ?? existing[0].inBank,
          updatedAt: new Date(),
        })
        .where(eq(questions.id, questionId))
        .returning();

      await tx.delete(questionOptions).where(eq(questionOptions.questionId, questionId));

      const optRows = await tx
        .insert(questionOptions)
        .values(
          data.options.map((o, idx) => ({
            questionId,
            optionText: o.optionText,
            isCorrect: o.isCorrect,
            optionOrder: idx,
          })),
        )
        .returning();

      return { ...qRow, options: optRows };
    });

    if (existing[0].quizId) {
      await recalculateQuizStats(existing[0].quizId);
    }

    return res.json({ question: updated });
  } catch (error) {
    console.error('Update question error:', error);
    return res.status(500).json({ error: 'Failed to update question.' });
  }
});

router.delete('/:id', requireAuth, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const questionId = Number(req.params.id);
    if (!Number.isInteger(questionId) || questionId <= 0) {
      return res.status(400).json({ error: 'Invalid question ID.' });
    }

    const existing = await db.select().from(questions).where(eq(questions.id, questionId)).limit(1);
    if (!existing[0]) {
      return res.status(404).json({ error: 'Question not found.' });
    }
    if (existing[0].teacherId !== req.user!.id) {
      return res.status(403).json({ error: 'You can only delete your own questions.' });
    }

    await db.delete(questions).where(eq(questions.id, questionId));
    if (existing[0].quizId) {
      await recalculateQuizStats(existing[0].quizId);
    }

    return res.json({ message: 'Question deleted successfully.' });
  } catch (error) {
    console.error('Delete question error:', error);
    return res.status(500).json({ error: 'Failed to delete question.' });
  }
});

export default router;
