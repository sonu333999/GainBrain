import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');
export const MATERIALS_DIR = path.resolve(UPLOADS_ROOT, 'materials');
export const AVATARS_DIR = path.resolve(UPLOADS_ROOT, 'avatars');

export function ensureUploadDirs() {
  fs.mkdirSync(MATERIALS_DIR, { recursive: true });
  fs.mkdirSync(AVATARS_DIR, { recursive: true });
}

export function resolveSafeUploadPath(baseDir: string, storedFileName: string): string | null {
  const sanitized = path.basename(storedFileName);
  const resolved = path.resolve(baseDir, sanitized);
  if (!resolved.startsWith(baseDir + path.sep)) {
    return null;
  }
  return resolved;
}

const ALLOWED_MATERIAL_EXTENSIONS = new Map<string, { category: 'PDF' | 'DOC' | 'PPT' | 'IMAGE'; mimes: string[] }>([
  ['.pdf', { category: 'PDF', mimes: ['application/pdf'] }],
  ['.doc', { category: 'DOC', mimes: ['application/msword', 'application/octet-stream'] }],
  [
    '.docx',
    {
      category: 'DOC',
      mimes: [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/zip',
        'application/octet-stream',
      ],
    },
  ],
  ['.ppt', { category: 'PPT', mimes: ['application/vnd.ms-powerpoint', 'application/octet-stream'] }],
  [
    '.pptx',
    {
      category: 'PPT',
      mimes: [
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/zip',
        'application/octet-stream',
      ],
    },
  ],
  ['.png', { category: 'IMAGE', mimes: ['image/png'] }],
  ['.jpg', { category: 'IMAGE', mimes: ['image/jpeg'] }],
  ['.jpeg', { category: 'IMAGE', mimes: ['image/jpeg'] }],
  ['.webp', { category: 'IMAGE', mimes: ['image/webp'] }],
]);

export function validateMaterialFile(originalName: string, mimeType: string) {
  const ext = path.extname(originalName).toLowerCase();
  const rule = ALLOWED_MATERIAL_EXTENSIONS.get(ext);
  if (!rule) {
    return {
      valid: false as const,
      error: 'Unsupported file type. Allowed formats: PDF, DOC, DOCX, PPT, PPTX, PNG, JPG, WEBP.',
    };
  }
  if (!rule.mimes.includes(mimeType.toLowerCase())) {
    return {
      valid: false as const,
      error: 'File MIME type does not match its file extension.',
    };
  }
  return {
    valid: true as const,
    ext,
    category: rule.category,
  };
}

export function validateAvatarFile(originalName: string, mimeType: string) {
  const ext = path.extname(originalName).toLowerCase();
  const allowed: Record<string, string[]> = {
    '.png': ['image/png'],
    '.jpg': ['image/jpeg'],
    '.jpeg': ['image/jpeg'],
    '.webp': ['image/webp'],
  };
  if (!allowed[ext] || !allowed[ext].includes(mimeType.toLowerCase())) {
    return { valid: false as const, error: 'Profile photos must be PNG, JPG, or WEBP images.' };
  }
  return { valid: true as const, ext };
}

export function generateStoredFilename(ext: string): string {
  return `${Date.now()}-${crypto.randomBytes(10).toString('hex')}${ext}`;
}
