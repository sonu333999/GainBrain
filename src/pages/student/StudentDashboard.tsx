import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, BookOpen, CheckCircle2, Clock, Download, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { apiDownloadBlob, apiRequest } from '../../lib/api.ts';

interface StudentDashboardData {
  stats: {
    totalAttempts: number;
    averageScore: number;
    completedQuizzes: number;
    pendingQuizzes: number;
  };
  recentActivity: {
    id: number;
    quizId: number;
    quizTitle: string;
    subjectName: string;
    obtainedMarks: number;
    totalMarks: number;
    percentage: number;
    passed: boolean;
    timeTakenSeconds: number;
    submittedAt: string;
  }[];
  availableQuizzes: {
    id: number;
    title: string;
    subjectName: string;
    subjectCode: string;
    difficulty: string;
    durationMinutes: number;
    totalMarks: number;
    questionCount: number;
  }[];
  availableMaterials: {
    id: number;
    title: string;
    subjectName: string;
    topic: string;
    fileType: string;
    fileName: string;
    createdAt: string;
  }[];
  scoreTrend: { name: string; score: number }[];
  subjectPerformance: { subject: string; avgScore: number }[];
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiRequest<StudentDashboardData>('/api/dashboard/student')
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

  const handleDownload = async (id: number, fileName: string) => {
    try {
      await apiDownloadBlob(`/api/materials/${id}/download`, fileName);
      showToast(`Downloaded ${fileName}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Download failed.', 'error');
    }
  };

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
        {error || 'Unable to load dashboard.'}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Welcome back, {user?.fullName}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Track your quiz assessments, review score progression, and access course materials.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/student/quizzes')}
          className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors inline-flex items-center gap-2 self-start sm:self-auto whitespace-nowrap shrink-0"
        >
          <span>Browse Quizzes</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* 4 KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Quizzes Attempted
          </p>
          <p className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-2">
            {data.stats.totalAttempts}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Average Score
          </p>
          <p className="text-3xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-2">
            {data.stats.averageScore}%
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Completed Quizzes
          </p>
          <p className="text-3xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-2">
            {data.stats.completedQuizzes}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Pending Quizzes
          </p>
          <p className="text-3xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-2">
            {data.stats.pendingQuizzes}
          </p>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Performance Over Time
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Score percentage across recent submissions
              </p>
            </div>
          </div>
          {data.scoreTrend.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
              Complete a quiz to view your score trajectory.
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.scoreTrend}>
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
                  <Line
                    type="monotone"
                    dataKey="score"
                    name="Score (%)"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#2563eb' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Subject Average
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Mean score by subject
            </p>
          </div>
          {data.subjectPerformance.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
              No subject metrics recorded yet.
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.subjectPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                  <XAxis dataKey="subject" tick={{ fontSize: 11 }} stroke="#64748b" />
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
                  <Bar dataKey="avgScore" name="Average (%)" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity + Available Study Materials */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Recent Quiz Activity
            </h3>
            <button
              type="button"
              onClick={() => navigate('/student/results')}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              View all results
            </button>
          </div>

          {data.recentActivity.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No quiz attempts yet. Start an available quiz to see your activity here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-5 font-medium">Quiz</th>
                    <th className="py-3 px-4 font-medium text-right">Marks</th>
                    <th className="py-3 px-4 font-medium text-right">Score</th>
                    <th className="py-3 px-5 font-medium text-right">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.recentActivity.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => navigate(`/student/results/${item.id}`)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-5">
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {item.quizTitle}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {item.subjectName}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {item.obtainedMarks}/{item.totalMarks}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                        {item.percentage}%
                      </td>
                      <td className="py-3 px-5 text-right">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium ${
                            item.passed
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {item.passed ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          <span>{item.passed ? 'Passed' : 'Failed'}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Available Study Materials
            </h3>
            <button
              type="button"
              onClick={() => navigate('/student/materials')}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Browse library
            </button>
          </div>
          {data.availableMaterials.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No study materials published yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.availableMaterials.map((mat) => (
                <div
                  key={mat.id}
                  className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {mat.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {mat.subjectName} · {mat.topic} · {mat.fileType}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownload(mat.id, mat.fileName)}
                    aria-label={`Download ${mat.title}`}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Open Quizzes */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Open Assessments
          </h3>
          <button
            type="button"
            onClick={() => navigate('/student/quizzes')}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            All quizzes
          </button>
        </div>
        {data.availableQuizzes.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No active quizzes available right now.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.availableQuizzes.map((q) => (
              <div
                key={q.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between gap-4 hover:border-blue-500/60 transition-colors"
              >
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {q.subjectCode} · <span className="capitalize">{q.difficulty}</span>
                  </p>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1 line-clamp-2">
                    {q.title}
                  </h4>
                  <div className="mt-3 flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {q.durationMinutes}m
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" />
                      {q.questionCount} Qs
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/student/quizzes?preview=${q.id}`)}
                  className="w-full py-2 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-900 dark:text-slate-100 text-xs font-semibold transition-colors"
                >
                  View Instructions
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
