import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// 1. users
export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash'),
    fullName: text('full_name').notNull(),
    role: text('role').notNull(), // 'teacher' | 'student'
    avatarUrl: text('avatar_url'),
    emailNotifications: boolean('email_notifications').notNull().default(true),
    quizReminders: boolean('quiz_reminders').notNull().default(true),
    resultAlerts: boolean('result_alerts').notNull().default(true),
    resetTokenHash: text('reset_token_hash'),
    resetTokenExpiresAt: timestamp('reset_token_expires_at'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('idx_users_role').on(table.role)],
);

// 2. student_profiles
export const studentProfiles = pgTable('student_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  course: text('course').notNull().default(''),
  semester: text('semester').notNull().default(''),
  enrollmentNumber: text('enrollment_number').notNull().default(''),
  department: text('department').notNull().default(''),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 3. teacher_profiles
export const teacherProfiles = pgTable('teacher_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  subjectSpecialty: text('subject_specialty').notNull().default(''),
  qualification: text('qualification').notNull().default(''),
  department: text('department').notNull().default(''),
  bio: text('bio').notNull().default(''),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 4. subjects
export const subjects = pgTable('subjects', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  code: text('code').notNull().unique(),
  description: text('description').notNull().default(''),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 5. quizzes
export const quizzes = pgTable(
  'quizzes',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    subjectId: integer('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'restrict' }),
    teacherId: integer('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    description: text('description').notNull().default(''),
    difficulty: text('difficulty').notNull().default('medium'), // 'easy' | 'medium' | 'hard'
    durationMinutes: integer('duration_minutes').notNull().default(30),
    totalMarks: integer('total_marks').notNull().default(0),
    passingPercentage: integer('passing_percentage').notNull().default(50),
    startDate: timestamp('start_date'),
    endDate: timestamp('end_date'),
    instructions: text('instructions').notNull().default(''),
    questionCount: integer('question_count').notNull().default(0),
    status: text('status').notNull().default('draft'), // 'draft' | 'published'
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_quizzes_teacher').on(table.teacherId),
    index('idx_quizzes_subject').on(table.subjectId),
    index('idx_quizzes_status').on(table.status),
  ],
);

// 6. questions
export const questions = pgTable(
  'questions',
  {
    id: serial('id').primaryKey(),
    quizId: integer('quiz_id').references(() => quizzes.id, { onDelete: 'set null' }),
    teacherId: integer('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    subjectId: integer('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
    topic: text('topic').notNull().default('General'),
    questionType: text('question_type').notNull().default('mcq'), // 'mcq' | 'true_false'
    questionText: text('question_text').notNull(),
    difficulty: text('difficulty').notNull().default('medium'), // 'easy' | 'medium' | 'hard'
    marks: integer('marks').notNull().default(1),
    explanation: text('explanation').notNull().default(''),
    inBank: boolean('in_bank').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_questions_quiz').on(table.quizId),
    index('idx_questions_subject').on(table.subjectId),
    index('idx_questions_teacher').on(table.teacherId),
    index('idx_questions_bank').on(table.inBank),
  ],
);

// 7. question_options
export const questionOptions = pgTable(
  'question_options',
  {
    id: serial('id').primaryKey(),
    questionId: integer('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    optionText: text('option_text').notNull(),
    isCorrect: boolean('is_correct').notNull().default(false),
    optionOrder: integer('option_order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('idx_options_question').on(table.questionId)],
);

// 8. quiz_attempts
export const quizAttempts = pgTable(
  'quiz_attempts',
  {
    id: serial('id').primaryKey(),
    quizId: integer('quiz_id')
      .notNull()
      .references(() => quizzes.id, { onDelete: 'cascade' }),
    studentId: integer('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('in_progress'), // 'in_progress' | 'submitted' | 'timed_out'
    totalQuestions: integer('total_questions').notNull().default(0),
    correctAnswers: integer('correct_answers').notNull().default(0),
    incorrectAnswers: integer('incorrect_answers').notNull().default(0),
    unansweredQuestions: integer('unanswered_questions').notNull().default(0),
    totalMarks: integer('total_marks').notNull().default(0),
    obtainedMarks: integer('obtained_marks').notNull().default(0),
    percentage: doublePrecision('percentage').notNull().default(0),
    passed: boolean('passed').notNull().default(false),
    timeTakenSeconds: integer('time_taken_seconds').notNull().default(0),
    startedAt: timestamp('started_at').notNull().defaultNow(),
    submittedAt: timestamp('submitted_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_attempts_quiz').on(table.quizId),
    index('idx_attempts_student').on(table.studentId),
    index('idx_attempts_status').on(table.status),
  ],
);

// 9. student_answers
export const studentAnswers = pgTable(
  'student_answers',
  {
    id: serial('id').primaryKey(),
    attemptId: integer('attempt_id')
      .notNull()
      .references(() => quizAttempts.id, { onDelete: 'cascade' }),
    questionId: integer('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    selectedOptionId: integer('selected_option_id').references(() => questionOptions.id, {
      onDelete: 'set null',
    }),
    isMarkedForReview: boolean('is_marked_for_review').notNull().default(false),
    isCorrect: boolean('is_correct').notNull().default(false),
    marksAwarded: integer('marks_awarded').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_attempt_question').on(table.attemptId, table.questionId),
    index('idx_student_answers_attempt').on(table.attemptId),
  ],
);

// 10. study_materials
export const studyMaterials = pgTable(
  'study_materials',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    subjectId: integer('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'restrict' }),
    teacherId: integer('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    topic: text('topic').notNull().default('General'),
    fileName: text('file_name').notNull(),
    storedFileName: text('stored_file_name').notNull(),
    fileType: text('file_type').notNull(), // 'PDF' | 'DOC' | 'PPT' | 'IMAGE'
    mimeType: text('mime_type').notNull(),
    fileSizeBytes: integer('file_size_bytes').notNull(),
    isPublished: boolean('is_published').notNull().default(true),
    downloadCount: integer('download_count').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_materials_subject').on(table.subjectId),
    index('idx_materials_teacher').on(table.teacherId),
    index('idx_materials_published').on(table.isPublished),
  ],
);

// 11. notifications
export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    message: text('message').notNull(),
    type: text('type').notNull().default('info'), // 'quiz' | 'result' | 'material' | 'system'
    isRead: boolean('is_read').notNull().default(false),
    linkUrl: text('link_url'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_notifications_user').on(table.userId),
    index('idx_notifications_read').on(table.isRead),
  ],
);

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  studentProfile: one(studentProfiles, {
    fields: [users.id],
    references: [studentProfiles.userId],
  }),
  teacherProfile: one(teacherProfiles, {
    fields: [users.id],
    references: [teacherProfiles.userId],
  }),
  quizzes: many(quizzes),
  questions: many(questions),
  attempts: many(quizAttempts),
  studyMaterials: many(studyMaterials),
  notifications: many(notifications),
}));

export const studentProfilesRelations = relations(studentProfiles, ({ one }) => ({
  user: one(users, {
    fields: [studentProfiles.userId],
    references: [users.id],
  }),
}));

export const teacherProfilesRelations = relations(teacherProfiles, ({ one }) => ({
  user: one(users, {
    fields: [teacherProfiles.userId],
    references: [users.id],
  }),
}));

export const subjectsRelations = relations(subjects, ({ many }) => ({
  quizzes: many(quizzes),
  questions: many(questions),
  studyMaterials: many(studyMaterials),
}));

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  subject: one(subjects, {
    fields: [quizzes.subjectId],
    references: [subjects.id],
  }),
  teacher: one(users, {
    fields: [quizzes.teacherId],
    references: [users.id],
  }),
  questions: many(questions),
  attempts: many(quizAttempts),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  quiz: one(quizzes, {
    fields: [questions.quizId],
    references: [quizzes.id],
  }),
  subject: one(subjects, {
    fields: [questions.subjectId],
    references: [subjects.id],
  }),
  teacher: one(users, {
    fields: [questions.teacherId],
    references: [users.id],
  }),
  options: many(questionOptions),
}));

export const questionOptionsRelations = relations(questionOptions, ({ one }) => ({
  question: one(questions, {
    fields: [questionOptions.questionId],
    references: [questions.id],
  }),
}));

export const quizAttemptsRelations = relations(quizAttempts, ({ one, many }) => ({
  quiz: one(quizzes, {
    fields: [quizAttempts.quizId],
    references: [quizzes.id],
  }),
  student: one(users, {
    fields: [quizAttempts.studentId],
    references: [users.id],
  }),
  answers: many(studentAnswers),
}));

export const studentAnswersRelations = relations(studentAnswers, ({ one }) => ({
  attempt: one(quizAttempts, {
    fields: [studentAnswers.attemptId],
    references: [quizAttempts.id],
  }),
  question: one(questions, {
    fields: [studentAnswers.questionId],
    references: [questions.id],
  }),
  selectedOption: one(questionOptions, {
    fields: [studentAnswers.selectedOptionId],
    references: [questionOptions.id],
  }),
}));

export const studyMaterialsRelations = relations(studyMaterials, ({ one }) => ({
  subject: one(subjects, {
    fields: [studyMaterials.subjectId],
    references: [subjects.id],
  }),
  teacher: one(users, {
    fields: [studyMaterials.teacherId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));
