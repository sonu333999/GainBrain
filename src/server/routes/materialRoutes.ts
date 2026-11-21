import fs from 'node:fs';
import { Router } from 'express';
import { and, desc, eq, sql } from 'drizzle-orm';
import multer from 'multer';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import { notifications, studyMaterials, subjects, users } from '../../db/schema.ts';
import { type AuthRequest, requireAuth, requireRole } from '../auth.ts';
import { ensureSeedData } from '../seed.ts';
import {
  ensureUploadDirs,
  generateStoredFilename,
  MATERIALS_DIR,
  resolveSafeUploadPath,
  validateMaterialFile,
} from '../storage.ts';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
});

const updateMaterialSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(1000).optional(),
  subjectId: z.number().int().positive().optional(),
  topic: z.string().trim().min(1).max(100).optional(),
  isPublished: z.boolean().optional(),
});

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeedData();
    const currentUser = req.user!;
    const subjectIdParam = typeof req.query.subjectId === 'string' ? Number(req.query.subjectId) : null;
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const fileTypeParam = typeof req.query.fileType === 'string' ? req.query.fileType : '';

    const baseQuery = db
      .select({
        id: studyMaterials.id,
        title: studyMaterials.title,
        description: studyMaterials.description,
        subjectId: studyMaterials.subjectId,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        teacherId: studyMaterials.teacherId,
        teacherName: users.fullName,
        topic: studyMaterials.topic,
        fileName: studyMaterials.fileName,
        fileType: studyMaterials.fileType,
        mimeType: studyMaterials.mimeType,
        fileSizeBytes: studyMaterials.fileSizeBytes,
        isPublished: studyMaterials.isPublished,
        downloadCount: studyMaterials.downloadCount,
        createdAt: studyMaterials.createdAt,
        updatedAt: studyMaterials.updatedAt,
      })
      .from(studyMaterials)
      .innerJoin(subjects, eq(studyMaterials.subjectId, subjects.id))
      .innerJoin(users, eq(studyMaterials.teacherId, users.id));

    const rows =
      currentUser.role === 'teacher'
        ? await baseQuery.where(eq(studyMaterials.teacherId, currentUser.id)).orderBy(desc(studyMaterials.createdAt))
        : await baseQuery.where(eq(studyMaterials.isPublished, true)).orderBy(desc(studyMaterials.createdAt));

    const filtered = rows.filter((m) => {
      if (subjectIdParam && m.subjectId !== subjectIdParam) return false;
      if (fileTypeParam && fileTypeParam !== 'all' && m.fileType !== fileTypeParam) return false;
      if (
        search &&
        !m.title.toLowerCase().includes(search) &&
        !m.topic.toLowerCase().includes(search) &&
        !m.subjectName.toLowerCase().includes(search)
      ) {
        return false;
      }
      return true;
    });

    return res.json({ materials: filtered });
  } catch (error) {
    console.error('List materials error:', error);
    return res.status(500).json({ error: 'Failed to load study materials.' });
  }
});

router.post(
  '/',
  requireAuth,
  requireRole('teacher'),
  upload.single('file'),
  async (req: AuthRequest, res) => {
    try {
      ensureUploadDirs();
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'Please select a file to upload.' });
      }

      const validation = validateMaterialFile(file.originalname, file.mimetype);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
      const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
      const topic = typeof req.body.topic === 'string' && req.body.topic.trim() ? req.body.topic.trim() : 'General';
      const subjectId = Number(req.body.subjectId);
      const isPublished = req.body.isPublished !== 'false';

      if (title.length < 2) {
        return res.status(400).json({ error: 'Material title must be at least 2 characters.' });
      }
      if (!Number.isInteger(subjectId) || subjectId <= 0) {
        return res.status(400).json({ error: 'Please select a valid subject.' });
      }

      const storedFileName = generateStoredFilename(validation.ext);
      const targetPath = resolveSafeUploadPath(MATERIALS_DIR, storedFileName);
      if (!targetPath) {
        return res.status(400).json({ error: 'Invalid upload file path.' });
      }

      fs.writeFileSync(targetPath, file.buffer);

      const [created] = await db
        .insert(studyMaterials)
        .values({
          title,
          description,
          subjectId,
          teacherId: req.user!.id,
          topic,
          fileName: file.originalname,
          storedFileName,
          fileType: validation.category,
          mimeType: file.mimetype,
          fileSizeBytes: file.size,
          isPublished,
        })
        .returning();

      if (isPublished) {
        const studentUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.role, 'student'));
        if (studentUsers.length > 0) {
          await db.insert(notifications).values(
            studentUsers.map((s) => ({
              userId: s.id,
              title: 'New Study Material',
              message: `${title} (${validation.category}) has been uploaded.`,
              type: 'material',
              linkUrl: '/student/materials',
            })),
          );
        }
      }

      return res.status(201).json({ material: created });
    } catch (error) {
      console.error('Upload material error:', error);
      return res.status(500).json({ error: 'Failed to upload study material.' });
    }
  },
);

router.put('/:id', requireAuth, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const materialId = Number(req.params.id);
    if (!Number.isInteger(materialId) || materialId <= 0) {
      return res.status(400).json({ error: 'Invalid material ID.' });
    }

    const existing = await db
      .select()
      .from(studyMaterials)
      .where(eq(studyMaterials.id, materialId))
      .limit(1);

    if (!existing[0]) {
      return res.status(404).json({ error: 'Study material not found.' });
    }
    if (existing[0].teacherId !== req.user!.id) {
      return res.status(403).json({ error: 'You can only edit your own study materials.' });
    }

    const parsed = updateMaterialSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid material update.' });
    }

    const updateValues: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.title !== undefined) updateValues.title = parsed.data.title;
    if (parsed.data.description !== undefined) updateValues.description = parsed.data.description;
    if (parsed.data.subjectId !== undefined) updateValues.subjectId = parsed.data.subjectId;
    if (parsed.data.topic !== undefined) updateValues.topic = parsed.data.topic;
    if (parsed.data.isPublished !== undefined) updateValues.isPublished = parsed.data.isPublished;

    const [updated] = await db
      .update(studyMaterials)
      .set(updateValues)
      .where(eq(studyMaterials.id, materialId))
      .returning();

    return res.json({ material: updated });
  } catch (error) {
    console.error('Update material error:', error);
    return res.status(500).json({ error: 'Failed to update study material.' });
  }
});

router.delete('/:id', requireAuth, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const materialId = Number(req.params.id);
    if (!Number.isInteger(materialId) || materialId <= 0) {
      return res.status(400).json({ error: 'Invalid material ID.' });
    }

    const existing = await db
      .select()
      .from(studyMaterials)
      .where(eq(studyMaterials.id, materialId))
      .limit(1);

    if (!existing[0]) {
      return res.status(404).json({ error: 'Study material not found.' });
    }
    if (existing[0].teacherId !== req.user!.id) {
      return res.status(403).json({ error: 'You can only delete your own study materials.' });
    }

    const filePath = resolveSafeUploadPath(MATERIALS_DIR, existing[0].storedFileName);
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await db.delete(studyMaterials).where(eq(studyMaterials.id, materialId));
    return res.json({ message: 'Study material deleted successfully.' });
  } catch (error) {
    console.error('Delete material error:', error);
    return res.status(500).json({ error: 'Failed to delete study material.' });
  }
});

router.get('/:id/download', requireAuth, async (req: AuthRequest, res) => {
  try {
    const materialId = Number(req.params.id);
    if (!Number.isInteger(materialId) || materialId <= 0) {
      return res.status(400).json({ error: 'Invalid material ID.' });
    }

    const rows = await db
      .select()
      .from(studyMaterials)
      .where(eq(studyMaterials.id, materialId))
      .limit(1);

    const material = rows[0];
    if (!material) {
      return res.status(404).json({ error: 'Study material not found.' });
    }

    if (req.user!.role === 'student' && !material.isPublished) {
      return res.status(403).json({ error: 'This material is not currently published.' });
    }
    if (req.user!.role === 'teacher' && material.teacherId !== req.user!.id && !material.isPublished) {
      return res.status(403).json({ error: 'Access denied to unpublished material.' });
    }

    const filePath = resolveSafeUploadPath(MATERIALS_DIR, material.storedFileName);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Stored file could not be found on server.' });
    }

    await db
      .update(studyMaterials)
      .set({
        downloadCount: sql`${studyMaterials.downloadCount} + 1`,
      })
      .where(and(eq(studyMaterials.id, materialId)));

    res.setHeader('Content-Type', material.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${material.fileName.replace(/"/g, '')}"`);
    return res.sendFile(filePath);
  } catch (error) {
    console.error('Download material error:', error);
    return res.status(500).json({ error: 'Failed to download study material.' });
  }
});

export default router;
