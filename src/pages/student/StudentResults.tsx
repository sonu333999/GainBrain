import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowLeft, CheckCircle2, Clock, Search, XCircle } from 'lucide-react';
import { useToast } from '../../context/ToastContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import type { AttemptBreakdownItem, QuizAttemptSummary } from '../../types/index.ts';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default function StudentResults() {
  const { attemptId } = useParams<{ attemptId?: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [results, setResults] = useState<QuizAttemptSummary[]>([]);
  const [trend, setTrend] = useState<{ name: string; percentage: number; date: string }[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [detail, setDetail] = useState<{
    attempt: QuizAttemptSummary;
    breakdown: AttemptBreakdownItem[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (attemptId) {
      let active = true;
      setDetailLoading(true);
      apiRequest<{ attempt: QuizAttemptSummary; breakdown: AttemptBreakdownItem[] }>(
        `/api/attempts/${attemptId}`,
      )
        .then((res) => {
          if (active) setDetail(res);
        })
        .catch((err) => {
          if (active) {
            showToast(err instanceof Error ? err.message : 'Unable to load result.', 'error');
            navigate('/student/results');
          }
        })
        .finally(() => {
          if (active) setDetailLoading(false);
        });
      return () => {
        active = false;
      };
    }

    setDetail(null);
    let active = true;
    setLoading(true);
    apiRequest<{
      results: QuizAttemptSummary[];
      trend: { name: string; percentage: number; date: string }[];
    }>('/api/results')
      .then((res) => {
        if (!active) return;
        setResults(res.results);
        setTrend(res.trend);
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
  }, [attemptId, navigate, showToast]);

  // Detailed Result Breakdown View
  if (attemptId) {
    if (detailLoading || !detail) {
      return (
        <div className="space-y-4">
          <div className="h-24 rounded-xl bg-slate-200/60 dark:bg-slate-800/60 animate-pulse" />
          <div className="h-64 rounded-xl bg-slate-200/60 dark:bg-slate-800/60 animate-pulse" />
        </div>
      );
    }

    const { attempt, breakdown } = detail;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate('/student/results')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to My Results</span>
          </button>
        </div>

        {/* Result Summary Header */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {attempt.subjectCode} · {attempt.subjectName}
              </p>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {attempt.quizTitle}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
                  attempt.passed
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {attempt.passed ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                <span>{attempt.passed ? 'Passed' : 'Failed'}</span>
              </span>
              <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {attempt.percentage}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 pt-5 font-mono tabular-nums">
            <div>
              <p className="text-xs font-sans text-slate-500 dark:text-slate-400">Questions</p>
              <p className="text-lg font-bold mt-0.5">{attempt.totalQuestions}</p>
            </div>
            <div>
              <p className="text-xs font-sans text-slate-500 dark:text-slate-400">Correct</p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {attempt.correctAnswers}
              </p>
            </div>
            <div>
              <p className="text-xs font-sans text-slate-500 dark:text-slate-400">Incorrect</p>
              <p className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                {attempt.incorrectAnswers}
              </p>
            </div>
            <div>
              <p className="text-xs font-sans text-slate-500 dark:text-slate-400">Unanswered</p>
              <p className="text-lg font-bold text-slate-600 dark:text-slate-300 mt-0.5">
                {attempt.unansweredQuestions}
              </p>
            </div>
            <div>
              <p className="text-xs font-sans text-slate-500 dark:text-slate-400">Marks</p>
              <p className="text-lg font-bold mt-0.5">
                {attempt.obtainedMarks}/{attempt.totalMarks}
              </p>
            </div>
            <div>
              <p className="text-xs font-sans text-slate-500 dark:text-slate-400">Time Taken</p>
              <p className="text-lg font-bold mt-0.5">{formatDuration(attempt.timeTakenSeconds)}</p>
            </div>
            <div>
              <p className="text-xs font-sans text-slate-500 dark:text-slate-400">Passing Req</p>
              <p className="text-lg font-bold mt-0.5">{attempt.passingPercentage ?? 50}%</p>
            </div>
          </div>
        </div>

        {/* Question-by-Question Review */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Answer Review & Explanations
          </h3>
          {breakdown.map((item, idx) => (
            <div
              key={item.questionId}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {idx + 1}. {item.questionText}
                </p>
                <span
                  className={`text-xs font-mono tabular-nums font-semibold shrink-0 ${
                    item.isCorrect
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {item.marksAwarded}/{item.marks} marks
                </span>
              </div>

              <div className="space-y-2">
                {item.options.map((opt) => {
                  const isChosen = opt.id === item.selectedOptionId;
                  const isCorrectOpt = Boolean(opt.isCorrect);
                  return (
                    <div
                      key={opt.id}
                      className={`px-3.5 py-2.5 rounded-lg border text-sm flex items-center justify-between gap-2 ${
                        isCorrectOpt
                          ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
                          : isChosen && !isCorrectOpt
                            ? 'border-rose-300 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200'
                            : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span>{opt.optionText}</span>
                      <span className="text-xs font-medium shrink-0">
                        {isCorrectOpt ? 'Correct Answer' : isChosen ? 'Your Selection' : ''}
                      </span>
                    </div>
                  );
                })}
              </div>

              {item.explanation && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Explanation:{' '}
                  </span>
                  {item.explanation}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Results History Overview
  const filtered = results.filter(
    (r) =>
      !search.trim() ||
      r.quizTitle.toLowerCase().includes(search.toLowerCase()) ||
      r.subjectName.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            My Quiz Results
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Review past attempts, track score trends, and inspect detailed answer explanations.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by quiz or subject..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
      </div>

      {/* Performance Trend Chart */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Score Progression
        </h3>
        {trend.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
            No completed attempts to plot yet.
          </div>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
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
                  dataKey="percentage"
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

      {/* History Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading results...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No quiz attempts found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-5 font-medium">Quiz</th>
                  <th className="py-3 px-4 font-medium text-right">Marks</th>
                  <th className="py-3 px-4 font-medium text-right">Percentage</th>
                  <th className="py-3 px-4 font-medium text-right">Time</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-5">
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {item.quizTitle}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {item.subjectName} ·{' '}
                        {item.submittedAt
                          ? new Date(item.submittedAt).toLocaleDateString()
                          : ''}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      {item.obtainedMarks}/{item.totalMarks}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold">
                      {item.percentage}%
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDuration(item.timeTakenSeconds)}
                      </span>
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
                        onClick={() => navigate(`/student/results/${item.id}`)}
                        className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                      >
                        View Breakdown
                      </button>
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
