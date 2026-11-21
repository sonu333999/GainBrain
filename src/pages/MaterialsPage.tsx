import React, { useEffect, useState } from 'react';
import {
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  Plus,
  Presentation,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { apiDownloadBlob, apiRequest } from '../lib/api.ts';
import type { StudyMaterial, Subject } from '../types/index.ts';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({ type }: { type: StudyMaterial['fileType'] }) {
  if (type === 'IMAGE') return <ImageIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
  if (type === 'PPT') return <Presentation className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
  return <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
}

export default function MaterialsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isTeacher = user?.role === 'teacher';

  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Upload / Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<StudyMaterial | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState<number>(0);
  const [topic, setTopic] = useState('General');
  const [isPublished, setIsPublished] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [mRes, sRes] = await Promise.all([
        apiRequest<{ materials: StudyMaterial[] }>('/api/materials'),
        apiRequest<{ subjects: Subject[] }>('/api/subjects'),
      ]);
      setMaterials(mRes.materials);
      setSubjects(sRes.subjects);
      if (sRes.subjects.length > 0 && subjectId === 0) {
        setSubjectId(sRes.subjects[0].id);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load materials.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const openUploadModal = () => {
    setEditingMaterial(null);
    setTitle('');
    setDescription('');
    setSubjectId(subjects[0]?.id ?? 0);
    setTopic('General');
    setIsPublished(true);
    setSelectedFile(null);
    setModalOpen(true);
  };

  const openEditModal = (mat: StudyMaterial) => {
    setEditingMaterial(mat);
    setTitle(mat.title);
    setDescription(mat.description);
    setSubjectId(mat.subjectId);
    setTopic(mat.topic);
    setIsPublished(mat.isPublished);
    setSelectedFile(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingMaterial) {
        await apiRequest(`/api/materials/${editingMaterial.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            title,
            description,
            subjectId,
            topic,
            isPublished,
          }),
        });
        showToast('Material details updated.', 'success');
      } else {
        if (!selectedFile) {
          showToast('Please select a file to upload.', 'error');
          setSaving(false);
          return;
        }
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('title', title);
        formData.append('description', description);
        formData.append('subjectId', String(subjectId));
        formData.append('topic', topic);
        formData.append('isPublished', String(isPublished));

        await apiRequest('/api/materials', {
          method: 'POST',
          body: formData,
        });
        showToast('Study material uploaded successfully.', 'success');
      }
      setModalOpen(false);
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save material.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (mat: StudyMaterial) => {
    try {
      await apiRequest(`/api/materials/${mat.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isPublished: !mat.isPublished }),
      });
      setMaterials((prev) =>
        prev.map((m) => (m.id === mat.id ? { ...m, isPublished: !m.isPublished } : m)),
      );
      showToast(mat.isPublished ? 'Material unpublished.' : 'Material published.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update status.', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiRequest(`/api/materials/${id}`, { method: 'DELETE' });
      setMaterials((prev) => prev.filter((m) => m.id !== id));
      showToast('Study material deleted.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete material.', 'error');
    }
  };

  const handleDownload = async (mat: StudyMaterial) => {
    try {
      await apiDownloadBlob(`/api/materials/${mat.id}/download`, mat.fileName);
      setMaterials((prev) =>
        prev.map((m) => (m.id === mat.id ? { ...m, downloadCount: m.downloadCount + 1 } : m)),
      );
      showToast(`Downloaded ${mat.fileName}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Download failed.', 'error');
    }
  };

  const filtered = materials.filter((m) => {
    if (subjectFilter !== 'all' && String(m.subjectId) !== subjectFilter) return false;
    if (typeFilter !== 'all' && m.fileType !== typeFilter) return false;
    if (
      search.trim() &&
      !m.title.toLowerCase().includes(search.toLowerCase()) &&
      !m.topic.toLowerCase().includes(search.toLowerCase()) &&
      !m.subjectName.toLowerCase().includes(search.toLowerCase())
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
            Study Materials
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {isTeacher
              ? 'Upload PDF, DOC, PPT, and image resources organized by subject and topic.'
              : 'Browse and download published course notes, slides, and reference sheets.'}
          </p>
        </div>

        {isTeacher && (
          <button
            type="button"
            onClick={openUploadModal}
            className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center gap-2 self-start sm:self-auto whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Upload Material</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, subject, or topic..."
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
          {(['all', 'PDF', 'DOC', 'PPT', 'IMAGE'] as const).map((ft) => (
            <button
              key={ft}
              type="button"
              onClick={() => setTypeFilter(ft)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                typeFilter === ft
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {ft === 'all' ? 'All' : ft}
            </button>
          ))}
        </div>
      </div>

      {/* Materials Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-xl bg-slate-200/60 dark:bg-slate-800/60 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-sm text-slate-500">
          No study materials match your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((mat) => (
            <div
              key={mat.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                      <FileTypeIcon type={mat.fileType} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {mat.subjectCode} · {mat.topic}
                      </p>
                      <p className="text-[11px] font-mono tabular-nums text-slate-400">
                        {mat.fileType} · {formatBytes(mat.fileSizeBytes)}
                      </p>
                    </div>
                  </div>
                  {isTeacher && (
                    <span
                      className={`text-xs font-medium shrink-0 ${
                        mat.isPublished
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {mat.isPublished ? 'Published' : 'Hidden'}
                    </span>
                  )}
                </div>

                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-3">
                  {mat.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                  {mat.description || `Uploaded by ${mat.teacherName}`}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  {mat.downloadCount} downloads
                </span>

                <div className="flex items-center gap-1.5">
                  {isTeacher && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleTogglePublish(mat)}
                        title={mat.isPublished ? 'Unpublish' : 'Publish'}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        {mat.isPublished ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(mat)}
                        title="Edit details"
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(mat.id)}
                        title="Delete material"
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDownload(mat)}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload / Edit Material Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold">
                {editingMaterial ? 'Edit Material Details' : 'Upload Study Material'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Material Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Dynamic Programming Lecture Slides"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Subject</label>
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
                  <label className="block text-xs font-medium mb-1">Topic</label>
                  <input
                    type="text"
                    required
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Summary of topics covered in this document..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                />
              </div>

              {!editingMaterial && (
                <div>
                  <label className="block text-xs font-medium mb-1">
                    File (PDF, DOC/DOCX, PPT/PPTX, PNG/JPG/WEBP · Max 10 MB)
                  </label>
                  <label className="flex items-center justify-center gap-2 p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 cursor-pointer hover:border-blue-500">
                    <Upload className="w-4 h-4 text-blue-600" />
                    <span className="text-xs text-slate-600 dark:text-slate-300">
                      {selectedFile ? selectedFile.name : 'Choose a file from your device'}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.webp"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="accent-blue-600"
                />
                <span>Publish immediately to students</span>
              </label>
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
                {saving ? 'Saving...' : editingMaterial ? 'Update Material' : 'Upload Material'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
