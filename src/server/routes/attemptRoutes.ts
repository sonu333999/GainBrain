import { Router } from 'express';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  notifications,
  questionOptions,
  questions,
  quizAttempts,
  quizzes,
  studentAnswers,
  subjects,
  users,
} from '../../db/schema.ts';
import { type AuthRequest, requireAuth, requireRole } from '../auth.ts';

const router = Router();

const startAttemptSchema = z.object({
  quizId: z.number().int().positive(),
});

const saveAnswerSchema = z.object({
  attemptId: z.number().int().positive(),
  questionId: z.number().int().positive(),
  selectedOptionId: z.number().int().positive().nullable(),
  isMarkedForReview: z.boolean().optional().default(false),
});

const submitAttemptSchema = z.object({
  attemptId: z.number().int().positive(),
  timedOut: z.boolean().optional().default(false),
  answers: z
    .array(
      z.object({
        questionId: z.number().int().positive(),
        selectedOptionId: z.number().int().positive().nullable(),
        isMarkedForReview: z.boolean().optional().default(false),
      }),
    )
    .optional(),
});

async function evaluateAndFinalizeAttempt(
  attemptId: number,
  incomingAnswers?: { questionId: number; selectedOptionId: number | null; isMarkedForReview?: boolean }[],
  timedOutFlag = false,
) {
  const [attempt] = await db
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.id, attemptId))
    .limit(1);

  if (!attempt) {
    throw new Error('Attempt not found');
  }

  if (attempt.status !== 'in_progress') {
    return attempt;
  }

  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, attempt.quizId)).limit(1);
  if (!quiz) {
    throw new Error('Quiz not found');
  }

  const quizQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quiz.id))
    .orderBy(asc(questions.id));

  const qIds = quizQuestions.map((q) => q.id);
  const allOptions =
    qIds.length > 0
      ? await db
          .select()
          .from(questionOptions)
          .where(inArray(questionOptions.questionId, qIds))
      : [];

  const validOptionMap = new Map<number, { questionId: number; isCorrect: boolean }>();
  for (const opt of allOptions) {
    validOptionMap.set(opt.id, { questionId: opt.questionId, isCorrect: opt.isCorrect });
  }

  // Persist any final answers included in submit body
  if (incomingAnswers && incomingAnswers.length > 0) {
    for (const ans of incomingAnswers) {
      if (!qIds.includes(ans.questionId)) continue;
      let validOptId: number | null = null;
      if (ans.selectedOptionId !== null) {
        const optMeta = validOptionMap.get(ans.selectedOptionId);
        if (optMeta && optMeta.questionId === ans.questionId) {
          validOptId = ans.selectedOptionId;
        }
      }

      await db
        .insert(studentAnswers)
        .values({
          attemptId,
          questionId: ans.questionId,
          selectedOptionId: validOptId,
          isMarkedForReview: ans.isMarkedForReview ?? false,
        })
        .onConflictDoUpdate({
          target: [studentAnswers.attemptId, studentAnswers.questionId],
          set: {
            selectedOptionId: validOptId,
            isMarkedForReview: ans.isMarkedForReview ?? false,
            updatedAt: new Date(),
          },
        });
    }
  }

  const storedAnswers = await db
    .select()
    .from(studentAnswers)
    .where(eq(studentAnswers.attemptId, attemptId));

  const storedMap = new Map<number, (typeof storedAnswers)[number]>();
  for (const row of storedAnswers) {
    storedMap.set(row.questionId, row);
  }

  let correctAnswers = 0;
  let incorrectAnswers = 0;
  let unansweredQuestions = 0;
  let totalMarks = 0;
  let obtainedMarks = 0;

  const updates: {
    questionId: number;
    selectedOptionId: number | null;
    isMarkedForReview: boolean;
    isCorrect: boolean;
    marksAwarded: number;
  }[] = [];

  for (const q of quizQuestions) {
    totalMarks += q.marks;
    const ans = storedMap.get(q.id);
    if (!ans || ans.selectedOptionId === null) {
      unansweredQuestions += 1;
      updates.push({
        questionId: q.id,
        selectedOptionId: null,
        isMarkedForReview: ans?.isMarkedForReview ?? false,
        isCorrect: false,
        marksAwarded: 0,
      });
      continue;
    }

    const optMeta = validOptionMap.get(ans.selectedOptionId);
    const isRight = Boolean(optMeta && optMeta.questionId === q.id && optMeta.isCorrect);
    if (isRight) {
      correctAnswers += 1;
      obtainedMarks += q.marks;
    } else {
      incorrectAnswers += 1;
    }
    updates.push({
      questionId: q.id,
      selectedOptionId: ans.selectedOptionId,
      isMarkedForReview: ans.isMarkedForReview,
      isCorrect: isRight,
      marksAwarded: isRight ? q.marks : 0,
    });
  }

  const percentage = totalMarks > 0 ? Math.round((obtainedMarks / totalMarks) * 1000) / 10 : 0;
  const passed = percentage >= quiz.passingPercentage;
  const elapsedRaw = Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000);
  const maxAllowed = quiz.durationMinutes * 60;
  const timeTakenSeconds = Math.min(maxAllowed, Math.max(1, elapsedRaw));
  const finalStatus = timedOutFlag || elapsedRaw >= maxAllowed ? 'timed_out' : 'submitted';

  const updatedAttempt = await db.transaction(async (tx) => {
    for (const u of updates) {
      await tx
        .insert(studentAnswers)
        .values({
          attemptId,
          questionId: u.questionId,
          selectedOptionId: u.selectedOptionId,
          isMarkedForReview: u.isMarkedForReview,
          isCorrect: u.isCorrect,
          marksAwarded: u.marksAwarded,
        })
        .onConflictDoUpdate({
          target: [studentAnswers.attemptId, studentAnswers.questionId],
          set: {
            isCorrect: u.isCorrect,
            marksAwarded: u.marksAwarded,
            updatedAt: new Date(),
          },
        });
    }

    const [finalRow] = await tx
      .update(quizAttempts)
      .set({
        status: finalStatus,
        totalQuestions: quizQuestions.length,
        correctAnswers,
        incorrectAnswers,
        unansweredQuestions,
        totalMarks,
        obtainedMarks,
        percentage,
        passed,
        timeTakenSeconds,
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(quizAttempts.id, attemptId))
      .returning();

    const [studentUser] = await tx
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, attempt.studentId))
      .limit(1);

    await tx.insert(notifications).values([
      {
        userId: attempt.studentId,
        title: passed ? 'Quiz Passed' : 'Quiz Completed',
        message: `You scored ${obtainedMarks}/${totalMarks} (${percentage}%) on ${quiz.title}.`,
        type: 'result',
        linkUrl: `/student/results/${attemptId}`,
      },
      {
        userId: quiz.teacherId,
        title: 'New Quiz Submission',
        message: `${studentUser?.fullName ?? 'A student'} completed ${quiz.title} with ${percentage}%.`,
        type: 'result',
        linkUrl: `/teacher/results`,
      },
    ]);

    return finalRow;
  });

  return updatedAttempt;
}

// Start or resume a quiz attempt (Student only)
router.post('/attempts/start', requireAuth, requireRole('student'), async (req: AuthRequest, res) => {
  try {
    const parsed = startAttemptSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Valid quizId is required.' });
    }

    const quizRows = await db
      .select({
        id: quizzes.id,
        title: quizzes.title,
        subjectId: quizzes.subjectId,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        durationMinutes: quizzes.durationMinutes,
        totalMarks: quizzes.totalMarks,
        passingPercentage: quizzes.passingPercentage,
        difficulty: quizzes.difficulty,
        instructions: quizzes.instructions,
        startDate: quizzes.startDate,
        endDate: quizzes.endDate,
        status: quizzes.status,
        isActive: quizzes.isActive,
      })
      .from(quizzes)
      .innerJoin(subjects, eq(quizzes.subjectId, subjects.id))
      .where(eq(quizzes.id, parsed.data.quizId))
      .limit(1);

    const quiz = quizRows[0];
    if (!quiz || quiz.status !== 'published' || !quiz.isActive) {
      return res.status(404).json({ error: 'Quiz is not available for attempts.' });
    }

    const now = new Date();
    if (quiz.startDate && now < quiz.startDate) {
      return res.status(403).json({ error: 'This quiz has not opened yet.' });
    }
    if (quiz.endDate && now > quiz.endDate) {
      return res.status(403).json({ error: 'This quiz submission window has closed.' });
    }

    const quizQuestions = await db
      .select({
        id: questions.id,
        questionType: questions.questionType,
        questionText: questions.questionText,
        difficulty: questions.difficulty,
        topic: questions.topic,
        marks: questions.marks,
      })
      .from(questions)
      .where(eq(questions.quizId, quiz.id))
      .orderBy(asc(questions.id));

    if (quizQuestions.length === 0) {
      return res.status(400).json({ error: 'This quiz has no questions yet.' });
    }

    const qIds = quizQuestions.map((q) => q.id);
    // CRITICAL SECURITY: Only select option id, questionId, optionText, optionOrder (NEVER isCorrect!)
    const options = await db
      .select({
        id: questionOptions.id,
        questionId: questionOptions.questionId,
        optionText: questionOptions.optionText,
        optionOrder: questionOptions.optionOrder,
      })
      .from(questionOptions)
      .where(inArray(questionOptions.questionId, qIds))
      .orderBy(asc(questionOptions.optionOrder));

    const optsByQ = new Map<number, typeof options>();
    for (const o of options) {
      const arr = optsByQ.get(o.questionId) ?? [];
      arr.push(o);
      optsByQ.set(o.questionId, arr);
    }

    // Check existing in_progress attempt
    const existingInProgress = await db
      .select()
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.quizId, quiz.id),
          eq(quizAttempts.studentId, req.user!.id),
          eq(quizAttempts.status, 'in_progress'),
        ),
      )
      .orderBy(desc(quizAttempts.createdAt))
      .limit(1);

    let activeAttempt = existingInProgress[0];
    if (activeAttempt) {
      const elapsedSeconds = Math.floor((Date.now() - activeAttempt.startedAt.getTime()) / 1000);
      if (elapsedSeconds >= quiz.durationMinutes * 60) {
        // Auto-finalize expired attempt before creating a new one
        await evaluateAndFinalizeAttempt(activeAttempt.id, undefined, true);
        activeAttempt = undefined as never;
      }
    }

    if (!activeAttempt) {
      const totalMarks = quizQuestions.reduce((sum, q) => sum + q.marks, 0);
      const [created] = await db
        .insert(quizAttempts)
        .values({
          quizId: quiz.id,
          studentId: req.user!.id,
          status: 'in_progress',
          totalQuestions: quizQuestions.length,
          totalMarks,
          startedAt: new Date(),
        })
        .returning();
      activeAttempt = created;
    }

    const savedAnswers = await db
      .select({
        questionId: studentAnswers.questionId,
        selectedOptionId: studentAnswers.selectedOptionId,
        isMarkedForReview: studentAnswers.isMarkedForReview,
      })
      .from(studentAnswers)
      .where(eq(studentAnswers.attemptId, activeAttempt.id));

    const elapsed = Math.floor((Date.now() - activeAttempt.startedAt.getTime()) / 1000);
    const remainingSeconds = Math.max(0, quiz.durationMinutes * 60 - elapsed);

    return res.json({
      attempt: activeAttempt,
      remainingSeconds,
      quiz,
      questions: quizQuestions.map((q) => ({
        ...q,
        options: optsByQ.get(q.id) ?? [],
      })),
      savedAnswers,
    });
  } catch (error) {
    console.error('Start attempt error:', error);
    return res.status(500).json({ error: 'Failed to start quiz attempt.' });
  }
});

// Save answer / mark for review mid-quiz
router.post('/attempts/save-answer', requireAuth, requireRole('student'), async (req: AuthRequest, res) => {
  try {
    const parsed = saveAnswerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid answer payload.' });
    }

    const [attempt] = await db
      .select()
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.id, parsed.data.attemptId),
          eq(quizAttempts.studentId, req.user!.id),
        ),
      )
      .limit(1);

    if (!attempt) {
      return res.status(404).json({ error: 'Quiz attempt not found.' });
    }
    if (attempt.status !== 'in_progress') {
      return res.status(400).json({ error: 'This quiz attempt has already been submitted.' });
    }

    const [quiz] = await db
      .select({ durationMinutes: quizzes.durationMinutes })
      .from(quizzes)
      .where(eq(quizzes.id, attempt.quizId))
      .limit(1);

    const elapsed = Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000);
    if (quiz && elapsed > quiz.durationMinutes * 60 + 5) {
      const finalized = await evaluateAndFinalizeAttempt(attempt.id, undefined, true);
      return res.status(409).json({ error: 'Quiz timer expired.', attempt: finalized });
    }

    // Verify question belongs to quiz and option belongs to question
    const [questionRow] = await db
      .select({ id: questions.id })
      .from(questions)
      .where(and(eq(questions.id, parsed.data.questionId), eq(questions.quizId, attempt.quizId)))
      .limit(1);

    if (!questionRow) {
      return res.status(400).json({ error: 'Question does not belong to this quiz.' });
    }

    if (parsed.data.selectedOptionId !== null) {
      const [optRow] = await db
        .select({ id: questionOptions.id })
        .from(questionOptions)
        .where(
          and(
            eq(questionOptions.id, parsed.data.selectedOptionId),
            eq(questionOptions.questionId, parsed.data.questionId),
          ),
        )
        .limit(1);
      if (!optRow) {
        return res.status(400).json({ error: 'Selected option does not belong to this question.' });
      }
    }

    await db
      .insert(studentAnswers)
      .values({
        attemptId: attempt.id,
        questionId: parsed.data.questionId,
        selectedOptionId: parsed.data.selectedOptionId,
        isMarkedForReview: parsed.data.isMarkedForReview,
      })
      .onConflictDoUpdate({
        target: [studentAnswers.attemptId, studentAnswers.questionId],
        set: {
          selectedOptionId: parsed.data.selectedOptionId,
          isMarkedForReview: parsed.data.isMarkedForReview,
          updatedAt: new Date(),
        },
      });

    return res.json({ saved: true });
  } catch (error) {
    console.error('Save answer error:', error);
    return res.status(500).json({ error: 'Failed to save answer.' });
  }
});

// Submit quiz & evaluate on backend
router.post('/attempts/submit', requireAuth, requireRole('student'), async (req: AuthRequest, res) => {
  try {
    const parsed = submitAttemptSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid quiz submission payload.' });
    }

    const [attempt] = await db
      .select()
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.id, parsed.data.attemptId),
          eq(quizAttempts.studentId, req.user!.id),
        ),
      )
      .limit(1);

    if (!attempt) {
      return res.status(404).json({ error: 'Quiz attempt not found.' });
    }

    const finalized = await evaluateAndFinalizeAttempt(
      attempt.id,
      parsed.data.answers,
      parsed.data.timedOut,
    );

    return res.json({ attempt: finalized });
  } catch (error) {
    console.error('Submit attempt error:', error);
    return res.status(500).json({ error: 'Failed to evaluate and submit quiz.' });
  }
});

// Attempt history
router.get('/attempts/history', requireAuth, async (req: AuthRequest, res) => {
  try {
    const currentUser = req.user!;
    if (currentUser.role === 'student') {
      const rows = await db
        .select({
          id: quizAttempts.id,
          quizId: quizAttempts.quizId,
          quizTitle: quizzes.title,
          subjectName: subjects.name,
          subjectCode: subjects.code,
          difficulty: quizzes.difficulty,
          passingPercentage: quizzes.passingPercentage,
          status: quizAttempts.status,
          totalQuestions: quizAttempts.totalQuestions,
          correctAnswers: quizAttempts.correctAnswers,
          incorrectAnswers: quizAttempts.incorrectAnswers,
          unansweredQuestions: quizAttempts.unansweredQuestions,
          totalMarks: quizAttempts.totalMarks,
          obtainedMarks: quizAttempts.obtainedMarks,
          percentage: quizAttempts.percentage,
          passed: quizAttempts.passed,
          timeTakenSeconds: quizAttempts.timeTakenSeconds,
          startedAt: quizAttempts.startedAt,
          submittedAt: quizAttempts.submittedAt,
        })
        .from(quizAttempts)
        .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
        .innerJoin(subjects, eq(quizzes.subjectId, subjects.id))
        .where(
          and(
            eq(quizAttempts.studentId, currentUser.id),
            inArray(quizAttempts.status, ['submitted', 'timed_out']),
          ),
        )
        .orderBy(desc(quizAttempts.submittedAt));

      return res.json({ attempts: rows });
    }

    // Teacher: attempts across quizzes created by this teacher
    const rows = await db
      .select({
        id: quizAttempts.id,
        quizId: quizAttempts.quizId,
        quizTitle: quizzes.title,
        subjectName: subjects.name,
        studentId: users.id,
        studentName: users.fullName,
        studentEmail: users.email,
        status: quizAttempts.status,
        totalQuestions: quizAttempts.totalQuestions,
        correctAnswers: quizAttempts.correctAnswers,
        incorrectAnswers: quizAttempts.incorrectAnswers,
        unansweredQuestions: quizAttempts.unansweredQuestions,
        totalMarks: quizAttempts.totalMarks,
        obtainedMarks: quizAttempts.obtainedMarks,
        percentage: quizAttempts.percentage,
        passed: quizAttempts.passed,
        timeTakenSeconds: quizAttempts.timeTakenSeconds,
        submittedAt: quizAttempts.submittedAt,
      })
      .from(quizAttempts)
      .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
      .innerJoin(subjects, eq(quizzes.subjectId, subjects.id))
      .innerJoin(users, eq(quizAttempts.studentId, users.id))
      .where(
        and(
          eq(quizzes.teacherId, currentUser.id),
          inArray(quizAttempts.status, ['submitted', 'timed_out']),
        ),
      )
      .orderBy(desc(quizAttempts.submittedAt));

    return res.json({ attempts: rows });
  } catch (error) {
    console.error('Attempt history error:', error);
    return res.status(500).json({ error: 'Failed to load attempt history.' });
  }
});

// Single attempt breakdown (STRICTLY only after submission!)
router.get('/attempts/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const attemptId = Number(req.params.id);
    if (!Number.isInteger(attemptId) || attemptId <= 0) {
      return res.status(400).json({ error: 'Invalid attempt ID.' });
    }

    const rows = await db
      .select({
        attempt: quizAttempts,
        quizTitle: quizzes.title,
        quizTeacherId: quizzes.teacherId,
        passingPercentage: quizzes.passingPercentage,
        difficulty: quizzes.difficulty,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        studentName: users.fullName,
        studentEmail: users.email,
      })
      .from(quizAttempts)
      .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
      .innerJoin(subjects, eq(quizzes.subjectId, subjects.id))
      .innerJoin(users, eq(quizAttempts.studentId, users.id))
      .where(eq(quizAttempts.id, attemptId))
      .limit(1);

    const record = rows[0];
    if (!record) {
      return res.status(404).json({ error: 'Attempt not found.' });
    }

    const currentUser = req.user!;
    if (currentUser.role === 'student' && record.attempt.studentId !== currentUser.id) {
      return res.status(403).json({ error: 'You can only view your own quiz results.' });
    }
    if (currentUser.role === 'teacher' && record.quizTeacherId !== currentUser.id) {
      return res.status(403).json({ error: 'You can only view attempts for your own quizzes.' });
    }

    if (record.attempt.status === 'in_progress') {
      return res.status(403).json({
        error: 'Answers and solutions are locked until the quiz attempt is submitted.',
      });
    }

    const quizQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.quizId, record.attempt.quizId))
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

    const answers = await db
      .select()
      .from(studentAnswers)
      .where(eq(studentAnswers.attemptId, attemptId));

    const ansMap = new Map<number, (typeof answers)[number]>();
    for (const a of answers) ansMap.set(a.questionId, a);

    const optMap = new Map<number, typeof options>();
    for (const o of options) {
      const arr = optMap.get(o.questionId) ?? [];
      arr.push(o);
      optMap.set(o.questionId, arr);
    }

    return res.json({
      attempt: {
        ...record.attempt,
        quizTitle: record.quizTitle,
        passingPercentage: record.passingPercentage,
        difficulty: record.difficulty,
        subjectName: record.subjectName,
        subjectCode: record.subjectCode,
        studentName: record.studentName,
        studentEmail: record.studentEmail,
      },
      breakdown: quizQuestions.map((q) => {
        const ans = ansMap.get(q.id);
        return {
          questionId: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          marks: q.marks,
          explanation: q.explanation,
          selectedOptionId: ans?.selectedOptionId ?? null,
          isCorrect: ans?.isCorrect ?? false,
          marksAwarded: ans?.marksAwarded ?? 0,
          options: optMap.get(q.id) ?? [],
        };
      }),
    });
  } catch (error) {
    console.error('Get attempt details error:', error);
    return res.status(500).json({ error: 'Failed to load attempt details.' });
  }
});

// Results & Analytics endpoint
router.get('/results', requireAuth, async (req: AuthRequest, res) => {
  try {
    const currentUser = req.user!;
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const quizIdParam = typeof req.query.quizId === 'string' ? Number(req.query.quizId) : null;

    if (currentUser.role === 'student') {
      const rows = await db
        .select({
          id: quizAttempts.id,
          quizId: quizAttempts.quizId,
          quizTitle: quizzes.title,
          subjectName: subjects.name,
          subjectCode: subjects.code,
          difficulty: quizzes.difficulty,
          totalQuestions: quizAttempts.totalQuestions,
          correctAnswers: quizAttempts.correctAnswers,
          incorrectAnswers: quizAttempts.incorrectAnswers,
          unansweredQuestions: quizAttempts.unansweredQuestions,
          totalMarks: quizAttempts.totalMarks,
          obtainedMarks: quizAttempts.obtainedMarks,
          percentage: quizAttempts.percentage,
          passed: quizAttempts.passed,
          timeTakenSeconds: quizAttempts.timeTakenSeconds,
          submittedAt: quizAttempts.submittedAt,
        })
        .from(quizAttempts)
        .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
        .innerJoin(subjects, eq(quizzes.subjectId, subjects.id))
        .where(
          and(
            eq(quizAttempts.studentId, currentUser.id),
            inArray(quizAttempts.status, ['submitted', 'timed_out']),
          ),
        )
        .orderBy(desc(quizAttempts.submittedAt));

      const filtered = rows.filter((r) => {
        if (quizIdParam && r.quizId !== quizIdParam) return false;
        if (search && !r.quizTitle.toLowerCase().includes(search) && !r.subjectName.toLowerCase().includes(search)) {
          return false;
        }
        return true;
      });

      const trend = [...filtered]
        .reverse()
        .map((r) => ({
          name: r.quizTitle.length > 18 ? `${r.quizTitle.slice(0, 18)}...` : r.quizTitle,
          percentage: r.percentage,
          date: r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
        }));

      return res.json({ results: filtered, trend });
    }

    // Teacher results
    const rows = await db
      .select({
        id: quizAttempts.id,
        quizId: quizAttempts.quizId,
        quizTitle: quizzes.title,
        subjectName: subjects.name,
        studentId: users.id,
        studentName: users.fullName,
        studentEmail: users.email,
        totalQuestions: quizAttempts.totalQuestions,
        correctAnswers: quizAttempts.correctAnswers,
        incorrectAnswers: quizAttempts.incorrectAnswers,
        unansweredQuestions: quizAttempts.unansweredQuestions,
        totalMarks: quizAttempts.totalMarks,
        obtainedMarks: quizAttempts.obtainedMarks,
        percentage: quizAttempts.percentage,
        passed: quizAttempts.passed,
        timeTakenSeconds: quizAttempts.timeTakenSeconds,
        submittedAt: quizAttempts.submittedAt,
      })
      .from(quizAttempts)
      .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
      .innerJoin(subjects, eq(quizzes.subjectId, subjects.id))
      .innerJoin(users, eq(quizAttempts.studentId, users.id))
      .where(
        and(
          eq(quizzes.teacherId, currentUser.id),
          inArray(quizAttempts.status, ['submitted', 'timed_out']),
        ),
      )
      .orderBy(desc(quizAttempts.submittedAt));

    const filtered = rows.filter((r) => {
      if (quizIdParam && r.quizId !== quizIdParam) return false;
      if (
        search &&
        !r.studentName.toLowerCase().includes(search) &&
        !r.studentEmail.toLowerCase().includes(search) &&
        !r.quizTitle.toLowerCase().includes(search)
      ) {
        return false;
      }
      return true;
    });

    // Aggregate per-quiz comparison
    const quizAgg = new Map<number, { quizTitle: string; attempts: number; sumPct: number; passCount: number }>();
    for (const r of filtered) {
      const prev = quizAgg.get(r.quizId) ?? {
        quizTitle: r.quizTitle,
        attempts: 0,
        sumPct: 0,
        passCount: 0,
      };
      prev.attempts += 1;
      prev.sumPct += r.percentage;
      if (r.passed) prev.passCount += 1;
      quizAgg.set(r.quizId, prev);
    }

    const quizComparison = Array.from(quizAgg.values()).map((q) => ({
      name: q.quizTitle.length > 20 ? `${q.quizTitle.slice(0, 20)}...` : q.quizTitle,
      avgScore: Math.round((q.sumPct / q.attempts) * 10) / 10,
      passRate: Math.round((q.passCount / q.attempts) * 100),
      attempts: q.attempts,
    }));

    return res.json({ results: filtered, quizComparison });
  } catch (error) {
    console.error('Results error:', error);
    return res.status(500).json({ error: 'Failed to load results.' });
  }
});

function escapeCsvCell(val: unknown): string {
  const raw = String(val ?? '');
  const neutralized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

// Teacher CSV export
router.get('/results/export.csv', requireAuth, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const quizIdParam = typeof req.query.quizId === 'string' ? Number(req.query.quizId) : null;

    const rows = await db
      .select({
        attemptId: quizAttempts.id,
        quizId: quizAttempts.quizId,
        quizTitle: quizzes.title,
        subjectName: subjects.name,
        studentName: users.fullName,
        studentEmail: users.email,
        totalQuestions: quizAttempts.totalQuestions,
        correctAnswers: quizAttempts.correctAnswers,
        obtainedMarks: quizAttempts.obtainedMarks,
        totalMarks: quizAttempts.totalMarks,
        percentage: quizAttempts.percentage,
        passed: quizAttempts.passed,
        timeTakenSeconds: quizAttempts.timeTakenSeconds,
        submittedAt: quizAttempts.submittedAt,
      })
      .from(quizAttempts)
      .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
      .innerJoin(subjects, eq(quizzes.subjectId, subjects.id))
      .innerJoin(users, eq(quizAttempts.studentId, users.id))
      .where(
        and(
          eq(quizzes.teacherId, req.user!.id),
          inArray(quizAttempts.status, ['submitted', 'timed_out']),
        ),
      )
      .orderBy(desc(quizAttempts.submittedAt));

    const filtered = rows.filter((r) => {
      if (quizIdParam && r.quizId !== quizIdParam) return false;
      if (
        search &&
        !r.studentName.toLowerCase().includes(search) &&
        !r.studentEmail.toLowerCase().includes(search) &&
        !r.quizTitle.toLowerCase().includes(search)
      ) {
        return false;
      }
      return true;
    });

    const header = [
      'Attempt ID',
      'Student Name',
      'Student Email',
      'Quiz Title',
      'Subject',
      'Correct Answers',
      'Total Questions',
      'Obtained Marks',
      'Total Marks',
      'Percentage',
      'Status',
      'Time Taken (sec)',
      'Submitted At',
    ]
      .map(escapeCsvCell)
      .join(',');

    const lines = filtered.map((r) =>
      [
        r.attemptId,
        r.studentName,
        r.studentEmail,
        r.quizTitle,
        r.subjectName,
        r.correctAnswers,
        r.totalQuestions,
        r.obtainedMarks,
        r.totalMarks,
        `${r.percentage}%`,
        r.passed ? 'Passed' : 'Failed',
        r.timeTakenSeconds,
        r.submittedAt ? new Date(r.submittedAt).toISOString() : '',
      ]
        .map(escapeCsvCell)
        .join(','),
    );

    const csvContent = [header, ...lines].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="student-quiz-results.csv"');
    return res.send(csvContent);
  } catch (error) {
    console.error('CSV export error:', error);
    return res.status(500).json({ error: 'Failed to export results CSV.' });
  }
});

export default router;
