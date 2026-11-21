import React, { useEffect, useState } from 'react';
import { Camera, Lock, Moon, Save, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { apiRequest } from '../lib/api.ts';

const TEACHER_AVATAR_FALLBACK = '/src/assets/images/avatar_teacher_elena_1795265266764.jpg';
const STUDENT_AVATAR_FALLBACK = '/src/assets/images/avatar_student_aarav_1795265266548.jpg';

export default function ProfileSettingsPage({ initialTab = 'profile' }: { initialTab?: 'profile' | 'settings' }) {
  const { user, profile, refreshProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();

  const [tab, setTab] = useState<'profile' | 'settings'>(initialTab);
  const [saving, setSaving] = useState(false);

  // Profile fields
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [course, setCourse] = useState('');
  const [semester, setSemester] = useState('');
  const [enrollmentNumber, setEnrollmentNumber] = useState('');
  const [subjectSpecialty, setSubjectSpecialty] = useState('');
  const [qualification, setQualification] = useState('');
  const [bio, setBio] = useState('');

  // Notification Preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [quizReminders, setQuizReminders] = useState(true);
  const [resultAlerts, setResultAlerts] = useState(true);

  // Password Change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName);
    setEmailNotifications(user.emailNotifications);
    setQuizReminders(user.quizReminders);
    setResultAlerts(user.resultAlerts);
    setDepartment(profile.department ?? '');
    setCourse(profile.course ?? '');
    setSemester(profile.semester ?? '');
    setEnrollmentNumber(profile.enrollmentNumber ?? '');
    setSubjectSpecialty(profile.subjectSpecialty ?? '');
    setQualification(profile.qualification ?? '');
    setBio(profile.bio ?? '');
  }, [user, profile]);

  if (!user) return null;

  const avatarSrc =
    user.avatarUrl ||
    (user.role === 'teacher' ? TEACHER_AVATAR_FALLBACK : STUDENT_AVATAR_FALLBACK);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          fullName,
          emailNotifications,
          quizReminders,
          resultAlerts,
          department,
          course,
          semester,
          enrollmentNumber,
          subjectSpecialty,
          qualification,
          bio,
        }),
      });
      await refreshProfile();
      showToast('Profile and preferences saved.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      await apiRequest('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      });
      await refreshProfile();
      showToast('Profile photo updated.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to upload photo.', 'error');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }
    setChangingPassword(true);
    try {
      await apiRequest('/api/profile/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password changed successfully.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update password.', 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {tab === 'profile' ? 'My Profile' : 'Account Settings'}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Manage your personal academic details, photo, security credentials, and notification rules.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-800 self-start">
          <button
            type="button"
            onClick={() => setTab('profile')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === 'profile'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Profile Details
          </button>
          <button
            type="button"
            onClick={() => setTab('settings')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === 'settings'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Settings & Security
          </button>
        </div>
      </div>

      {tab === 'profile' ? (
        <form
          onSubmit={handleSaveProfile}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6"
        >
          {/* Avatar */}
          <div className="flex items-center gap-5 pb-6 border-b border-slate-100 dark:border-slate-800">
            <img
              src={avatarSrc}
              alt={user.fullName}
              referrerPolicy="no-referrer"
              className="w-20 h-20 rounded-xl object-cover bg-slate-200 dark:bg-slate-800 shrink-0"
            />
            <div>
              <p className="text-base font-bold text-slate-900 dark:text-slate-100">
                {user.fullName}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                {user.role} · {user.email}
              </p>
              <label className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                <Camera className="w-3.5 h-3.5" />
                <span>Change Photo</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                disabled
                value={user.email}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 text-sm text-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. School of Computing"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
              />
            </div>

            {user.role === 'student' ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Enrollment Number
                  </label>
                  <input
                    type="text"
                    value={enrollmentNumber}
                    onChange={(e) => setEnrollmentNumber(e.target.value)}
                    placeholder="e.g. CS-2024-089"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Course / Program
                  </label>
                  <input
                    type="text"
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    placeholder="e.g. B.Tech Computer Science"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Semester
                  </label>
                  <input
                    type="text"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    placeholder="e.g. Semester 5"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Subject Specialty
                  </label>
                  <input
                    type="text"
                    value={subjectSpecialty}
                    onChange={(e) => setSubjectSpecialty(e.target.value)}
                    placeholder="e.g. Algorithms & Distributed Systems"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Academic Qualification
                  </label>
                  <input
                    type="text"
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    placeholder="e.g. Ph.D. Computer Science"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Instructor Bio
                  </label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                  />
                </div>
              </>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Profile'}</span>
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-6">
          {/* Appearance & Notifications */}
          <form
            onSubmit={handleSaveProfile}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-semibold">Appearance</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Switch between light and dark interface themes
                </p>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-2"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                <span>{theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}</span>
              </button>
            </div>

            <div className="space-y-3">
              <h3 className="text-base font-semibold">Notification Preferences</h3>

              <label className="flex items-center justify-between py-2 cursor-pointer">
                <div>
                  <p className="text-sm font-medium">Email Notifications</p>
                  <p className="text-xs text-slate-500">
                    Receive important account and course announcements
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={emailNotifications}
                  onChange={(e) => setEmailNotifications(e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
              </label>

              <label className="flex items-center justify-between py-2 cursor-pointer">
                <div>
                  <p className="text-sm font-medium">Quiz Reminders</p>
                  <p className="text-xs text-slate-500">
                    Alerts when new quizzes or study materials are published
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={quizReminders}
                  onChange={(e) => setQuizReminders(e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
              </label>

              <label className="flex items-center justify-between py-2 cursor-pointer">
                <div>
                  <p className="text-sm font-medium">Result Alerts</p>
                  <p className="text-xs text-slate-500">
                    Instant notifications when quiz attempts are graded
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={resultAlerts}
                  onChange={(e) => setResultAlerts(e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
              </label>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
              >
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </form>

          {/* Change Password */}
          <form
            onSubmit={handleChangePassword}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-base font-semibold">Change Password</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">New Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={changingPassword}
                className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold"
              >
                {changingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
