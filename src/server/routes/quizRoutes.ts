import { Router } from 'express';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  notifications,
  questionOptions,
  questions,
  quizAttempts,
  quizzes,
  subjects,
  users,
} from '../../db/schema.ts';
import { type AuthRequest, requireAuth, requireRole } from '../auth.ts';
import { ensureSeedData } from '../seed.ts';

const router = Router();

const createSubjectSchema = z.object({
  name: z.string().trim().min(2).max(100),
  code: z.string().trim().min(2).max(20),
  description: z.string().trim().max(300).optional(),
});

const questionPayloadSchema = z.object({
  questionType: z.enum(['mcq', 'true_false']),
  questionText: z.string().trim().min(5, 'Question text must be at least 5 characters.'),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  topic: z.string().trim().min(1).max(100).default('General'),
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

const createQuizSchema = z.object({
  title: z.string().trim().min(3, 'Quiz title is required.').max(160),
  subjectId: z.number().int().positive(),
  description: z.string().trim().max(1000).optional().default(''),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  durationMinutes: z.number().int().min(1).max(300),
  totalMarks: z.number().int().min(0).max(5000).optional(),
  passingPercentage: z.number().int().min(1).max(100).default(50),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  instructions: z.string().trim().max(2000).optional().default(''),
  status: z.enum(['draft', 'published']).default('draft'),
  isActive: z.boolean().optional().default(true),
  questions: z.array(questionPayloadSchema).optional().default([]),
});

const updateQuizSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  subjectId: z.number().int().positive().optional(),
  description: z.string().trim().max(1000).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  durationMinutes: z.number().int().min(1).max(300).optional(),
  passingPercentage: z.number().int().min(1).max(100).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  instructions: z.string().trim().max(2000).optional(),
  status: z.enum(['draft', 'published']).optional(),
  isActive: z.boolean().optional(),
});

const reuseQuestionsSchema = z.object({
  questionIds: z.array(z.number().int().positive()).min(1),
});

export async function recalculateQuizStats(quizId: number) {
  const quizQuestions = await db
    .select({ marks: questions.marks })
    .from(questions)
    .where(eq(questions.quizId, quizId));

  const questionCount = quizQuestions.length;
  const totalMarks = quizQuestions.reduce((sum, q) => sum + q.marks, 0);

  await db
    .update(quizzes)
    .set({
      questionCount,
      totalMarks,
      updatedAt: new Date(),
    })
    .where(eq(quizzes.id, quizId));
}

// Subjects
router.get('/subjects', requireAuth, async (_req, res) => {
  try {
    await ensureSeedData();
    const list = await db.select().from(subjects).orderBy(asc(subjects.name));
    return res.json({ subjects: list });
  } catch (error) {
    console.error('List subjects error:', error);
    return res.status(500).json({ error: 'Failed to load subjects.' });
  }
});

router.post('/subjects', requireAuth, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const parsed = createSubjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid subject data.' });
    }

    const [created] = await db
      .insert(subjects)
      .values({
        name: parsed.data.name,
        code: parsed.data.code.toUpperCase(),
        description: parsed.data.description ?? '',
        createdBy: req.user!.id,
      })
      .returning();

    return res.status(201).json({ subject: created });
  } catch (error) {
    console.error('Create subject error:', error);
    return res.status(400).json({ error: 'Subject name or code already exists.' });
  }
});

// Quizzes list
router.get('/quizzes', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeedData();
    const currentUser = req.user!;
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const subjectIdParam = typeof req.query.subjectId === 'string' ? Number(req.query.subjectId) : null;
    const difficultyParam = typeof req.query.difficulty === 'string' ? req.query.difficulty : '';
    const statusParam = typeof req.query.status === 'string' ? req.query.status : '';

    const baseQuery = db
      .select({
        id: quizzes.id,
        title: quizzes.title,
        subjectId: quizzes.subjectId,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        teacherId: quizzes.teacherId,
        teacherName: users.fullName,
        description: quizzes.description,
        difficulty: quizzes.difficulty,
        durationMinutes: quizzes.durationMinutes,
        totalMarks: quizzes.totalMarks,
        passingPercentage: quizzes.passingPercentage,
        startDate: quizzes.startDate,
        endDate: quizzes.endDate,
        instructions: quizzes.instructions,
        questionCount: quizzes.questionCount,
        status: quizzes.status,
        isActive: quizzes.isActive,
        createdAt: quizzes.createdAt,
        updatedAt: quizzes.updatedAt,
      })
      .from(quizzes)
      .innerJoin(subjects, eq(quizzes.subjectId, subjects.id))
      .innerJoin(users, eq(quizzes.teacherId, users.id));

    const rows =
      currentUser.role === 'teacher'
        ? await baseQuery.where(eq(quizzes.teacherId, currentUser.id)).orderBy(desc(quizzes.createdAt))
        : await baseQuery
            .where(and(eq(quizzes.status, 'published'), eq(quizzes.isActive, true)))
            .orderBy(desc(quizzes.createdAt));

    const filtered = rows.filter((q) => {
      if (search && !q.title.toLowerCase().includes(search) && !q.subjectName.toLowerCase().includes(search)) {
        return false;
      }
      if (subjectIdParam && q.subjectId !== subjectIdParam) return false;
      if (difficultyParam && difficultyParam !== 'all' && q.difficulty !== difficultyParam) return false;
      if (statusParam && statusParam !== 'all' && q.status !== statusParam) return false;
      return true;
    });

    if (currentUser.role === 'student') {
      const studentAttemptRows = await db
        .select({
          quizId: quizAttempts.quizId,
          status: quizAttempts.status,
          percentage: quizAttempts.percentage,
          passed: quizAttempts.passed,
          id: quizAttempts.id,
        })
        .from(quizAttempts)
        .where(eq(quizAttempts.studentId, currentUser.id))
        .orderBy(desc(quizAttempts.createdAt));

      const attemptMap = new Map<
        number,
        { attemptCount: number; inProgressAttemptId: number | null; bestPercentage: number | null; lastAttemptId: number | null }
      >();

      for (const att of studentAttemptRows) {
        const prev = attemptMap.get(att.quizId) ?? {
          attemptCount: 0,
          inProgressAttemptId: null,
          bestPercentage: null,
          lastAttemptId: null,
        };
        if (att.status === 'in_progress') {
          prev.inProgressAttemptId = att.id;
        } else {
          prev.attemptCount += 1;
          prev.bestPercentage =
            prev.bestPercentage === null ? att.percentage : Math.max(prev.bestPercentage, att.percentage);
          if (prev.lastAttemptId === null) prev.lastAttemptId = att.id;
        }
        attemptMap.set(att.quizId, prev);
      }

      return res.json({
        quizzes: filtered.map((q) => {
          const meta = attemptMap.get(q.id);
          return {
            ...q,
            studentAttemptCount: meta?.attemptCount ?? 0,
            inProgressAttemptId: meta?.inProgressAttemptId ?? null,
            bestPercentage: meta?.bestPercentage ?? null,
            lastAttemptId: meta?.lastAttemptId ?? null,
          };
        }),
      });
    }

    // Teacher: attach attempt stats per quiz
    const quizIds = filtered.map((q) => q.id);
    const statsMap = new Map<number, { attemptCount: number; avgScore: number }>();
    if (quizIds.length > 0) {
      const statsRows = await db
        .select({
          quizId: quizAttempts.quizId,
          attemptCount: sql<number>`count(*)::int`,
          avgScore: sql<number>`coalesce(avg(${quizAttempts.percentage}), 0)::float`,
        })
        .from(quizAttempts)
        .where(
          and(
            inArray(quizAttempts.quizId, quizIds),
            inArray(quizAttempts.status, ['submitted', 'timed_out']),
          ),
        )
        .groupBy(quizAttempts.quizId);

      for (const s of statsRows) {
        statsMap.set(s.quizId, {
          attemptCount: Number(s.attemptCount),
          avgScore: Math.round(Number(s.avgScore) * 10) / 10,
        });
      }
    }

    return res.json({
      quizzes: filtered.map((q) => ({
        ...q,
        attemptCount: statsMap.get(q.id)?.attemptCount ?? 0,
        avgScore: statsMap.get(q.id)?.avgScore ?? 0,
      })),
    });
  } catch (error) {
    console.error('List quizzes error:', error);
    return res.status(500).json({ error: 'Failed to load quizzes.' });
  }
});

// Create Quiz
router.post('/quizzes', requireAuth, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const parsed = createQuizSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid quiz payload.' });
    }

    const data = parsed.data;
    if (data.status === 'published' && data.questions.length === 0) {
      return res.status(400).json({
        error: 'A quiz must contain at least one question before publishing. Save as draft first or add questions.',
      });
    }

    for (const q of data.questions) {
      if (!q.options.some((o) => o.isCorrect)) {
        return res.status(400).json({
          error: `Question "${q.questionText.slice(0, 40)}..." must have at least one correct option.`,
        });
      }
    }

    const computedMarks =
      data.questions.length > 0
        ? data.questions.reduce((acc, q) => acc + q.marks, 0)
        : (data.totalMarks ?? 0);

    const createdQuiz = await db.transaction(async (tx) => {
      const [quiz] = await tx
        .insert(quizzes)
        .values({
          title: data.title,
          subjectId: data.subjectId,
          teacherId: req.user!.id,
          description: data.description,
          difficulty: data.difficulty,
          durationMinutes: data.durationMinutes,
          totalMarks: computedMarks,
          passingPercentage: data.passingPercentage,
          startDate: data.startDate ? new Date(data.startDate) : null,
          endDate: data.endDate ? new Date(data.endDate) : null,
          instructions: data.instructions,
          questionCount: data.questions.length,
          status: data.status,
          isActive: data.isActive,
        })
        .returning();

      for (const q of data.questions) {
        const [qRow] = await tx
          .insert(questions)
          .values({
            quizId: quiz.id,
            teacherId: req.user!.id,
            subjectId: data.subjectId,
            topic: q.topic,
            questionType: q.questionType,
            questionText: q.questionText,
            difficulty: q.difficulty,
            marks: q.marks,
            explanation: q.explanation ?? '',
            inBank: q.inBank ?? true,
          })
          .returning();

        await tx.insert(questionOptions).values(
          q.options.map((opt, idx) => ({
            questionId: qRow.id,
            optionText: opt.optionText,
            isCorrect: opt.isCorrect,
            optionOrder: idx,
          })),
        );
      }

      if (data.status === 'published' && data.isActive) {
        const studentUsers = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.role, 'student'));
        if (studentUsers.length > 0) {
          await tx.insert(notifications).values(
            studentUsers.map((s) => ({
              userId: s.id,
              title: 'New Quiz Published',
              message: `${quiz.title} is now open for student attempts.`,
              type: 'quiz',
              linkUrl: `/student/quizzes/${quiz.id}`,
            })),
          );
        }
      }

      return quiz;
    });

    return res.status(201).json({ quiz: createdQuiz });
  } catch (error) {
    console.error('Create quiz error:', error);
    return res.status(500).json({ error: 'Failed to create quiz.' });
  }
});

// Get Single Quiz Details
router.get('/quizzes/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const quizId = Number(req.params.id);
    if (!Number.isInteger(quizId) || quizId <= 0) {
      return res.status(400).json({ error: 'Invalid quiz ID.' });
    }

    const rows = await db
      .select({
        id: quizzes.id,
        title: quizzes.title,
        subjectId: quizzes.subjectId,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        teacherId: quizzes.teacherId,
        teacherName: users.fullName,
        description: quizzes.description,
        difficulty: quizzes.difficulty,
        durationMinutes: quizzes.durationMinutes,
        totalMarks: quizzes.totalMarks,
        passingPercentage: quizzes.passingPercentage,
        startDate: quizzes.startDate,
        endDate: quizzes.endDate,
        instructions: quizzes.instructions,
        questionCount: quizzes.questionCount,
        status: quizzes.status,
        isActive: quizzes.isActive,
        createdAt: quizzes.createdAt,
        updatedAt: quizzes.updatedAt,
      })
      .from(quizzes)
      .innerJoin(subjects, eq(quizzes.subjectId, subjects.id))
      .innerJoin(users, eq(quizzes.teacherId, users.id))
      .where(eq(quizzes.id, quizId))
      .limit(1);

    const quiz = rows[0];
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found.' });
    }

    if (req.user!.role === 'student') {
      if (quiz.status !== 'published' || !quiz.isActive) {
        return res.status(403).json({ error: 'This quiz is not currently available.' });
      }
      // Security: Never expose questions or correct answers here; students only get instructions/metadata
      const studentAttempts = await db
        .select({
          id: quizAttempts.id,
          status: quizAttempts.status,
          percentage: quizAttempts.percentage,
          passed: quizAttempts.passed,
          submittedAt: quizAttempts.submittedAt,
        })
        .from(quizAttempts)
        .where(and(eq(quizAttempts.quizId, quizId), eq(quizAttempts.studentId, req.user!.id)))
        .orderBy(desc(quizAttempts.createdAt));

      return res.json({ quiz, attempts: studentAttempts });
    }

    // Teacher access check
    if (quiz.teacherId !== req.user!.id) {
      return res.status(403).json({ error: 'You are not authorized to view this quiz.' });
    }

    const quizQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.quizId, quizId))
      .orderBy(asc(questions.id));

    const qIds = quizQuestions.map((q) => q.id);
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
      const arr = optionsByQ.get(opt.questionId) ?? [];
      arr.push(opt);
      optionsByQ.set(opt.questionId, arr);
    }

    return res.json({
      quiz,
      questions: quizQuestions.map((q) => ({
        ...q,
        options: optionsByQ.get(q.id) ?? [],
      })),
    });
  } catch (error) {
    console.error('Get quiz error:', error);
    return res.status(500).json({ error: 'Failed to load quiz details.' });
  }
});

// Update Quiz
router.put('/quizzes/:id', requireAuth, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const quizId = Number(req.params.id);
    if (!Number.isInteger(quizId) || quizId <= 0) {
      return res.status(400).json({ error: 'Invalid quiz ID.' });
    }

    const existing = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
    if (!existing[0]) {
      return res.status(404).json({ error: 'Quiz not found.' });
    }
    if (existing[0].teacherId !== req.user!.id) {
      return res.status(403).json({ error: 'You can only update your own quizzes.' });
    }

    const parsed = updateQuizSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid update payload.' });
    }

    if (parsed.data.status === 'published') {
      const qCountRows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(questions)
        .where(eq(questions.quizId, quizId));
      if (Number(qCountRows[0]?.count ?? 0) === 0) {
        return res.status(400).json({ error: 'Add at least one question before publishing this quiz.' });
      }
    }

    const updateValues: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.title !== undefined) updateValues.title = parsed.data.title;
    if (parsed.data.subjectId !== undefined) updateValues.subjectId = parsed.data.subjectId;
    if (parsed.data.description !== undefined) updateValues.description = parsed.data.description;
    if (parsed.data.difficulty !== undefined) updateValues.difficulty = parsed.data.difficulty;
    if (parsed.data.durationMinutes !== undefined) updateValues.durationMinutes = parsed.data.durationMinutes;
    if (parsed.data.passingPercentage !== undefined) updateValues.passingPercentage = parsed.data.passingPercentage;
    if (parsed.data.startDate !== undefined) {
      updateValues.startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : null;
    }
    if (parsed.data.endDate !== undefined) {
      updateValues.endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : null;
    }
    if (parsed.data.instructions !== undefined) updateValues.instructions = parsed.data.instructions;
    if (parsed.data.status !== undefined) updateValues.status = parsed.data.status;
    if (parsed.data.isActive !== undefined) updateValues.isActive = parsed.data.isActive;

    const [updated] = await db
      .update(quizzes)
      .set(updateValues)
      .where(eq(quizzes.id, quizId))
      .returning();

    return res.json({ quiz: updated });
  } catch (error) {
    console.error('Update quiz error:', error);
    return res.status(500).json({ error: 'Failed to update quiz.' });
  }
});

// Delete Quiz
router.delete('/quizzes/:id', requireAuth, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const quizId = Number(req.params.id);
    if (!Number.isInteger(quizId) || quizId <= 0) {
      return res.status(400).json({ error: 'Invalid quiz ID.' });
    }

    const existing = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
    if (!existing[0]) {
      return res.status(404).json({ error: 'Quiz not found.' });
    }
    if (existing[0].teacherId !== req.user!.id) {
      return res.status(403).json({ error: 'You can only delete your own quizzes.' });
    }

    await db.delete(quizzes).where(eq(quizzes.id, quizId));
    return res.json({ message: 'Quiz deleted successfully.' });
  } catch (error) {
    console.error('Delete quiz error:', error);
    return res.status(500).json({ error: 'Failed to delete quiz.' });
  }
});

// Reuse questions from Question Bank into a quiz
router.post('/quizzes/:id/reuse-questions', requireAuth, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const quizId = Number(req.params.id);
    if (!Number.isInteger(quizId) || quizId <= 0) {
      return res.status(400).json({ error: 'Invalid quiz ID.' });
    }

    const existingQuiz = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
    if (!existingQuiz[0]) {
      return res.status(404).json({ error: 'Quiz not found.' });
    }
    if (existingQuiz[0].teacherId !== req.user!.id) {
      return res.status(403).json({ error: 'You can only modify your own quizzes.' });
    }

    const parsed = reuseQuestionsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Select at least one valid question to add.' });
    }

    const sourceQuestions = await db
      .select()
      .from(questions)
      .where(
        and(
          inArray(questions.id, parsed.data.questionIds),
          eq(questions.teacherId, req.user!.id),
        ),
      );

    if (sourceQuestions.length === 0) {
      return res.status(404).json({ error: 'No matching Question Bank questions found.' });
    }

    const sourceOptions = await db
      .select()
      .from(questionOptions)
      .where(inArray(questionOptions.questionId, sourceQuestions.map((q) => q.id)))
      .orderBy(asc(questionOptions.optionOrder));

    const optsMap = new Map<number, typeof sourceOptions>();
    for (const opt of sourceOptions) {
      const arr = optsMap.get(opt.questionId) ?? [];
      arr.push(opt);
      optsMap.set(opt.questionId, arr);
    }

    await db.transaction(async (tx) => {
      for (const src of sourceQuestions) {
        const [cloned] = await tx
          .insert(questions)
          .values({
            quizId,
            teacherId: req.user!.id,
            subjectId: src.subjectId ?? existingQuiz[0].subjectId,
            topic: src.topic,
            questionType: src.questionType,
            questionText: src.questionText,
            difficulty: src.difficulty,
            marks: src.marks,
            explanation: src.explanation,
            inBank: false,
          })
          .returning();

        const opts = optsMap.get(src.id) ?? [];
        if (opts.length > 0) {
          await tx.insert(questionOptions).values(
            opts.map((o, idx) => ({
              questionId: cloned.id,
              optionText: o.optionText,
              isCorrect: o.isCorrect,
              optionOrder: idx,
            })),
          );
        }
      }
    });

    await recalculateQuizStats(quizId);
    return res.json({ message: `${sourceQuestions.length} question(s) added to quiz.` });
  } catch (error) {
    console.error('Reuse questions error:', error);
    return res.status(500).json({ error: 'Failed to add questions from bank.' });
  }
});

export default router;
