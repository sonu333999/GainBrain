import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import AuthPage from './pages/AuthPage.tsx';
import MaterialsPage from './pages/MaterialsPage.tsx';
import ProfileSettingsPage from './pages/ProfileSettingsPage.tsx';
import QuizRunner from './pages/student/QuizRunner.tsx';
import StudentDashboard from './pages/student/StudentDashboard.tsx';
import StudentQuizzes from './pages/student/StudentQuizzes.tsx';
import StudentResults from './pages/student/StudentResults.tsx';
import CreateEditQuiz from './pages/teacher/CreateEditQuiz.tsx';
import ManageQuizzes from './pages/teacher/ManageQuizzes.tsx';
import QuestionBank from './pages/teacher/QuestionBank.tsx';
import StudentManagement from './pages/teacher/StudentManagement.tsx';
import TeacherDashboard from './pages/teacher/TeacherDashboard.tsx';
import TeacherResults from './pages/teacher/TeacherResults.tsx';
import type { UserRole } from './types/index.ts';

function RoleGuard({ requiredRole, children }: { requiredRole: UserRole; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-sm text-slate-500">
        Loading workspace...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  if (user.role !== requiredRole) {
    return (
      <Navigate
        to={user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard'}
        replace
      />
    );
  }
  return <>{children}</>;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-sm text-slate-500">
        Initializing...
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return (
    <Navigate
      to={user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard'}
      replace
    />
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/auth" element={<AuthPage />} />

              {/* Student Protected Routes */}
              <Route
                path="/student"
                element={
                  <RoleGuard requiredRole="student">
                    <Layout />
                  </RoleGuard>
                }
              >
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<StudentDashboard />} />
                <Route path="quizzes" element={<StudentQuizzes />} />
                <Route path="quizzes/:id/take" element={<QuizRunner />} />
                <Route path="results" element={<StudentResults />} />
                <Route path="results/:attemptId" element={<StudentResults />} />
                <Route path="materials" element={<MaterialsPage />} />
                <Route path="profile" element={<ProfileSettingsPage initialTab="profile" />} />
                <Route path="settings" element={<ProfileSettingsPage initialTab="settings" />} />
              </Route>

              {/* Teacher Protected Routes */}
              <Route
                path="/teacher"
                element={
                  <RoleGuard requiredRole="teacher">
                    <Layout />
                  </RoleGuard>
                }
              >
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<TeacherDashboard />} />
                <Route path="quizzes/new" element={<CreateEditQuiz />} />
                <Route path="quizzes/:id/edit" element={<CreateEditQuiz />} />
                <Route path="quizzes" element={<ManageQuizzes />} />
                <Route path="question-bank" element={<QuestionBank />} />
                <Route path="results" element={<TeacherResults />} />
                <Route path="materials" element={<MaterialsPage />} />
                <Route path="students" element={<StudentManagement />} />
                <Route path="profile" element={<ProfileSettingsPage initialTab="profile" />} />
                <Route path="settings" element={<ProfileSettingsPage initialTab="settings" />} />
              </Route>

              <Route path="*" element={<HomeRedirect />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
