import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import authRoutes from './src/server/routes/authRoutes.ts';
import quizRoutes from './src/server/routes/quizRoutes.ts';
import questionRoutes from './src/server/routes/questionRoutes.ts';
import attemptRoutes from './src/server/routes/attemptRoutes.ts';
import materialRoutes from './src/server/routes/materialRoutes.ts';
import userRoutes from './src/server/routes/userRoutes.ts';
import { AVATARS_DIR, ensureUploadDirs } from './src/server/storage.ts';

async function startServer() {
  ensureUploadDirs();
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Serve uploaded avatars statically (materials go through authenticated download endpoint)
  app.use('/uploads/avatars', express.static(AVATARS_DIR));

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api', quizRoutes);
  app.use('/api/questions', questionRoutes);
  app.use('/api', attemptRoutes);
  app.use('/api/materials', materialRoutes);
  app.use('/api', userRoutes);

  // Explicit 404 for unknown API routes
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Global error handler (including multer file size errors)
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Server error:', err);
    if (err.message?.includes('File too large')) {
      return res.status(413).json({ error: 'Uploaded file exceeds the maximum allowed size.' });
    }
    return res.status(500).json({ error: 'An unexpected server error occurred.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ScholarPulse server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
