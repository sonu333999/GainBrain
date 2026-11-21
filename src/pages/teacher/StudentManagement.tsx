import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useToast } from '../../context/ToastContext.tsx';
import { apiRequest } from '../../lib/api.ts';

interface StudentDirectoryRow {
  id: number;
  fullName: string;
  email: string;
  course: string | null;
  semester: string | null;
  enrollmentNumber: string | null;
  department: string | null;
  attemptCount: number;
  avgScore: number;
  createdAt: string;
}

export default function StudentManagement() {
  const { showToast } = useToast();
  const [students, setStudents] = useState<StudentDirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiRequest<{ students: StudentDirectoryRow[] }>('/api/students')
      .then((res) => {
        if (active) setStudents(res.students);
      })
      .catch((err) => {
        if (active) showToast(err instanceof Error ? err.message : 'Failed to load students.', 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [showToast]);

  const filtered = students.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.fullName.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.enrollmentNumber ?? '').toLowerCase().includes(q) ||
      (s.course ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Student Management
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            View enrolled learners, academic cohorts, and average performance across your assessments.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, or enrollment #..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading students...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No registered students match your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-5 font-medium">Student</th>
                  <th className="py-3 px-4 font-medium">Enrollment #</th>
                  <th className="py-3 px-4 font-medium">Course & Semester</th>
                  <th className="py-3 px-4 font-medium text-right">Attempts</th>
                  <th className="py-3 px-5 font-medium text-right">Avg Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-5">
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {s.fullName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{s.email}</p>
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-700 dark:text-slate-300">
                      {s.enrollmentNumber || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                      {s.course || 'Not specified'}
                      {s.semester ? ` · ${s.semester}` : ''}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                      {s.attemptCount}
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono tabular-nums font-semibold">
                      {s.attemptCount > 0 ? `${s.avgScore}%` : '—'}
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
