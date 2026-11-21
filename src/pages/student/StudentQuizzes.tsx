import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Clock, FileCheck2, Play, Search, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import type { Quiz, Subject } from '../../types/index.ts';

export default function StudentQuizzes() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');

  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest<{ quizzes: Quiz[] }>('/api/quizzes'),
      apiRequest<{ subjects: Subject[] }>('/api/subjects'),
    ])
      .then(([qRes, sRes]) => {
        if (!active) return;
        setQuizzes(qRes.quizzes);
        setSubjects(sRes.subjects);
        const previewId = Number(searchParams.get('preview'));
        if (previewId) {
          const found = qRes.quizzes.find((q) => q.id === previewId);
          if (found) setSelectedQuiz(found);
        }
      })
      .catch((err) => {
        if (active) showToast(err instanceof Error ? err.message : 'Failed to load quizzes.', 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [searchParams, showToast]);

  const filtered = quizzes.filter((q) => {
    if (
      search.trim() &&
      !q.title.toLowerCase().includes(search.toLowerCase()) &&
      !q.subjectName.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    if (subjectFilter !== 'all' && String(q.subjectId) !== subjectFilter) return false;
    if (difficultyFilter !== 'all' && q.difficulty !== difficultyFilter) return false;
    return true;
  });

  const closeModal = () => {
    setSelectedQuiz(null);
    if (searchParams.has('preview')) {
      searchParams.delete('preview');
      setSearchParams(searchParams, { replace: true });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Available Quizzes
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Search assessments by title, filter by subject or difficulty, and review instructions before starting.
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search quizzes by name or subject..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          aria-label="Filter by subject"
          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
        >
          <option value="all">All Subjects</option>
          {subjects.map((sub) => (
            <option key={sub.id} value={String(sub.id)}>
              {sub.code} — {sub.name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
          {(['all', 'easy', 'medium', 'hard'] as const).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setDifficultyFilter(level)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                difficultyFilter === level
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {level === 'all' ? 'All Levels' : level}
            </button>
          ))}
        </div>
      </div>

      {/* Quiz Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-52 rounded-xl bg-slate-200/60 dark:bg-slate-800/60 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center">
          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
            No matching quizzes found
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Adjust your search query or subject filter to view available assessments.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((quiz) => (
            <div
              key={quiz.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    {quiz.subjectCode} · {quiz.subjectName}
                  </span>
                  <span className="capitalize font-medium text-slate-700 dark:text-slate-300">
                    {quiz.difficulty}
                  </span>
                </div>

                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-2">
                  {quiz.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5 line-clamp-2">
                  {quiz.description || 'Timed assessment authored by ' + quiz.teacherName}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
                  <div>
                    <span className="block text-[11px] font-sans text-slate-400">Duration</span>
                    {quiz.durationMinutes} min
                  </div>
                  <div>
                    <span className="block text-[11px] font-sans text-slate-400">Questions</span>
                    {quiz.questionCount}
                  </div>
                  <div>
                    <span className="block text-[11px] font-sans text-slate-400">Total Marks</span>
                    {quiz.totalMarks}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                {quiz.bestPercentage !== null && quiz.bestPercentage !== undefined ? (
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                    Best: {quiz.bestPercentage}%
                  </span>
                ) : (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Pass: {quiz.passingPercentage}%
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedQuiz(quiz)}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{quiz.inProgressAttemptId ? 'Resume Quiz' : 'Start Quiz'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quiz Instructions Modal */}
      {selectedQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedQuiz.subjectCode} · {selectedQuiz.subjectName}
                </p>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {selectedQuiz.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close instructions"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                  <Clock className="w-4 h-4 mx-auto text-blue-600 dark:text-blue-400 mb-1" />
                  <p className="text-sm font-bold font-mono tabular-nums">
                    {selectedQuiz.durationMinutes}m
                  </p>
                  <p className="text-[11px] text-slate-500">Duration</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                  <BookOpen className="w-4 h-4 mx-auto text-blue-600 dark:text-blue-400 mb-1" />
                  <p className="text-sm font-bold font-mono tabular-nums">
                    {selectedQuiz.questionCount}
                  </p>
                  <p className="text-[11px] text-slate-500">Questions</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                  <FileCheck2 className="w-4 h-4 mx-auto text-blue-600 dark:text-blue-400 mb-1" />
                  <p className="text-sm font-bold font-mono tabular-nums">
                    {selectedQuiz.totalMarks}
                  </p>
                  <p className="text-[11px] text-slate-500">Total Marks</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                  <p className="text-sm font-bold font-mono tabular-nums mt-1">
                    {selectedQuiz.passingPercentage}%
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">Passing</p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Assessment Instructions
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-line">
                  {selectedQuiz.instructions ||
                    'Answer all questions within the allotted duration. The assessment submits automatically when the timer expires. Answers cannot be viewed prior to submission.'}
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/student/quizzes/${selectedQuiz.id}/take`)}
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  <span>
                    {selectedQuiz.inProgressAttemptId ? 'Resume Attempt' : 'Begin Assessment'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
