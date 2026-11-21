import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  Database,
  Eye,
  Plus,
  Save,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import type {
  DifficultyLevel,
  Question,
  QuestionType,
  Quiz,
  Subject,
} from '../../types/index.ts';

interface DraftQuestion {
  localId: string;
  id?: number;
  questionType: QuestionType;
  questionText: string;
  difficulty: DifficultyLevel;
  topic: string;
  marks: number;
  explanation: string;
  options: { optionText: string; isCorrect: boolean }[];
}

function emptyQuestion(type: QuestionType = 'mcq'): DraftQuestion {
  return {
    localId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    questionType: type,
    questionText: '',
    difficulty: 'medium',
    topic: 'General',
    marks: 2,
    explanation: '',
    options:
      type === 'true_false'
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
  };
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CreateEditQuiz() {
  const { id } = useParams<{ id?: string }>();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Quiz Metadata
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [passingPercentage, setPassingPercentage] = useState(60);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [instructions, setInstructions] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Questions
  const [quizQuestions, setQuizQuestions] = useState<DraftQuestion[]>([]);
  const [editingQuestionIdx, setEditingQuestionIdx] = useState<number | null>(null);
  const [questionForm, setQuestionForm] = useState<DraftQuestion>(emptyQuestion('mcq'));

  // Add subject inline modal
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newSubCode, setNewSubCode] = useState('');

  // Question Bank reuse modal
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [bankQuestions, setBankQuestions] = useState<Question[]>([]);
  const [selectedBankIds, setSelectedBankIds] = useState<number[]>([]);
  const [bankSearch, setBankSearch] = useState('');

  // Preview Modal
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const loadAll = async () => {
      try {
        const subRes = await apiRequest<{ subjects: Subject[] }>('/api/subjects');
        if (!active) return;
        setSubjects(subRes.subjects);
        if (subRes.subjects.length > 0 && !isEditMode) {
          setSubjectId(subRes.subjects[0].id);
        }

        if (isEditMode && id) {
          const quizRes = await apiRequest<{ quiz: Quiz; questions: Question[] }>(
            `/api/quizzes/${id}`,
          );
          if (!active) return;
          const q = quizRes.quiz;
          setTitle(q.title);
          setSubjectId(q.subjectId);
          setDescription(q.description);
          setDifficulty(q.difficulty);
          setDurationMinutes(q.durationMinutes);
          setPassingPercentage(q.passingPercentage);
          setStartDate(toDatetimeLocal(q.startDate));
          setEndDate(toDatetimeLocal(q.endDate));
          setInstructions(q.instructions);
          setIsActive(q.isActive);

          setQuizQuestions(
            quizRes.questions.map((item) => ({
              localId: `db-${item.id}`,
              id: item.id,
              questionType: item.questionType,
              questionText: item.questionText,
              difficulty: item.difficulty,
              topic: item.topic,
              marks: item.marks,
              explanation: item.explanation ?? '',
              options: item.options.map((o) => ({
                optionText: o.optionText,
                isCorrect: Boolean(o.isCorrect),
              })),
            })),
          );
        }
      } catch (err) {
        if (active) showToast(err instanceof Error ? err.message : 'Failed to load quiz.', 'error');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadAll();
    return () => {
      active = false;
    };
  }, [id, isEditMode, showToast]);

  const totalMarks = quizQuestions.reduce((sum, q) => sum + Number(q.marks || 0), 0);

  const handleQuestionTypeSwitch = (nextType: QuestionType) => {
    setQuestionForm((prev) => ({
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

  const handleSaveQuestionForm = async () => {
    if (questionForm.questionText.trim().length < 5) {
      showToast('Question text must be at least 5 characters.', 'error');
      return;
    }
    if (questionForm.options.some((o) => !o.optionText.trim())) {
      showToast('All answer options must be filled in.', 'error');
      return;
    }
    if (!questionForm.options.some((o) => o.isCorrect)) {
      showToast('Select a correct answer option.', 'error');
      return;
    }

    if (isEditMode && id) {
      try {
        if (editingQuestionIdx !== null && quizQuestions[editingQuestionIdx]?.id) {
          const targetId = quizQuestions[editingQuestionIdx].id!;
          const res = await apiRequest<{ question: Question }>(`/api/questions/${targetId}`, {
            method: 'PUT',
            body: JSON.stringify({
              quizId: Number(id),
              subjectId,
              topic: questionForm.topic,
              questionType: questionForm.questionType,
              questionText: questionForm.questionText,
              difficulty: questionForm.difficulty,
              marks: Number(questionForm.marks),
              explanation: questionForm.explanation,
              options: questionForm.options,
            }),
          });
          setQuizQuestions((prev) =>
            prev.map((item, idx) =>
              idx === editingQuestionIdx
                ? {
                    localId: `db-${res.question.id}`,
                    id: res.question.id,
                    questionType: res.question.questionType,
                    questionText: res.question.questionText,
                    difficulty: res.question.difficulty,
                    topic: res.question.topic,
                    marks: res.question.marks,
                    explanation: res.question.explanation ?? '',
                    options: res.question.options.map((o) => ({
                      optionText: o.optionText,
                      isCorrect: Boolean(o.isCorrect),
                    })),
                  }
                : item,
            ),
          );
          showToast('Question updated.', 'success');
        } else {
          const res = await apiRequest<{ question: Question }>('/api/questions', {
            method: 'POST',
            body: JSON.stringify({
              quizId: Number(id),
              subjectId,
              topic: questionForm.topic,
              questionType: questionForm.questionType,
              questionText: questionForm.questionText,
              difficulty: questionForm.difficulty,
              marks: Number(questionForm.marks),
              explanation: questionForm.explanation,
              inBank: true,
              options: questionForm.options,
            }),
          });
          setQuizQuestions((prev) => [
            ...prev,
            {
              localId: `db-${res.question.id}`,
              id: res.question.id,
              questionType: res.question.questionType,
              questionText: res.question.questionText,
              difficulty: res.question.difficulty,
              topic: res.question.topic,
              marks: res.question.marks,
              explanation: res.question.explanation ?? '',
              options: res.question.options.map((o) => ({
                optionText: o.optionText,
                isCorrect: Boolean(o.isCorrect),
              })),
            },
          ]);
          showToast('Question added to quiz and Question Bank.', 'success');
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to save question.', 'error');
        return;
      }
    } else {
      if (editingQuestionIdx !== null) {
        setQuizQuestions((prev) =>
          prev.map((q, idx) => (idx === editingQuestionIdx ? questionForm : q)),
        );
      } else {
        setQuizQuestions((prev) => [...prev, questionForm]);
      }
    }

    setEditingQuestionIdx(null);
    setQuestionForm(emptyQuestion('mcq'));
  };

  const handleDeleteQuestion = async (idx: number) => {
    const target = quizQuestions[idx];
    if (isEditMode && target.id) {
      try {
        await apiRequest(`/api/questions/${target.id}`, { method: 'DELETE' });
        showToast('Question removed from quiz.', 'info');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to delete question.', 'error');
        return;
      }
    }
    setQuizQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const openBankModal = async () => {
    setBankModalOpen(true);
    setSelectedBankIds([]);
    try {
      const res = await apiRequest<{ questions: Question[] }>('/api/questions?bankOnly=true');
      setBankQuestions(res.questions);
    } catch {
      showToast('Unable to load Question Bank.', 'error');
    }
  };

  const handleImportFromBank = async () => {
    if (selectedBankIds.length === 0) return;
    if (isEditMode && id) {
      try {
        await apiRequest(`/api/quizzes/${id}/reuse-questions`, {
          method: 'POST',
          body: JSON.stringify({ questionIds: selectedBankIds }),
        });
        const refreshed = await apiRequest<{ questions: Question[] }>(`/api/quizzes/${id}`);
        setQuizQuestions(
          refreshed.questions.map((item) => ({
            localId: `db-${item.id}`,
            id: item.id,
            questionType: item.questionType,
            questionText: item.questionText,
            difficulty: item.difficulty,
            topic: item.topic,
            marks: item.marks,
            explanation: item.explanation ?? '',
            options: item.options.map((o) => ({
              optionText: o.optionText,
              isCorrect: Boolean(o.isCorrect),
            })),
          })),
        );
        showToast(`Imported ${selectedBankIds.length} question(s) from bank.`, 'success');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Import failed.', 'error');
      }
    } else {
      const chosen = bankQuestions.filter((q) => selectedBankIds.includes(q.id));
      const drafts: DraftQuestion[] = chosen.map((item) => ({
        localId: `bank-${item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        questionType: item.questionType,
        questionText: item.questionText,
        difficulty: item.difficulty,
        topic: item.topic,
        marks: item.marks,
        explanation: item.explanation ?? '',
        options: item.options.map((o) => ({
          optionText: o.optionText,
          isCorrect: Boolean(o.isCorrect),
        })),
      }));
      setQuizQuestions((prev) => [...prev, ...drafts]);
      showToast(`Added ${drafts.length} question(s) to quiz.`, 'success');
    }
    setBankModalOpen(false);
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ subject: Subject }>('/api/subjects', {
        method: 'POST',
        body: JSON.stringify({ name: newSubName, code: newSubCode }),
      });
      setSubjects((prev) => [...prev, res.subject]);
      setSubjectId(res.subject.id);
      setSubjectModalOpen(false);
      setNewSubName('');
      setNewSubCode('');
      showToast('Subject created.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create subject.', 'error');
    }
  };

  const handleSaveQuiz = async (targetStatus: 'draft' | 'published') => {
    if (title.trim().length < 3) {
      showToast('Quiz title must be at least 3 characters.', 'error');
      return;
    }
    if (!subjectId) {
      showToast('Please select a subject.', 'error');
      return;
    }
    if (targetStatus === 'published' && quizQuestions.length === 0) {
      showToast('Add at least one question before publishing.', 'error');
      return;
    }

    setSaving(true);
    try {
      if (isEditMode && id) {
        await apiRequest(`/api/quizzes/${id}`, {
          method: 'PUT',
          body: JSON.stringify({
            title,
            subjectId,
            description,
            difficulty,
            durationMinutes: Number(durationMinutes),
            passingPercentage: Number(passingPercentage),
            startDate: startDate ? new Date(startDate).toISOString() : null,
            endDate: endDate ? new Date(endDate).toISOString() : null,
            instructions,
            status: targetStatus,
            isActive: targetStatus === 'published' ? isActive : false,
          }),
        });
        showToast(
          targetStatus === 'published' ? 'Quiz updated and published.' : 'Quiz saved as draft.',
          'success',
        );
      } else {
        await apiRequest('/api/quizzes', {
          method: 'POST',
          body: JSON.stringify({
            title,
            subjectId,
            description,
            difficulty,
            durationMinutes: Number(durationMinutes),
            passingPercentage: Number(passingPercentage),
            startDate: startDate ? new Date(startDate).toISOString() : null,
            endDate: endDate ? new Date(endDate).toISOString() : null,
            instructions,
            status: targetStatus,
            isActive: targetStatus === 'published' ? isActive : false,
            questions: quizQuestions.map((q) => ({
              questionType: q.questionType,
              questionText: q.questionText,
              difficulty: q.difficulty,
              topic: q.topic,
              marks: Number(q.marks),
              explanation: q.explanation,
              inBank: true,
              options: q.options,
            })),
          }),
        });
        showToast(
          targetStatus === 'published' ? 'Quiz published to students.' : 'Quiz saved as draft.',
          'success',
        );
      }
      navigate('/teacher/quizzes');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save quiz.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-20 rounded-xl bg-slate-200/60 dark:bg-slate-800/60 animate-pulse" />
        <div className="h-80 rounded-xl bg-slate-200/60 dark:bg-slate-800/60 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {isEditMode ? 'Edit Quiz & Questions' : 'Create New Quiz'}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Configure assessment schedule, scoring rules, and author or reuse questions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium inline-flex items-center gap-1.5"
          >
            <Eye className="w-4 h-4" />
            <span>Preview</span>
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSaveQuiz('draft')}
            className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium inline-flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>Save Draft</span>
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSaveQuiz('published')}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center gap-1.5"
          >
            <Send className="w-4 h-4" />
            <span>Publish Quiz</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Quiz Metadata Form */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Quiz Configuration
            </h3>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {quizQuestions.length} Qs · {totalMarks} Marks
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Quiz Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Graph Traversal & Shortest Paths"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Subject
              </label>
              <button
                type="button"
                onClick={() => setSubjectModalOpen(true)}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                + New Subject
              </button>
            </div>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(Number(e.target.value))}
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
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief overview of topics covered..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Duration (min)
              </label>
              <input
                type="number"
                min={1}
                max={300}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Passing (%)
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={passingPercentage}
                onChange={(e) => setPassingPercentage(Number(e.target.value))}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Start Date (Optional)
              </label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                End Date (Optional)
              </label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Student Instructions
            </label>
            <textarea
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Guidelines shown before the student starts..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
            />
          </div>
        </div>

        {/* Question Builder + Quiz Question List */}
        <div className="lg:col-span-7 space-y-6">
          {/* Add/Edit Question Panel */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {editingQuestionIdx !== null ? 'Edit Question' : 'Add Question'}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openBankModal}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Reuse from Question Bank</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Type
                </label>
                <select
                  value={questionForm.questionType}
                  onChange={(e) => handleQuestionTypeSwitch(e.target.value as QuestionType)}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                >
                  <option value="mcq">Multiple Choice (4)</option>
                  <option value="true_false">True / False</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Topic
                </label>
                <input
                  type="text"
                  value={questionForm.topic}
                  onChange={(e) => setQuestionForm({ ...questionForm, topic: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Difficulty
                </label>
                <select
                  value={questionForm.difficulty}
                  onChange={(e) =>
                    setQuestionForm({
                      ...questionForm,
                      difficulty: e.target.value as DifficultyLevel,
                    })
                  }
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Marks
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={questionForm.marks}
                  onChange={(e) =>
                    setQuestionForm({ ...questionForm, marks: Number(e.target.value) })
                  }
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Question Prompt
              </label>
              <textarea
                rows={2}
                value={questionForm.questionText}
                onChange={(e) =>
                  setQuestionForm({ ...questionForm, questionText: e.target.value })
                }
                placeholder="Enter the question statement..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Answer Options (Select the correct answer)
              </label>
              {questionForm.options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="correct-option"
                    checked={opt.isCorrect}
                    onChange={() =>
                      setQuestionForm({
                        ...questionForm,
                        options: questionForm.options.map((o, i) => ({
                          ...o,
                          isCorrect: i === idx,
                        })),
                      })
                    }
                    className="w-4 h-4 accent-blue-600"
                    aria-label={`Mark option ${idx + 1} as correct`}
                  />
                  <input
                    type="text"
                    readOnly={questionForm.questionType === 'true_false'}
                    value={opt.optionText}
                    onChange={(e) =>
                      setQuestionForm({
                        ...questionForm,
                        options: questionForm.options.map((o, i) =>
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
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Explanation (Optional — shown after submission)
              </label>
              <input
                type="text"
                value={questionForm.explanation}
                onChange={(e) =>
                  setQuestionForm({ ...questionForm, explanation: e.target.value })
                }
                placeholder="Explain why the correct answer is right..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              {editingQuestionIdx !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingQuestionIdx(null);
                    setQuestionForm(emptyQuestion('mcq'));
                  }}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium"
                >
                  Cancel Edit
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveQuestionForm}
                className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{editingQuestionIdx !== null ? 'Update Question' : 'Add to Quiz'}</span>
              </button>
            </div>
          </div>

          {/* Attached Questions List */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Quiz Questions ({quizQuestions.length})
              </h3>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                Total: {totalMarks} marks
              </span>
            </div>

            {quizQuestions.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No questions added yet. Create a question above or import from your Question Bank.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {quizQuestions.map((q, idx) => (
                  <div key={q.localId} className="p-5 space-y-2.5">
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {idx + 1}. {q.questionText}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-mono tabular-nums text-slate-500">
                          {q.marks}m
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingQuestionIdx(idx);
                            setQuestionForm(q);
                          }}
                          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(idx)}
                          aria-label="Remove question"
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                      {q.options.map((opt, oIdx) => (
                        <div
                          key={oIdx}
                          className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 ${
                            opt.isCorrect
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium'
                              : 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {opt.isCorrect && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                          <span className="truncate">{opt.optionText}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Subject Modal */}
      {subjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <form
            onSubmit={handleCreateSubject}
            className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Add New Subject</h3>
              <button type="button" onClick={() => setSubjectModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              required
              value={newSubCode}
              onChange={(e) => setNewSubCode(e.target.value)}
              placeholder="Subject Code (e.g. CS401)"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
            />
            <input
              type="text"
              required
              value={newSubName}
              onChange={(e) => setNewSubName(e.target.value)}
              placeholder="Subject Name (e.g. Machine Learning)"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
            />
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold"
            >
              Create Subject
            </button>
          </form>
        </div>
      )}

      {/* Question Bank Reuse Modal */}
      {bankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold">Import from Question Bank</h3>
              <button type="button" onClick={() => setBankModalOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <input
                type="text"
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
                placeholder="Search question text or topic..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
              />
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {bankQuestions
                .filter(
                  (q) =>
                    !bankSearch.trim() ||
                    q.questionText.toLowerCase().includes(bankSearch.toLowerCase()) ||
                    q.topic.toLowerCase().includes(bankSearch.toLowerCase()),
                )
                .map((q) => {
                  const checked = selectedBankIds.includes(q.id);
                  return (
                    <label
                      key={q.id}
                      className="flex items-start gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedBankIds((prev) =>
                            checked ? prev.filter((x) => x !== q.id) : [...prev, q.id],
                          )
                        }
                        className="mt-1 accent-blue-600"
                      />
                      <div className="text-sm">
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {q.questionText}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {q.subjectName || 'General'} · {q.topic} · {q.difficulty} · {q.marks}m
                        </p>
                      </div>
                    </label>
                  );
                })}
            </div>
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setBankModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={selectedBankIds.length === 0}
                onClick={handleImportFromBank}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold disabled:opacity-50"
              >
                Import Selected ({selectedBankIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Quiz Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Student Preview Mode</p>
                <h3 className="text-lg font-bold">{title || 'Untitled Quiz'}</h3>
              </div>
              <button type="button" onClick={() => setPreviewOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-5">
              <div className="text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                Duration: {durationMinutes} mins · Questions: {quizQuestions.length} · Total Marks:{' '}
                {totalMarks} · Passing: {passingPercentage}%
              </div>
              {instructions && (
                <p className="text-sm text-slate-700 dark:text-slate-300">{instructions}</p>
              )}
              {quizQuestions.map((q, idx) => (
                <div
                  key={q.localId}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5"
                >
                  <p className="text-sm font-semibold">
                    {idx + 1}. {q.questionText}{' '}
                    <span className="text-xs font-normal text-slate-500">({q.marks}m)</span>
                  </p>
                  <div className="space-y-1.5">
                    {q.options.map((opt, oIdx) => (
                      <div
                        key={oIdx}
                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs"
                      >
                        {String.fromCharCode(65 + oIdx)}. {opt.optionText}
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
