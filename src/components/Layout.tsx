import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  ClipboardCheck,
  Database,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PlusCircle,
  Settings,
  Sun,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { apiRequest } from '../lib/api.ts';
import type { NotificationItem } from '../types/index.ts';

const TEACHER_AVATAR_FALLBACK = '/src/assets/images/avatar_teacher_elena_1795265266764.jpg';
const STUDENT_AVATAR_FALLBACK = '/src/assets/images/avatar_student_aarav_1795265266548.jpg';

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}

const studentNav: NavItem[] = [
  { label: 'Dashboard', to: '/student/dashboard', icon: LayoutDashboard },
  { label: 'Available Quizzes', to: '/student/quizzes', icon: ClipboardCheck },
  { label: 'My Results', to: '/student/results', icon: Award },
  { label: 'Study Materials', to: '/student/materials', icon: BookOpen },
  { label: 'My Profile', to: '/student/profile', icon: UserIcon },
  { label: 'Settings', to: '/student/settings', icon: Settings },
];

const teacherNav: NavItem[] = [
  { label: 'Dashboard', to: '/teacher/dashboard', icon: LayoutDashboard },
  { label: 'Create Quiz', to: '/teacher/quizzes/new', icon: PlusCircle },
  { label: 'Manage Quizzes', to: '/teacher/quizzes', icon: FileText },
  { label: 'Question Bank', to: '/teacher/question-bank', icon: Database },
  { label: 'Student Results', to: '/teacher/results', icon: BarChart3 },
  { label: 'Study Materials', to: '/teacher/materials', icon: BookOpen },
  { label: 'Student Management', to: '/teacher/students', icon: Users },
  { label: 'My Profile', to: '/teacher/profile', icon: UserIcon },
  { label: 'Settings', to: '/teacher/settings', icon: Settings },
];

function getBreadcrumbTitle(pathname: string, role: 'teacher' | 'student'): string {
  const all = role === 'teacher' ? teacherNav : studentNav;
  const exact = all.find((item) => item.to === pathname);
  if (exact) return exact.label;
  if (pathname.includes('/take')) return 'Active Assessment';
  if (pathname.includes('/results/')) return 'Result Breakdown';
  if (pathname.includes('/quizzes/') && pathname.includes('/edit')) return 'Edit Quiz';
  if (pathname.includes('/quizzes/')) return 'Quiz Overview';
  return 'Dashboard';
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setNotifOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    apiRequest<{ notifications: NotificationItem[] }>('/api/notifications')
      .then((res) => {
        if (active) setNotifications(res.notifications);
      })
      .catch(() => {
        // silent fail on notifications poll
      });
    return () => {
      active = false;
    };
  }, [user, location.pathname]);

  if (!user) return null;

  const navItems = user.role === 'teacher' ? teacherNav : studentNav;
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const avatarSrc =
    user.avatarUrl ||
    (user.role === 'teacher' ? TEACHER_AVATAR_FALLBACK : STUDENT_AVATAR_FALLBACK);

  const handleLogout = async () => {
    await logout();
    showToast('Signed out of ScholarPulse.', 'info');
    navigate('/auth');
  };

  const handleMarkRead = async (item: NotificationItem) => {
    try {
      if (!item.isRead) {
        await apiRequest(`/api/notifications/${item.id}/read`, { method: 'PUT' });
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
        );
      }
      if (item.linkUrl) {
        setNotifOpen(false);
        navigate(item.linkUrl);
      }
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiRequest('/api/notifications/read-all', { method: 'PUT' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      showToast('Unable to update notifications.', 'error');
    }
  };

  const currentSection = getBreadcrumbTitle(location.pathname, user.role);

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 shrink-0">
        <button
          type="button"
          onClick={() => navigate(user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard')}
          className="flex items-center gap-2.5 text-left focus-visible:outline-2 focus-visible:outline-blue-600 rounded-lg"
        >
          <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
            <GraduationCap className="w-4 h-4" />
          </span>
          <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
            ScholarPulse
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
          aria-label="Close navigation menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/70">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {user.role === 'teacher' ? 'Instructor Workspace' : 'Student Portal'}
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Sidebar Navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/teacher/quizzes' || item.to === '/student/results'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors whitespace-nowrap"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-64 max-w-[80vw] h-full">{sidebarContent}</aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-500 dark:text-slate-400 hidden sm:inline whitespace-nowrap">
                {user.role === 'teacher' ? 'Teacher' : 'Student'}
              </span>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">/</span>
              <h1 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                {currentSection}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                aria-label="Notifications"
                className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-md bg-blue-600 text-white text-[10px] font-mono font-semibold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden z-40">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Notifications
                    </span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-sm text-slate-500 dark:text-slate-400 text-center">
                        No notifications yet.
                      </p>
                    ) : (
                      notifications.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleMarkRead(item)}
                          className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${
                            !item.isRead ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              {item.title}
                            </span>
                            {!item.isRead && (
                              <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                                New
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                            {item.message}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                navigate(user.role === 'teacher' ? '/teacher/profile' : '/student/profile')
              }
              className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <img
                src={avatarSrc}
                alt={user.fullName}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
                className="w-7 h-7 rounded-md object-cover bg-slate-200 dark:bg-slate-800 shrink-0"
              />
              <div className="hidden sm:block text-left leading-tight">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 max-w-[130px] truncate">
                  {user.fullName}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
                  {user.role}
                </p>
              </div>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
