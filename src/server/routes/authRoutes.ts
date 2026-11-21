import crypto from 'node:crypto';
import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import { notifications, studentProfiles, teacherProfiles, users } from '../../db/schema.ts';
import { adminAuth } from '../../lib/firebase-admin.ts';
import {
  type AuthRequest,
  ensureRoleProfile,
  hashPassword,
  requireAuth,
  signAuthToken,
  verifyPassword,
} from '../auth.ts';
import { ensureSeedData } from '../seed.ts';

const router = Router();

const registerSchema = z.object({
  email: z.string().trim().email('Please provide a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters long.').max(128),
  fullName: z.string().trim().min(2, 'Full name is required.').max(100),
  role: z.enum(['teacher', 'student']),
  course: z.string().trim().max(120).optional(),
  semester: z.string().trim().max(60).optional(),
  enrollmentNumber: z.string().trim().max(60).optional(),
  subjectSpecialty: z.string().trim().max(120).optional(),
  qualification: z.string().trim().max(120).optional(),
  department: z.string().trim().max(120).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email('Valid email is required.'),
  password: z.string().min(1, 'Password is required.'),
});

const firebaseLoginSchema = z.object({
  idToken: z.string().min(10),
  role: z.enum(['teacher', 'student']).optional(),
});

const demoAccessSchema = z.object({
  role: z.enum(['teacher', 'student']),
  password: z.string().min(6, 'Demo password must be at least 6 characters.').max(128),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.'),
});

const resetPasswordSchema = z.object({
  email: z.string().trim().email('Valid email is required.'),
  token: z.string().trim().min(16, 'Valid reset token is required.'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters.').max(128),
});

function serializeUser(row: {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  role: string;
  avatarUrl: string | null;
  emailNotifications: boolean;
  quizReminders: boolean;
  resultAlerts: boolean;
}) {
  return {
    id: row.id,
    uid: row.uid,
    email: row.email,
    fullName: row.fullName,
    role: row.role as 'teacher' | 'student',
    avatarUrl: row.avatarUrl,
    emailNotifications: row.emailNotifications,
    quizReminders: row.quizReminders,
    resultAlerts: row.resultAlerts,
  };
}

router.post('/register', async (req, res) => {
  try {
    await ensureSeedData();
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input.' });
    }

    const { email, password, fullName, role } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await hashPassword(password);
    const uid = `local_${crypto.randomUUID()}`;

    const [created] = await db
      .insert(users)
      .values({
        uid,
        email: normalizedEmail,
        passwordHash,
        fullName,
        role,
      })
      .returning();

    if (role === 'student') {
      await db.insert(studentProfiles).values({
        userId: created.id,
        course: parsed.data.course ?? '',
        semester: parsed.data.semester ?? '',
        enrollmentNumber: parsed.data.enrollmentNumber ?? '',
        department: parsed.data.department ?? '',
      });
    } else {
      await db.insert(teacherProfiles).values({
        userId: created.id,
        subjectSpecialty: parsed.data.subjectSpecialty ?? '',
        qualification: parsed.data.qualification ?? '',
        department: parsed.data.department ?? '',
        bio: '',
      });
    }

    await db.insert(notifications).values({
      userId: created.id,
      title: 'Welcome to ScholarPulse',
      message:
        role === 'teacher'
          ? 'Your instructor workspace is ready. Create your first quiz or upload study materials.'
          : 'Your student account is ready. Explore available quizzes and study resources.',
      type: 'system',
      linkUrl: role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard',
    });

    const token = signAuthToken({
      userId: created.id,
      uid: created.uid,
      email: created.email,
      role,
    });

    return res.status(201).json({ token, user: serializeUser(created) });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Failed to register account. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    await ensureSeedData();
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid credentials.' });
    }

    const normalizedEmail = parsed.data.email.toLowerCase();
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    const found = rows[0];
    if (!found || !found.passwordHash) {
      return res.status(401).json({
        error:
          found && !found.passwordHash
            ? 'This account has not set a password yet. Use Google Sign-In or Demo Setup below.'
            : 'Invalid email or password.',
      });
    }

    const valid = await verifyPassword(parsed.data.password, found.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!found.isActive) {
      return res.status(403).json({ error: 'This account is currently deactivated.' });
    }

    const token = signAuthToken({
      userId: found.id,
      uid: found.uid,
      email: found.email,
      role: found.role as 'teacher' | 'student',
    });

    return res.json({ token, user: serializeUser(found) });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Authentication failed. Please try again.' });
  }
});

router.post('/firebase', async (req, res) => {
  try {
    await ensureSeedData();
    const parsed = firebaseLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Valid Firebase ID token is required.' });
    }

    const decoded = await adminAuth.verifyIdToken(parsed.data.idToken);
    const email = (decoded.email ?? '').toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Google account must provide an email address.' });
    }

    const existingByUid = await db
      .select()
      .from(users)
      .where(eq(users.uid, decoded.uid))
      .limit(1);

    if (existingByUid[0]) {
      const user = existingByUid[0];
      const token = signAuthToken({
        userId: user.id,
        uid: user.uid,
        email: user.email,
        role: user.role as 'teacher' | 'student',
      });
      return res.json({ token, user: serializeUser(user) });
    }

    const existingByEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingByEmail[0]) {
      const [updated] = await db
        .update(users)
        .set({
          uid: decoded.uid,
          avatarUrl: existingByEmail[0].avatarUrl ?? decoded.picture ?? null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingByEmail[0].id))
        .returning();

      const token = signAuthToken({
        userId: updated.id,
        uid: updated.uid,
        email: updated.email,
        role: updated.role as 'teacher' | 'student',
      });
      return res.json({ token, user: serializeUser(updated) });
    }

    // New user via Google Sign-In requires role selection
    if (!parsed.data.role) {
      return res.status(202).json({
        needsRoleSelection: true,
        email,
        fullName: decoded.name || email.split('@')[0],
      });
    }

    const [created] = await db
      .insert(users)
      .values({
        uid: decoded.uid,
        email,
        fullName: decoded.name || email.split('@')[0],
        role: parsed.data.role,
        avatarUrl: decoded.picture ?? null,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          updatedAt: new Date(),
        },
      })
      .returning();

    await ensureRoleProfile(created.id, parsed.data.role);

    const token = signAuthToken({
      userId: created.id,
      uid: created.uid,
      email: created.email,
      role: created.role as 'teacher' | 'student',
    });

    return res.status(201).json({ token, user: serializeUser(created) });
  } catch (error) {
    console.error('Firebase auth error:', error);
    return res.status(401).json({ error: 'Unable to verify Google Sign-In session.' });
  }
});

router.get('/demo-status', async (_req, res) => {
  try {
    await ensureSeedData();
    const rows = await db
      .select({ email: users.email, passwordHash: users.passwordHash })
      .from(users);

    const teacherRow = rows.find((r) => r.email === 'teacher@quizsystem.com');
    const studentRow = rows.find((r) => r.email === 'student@quizsystem.com');

    return res.json({
      teacherConfigured: Boolean(teacherRow?.passwordHash),
      studentConfigured: Boolean(studentRow?.passwordHash),
    });
  } catch (error) {
    console.error('Demo status error:', error);
    return res.status(500).json({ error: 'Failed to inspect demo account readiness.' });
  }
});

router.post('/demo-access', async (req, res) => {
  try {
    await ensureSeedData();
    const parsed = demoAccessSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid demo request.' });
    }

    const targetEmail =
      parsed.data.role === 'teacher' ? 'teacher@quizsystem.com' : 'student@quizsystem.com';

    const rows = await db.select().from(users).where(eq(users.email, targetEmail)).limit(1);
    const demoUser = rows[0];
    if (!demoUser) {
      return res.status(404).json({ error: 'Demo account not found.' });
    }

    if (!demoUser.passwordHash) {
      const newHash = await hashPassword(parsed.data.password);
      await db
        .update(users)
        .set({ passwordHash: newHash, updatedAt: new Date() })
        .where(eq(users.id, demoUser.id));
    } else {
      const ok = await verifyPassword(parsed.data.password, demoUser.passwordHash);
      if (!ok) {
        return res.status(401).json({
          error: 'Incorrect password for this demo account.',
        });
      }
    }

    const token = signAuthToken({
      userId: demoUser.id,
      uid: demoUser.uid,
      email: demoUser.email,
      role: demoUser.role as 'teacher' | 'student',
    });

    return res.json({ token, user: serializeUser(demoUser) });
  } catch (error) {
    console.error('Demo access error:', error);
    return res.status(500).json({ error: 'Failed to sign into demo account.' });
  }
});

router.post('/logout', (_req, res) => {
  return res.json({ message: 'Signed out successfully.' });
});

router.post('/forgot-password', async (req, res) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid email.' });
    }

    const normalizedEmail = parsed.data.email.toLowerCase();
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (rows[0]) {
      const rawToken = crypto.randomBytes(24).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await db
        .update(users)
        .set({
          resetTokenHash: tokenHash,
          resetTokenExpiresAt: expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(users.id, rows[0].id));
    }

    return res.json({
      message:
        'If an account exists for that email, password reset instructions and a time-limited token have been issued.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Unable to process password reset request.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid reset input.' });
    }

    const normalizedEmail = parsed.data.email.toLowerCase();
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    const user = rows[0];
    if (!user || !user.resetTokenHash || !user.resetTokenExpiresAt) {
      return res.status(400).json({ error: 'Invalid or expired password reset token.' });
    }

    if (user.resetTokenExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ error: 'Password reset token has expired.' });
    }

    const incomingHash = crypto.createHash('sha256').update(parsed.data.token).digest('hex');
    const a = Buffer.from(incomingHash, 'hex');
    const b = Buffer.from(user.resetTokenHash, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(400).json({ error: 'Invalid or expired password reset token.' });
    }

    const newPasswordHash = await hashPassword(parsed.data.newPassword);
    await db
      .update(users)
      .set({
        passwordHash: newPasswordHash,
        resetTokenHash: null,
        resetTokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return res.json({ message: 'Password updated successfully. You can now sign in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Failed to reset password.' });
  }
});

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
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
    console.error('Get me error:', error);
    return res.status(500).json({ error: 'Failed to load user profile.' });
  }
});

export default router;
