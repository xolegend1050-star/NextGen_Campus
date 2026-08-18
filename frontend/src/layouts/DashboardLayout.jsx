import { useState, useEffect, useMemo, useCallback } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import {
  HomeIcon,
  UserIcon,
  QuestionMarkCircleIcon,
  AcademicCapIcon,
  BriefcaseIcon,
  WalletIcon,
  BellIcon,
  ChatBubbleLeftIcon,
  BookOpenIcon,
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  UsersIcon,
  NewspaperIcon,
  ShieldCheckIcon,
  FlagIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login');
  }, [logout, navigate]);

  // Fetch unread notification count
  useEffect(() => {
    let cancelled = false;
    const fetchNotifications = async () => {
      try {
        const res = await api.get('/notifications?unreadOnly=true&limit=1');
        if (!cancelled) setUnreadCount(res.data?.unreadCount || 0);
      } catch {
        // Silent fail
      }
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Check if a nav item is active
  const isActive = useCallback((href) => {
    if (href === '/dashboard' || href === '/mentor' || href === '/company' || href === '/admin') {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  }, [location.pathname]);

  // Navigation items based on role — memoized
  const navItems = useMemo(() => {
    const commonItems = [
      { name: 'Dashboard', href: user?.role === 'alumni' ? '/mentor' : user?.role === 'company' ? '/company' : '/dashboard', icon: HomeIcon },
      { name: 'Profile', href: '/dashboard/profile', icon: UserIcon },
      { name: 'Notifications', href: '/dashboard/notifications', icon: BellIcon },
      { name: 'Chat', href: '/dashboard/chat', icon: ChatBubbleLeftIcon },
      { name: 'People', href: '/dashboard/people', icon: UsersIcon },
      { name: 'Feed', href: '/dashboard/feed', icon: NewspaperIcon },
    ];

    switch (user?.role) {
      case 'student':
        return [
          ...commonItems,
          { name: 'Doubts', href: '/dashboard/doubts', icon: QuestionMarkCircleIcon },
          { name: 'Mentors', href: '/dashboard/mentors', icon: AcademicCapIcon },
          { name: 'Gigs', href: '/dashboard/gigs', icon: BriefcaseIcon },
          { name: 'My Applications', href: '/dashboard/my-applications', icon: BriefcaseIcon },
          { name: 'Verification', href: '/dashboard/verification', icon: ShieldCheckIcon },
          { name: 'Wallet', href: '/dashboard/wallet', icon: WalletIcon },
          { name: 'Resources', href: '/dashboard/resources', icon: BookOpenIcon },
        ];
      case 'alumni':
        return [
          ...commonItems,
          { name: 'Mentor Requests', href: '/mentor/requests', icon: AcademicCapIcon },
          { name: 'Sessions', href: '/mentor/sessions', icon: AcademicCapIcon },
          { name: 'Verification', href: '/mentor/verification', icon: ShieldCheckIcon },
          { name: 'Resources', href: '/dashboard/resources', icon: BookOpenIcon },
        ];
      case 'company':
        return [
          ...commonItems,
          { name: 'Post Gig', href: '/company/post-gig', icon: BriefcaseIcon },
          { name: 'Manage Gigs', href: '/company/manage-gigs', icon: BriefcaseIcon },
          { name: 'Verification', href: '/company/verification', icon: ShieldCheckIcon },
        ];
      case 'admin':
        return [
          { name: 'Dashboard', href: '/admin', icon: HomeIcon },
          { name: 'Users', href: '/admin/users', icon: UsersIcon },
          { name: 'Verifications', href: '/admin/verifications', icon: ShieldCheckIcon },
          { name: 'Flagged Content', href: '/admin/flagged-content', icon: FlagIcon },
          { name: 'Disputes', href: '/admin/disputes', icon: ExclamationTriangleIcon },
          { name: 'Audit Log', href: '/admin/audit-log', icon: DocumentTextIcon },
        ];
      default:
        return commonItems;
    }
  }, [user?.role]);

  // Get user display name and initial
  const displayName = user?.full_name || user?.email?.split('@')[0] || 'User';
  const avatarInitial = displayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 flex flex-col w-64 bg-white transform transition-transform duration-300 ease-in-out lg:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between h-16 px-4 border-b">
          <Link to="/dashboard" className="text-xl font-bold text-primary-600" onClick={() => setSidebarOpen(false)}>
            NextGen Campus
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-md hover:bg-gray-100 transition-colors">
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className={`sidebar-link ${isActive(item.href) ? 'sidebar-link-active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t">
          <button
            onClick={handleLogout}
            className="sidebar-link w-full text-red-600 hover:bg-red-50"
          >
            <ArrowLeftOnRectangleIcon className="h-5 w-5" />
            Logout
          </button>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          <div className="flex items-center h-16 px-4 border-b">
            <Link to="/dashboard" className="text-xl font-bold text-primary-600">
              NextGen Campus
            </Link>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`sidebar-link ${isActive(item.href) ? 'sidebar-link-active' : ''}`}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            ))}
          </nav>
          <div className="p-4 border-t">
            <div className="flex items-center gap-3 mb-4">
              <div className="avatar avatar-md bg-primary-100 text-primary-600 flex items-center justify-center font-semibold">
                {avatarInitial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {displayName}
                </p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="sidebar-link w-full text-red-600 hover:bg-red-50"
            >
              <ArrowLeftOnRectangleIcon className="h-5 w-5" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex items-center h-16 px-4 bg-white/80 backdrop-blur-md border-b lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md lg:hidden hover:bg-gray-100 transition-colors"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
          <div className="flex-1 lg:flex-none" />
          <div className="flex items-center gap-4">
            <Link to="/dashboard/notifications" className="relative p-2 hover:bg-gray-100 rounded-full transition-colors">
              <BellIcon className="h-6 w-6 text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
            </Link>
          </div>
        </div>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
