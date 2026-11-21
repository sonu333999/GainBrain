import React, { useEffect, useState } from 'react';
import { CheckCircle2, Edit3, Plus, Search, Trash2, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import type { DifficultyLevel, Question, QuestionType, Subject } from '../../types/index.ts';

interface QuestionFormState {
  id?: number;
  subjectId: number;
  topic: string;
  questionType: QuestionType;
  questionText: string;
  difficulty: DifficultyLevel;
  marks: number;
  explanation: string;
  options: { optionText: string; isCorrect: boolean }[];
}

export default function QuestionBank() {
  const { showToast } = useToast();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<QuestionFormState>({
    subjectId: 0,
    topic: 'General',
    questionType: 'mcq',
    questionText: '',
    difficulty: 'medium',
    marks: 2,
    explanation: '',
    options: [
      { optionText: '', isCorrect: true },
      { optionText: '', isCorrect: false },
      { optionText: '', isCorrect: false },
      { optionText: '', isCorrect: false },
    ],
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [qRes, sRes] = await Promise.all([
        apiRequest<{ questions: Question[] }>('/api/questions'),
        apiRequest<{ subjects: Subject[] }>('/api/subjects'),
      ]);
      setQuestions(qRes.questions);
      setSubjects(sRes.subjects);
      if (sRes.subjects.length > 0 && form.subjectId === 0) {
        setForm((prev) => ({ ...prev, subjectId: sRes.subjects[0].id }));
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load Question Bank.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setForm({
      subjectId: subjects[0]?.id ?? 0,
      topic: 'General',
      questionType: 'mcq',
      questionText: '',
      difficulty: 'medium',
      marks: 2,
      explanation: '',
      options: [
        { optionText: '', isCorrect: true },
        { optionText: '', isCorrect: false },
        { optionText: '', isCorrect: false },
        { optionText: '', isCorrect: false },
      ],
    });
    setModalOpen(true);
  };

  const openEditModal = (q: Question) => {
    setForm({
      id: q.id,
      subjectId: q.subjectId ?? subjects[0]?.id ?? 0,
      topic: q.topic,
      questionType: q.questionType,
      questionText: q.questionText,
      difficulty: q.difficulty,
      marks: q.marks,
      explanation: q.explanation ?? '',
      options: q.options.map((o) => ({
        optionText: o.optionText,
        isCorrect: Boolean(o.isCorrect),
      })),
    });
    setModalOpen(true);
  };

  const handleTypeChange = (nextType: QuestionType) => {
    setForm((prev) => ({
      ...prev,
      questionType: nextType,
      options:
        nextType === 'true_false'
          ? [
              { optionText: 'True', isCorrect: true },
              { optionText: 'False', isCorrect: false },
            ]
          : [
              { optionText: '', isCorrect: true },
              { optionText: '', isCorrect: false },
              { optionText: '', isCorrect: false },
              { optionText: '', isCorrect: false },
            ],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.questionText.trim().length < 5) {
      showToast('Question text must be at least 5 characters.', 'error');
      return;
    }
    if (form.options.some((o) => !o.optionText.trim())) {
      showToast('Please fill in all options.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        subjectId: form.subjectId || null,
        topic: form.topic,
        questionType: form.questionType,
        questionText: form.questionText,
        difficulty: form.difficulty,
        marks: Number(form.marks),
        explanation: form.explanation,
        inBank: true,
        options: form.options,
      };
      if (form.id) {
        await apiRequest(`/api/questions/${form.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast('Question updated.', 'success');
      } else {
        await apiRequest('/api/questions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('Question added to Question Bank.', 'success');
      }
      setModalOpen(false);
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save question.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiRequest(`/api/questions/${id}`, { method: 'DELETE' });
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      showToast('Question deleted from bank.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete question.', 'error');
    }
  };

  const filtered = questions.filter((q) => {
    if (subjectFilter !== 'all' && String(q.subjectId) !== subjectFilter) return false;
    if (difficultyFilter !== 'all' && q.difficulty !== difficultyFilter) return false;
    if (
      search.trim() &&
      !q.questionText.toLowerCase().includes(search.toLowerCase()) &&
      !q.topic.toLowerCase().includes(search.toLowerCase())
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
            Question Bank
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Organize reusable questions by subject, topic, and difficulty for future assessments.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center gap-2 self-start sm:self-auto whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Add Question</span>
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by question prompt or topic..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
          />
        </div>

        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
        >
          <option value="all">All Subjects</option>
          {subjects.map((sub) => (
            <option key={sub.id} value={String(sub.id)}>
              {sub.code} — {sub.name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
          {(['all', 'easy', 'medium', 'hard'] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setDifficultyFilter(lvl)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                difficultyFilter === lvl
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {lvl === 'all' ? 'All' : lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Question List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-slate-200/60 dark:bg-slate-800/60 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-sm text-slate-500">
          No questions found matching your filters.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((q) => (
            <div
              key={q.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {q.subjectName || 'Unassigned'} · {q.topic} ·{' '}
                    <span className="capitalize">{q.difficulty}</span> ·{' '}
                    <span className="font-mono tabular-nums">{q.marks} marks</span>
                  </p>
                  <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 mt-1">
                    {q.questionText}
                  </h3>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditModal(q)}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Edit question"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(q.id)}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    title="Delete question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {q.options.map((opt) => (
                  <div
                    key={opt.id}
                    className={`px-3 py-2 rounded-lg flex items-center gap-2 ${
                      opt.isCorrect
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium'
                        : 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {opt.isCorrect && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                    <span>{opt.optionText}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Question Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold">
                {form.id ? 'Edit Question' : 'Add Question to Bank'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Subject</label>
                  <select
                    value={form.subjectId}
                    onChange={(e) => setForm({ ...form, subjectId: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                  >
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.code} — {sub.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Topic</label>
                  <input
                    type="text"
                    required
                    value={form.topic}
                    onChange={(e) => setForm({ ...form, topic: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Type</label>
                  <select
                    value={form.questionType}
                    onChange={(e) => handleTypeChange(e.target.value as QuestionType)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                  >
                    <option value="mcq">Multiple Choice</option>
                    <option value="true_false">True / False</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Difficulty</label>
                  <select
                    value={form.difficulty}
                    onChange={(e) =>
                      setForm({ ...form, difficulty: e.target.value as DifficultyLevel })
                    }
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Marks</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={form.marks}
                    onChange={(e) => setForm({ ...form, marks: Number(e.target.value) })}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Question Prompt</label>
                <textarea
                  rows={2}
                  required
                  value={form.questionText}
                  onChange={(e) => setForm({ ...form, questionText: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium">Options (Select Correct)</label>
                {form.options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="bank-correct-opt"
                      checked={opt.isCorrect}
                      onChange={() =>
                        setForm({
                          ...form,
                          options: form.options.map((o, i) => ({
                            ...o,
                            isCorrect: i === idx,
                          })),
                        })
                      }
                      className="w-4 h-4 accent-blue-600"
                    />
                    <input
                      type="text"
                      readOnly={form.questionType === 'true_false'}
                      value={opt.optionText}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          options: form.options.map((o, i) =>
                            i === idx ? { ...o, optionText: e.target.value } : o,
                          ),
                        })
                      }
                      placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Explanation (Optional)</label>
                <input
                  type="text"
                  value={form.explanation}
                  onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Question'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
