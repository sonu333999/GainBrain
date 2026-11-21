import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { studentProfiles, teacherProfiles, users } from '../db/schema.ts';
import { adminAuth } from '../lib/firebase-admin.ts';

declare global {
  var _scholarPulseJwtSecret: string | undefined;
}

function getJwtSecret(): string {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length >= 16) {
    return process.env.JWT_SECRET.trim();
  }
  if (!global._scholarPulseJwtSecret) {
    global._scholarPulseJwtSecret = crypto.randomBytes(32).toString('hex');
  }
  return global._scholarPulseJwtSecret;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
  return `${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;

  const expectedKey = Buffer.from(keyHex, 'hex');
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });

  if (derivedKey.length !== expectedKey.length) return false;
  return crypto.timingSafeEqual(derivedKey, expectedKey);
}

export interface JwtPayload {
  userId: number;
  uid: string;
  email: string;
  role: 'teacher' | 'student';
}

export function signAuthToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

export function verifyAuthToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;
    if (!decoded || typeof decoded.userId !== 'number' || !decoded.role) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export interface AuthenticatedUser {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  role: 'teacher' | 'student';
  avatarUrl: string | null;
  emailNotifications: boolean;
  quizReminders: boolean;
  resultAlerts: boolean;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Empty token.' });
  }

  try {
    // 1. Try server-signed JWT first
    const jwtPayload = verifyAuthToken(token);
    if (jwtPayload) {
      const rows = await db
        .select({
          id: users.id,
          uid: users.uid,
          email: users.email,
          fullName: users.fullName,
          role: users.role,
          avatarUrl: users.avatarUrl,
          emailNotifications: users.emailNotifications,
          quizReminders: users.quizReminders,
          resultAlerts: users.resultAlerts,
          isActive: users.isActive,
        })
        .from(users)
        .where(eq(users.id, jwtPayload.userId))
        .limit(1);

      const found = rows[0];
      if (!found || !found.isActive) {
        return res.status(401).json({ error: 'Account not found or inactive.' });
      }
      req.user = {
        id: found.id,
        uid: found.uid,
        email: found.email,
        fullName: found.fullName,
        role: found.role as 'teacher' | 'student',
        avatarUrl: found.avatarUrl,
        emailNotifications: found.emailNotifications,
        quizReminders: found.quizReminders,
        resultAlerts: found.resultAlerts,
      };
      return next();
    }

    // 2. Fallback: verify Firebase ID token (for Google Sign-In sessions)
    const decodedFirebase = await adminAuth.verifyIdToken(token);
    const firebaseRows = await db
      .select({
        id: users.id,
        uid: users.uid,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        avatarUrl: users.avatarUrl,
        emailNotifications: users.emailNotifications,
        quizReminders: users.quizReminders,
        resultAlerts: users.resultAlerts,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.uid, decodedFirebase.uid))
      .limit(1);

    const foundFirebase = firebaseRows[0];
    if (!foundFirebase || !foundFirebase.isActive) {
      return res.status(401).json({ error: 'User profile not registered yet.' });
    }
    req.user = {
      id: foundFirebase.id,
      uid: foundFirebase.uid,
      email: foundFirebase.email,
      fullName: foundFirebase.fullName,
      role: foundFirebase.role as 'teacher' | 'student',
      avatarUrl: foundFirebase.avatarUrl,
      emailNotifications: foundFirebase.emailNotifications,
      quizReminders: foundFirebase.quizReminders,
      resultAlerts: foundFirebase.resultAlerts,
    };
    return next();
  } catch (error) {
    console.error('Authentication check failed:', error);
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

export function requireRole(role: 'teacher' | 'student') {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (req.user.role !== role) {
      return res.status(403).json({
        error: `Access denied. This resource requires the ${role} role.`,
      });
    }
    return next();
  };
}

export async function ensureRoleProfile(userId: number, role: 'teacher' | 'student') {
  if (role === 'student') {
    await db
      .insert(studentProfiles)
      .values({
        userId,
        course: '',
        semester: '',
        enrollmentNumber: '',
        department: '',
      })
      .onConflictDoNothing({ target: studentProfiles.userId });
  } else {
    await db
      .insert(teacherProfiles)
      .values({
        userId,
        subjectSpecialty: '',
        qualification: '',
        department: '',
        bio: '',
      })
      .onConflictDoNothing({ target: teacherProfiles.userId });
  }
}
