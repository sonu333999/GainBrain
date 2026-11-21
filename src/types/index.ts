export type UserRole = 'teacher' | 'student';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type QuestionType = 'mcq' | 'true_false';

export interface User {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  role: UserRole;
  avatarUrl: string | null;
  emailNotifications: boolean;
  quizReminders: boolean;
  resultAlerts: boolean;
}

export interface StudentProfileData {
  course?: string;
  semester?: string;
  enrollmentNumber?: string;
  department?: string;
}

export interface TeacherProfileData {
  subjectSpecialty?: string;
  qualification?: string;
  department?: string;
  bio?: string;
}

export interface Subject {
  id: number;
  name: string;
  code: string;
  description: string;
}

export interface QuestionOption {
  id: number;
  questionId: number;
  optionText: string;
  isCorrect?: boolean;
  optionOrder: number;
}

export interface Question {
  id: number;
  quizId: number | null;
  teacherId: number;
  subjectId: number | null;
  subjectName?: string | null;
  subjectCode?: string | null;
  topic: string;
  questionType: QuestionType;
  questionText: string;
  difficulty: DifficultyLevel;
  marks: number;
  explanation?: string;
  inBank: boolean;
  options: QuestionOption[];
}

export interface Quiz {
  id: number;
  title: string;
  subjectId: number;
  subjectName: string;
  subjectCode: string;
  teacherId: number;
  teacherName: string;
  description: string;
  difficulty: DifficultyLevel;
  durationMinutes: number;
  totalMarks: number;
  passingPercentage: number;
  startDate: string | null;
  endDate: string | null;
  instructions: string;
  questionCount: number;
  status: 'draft' | 'published';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Student metadata
  studentAttemptCount?: number;
  inProgressAttemptId?: number | null;
  bestPercentage?: number | null;
  lastAttemptId?: number | null;
  // Teacher metadata
  attemptCount?: number;
  avgScore?: number;
}

export interface QuizAttemptSummary {
  id: number;
  quizId: number;
  quizTitle: string;
  subjectName: string;
  subjectCode?: string;
  difficulty?: DifficultyLevel;
  passingPercentage?: number;
  studentId?: number;
  studentName?: string;
  studentEmail?: string;
  status: 'in_progress' | 'submitted' | 'timed_out';
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unansweredQuestions: number;
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  passed: boolean;
  timeTakenSeconds: number;
  startedAt?: string;
  submittedAt: string | null;
}

export interface AttemptBreakdownItem {
  questionId: number;
  questionText: string;
  questionType: QuestionType;
  marks: number;
  explanation: string;
  selectedOptionId: number | null;
  isCorrect: boolean;
  marksAwarded: number;
  options: QuestionOption[];
}

export interface StudyMaterial {
  id: number;
  title: string;
  description: string;
  subjectId: number;
  subjectName: string;
  subjectCode: string;
  teacherId: number;
  teacherName: string;
  topic: string;
  fileName: string;
  fileType: 'PDF' | 'DOC' | 'PPT' | 'IMAGE';
  mimeType: string;
  fileSizeBytes: number;
  isPublished: boolean;
  downloadCount: number;
  createdAt: string;
}

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  linkUrl: string | null;
  createdAt: string;
}
