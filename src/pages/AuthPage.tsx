import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpenCheck,
  GraduationCap,
  KeyRound,
  Lock,
  Mail,
  Moon,
  ShieldCheck,
  Sun,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { apiRequest } from '../lib/api.ts';
import type { UserRole } from '../types/index.ts';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

const HERO_CAMPUS_IMAGE = '/src/assets/images/auth_academic_campus_1795265266555.jpg';

export default function AuthPage() {
  const {
    user,
    login,
    register,
    demoAccess,
    loginWithGoogle,
    pendingGoogle,
    completeGoogleRole,
    cancelPendingGoogle,
  } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [mode, setMode] = useState<AuthMode>('login');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Login / Register state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [course, setCourse] = useState('');
  const [semester, setSemester] = useState('');
  const [enrollmentNumber, setEnrollmentNumber] = useState('');
  const [subjectSpecialty, setSubjectSpecialty] = useState('');
  const [qualification, setQualification] = useState('');

  // Reset password state
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Demo access state
  const [demoStatus, setDemoStatus] = useState<{
    teacherConfigured: boolean;
    studentConfigured: boolean;
  }>({ teacherConfigured: false, studentConfigured: false });
  const [demoTargetRole, setDemoTargetRole] = useState<UserRole | null>(null);
  const [demoPassword, setDemoPassword] = useState('');

  useEffect(() => {
    if (user) {
      navigate(user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard', {
        replace: true,
      });
    }
  }, [user, navigate]);

  useEffect(() => {
    apiRequest<{ teacherConfigured: boolean; studentConfigured: boolean }>('/api/auth/demo-status')
      .then((res) => setDemoStatus(res))
      .catch(() => {
        // ignore
      });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    try {
      const loggedIn = await login(email, password);
      showToast(`Welcome back, ${loggedIn.fullName}`, 'success');
      navigate(loggedIn.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    try {
      const created = await register({
        email,
        password,
        fullName,
        role,
        course: role === 'student' ? course : undefined,
        semester: role === 'student' ? semester : undefined,
        enrollmentNumber: role === 'student' ? enrollmentNumber : undefined,
        subjectSpecialty: role === 'teacher' ? subjectSpecialty : undefined,
        qualification: role === 'teacher' ? qualification : undefined,
      });
      showToast('Account created successfully.', 'success');
      navigate(created.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to create account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      showToast(res.message, 'info');
      setMode('reset');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to request reset.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, token: resetToken, newPassword }),
      });
      showToast(res.message, 'success');
      setMode('login');
      setPassword('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setSubmitting(true);
    try {
      const loggedIn = await loginWithGoogle();
      if (loggedIn) {
        showToast(`Signed in as ${loggedIn.fullName}`, 'success');
        navigate(loggedIn.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Google Sign-In failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteGoogleRole = async (chosenRole: UserRole) => {
    setErrorMsg('');
    setSubmitting(true);
    try {
      const completed = await completeGoogleRole(chosenRole);
      showToast(`Welcome to ScholarPulse, ${completed.fullName}`, 'success');
      navigate(completed.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to complete Google sign-in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoTargetRole) return;
    setErrorMsg('');
    setSubmitting(true);
    try {
      const loggedIn = await demoAccess(demoTargetRole, demoPassword);
      showToast(`Entered demo workspace as ${loggedIn.fullName}`, 'success');
      navigate(loggedIn.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Demo login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Top Bar */}
      <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 flex items-center justify-between gap-8">
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
            <GraduationCap className="w-4 h-4" />
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
            ScholarPulse
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle color theme"
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 items-stretch">
        {/* Left Editorial Hero Column */}
        <div className="lg:col-span-6 relative overflow-hidden bg-slate-900 min-h-[320px] lg:min-h-full flex flex-col justify-between p-8 sm:p-12">
          <img
            src={HERO_CAMPUS_IMAGE}
            alt="University study hall and digital assessment center"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/65 to-slate-900/45" />

          <div className="relative z-10 max-w-lg">
            <p className="text-sm font-medium text-blue-300">
              Online Assessment & Learning Platform
            </p>
            <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight text-balance">
              Structured quizzes, live timing, and measurable student outcomes.
            </h1>
            <p className="mt-4 text-sm sm:text-base text-slate-200 leading-relaxed">
              Built for instructors authoring rigorous question banks and students mastering core technical subjects with instant backend-verified grading.
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8 border-t border-white/15 text-white">
            <div>
              <p className="text-xs text-slate-300">Role Separation</p>
              <p className="text-sm font-semibold mt-0.5">Teacher & Student Portals</p>
            </div>
            <div>
              <p className="text-xs text-slate-300">Assessment Engine</p>
              <p className="text-sm font-semibold mt-0.5">Server-Evaluated Scoring</p>
            </div>
            <div>
              <p className="text-xs text-slate-300">Resources</p>
              <p className="text-sm font-semibold mt-0.5">PDF, Docs & Slide Vault</p>
            </div>
          </div>
        </div>

        {/* Right Auth Form Column */}
        <div className="lg:col-span-6 flex items-center justify-center p-6 sm:p-10 lg:p-14">
          <div className="w-full max-w-md space-y-6">
            {pendingGoogle ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    Choose your workspace role
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Completing sign-in for <span className="font-medium text-slate-900 dark:text-slate-100">{pendingGoogle.email}</span>. Select your role to initialize your dashboard.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleCompleteGoogleRole('student')}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-600 dark:hover:border-blue-500 text-left transition-colors"
                  >
                    <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-2" />
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Student</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Attempt quizzes and study materials
                    </p>
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleCompleteGoogleRole('teacher')}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-600 dark:hover:border-blue-500 text-left transition-colors"
                  >
                    <BookOpenCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-2" />
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Teacher</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Create quizzes and track results
                    </p>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={cancelPendingGoogle}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  Cancel Google Sign-In
                </button>
              </div>
            ) : (
              <>
                {/* Mode Tabs */}
                <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-800/80">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setErrorMsg('');
                    }}
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                      mode === 'login'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setErrorMsg('');
                    }}
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                      mode === 'register'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                {errorMsg && (
                  <div
                    role="alert"
                    className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-300"
                  >
                    {errorMsg}
                  </div>
                )}

                {mode === 'login' && (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@university.edu"
                          className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setMode('forgot');
                            setErrorMsg('');
                          }}
                          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      <span>{submitting ? 'Signing in...' : 'Sign In'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                )}

                {mode === 'register' && (
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Select Role
                      </label>
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setRole('student')}
                          className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                            role === 'student'
                              ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                              : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <GraduationCap className="w-4 h-4" />
                          <span>Student</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRole('teacher')}
                          className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                            role === 'teacher'
                              ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                              : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <BookOpenCheck className="w-4 h-4" />
                          <span>Teacher</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Full Name
                      </label>
                      <div className="relative">
                        <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Dr. Elena Vance or Aarav Mehta"
                          className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                          Email
                        </label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@university.edu"
                          className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                          Password
                        </label>
                        <input
                          type="password"
                          required
                          minLength={8}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Min 8 characters"
                          className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    </div>

                    {role === 'student' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <input
                          type="text"
                          value={course}
                          onChange={(e) => setCourse(e.target.value)}
                          placeholder="Course (e.g. B.Tech CS)"
                          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                        <input
                          type="text"
                          value={semester}
                          onChange={(e) => setSemester(e.target.value)}
                          placeholder="Semester"
                          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                        <input
                          type="text"
                          value={enrollmentNumber}
                          onChange={(e) => setEnrollmentNumber(e.target.value)}
                          placeholder="Enrollment #"
                          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          value={subjectSpecialty}
                          onChange={(e) => setSubjectSpecialty(e.target.value)}
                          placeholder="Subject Specialty"
                          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                        <input
                          type="text"
                          value={qualification}
                          onChange={(e) => setQualification(e.target.value)}
                          placeholder="Qualification (e.g. Ph.D.)"
                          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
                    >
                      {submitting ? 'Creating Account...' : 'Create Account'}
                    </button>
                  </form>
                )}

                {mode === 'forgot' && (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        Forgot Password
                      </h2>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        Enter your account email to request a time-limited password reset token.
                      </p>
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@university.edu"
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <div className="flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
                      >
                        Request Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode('reset')}
                        className="py-2.5 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium"
                      >
                        Have a token?
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      Back to Sign In
                    </button>
                  </form>
                )}

                {mode === 'reset' && (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        Reset Password
                      </h2>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        Enter your email, reset token, and your new password.
                      </p>
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email address"
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                    />
                    <input
                      type="text"
                      required
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      placeholder="Reset token"
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono"
                    />
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password (min 8 chars)"
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                    />
                    <div className="flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
                      >
                        Update Password
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode('login')}
                        className="py-2.5 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {/* Divider & Google Sign-In */}
                {(mode === 'login' || mode === 'register') && (
                  <>
                    <div className="relative flex items-center py-1">
                      <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
                      <span className="shrink mx-3 text-xs text-slate-400">or</span>
                      <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
                    </div>

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleGoogleSignIn}
                      className="w-full py-2.5 px-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium text-slate-800 dark:text-slate-100 transition-colors flex items-center justify-center gap-2.5"
                    >
                      <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Continue with Google</span>
                    </button>

                    {/* Demo Workspace Access */}
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Demo Workspace Accounts
                        </p>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Pre-seeded sample data
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setDemoTargetRole('teacher');
                            setDemoPassword('');
                            setErrorMsg('');
                          }}
                          className={`p-3 rounded-lg border text-left transition-colors ${
                            demoTargetRole === 'teacher'
                              ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            Demo Teacher
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            teacher@quizsystem.com
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setDemoTargetRole('student');
                            setDemoPassword('');
                            setErrorMsg('');
                          }}
                          className={`p-3 rounded-lg border text-left transition-colors ${
                            demoTargetRole === 'student'
                              ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            Demo Student
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            student@quizsystem.com
                          </p>
                        </button>
                      </div>

                      {demoTargetRole && (
                        <form
                          onSubmit={handleDemoSubmit}
                          className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5"
                        >
                          <div className="flex items-center gap-2 text-xs font-medium text-slate-800 dark:text-slate-200">
                            <KeyRound className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            <span>
                              {(
                                demoTargetRole === 'teacher'
                                  ? demoStatus.teacherConfigured
                                  : demoStatus.studentConfigured
                              )
                                ? `Enter password for ${demoTargetRole}@quizsystem.com`
                                : `First-run setup: choose a password for ${demoTargetRole}@quizsystem.com`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="password"
                              required
                              minLength={6}
                              value={demoPassword}
                              onChange={(e) => setDemoPassword(e.target.value)}
                              placeholder="Min 6 characters"
                              className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                            <button
                              type="submit"
                              disabled={submitting}
                              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap shrink-0"
                            >
                              {submitting ? 'Entering...' : 'Enter'}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
