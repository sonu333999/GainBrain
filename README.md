# ScholarPulse — Smart Online Learning & Assessment Platform

A full-stack online quiz assessment, question bank, study material vault, and performance analytics platform built with React, TypeScript, Tailwind CSS, Express, Drizzle ORM, PostgreSQL (Cloud SQL), and Firebase Authentication.

## Features

- **Role-Based Authentication & Portals**: Separate Teacher and Student dashboards with JWT + Firebase Auth (Google Sign-In), `scrypt` password hashing, and strict API role guards.
- **Student Assessment Engine**: Search and filter quizzes, review instructions, live server-synced countdown timer, mark-for-review palette, automatic submission on expiry, and backend-evaluated scoring with detailed answer explanations.
- **Teacher Authoring & Question Bank**: Create/edit/publish/pause quizzes, author MCQ (4 options) and True/False questions, organize a reusable Question Bank by subject/topic/difficulty, and preview assessments.
- **Study Materials Vault**: Upload, edit, publish/unpublish, and download PDF, DOC/DOCX, PPT/PPTX, and image resources with secure path confinement and MIME validation.
- **Analytics & Reporting**: Interactive Recharts visualizations for both students and teachers, plus filtered gradebook CSV export.

## Database Schema (PostgreSQL + Drizzle ORM)

11 normalized tables defined in `src/db/schema.ts`:
- `users`, `student_profiles`, `teacher_profiles`
- `subjects`, `quizzes`, `questions`, `question_options`
- `quiz_attempts`, `student_answers`
- `study_materials`, `notifications`

## Setup & Commands

1. Copy `.env.example` and configure your PostgreSQL (`SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`, `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD`) and optional demo passwords (`DEMO_TEACHER_PASSWORD`, `DEMO_STUDENT_PASSWORD`).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Push database schema & seed sample data:
   ```bash
   npx drizzle-kit push --config=src/db/drizzle.config.ts
   npm run seed
   ```
4. Run development server (port 3000):
   ```bash
   npm run dev

   App link: https://ai.studio/apps/2bed0b4b-6e82-4add-bfd8-f1af5e5338e2?fullscreenApplet=true
   ```
5. Build & run in production:
   ```bash
   npm run build
   NODE_ENV=production npm start
   ```
