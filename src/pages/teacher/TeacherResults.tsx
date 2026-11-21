import React, { useEffect, useState } from 'react';
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
import { CheckCircle2, Download, Eye, Search, X, XCircle } from 'lucide-react';
import { useToast } from '../../context/ToastContext.tsx';
import { apiDownloadBlob, apiRequest } from '../../lib/api.ts';
import type { AttemptBreakdownItem, Quiz, QuizAttemptSummary } from '../../types/index.ts';

export default function TeacherResults() {
  const { showToast } = useToast();
  const [results, setResults] = useState<QuizAttemptSummary[]>([]);
  const [quizComparison, setQuizComparison] = useState<
    { name: string; avgScore: number; passRate: number; attempts: number }[]
  >([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [quizFilter, setQuizFilter] = useState('all');

  const [inspectAttempt, setInspectAttempt] = useState<{
    attempt: QuizAttemptSummary;
    breakdown: AttemptBreakdownItem[];
  } | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest<{
        results: QuizAttemptSummary[];
        quizComparison: { name: string; avgScore: number; passRate: number; attempts: number }[];
      }>('/api/results'),
      apiRequest<{ quizzes: Quiz[] }>('/api/quizzes'),
    ])
      .then(([resData, qData]) => {
        if (!active) return;
        setResults(resData.results);
        setQuizComparison(resData.quizComparison);
        setQuizzes(qData.quizzes);
      })
      .catch((err) => {
        if (active) showToast(err instanceof Error ? err.message : 'Failed to load results.', 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [showToast]);

  const filtered = results.filter((r) => {
    if (quizFilter !== 'all' && String(r.quizId) !== quizFilter) return false;
    if (
      search.trim() &&
      !(r.studentName ?? '').toLowerCase().includes(search.toLowerCase()) &&
      !(r.studentEmail ?? '').toLowerCase().includes(search.toLowerCase()) &&
      !r.quizTitle.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const handleExportCsv = async () => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (quizFilter !== 'all') params.set('quizId', quizFilter);
      const qs = params.toString();
      await apiDownloadBlob(
        `/api/results/export.csv${qs ? `?${qs}` : ''}`,
        'student-quiz-results.csv',
      );
      showToast('CSV results exported.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'CSV export failed.', 'error');
    }
  };

  const handleInspect = async (attemptId: number) => {
    try {
      const data = await apiRequest<{
        attempt: QuizAttemptSummary;
        breakdown: AttemptBreakdownItem[];
      }>(`/api/attempts/${attemptId}`);
      setInspectAttempt(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load attempt details.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Student Results & Analytics
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Inspect individual submissions, compare quiz averages, and export gradebook CSVs.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="px-4 py-2.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold inline-flex items-center gap-2 self-start sm:self-auto whitespace-nowrap"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Quiz Performance Comparison Chart */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Quiz Performance Comparison
        </h3>
        {quizComparison.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-slate-500">
            No student attempts recorded yet.
          </div>
        ) : (
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={quizComparison}>
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
                <Bar dataKey="avgScore" name="Average Score (%)" fill="#2563eb" radius={[6, 6, 0, 0]} />
                <Bar dataKey="passRate" name="Pass Rate (%)" fill="#16a34a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student name, email, or quiz..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
          />
        </div>

        <select
          value={quizFilter}
          onChange={(e) => setQuizFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
        >
          <option value="all">All Quizzes</option>
          {quizzes.map((q) => (
            <option key={q.id} value={String(q.id)}>
              {q.title}
            </option>
          ))}
        </select>
      </div>

      {/* Submissions Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading student results...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No matching student submissions found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-5 font-medium">Student</th>
                  <th className="py-3 px-4 font-medium">Quiz</th>
                  <th className="py-3 px-4 font-medium text-right">Marks</th>
                  <th className="py-3 px-4 font-medium text-right">Percentage</th>
                  <th className="py-3 px-4 font-medium">Outcome</th>
                  <th className="py-3 px-5 font-medium text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-5">
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {item.studentName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {item.studentEmail}
                      </p>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="text-slate-800 dark:text-slate-200">{item.quizTitle}</p>
                      <p className="text-xs text-slate-500">{item.subjectName}</p>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      {item.obtainedMarks}/{item.totalMarks}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold">
                      {item.percentage}%
                    </td>
                    <td className="py-3.5 px-4">
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
                    <td className="py-3.5 px-5 text-right">
                      <button
                        type="button"
                        onClick={() => handleInspect(item.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inspect Individual Student Attempt Modal */}
      {inspectAttempt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden flex flex-col max-h-[88vh]">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">
                  {inspectAttempt.attempt.studentName} · {inspectAttempt.attempt.studentEmail}
                </p>
                <h3 className="text-lg font-bold">{inspectAttempt.attempt.quizTitle}</h3>
              </div>
              <button type="button" onClick={() => setInspectAttempt(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-4 gap-3 text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 font-mono tabular-nums text-xs">
                <div>
                  <span className="block text-slate-500 font-sans">Score</span>
                  <strong className="text-sm">{inspectAttempt.attempt.percentage}%</strong>
                </div>
                <div>
                  <span className="block text-slate-500 font-sans">Marks</span>
                  <strong className="text-sm">
                    {inspectAttempt.attempt.obtainedMarks}/{inspectAttempt.attempt.totalMarks}
                  </strong>
                </div>
                <div>
                  <span className="block text-slate-500 font-sans">Correct</span>
                  <strong className="text-sm text-emerald-600">
                    {inspectAttempt.attempt.correctAnswers}
                  </strong>
                </div>
                <div>
                  <span className="block text-slate-500 font-sans">Incorrect</span>
                  <strong className="text-sm text-rose-600">
                    {inspectAttempt.attempt.incorrectAnswers}
                  </strong>
                </div>
              </div>

              {inspectAttempt.breakdown.map((q, idx) => (
                <div
                  key={q.questionId}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold">
                      {idx + 1}. {q.questionText}
                    </p>
                    <span className="text-xs font-mono tabular-nums shrink-0">
                      {q.marksAwarded}/{q.marks}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs">
                    {q.options.map((opt) => (
                      <div
                        key={opt.id}
                        className={`px-2.5 py-1.5 rounded ${
                          opt.isCorrect
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium'
                            : opt.id === q.selectedOptionId
                              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                              : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {opt.optionText}
                        {opt.id === q.selectedOptionId ? ' (Student Answer)' : ''}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
