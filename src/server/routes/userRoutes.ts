import fs from 'node:fs';
import { Router } from 'express';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import multer from 'multer';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  notifications,
  quizAttempts,
  quizzes,
  studentProfiles,
  studyMaterials,
  subjects,
  teacherProfiles,
  users,
} from '../../db/schema.ts';
import {
  type AuthRequest,
  hashPassword,
  requireAuth,
  requireRole,
  verifyPassword,
} from '../auth.ts';
import { ensureSeedData } from '../seed.ts';
import {
  AVATARS_DIR,
  ensureUploadDirs,
  generateStoredFilename,
  resolveSafeUploadPath,
  validateAvatarFile,
} from '../storage.ts';

const router = Router();

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB
  },
});

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  emailNotifications: z.boolean().optional(),
  quizReminders: z.boolean().optional(),
  resultAlerts: z.boolean().optional(),
  course: z.string().trim().max(120).optional(),
  semester: z.string().trim().max(60).optional(),
  enrollmentNumber: z.string().trim().max(60).optional(),
  department: z.string().trim().max(120).optional(),
  subjectSpecialty: z.string().trim().max(120).optional(),
  qualification: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(600).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, 'New password must be at least 8 characters.').max(128),
});

// Student Dashboard Aggregation
router.get('/dashboard/student', requireAuth, requireRole('student'), async (req: AuthRequest, res) => {
  try {
    await ensureSeedData();
    const studentId = req.user!.id;

    const publishedQuizzes = await db
      .select({
        id: quizzes.id,
        title: quizzes.title,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        difficulty: quizzes.difficulty,
        durationMinutes: quizzes.durationMinutes,
        totalMarks: quizzes.totalMarks,
        questionCount: quizzes.questionCount,
      })
      .from(quizzes)
      .innerJoin(subjects, eq(quizzes.subjectId, subjects.id))
      .where(and(eq(quizzes.status, 'published'), eq(quizzes.isActive, true)))
      .orderBy(desc(quizzes.createdAt));

    const attempts = await db
      .select({
        id: quizAttempts.id,
        quizId: quizAttempts.quizId,
        quizTitle: quizzes.title,
        subjectName: subjects.name,
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
      .where(
        and(
          eq(quizAttempts.studentId, studentId),
          inArray(quizAttempts.status, ['submitted', 'timed_out']),
        ),
      )
      .orderBy(desc(quizAttempts.submittedAt));

    const materials = await db
      .select({
        id: studyMaterials.id,
        title: studyMaterials.title,
        subjectName: subjects.name,
        topic: studyMaterials.topic,
        fileType: studyMaterials.fileType,
        fileName: studyMaterials.fileName,
        createdAt: studyMaterials.createdAt,
      })
      .from(studyMaterials)
      .innerJoin(subjects, eq(studyMaterials.subjectId, subjects.id))
      .where(eq(studyMaterials.isPublished, true))
      .orderBy(desc(studyMaterials.createdAt))
      .limit(5);

    const attemptedQuizIds = new Set(attempts.map((a) => a.quizId));
    const completedQuizzes = attemptedQuizIds.size;
    const pendingQuizzes = publishedQuizzes.filter((q) => !attemptedQuizIds.has(q.id)).length;
    const totalAttempts = attempts.length;
    const averageScore =
      totalAttempts > 0
        ? Math.round((attempts.reduce((sum, a) => sum + a.percentage, 0) / totalAttempts) * 10) / 10
        : 0;

    const scoreTrend = [...attempts]
      .slice(0, 8)
      .reverse()
      .map((a) => ({
        name: a.quizTitle.length > 16 ? `${a.quizTitle.slice(0, 16)}...` : a.quizTitle,
        score: a.percentage,
      }));

    const subjectPerfMap = new Map<string, { sum: number; count: number }>();
    for (const a of attempts) {
      const prev = subjectPerfMap.get(a.subjectName) ?? { sum: 0, count: 0 };
      prev.sum += a.percentage;
      prev.count += 1;
      subjectPerfMap.set(a.subjectName, prev);
    }

    const subjectPerformance = Array.from(subjectPerfMap.entries()).map(([subject, stat]) => ({
      subject: subject.length > 18 ? `${subject.slice(0, 18)}...` : subject,
      avgScore: Math.round((stat.sum / stat.count) * 10) / 10,
    }));

    return res.json({
      stats: {
        totalAttempts,
        averageScore,
        completedQuizzes,
        pendingQuizzes,
      },
      recentActivity: attempts.slice(0, 5),
      availableQuizzes: publishedQuizzes.slice(0, 4),
      availableMaterials: materials,
      scoreTrend,
      subjectPerformance,
    });
  } catch (error) {
    console.error('Student dashboard error:', error);
    return res.status(500).json({ error: 'Failed to load student dashboard.' });
  }
});

// Teacher Dashboard Aggregation
router.get('/dashboard/teacher', requireAuth, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    await ensureSeedData();
    const teacherId = req.user!.id;

    const teacherQuizzes = await db
      .select({
        id: quizzes.id,
        title: quizzes.title,
        status: quizzes.status,
        isActive: quizzes.isActive,
        subjectName: subjects.name,
        questionCount: quizzes.questionCount,
        totalMarks: quizzes.totalMarks,
        createdAt: quizzes.createdAt,
      })
      .from(quizzes)
      .innerJoin(subjects, eq(quizzes.subjectId, subjects.id))
      .where(eq(quizzes.teacherId, teacherId))
      .orderBy(desc(quizzes.createdAt));

    const studentCountRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, 'student'));

    const totalStudents = Number(studentCountRows[0]?.count ?? 0);

    const recentSubmissions = await db
      .select({
        id: quizAttempts.id,
        quizId: quizAttempts.quizId,
        quizTitle: quizzes.title,
        studentName: users.fullName,
        studentEmail: users.email,
        obtainedMarks: quizAttempts.obtainedMarks,
        totalMarks: quizAttempts.totalMarks,
        percentage: quizAttempts.percentage,
        passed: quizAttempts.passed,
        submittedAt: quizAttempts.submittedAt,
      })
      .from(quizAttempts)
      .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
      .innerJoin(users, eq(quizAttempts.studentId, users.id))
      .where(
        and(
          eq(quizzes.teacherId, teacherId),
          inArray(quizAttempts.status, ['submitted', 'timed_out']),
        ),
      )
      .orderBy(desc(quizAttempts.submittedAt));

    const totalAttempts = recentSubmissions.length;
    const avgStudentPerformance =
      totalAttempts > 0
        ? Math.round(
            (recentSubmissions.reduce((sum, s) => sum + s.percentage, 0) / totalAttempts) * 10,
          ) / 10
        : 0;

    // Performance per quiz for chart
    const quizPerfMap = new Map<number, { title: string; sumPct: number; count: number; passes: number }>();
    for (const q of teacherQuizzes) {
      quizPerfMap.set(q.id, { title: q.title, sumPct: 0, count: 0, passes: 0 });
    }
    for (const s of recentSubmissions) {
      const entry = quizPerfMap.get(s.quizId);
      if (entry) {
        entry.sumPct += s.percentage;
        entry.count += 1;
        if (s.passed) entry.passes += 1;
      }
    }

    const quizPerformance = Array.from(quizPerfMap.values())
      .filter((entry) => entry.count > 0)
      .map((entry) => ({
        name: entry.title.length > 18 ? `${entry.title.slice(0, 18)}...` : entry.title,
        avgScore: Math.round((entry.sumPct / entry.count) * 10) / 10,
        passRate: Math.round((entry.passes / entry.count) * 100),
        attempts: entry.count,
      }));

    return res.json({
      stats: {
        totalQuizzes: teacherQuizzes.length,
        totalStudents,
        totalAttempts,
        avgStudentPerformance,
      },
      recentSubmissions: recentSubmissions.slice(0, 6),
      quizPerformance,
      recentQuizzes: teacherQuizzes.slice(0, 5),
    });
  } catch (error) {
    console.error('Teacher dashboard error:', error);
    return res.status(500).json({ error: 'Failed to load teacher dashboard.' });
  }
});

// Teacher: Student Management Directory
router.get('/students', requireAuth, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const studentRows = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
        createdAt: users.createdAt,
        course: studentProfiles.course,
        semester: studentProfiles.semester,
        enrollmentNumber: studentProfiles.enrollmentNumber,
        department: studentProfiles.department,
      })
      .from(users)
      .leftJoin(studentProfiles, eq(users.id, studentProfiles.userId))
      .where(eq(users.role, 'student'))
      .orderBy(desc(users.createdAt));

    const attemptStats = await db
      .select({
        studentId: quizAttempts.studentId,
        attemptCount: sql<number>`count(*)::int`,
        avgScore: sql<number>`coalesce(avg(${quizAttempts.percentage}), 0)::float`,
      })
      .from(quizAttempts)
      .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
      .where(
        and(
          eq(quizzes.teacherId, req.user!.id),
          inArray(quizAttempts.status, ['submitted', 'timed_out']),
        ),
      )
      .groupBy(quizAttempts.studentId);

    const statMap = new Map<number, { attemptCount: number; avgScore: number }>();
    for (const s of attemptStats) {
      statMap.set(s.studentId, {
        attemptCount: Number(s.attemptCount),
        avgScore: Math.round(Number(s.avgScore) * 10) / 10,
      });
    }

    const filtered = studentRows
      .filter((st) => {
        if (!search) return true;
        return (
          st.fullName.toLowerCase().includes(search) ||
          st.email.toLowerCase().includes(search) ||
          (st.enrollmentNumber ?? '').toLowerCase().includes(search)
        );
      })
      .map((st) => ({
        ...st,
        attemptCount: statMap.get(st.id)?.attemptCount ?? 0,
        avgScore: statMap.get(st.id)?.avgScore ?? 0,
      }));

    return res.json({ students: filtered });
  } catch (error) {
    console.error('List students error:', error);
    return res.status(500).json({ error: 'Failed to load students.' });
  }
});

// Profile endpoints
router.get('/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const currentUser = req.user!;
    let profile: Record<string, unknown> = {};
    if (currentUser.role === 'student') {
      const [sp] = await db
        .select()
        .from(studentProfiles)
        .where(eq(studentProfiles.userId, currentUser.id))
        .limit(1);
      profile = sp ?? {};
    } else {
      const [tp] = await db
        .select()
        .from(teacherProfiles)
        .where(eq(teacherProfiles.userId, currentUser.id))
        .limit(1);
      profile = tp ?? {};
    }
    return res.json({ user: currentUser, profile });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ error: 'Failed to load profile.' });
  }
});

router.put('/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid profile data.' });
    }

    const currentUser = req.user!;
    const data = parsed.data;

    const [updatedUser] = await db
      .update(users)
      .set({
        fullName: data.fullName,
        emailNotifications: data.emailNotifications ?? currentUser.emailNotifications,
        quizReminders: data.quizReminders ?? currentUser.quizReminders,
        resultAlerts: data.resultAlerts ?? currentUser.resultAlerts,
        updatedAt: new Date(),
      })
      .where(eq(users.id, currentUser.id))
      .returning({
        id: users.id,
        uid: users.uid,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        avatarUrl: users.avatarUrl,
        emailNotifications: users.emailNotifications,
        quizReminders: users.quizReminders,
        resultAlerts: users.resultAlerts,
      });

    let profile: Record<string, unknown> = {};
    if (currentUser.role === 'student') {
      const [sp] = await db
        .insert(studentProfiles)
        .values({
          userId: currentUser.id,
          course: data.course ?? '',
          semester: data.semester ?? '',
          enrollmentNumber: data.enrollmentNumber ?? '',
          department: data.department ?? '',
        })
        .onConflictDoUpdate({
          target: studentProfiles.userId,
          set: {
            course: data.course ?? '',
            semester: data.semester ?? '',
            enrollmentNumber: data.enrollmentNumber ?? '',
            department: data.department ?? '',
            updatedAt: new Date(),
          },
        })
        .returning();
      profile = sp;
    } else {
      const [tp] = await db
        .insert(teacherProfiles)
        .values({
          userId: currentUser.id,
          subjectSpecialty: data.subjectSpecialty ?? '',
          qualification: data.qualification ?? '',
          department: data.department ?? '',
          bio: data.bio ?? '',
        })
        .onConflictDoUpdate({
          target: teacherProfiles.userId,
          set: {
            subjectSpecialty: data.subjectSpecialty ?? '',
            qualification: data.qualification ?? '',
            department: data.department ?? '',
            bio: data.bio ?? '',
            updatedAt: new Date(),
          },
        })
        .returning();
      profile = tp;
    }

    return res.json({ user: updatedUser, profile });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'Failed to update profile.' });
  }
});

router.post(
  '/profile/avatar',
  requireAuth,
  avatarUpload.single('avatar'),
  async (req: AuthRequest, res) => {
    try {
      ensureUploadDirs();
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'Please select an image file.' });
      }
      const validation = validateAvatarFile(file.originalname, file.mimetype);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      const storedName = generateStoredFilename(validation.ext);
      const targetPath = resolveSafeUploadPath(AVATARS_DIR, storedName);
      if (!targetPath) {
        return res.status(400).json({ error: 'Invalid avatar path.' });
      }
      fs.writeFileSync(targetPath, file.buffer);

      const avatarUrl = `/uploads/avatars/${storedName}`;
      await db
        .update(users)
        .set({ avatarUrl, updatedAt: new Date() })
        .where(eq(users.id, req.user!.id));

      return res.json({ avatarUrl });
    } catch (error) {
      console.error('Upload avatar error:', error);
      return res.status(500).json({ error: 'Failed to upload profile photo.' });
    }
  },
);

router.put('/profile/password', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid password input.' });
    }

    const [userRow] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user!.id))
      .limit(1);

    if (!userRow) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (userRow.passwordHash) {
      if (!parsed.data.currentPassword) {
        return res.status(400).json({ error: 'Current password is required.' });
      }
      const ok = await verifyPassword(parsed.data.currentPassword, userRow.passwordHash);
      if (!ok) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }
    }

    const newHash = await hashPassword(parsed.data.newPassword);
    await db
      .update(users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(users.id, req.user!.id));

    return res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ error: 'Failed to update password.' });
  }
});

// Notifications
router.get('/notifications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const items = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, req.user!.id))
      .orderBy(desc(notifications.createdAt))
      .limit(20);
    return res.json({ notifications: items });
  } catch (error) {
    console.error('Notifications error:', error);
    return res.status(500).json({ error: 'Failed to load notifications.' });
  }
});

router.put('/notifications/read-all', requireAuth, async (req: AuthRequest, res) => {
  try {
    await db
      .update(notifications)
      .set({ isRead: true, updatedAt: new Date() })
      .where(eq(notifications.userId, req.user!.id));
    return res.json({ success: true });
  } catch (error) {
    console.error('Read all notifications error:', error);
    return res.status(500).json({ error: 'Failed to mark notifications read.' });
  }
});

router.put('/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid notification ID.' });
    }
    await db
      .update(notifications)
      .set({ isRead: true, updatedAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, req.user!.id)));
    return res.json({ success: true });
  } catch (error) {
    console.error('Read notification error:', error);
    return res.status(500).json({ error: 'Failed to update notification.' });
  }
});

export default router;
