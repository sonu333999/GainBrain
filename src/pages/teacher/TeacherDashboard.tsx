import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, CheckCircle2, PlusCircle, Upload, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiRequest } from '../../lib/api.ts';

interface TeacherDashboardData {
  stats: {
    totalQuizzes: number;
    totalStudents: number;
    totalAttempts: number;
    avgStudentPerformance: number;
  };
  recentSubmissions: {
    id: number;
    quizId: number;
    quizTitle: string;
    studentName: string;
    studentEmail: string;
    obtainedMarks: number;
    totalMarks: number;
    percentage: number;
    passed: boolean;
    submittedAt: string;
  }[];
  quizPerformance: {
    name: string;
    avgScore: number;
    passRate: number;
    attempts: number;
  }[];
  recentQuizzes: {
    id: number;
    title: string;
    status: string;
    isActive: boolean;
    subjectName: string;
    questionCount: number;
    totalMarks: number;
  }[];
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiRequest<TeacherDashboardData>('/api/dashboard/teacher')
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load dashboard.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-20 rounded-xl bg-slate-200/60 dark:bg-slate-800/60 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-slate-200/60 dark:bg-slate-800/60 animate-pulse" />
          ))}
        </div>
        <div className="h-72 rounded-xl bg-slate-200/60 dark:bg-slate-800/60 animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-6 text-sm text-rose-700 dark:text-rose-300">
        {error || 'Unable to load teacher dashboard.'}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Instructor Overview, {user?.fullName}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Monitor assessment activity, student scores, and course resource engagement.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/teacher/materials')}
            className="px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Material</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/teacher/quizzes/new')}
            className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Quiz</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Quizzes Created
          </p>
          <p className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-2">
            {data.stats.totalQuizzes}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Registered Students
          </p>
          <p className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-2">
            {data.stats.totalStudents}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Quiz Attempts
          </p>
          <p className="text-3xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-2">
            {data.stats.totalAttempts}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Avg Student Performance
          </p>
          <p className="text-3xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-2">
            {data.stats.avgStudentPerformance}%
          </p>
        </div>
      </div>

      {/* Charts + Recent Quizzes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Quiz Performance Comparison
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Average score and pass rate per assessment
            </p>
          </div>
          {data.quizPerformance.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
              Student submissions will appear here once quizzes are attempted.
            </div>
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.quizPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#64748b" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#64748b" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#1e293b',
                      color: '#f8fafc',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="avgScore" name="Avg Score (%)" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="passRate" name="Pass Rate (%)" fill="#16a34a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Your Quizzes
            </h3>
            <button
              type="button"
              onClick={() => navigate('/teacher/quizzes')}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            >
              <span>Manage all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {data.recentQuizzes.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No quizzes created yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.recentQuizzes.map((q) => (
                <div
                  key={q.id}
                  onClick={() => navigate(`/teacher/quizzes/${q.id}/edit`)}
                  className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {q.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                      {q.subjectName} · {q.questionCount} Qs · {q.totalMarks} marks
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium capitalize shrink-0 ${
                      q.status === 'published' && q.isActive
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {q.status === 'published' ? (q.isActive ? 'Published' : 'Paused') : 'Draft'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Student Submissions */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Recent Student Submissions
          </h3>
          <button
            type="button"
            onClick={() => navigate('/teacher/results')}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Full results & CSV export
          </button>
        </div>

        {data.recentSubmissions.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No student quiz attempts submitted yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-5 font-medium">Student</th>
                  <th className="py-3 px-4 font-medium">Quiz</th>
                  <th className="py-3 px-4 font-medium text-right">Marks</th>
                  <th className="py-3 px-4 font-medium text-right">Score</th>
                  <th className="py-3 px-5 font-medium text-right">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.recentSubmissions.map((sub) => (
                  <tr
                    key={sub.id}
                    onClick={() => navigate('/teacher/results')}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                  >
                    <td className="py-3 px-5">
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {sub.studentName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {sub.studentEmail}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {sub.quizTitle}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {sub.obtainedMarks}/{sub.totalMarks}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                      {sub.percentage}%
                    </td>
                    <td className="py-3 px-5 text-right">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium ${
                          sub.passed
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {sub.passed ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        <span>{sub.passed ? 'Passed' : 'Failed'}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
