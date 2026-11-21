import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit3, PlusCircle, Power, Search, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import type { Quiz } from '../../types/index.ts';

export default function ManageQuizzes() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');

  const loadQuizzes = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ quizzes: Quiz[] }>('/api/quizzes');
      setQuizzes(res.quizzes);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load quizzes.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuizzes();
  }, []);

  const handleToggleActive = async (quiz: Quiz) => {
    try {
      const res = await apiRequest<{ quiz: Quiz }>(`/api/quizzes/${quiz.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !quiz.isActive }),
      });
      setQuizzes((prev) =>
        prev.map((q) => (q.id === quiz.id ? { ...q, isActive: res.quiz.isActive } : q)),
      );
      showToast(
        res.quiz.isActive ? 'Quiz activated for students.' : 'Quiz deactivated.',
        'info',
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update status.', 'error');
    }
  };

  const handleTogglePublish = async (quiz: Quiz) => {
    const nextStatus = quiz.status === 'published' ? 'draft' : 'published';
    try {
      const res = await apiRequest<{ quiz: Quiz }>(`/api/quizzes/${quiz.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: nextStatus,
          isActive: nextStatus === 'published' ? true : quiz.isActive,
        }),
      });
      setQuizzes((prev) =>
        prev.map((q) =>
          q.id === quiz.id
            ? { ...q, status: res.quiz.status, isActive: res.quiz.isActive }
            : q,
        ),
      );
      showToast(
        nextStatus === 'published' ? 'Quiz published.' : 'Quiz moved to drafts.',
        'success',
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to change publish state.', 'error');
    }
  };

  const handleDelete = async (quizId: number) => {
    try {
      await apiRequest(`/api/quizzes/${quizId}`, { method: 'DELETE' });
      setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
      showToast('Quiz deleted permanently.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete quiz.', 'error');
    }
  };

  const filtered = quizzes.filter((q) => {
    if (statusFilter !== 'all' && q.status !== statusFilter) return false;
    if (
      search.trim() &&
      !q.title.toLowerCase().includes(search.toLowerCase()) &&
      !q.subjectName.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Manage Quizzes
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Publish drafts, pause active assessments, edit questions, and review participation metrics.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/teacher/quizzes/new')}
          className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center gap-2 self-start sm:self-auto whitespace-nowrap"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Create Quiz</span>
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your quizzes..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
          />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
          {(['all', 'published', 'draft'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                statusFilter === tab
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading quizzes...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">No quizzes match your filters.</p>
            <button
              type="button"
              onClick={() => navigate('/teacher/quizzes/new')}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold"
            >
              Create First Quiz
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-5 font-medium">Quiz Title</th>
                  <th className="py-3 px-4 font-medium text-right">Questions</th>
                  <th className="py-3 px-4 font-medium text-right">Attempts</th>
                  <th className="py-3 px-4 font-medium text-right">Avg Score</th>
                  <th className="py-3 px-4 font-medium">State</th>
                  <th className="py-3 px-5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((quiz) => (
                  <tr key={quiz.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-5">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {quiz.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {quiz.subjectCode} · {quiz.subjectName} · {quiz.durationMinutes}m ·{' '}
                        <span className="capitalize">{quiz.difficulty}</span>
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      {quiz.questionCount} ({quiz.totalMarks}m)
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      {quiz.attemptCount ?? 0}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      {quiz.avgScore ?? 0}%
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => handleTogglePublish(quiz)}
                        className={`text-xs font-medium hover:underline ${
                          quiz.status === 'published'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {quiz.status === 'published'
                          ? quiz.isActive
                            ? 'Published (Active)'
                            : 'Published (Paused)'
                          : 'Draft'}
                      </button>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(quiz)}
                          title={quiz.isActive ? 'Deactivate quiz' : 'Activate quiz'}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/teacher/quizzes/${quiz.id}/edit`)}
                          title="Edit quiz"
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(quiz.id)}
                          title="Delete quiz"
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
