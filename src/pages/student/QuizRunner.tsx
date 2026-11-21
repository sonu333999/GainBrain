import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Send,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import type { Question } from '../../types/index.ts';

interface StartQuizResponse {
  attempt: {
    id: number;
    quizId: number;
    totalQuestions: number;
    totalMarks: number;
  };
  remainingSeconds: number;
  quiz: {
    id: number;
    title: string;
    subjectName: string;
    subjectCode: string;
    durationMinutes: number;
    passingPercentage: number;
  };
  questions: Question[];
  savedAnswers: {
    questionId: number;
    selectedOptionId: number | null;
    isMarkedForReview: boolean;
  }[];
}

function formatTimer(totalSec: number): string {
  const safe = Math.max(0, totalSec);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function QuizRunner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [session, setSession] = useState<StartQuizResponse | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number | null>>({});
  const [marked, setMarked] = useState<Record<number, boolean>>({});
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const submittedRef = useRef(false);
  const answersRef = useRef(answers);
  const markedRef = useRef(marked);
  answersRef.current = answers;
  markedRef.current = marked;

  useEffect(() => {
    const quizId = Number(id);
    if (!Number.isInteger(quizId) || quizId <= 0) {
      setError('Invalid quiz identifier.');
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    apiRequest<StartQuizResponse>('/api/attempts/start', {
      method: 'POST',
      body: JSON.stringify({ quizId }),
    })
      .then((res) => {
        if (!active) return;
        setSession(res);
        setRemainingSeconds(res.remainingSeconds);

        const initialAnswers: Record<number, number | null> = {};
        const initialMarked: Record<number, boolean> = {};
        for (const s of res.savedAnswers) {
          initialAnswers[s.questionId] = s.selectedOptionId;
          initialMarked[s.questionId] = s.isMarkedForReview;
        }
        setAnswers(initialAnswers);
        setMarked(initialMarked);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to start quiz.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const performSubmit = useCallback(
    async (timedOut = false) => {
      if (!session || submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      try {
        const payloadAnswers = session.questions.map((q) => ({
          questionId: q.id,
          selectedOptionId: answersRef.current[q.id] ?? null,
          isMarkedForReview: Boolean(markedRef.current[q.id]),
        }));

        const res = await apiRequest<{ attempt: { id: number } }>('/api/attempts/submit', {
          method: 'POST',
          body: JSON.stringify({
            attemptId: session.attempt.id,
            timedOut,
            answers: payloadAnswers,
          }),
        });

        showToast(
          timedOut ? 'Time expired. Quiz submitted automatically.' : 'Quiz submitted and graded.',
          timedOut ? 'info' : 'success',
        );
        navigate(`/student/results/${res.attempt.id}`, { replace: true });
      } catch (err) {
        submittedRef.current = false;
        setSubmitting(false);
        showToast(err instanceof Error ? err.message : 'Failed to submit quiz.', 'error');
      }
    },
    [navigate, session, showToast],
  );

  // Countdown timer with auto-submit
  useEffect(() => {
    if (!session || submittedRef.current) return;
    if (remainingSeconds <= 0) {
      performSubmit(true);
      return;
    }

    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          performSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [session, remainingSeconds, performSubmit]);

  const persistAnswer = async (
    questionId: number,
    selectedOptionId: number | null,
    isMarkedForReview: boolean,
  ) => {
    if (!session) return;
    try {
      await apiRequest('/api/attempts/save-answer', {
        method: 'POST',
        body: JSON.stringify({
          attemptId: session.attempt.id,
          questionId,
          selectedOptionId,
          isMarkedForReview,
        }),
      });
    } catch {
      // Final submit still reconciles all answers in memory
    }
  };

  const handleSelectOption = (questionId: number, optionId: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    persistAnswer(questionId, optionId, Boolean(marked[questionId]));
  };

  const handleClearAnswer = (questionId: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: null }));
    persistAnswer(questionId, null, Boolean(marked[questionId]));
  };

  const handleToggleMark = (questionId: number) => {
    const nextMarked = !marked[questionId];
    setMarked((prev) => ({ ...prev, [questionId]: nextMarked }));
    persistAnswer(questionId, answers[questionId] ?? null, nextMarked);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="h-16 rounded-xl bg-slate-200/60 dark:bg-slate-800/60 animate-pulse" />
        <div className="h-80 rounded-xl bg-slate-200/60 dark:bg-slate-800/60 animate-pulse" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="max-w-xl mx-auto rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-6 space-y-4">
        <p className="text-sm text-rose-700 dark:text-rose-300">{error || 'Quiz unavailable.'}</p>
        <button
          type="button"
          onClick={() => navigate('/student/quizzes')}
          className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold"
        >
          Back to Available Quizzes
        </button>
      </div>
    );
  }

  const currentQuestion = session.questions[currentIdx];
  const answeredCount = session.questions.filter(
    (q) => answers[q.id] !== undefined && answers[q.id] !== null,
  ).length;
  const markedCount = session.questions.filter((q) => Boolean(marked[q.id])).length;
  const unansweredCount = session.questions.length - answeredCount;
  const isLowTime = remainingSeconds <= 120;

  return (
    <div className="space-y-6">
      {/* Assessment Header Bar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {session.quiz.subjectCode} · {session.quiz.subjectName}
          </p>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {session.quiz.title}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`px-3.5 py-2 rounded-lg border font-mono tabular-nums text-sm font-semibold inline-flex items-center gap-2 ${
              isLowTime
                ? 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{formatTimer(remainingSeconds)}</span>
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={() => setConfirmOpen(true)}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>Submit Quiz</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Question Viewport */}
        <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              Question {currentIdx + 1} of {session.questions.length} · {currentQuestion.marks}{' '}
              {currentQuestion.marks === 1 ? 'mark' : 'marks'} · {currentQuestion.topic}
            </div>

            <button
              type="button"
              onClick={() => handleToggleMark(currentQuestion.id)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                marked[currentQuestion.id]
                  ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Flag className="w-3.5 h-3.5" />
              <span>{marked[currentQuestion.id] ? 'Marked for Review' : 'Mark for Review'}</span>
            </button>
          </div>

          <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 leading-relaxed">
            {currentQuestion.questionText}
          </h3>

          <div className="space-y-3">
            {currentQuestion.options.map((option, idx) => {
              const selected = answers[currentQuestion.id] === option.id;
              const letter = String.fromCharCode(65 + idx);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelectOption(currentQuestion.id, option.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-colors flex items-start gap-3 ${
                    selected
                      ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-slate-900 dark:text-slate-100'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-md text-xs font-mono font-semibold flex items-center justify-center shrink-0 mt-0.5 ${
                      selected
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {letter}
                  </span>
                  <span className="text-sm leading-relaxed">{option.optionText}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium disabled:opacity-40 inline-flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>
              {answers[currentQuestion.id] && (
                <button
                  type="button"
                  onClick={() => handleClearAnswer(currentQuestion.id)}
                  className="px-3 py-2 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  Clear choice
                </button>
              )}
            </div>

            {currentIdx < session.questions.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentIdx((i) => Math.min(session.questions.length - 1, i + 1))}
                className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold inline-flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                <span>Review & Submit</span>
              </button>
            )}
          </div>
        </div>

        {/* Question Navigator Sidebar */}
        <div className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Question Palette
            </h4>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {answeredCount}/{session.questions.length} answered
            </span>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {session.questions.map((q, idx) => {
              const isAnswered = answers[q.id] !== undefined && answers[q.id] !== null;
              const isMarked = Boolean(marked[q.id]);
              const isCurrent = idx === currentIdx;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentIdx(idx)}
                  className={`h-9 rounded-lg text-xs font-mono font-semibold transition-colors border ${
                    isCurrent
                      ? 'ring-2 ring-blue-600 border-blue-600'
                      : 'border-transparent'
                  } ${
                    isMarked
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                      : isAnswered
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-600 shrink-0" />
              <span>Answered</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-400 shrink-0" />
              <span>Review</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-slate-200 dark:bg-slate-700 shrink-0" />
              <span>Unanswered</span>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Submit Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Submit Assessment?
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Once submitted, your responses are permanently scored and locked.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono tabular-nums">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                <p className="text-base font-bold text-blue-600 dark:text-blue-400">
                  {answeredCount}
                </p>
                <p className="font-sans text-slate-500 mt-0.5">Answered</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                <p className="text-base font-bold text-amber-600 dark:text-amber-400">
                  {markedCount}
                </p>
                <p className="font-sans text-slate-500 mt-0.5">Marked</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                <p className="text-base font-bold text-slate-700 dark:text-slate-200">
                  {unansweredCount}
                </p>
                <p className="font-sans text-slate-500 mt-0.5">Unanswered</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium"
              >
                Continue Quiz
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => performSubmit(false)}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60"
              >
                {submitting ? 'Submitting...' : 'Confirm Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
