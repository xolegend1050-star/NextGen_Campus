import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import {
  BellIcon,
  CheckIcon,
  CheckCircleIcon,
  AcademicCapIcon,
  BriefcaseIcon,
  CurrencyRupeeIcon,
  ExclamationCircleIcon,
  LockClosedIcon,
  ArrowPathIcon,
  UserPlusIcon,
  CalendarIcon,
  ScaleIcon,
  SparklesIcon,
  ShieldCheckIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';

// One entry per notification_type the backend can emit. Anything missing here
// previously fell through to a generic grey bell, which hid real activity such
// as escrow events and new followers.
const TYPE_META = {
  // mentorship
  mentor_request: { icon: AcademicCapIcon, style: 'bg-blue-100 text-blue-600', label: 'Mentorship' },
  mentor_accepted: { icon: AcademicCapIcon, style: 'bg-blue-100 text-blue-600', label: 'Mentorship' },
  session_scheduled: { icon: CalendarIcon, style: 'bg-indigo-100 text-indigo-600', label: 'Session' },
  session_reminder: { icon: CalendarIcon, style: 'bg-indigo-100 text-indigo-600', label: 'Session' },
  session_completed: { icon: CheckCircleIcon, style: 'bg-indigo-100 text-indigo-600', label: 'Session' },

  // gigs
  gig_shortlisted: { icon: BriefcaseIcon, style: 'bg-green-100 text-green-600', label: 'Application' },
  gig_accepted: { icon: BriefcaseIcon, style: 'bg-green-100 text-green-600', label: 'Application' },
  gig_completed: { icon: BriefcaseIcon, style: 'bg-green-100 text-green-600', label: 'Gig' },

  // payments and escrow
  payment_received: { icon: CurrencyRupeeIcon, style: 'bg-yellow-100 text-yellow-600', label: 'Payment' },
  payment_released: { icon: CurrencyRupeeIcon, style: 'bg-yellow-100 text-yellow-600', label: 'Payment' },
  escrow_funded: { icon: LockClosedIcon, style: 'bg-amber-100 text-amber-700', label: 'Escrow' },
  escrow_refunded: { icon: ArrowPathIcon, style: 'bg-gray-100 text-gray-600', label: 'Escrow' },
  dispute_opened: { icon: ScaleIcon, style: 'bg-orange-100 text-orange-600', label: 'Dispute' },
  dispute_resolved: { icon: ScaleIcon, style: 'bg-orange-100 text-orange-600', label: 'Dispute' },

  // doubts
  doubt_answer: { icon: ChatBubbleLeftRightIcon, style: 'bg-purple-100 text-purple-600', label: 'Doubt' },
  doubt_accepted: { icon: CheckCircleIcon, style: 'bg-purple-100 text-purple-600', label: 'Doubt' },

  // verification, trust, social
  verification_approved: { icon: CheckCircleIcon, style: 'bg-green-100 text-green-600', label: 'Verification' },
  verification_rejected: { icon: ExclamationCircleIcon, style: 'bg-red-100 text-red-600', label: 'Verification' },
  new_follower: { icon: UserPlusIcon, style: 'bg-pink-100 text-pink-600', label: 'Social' },
  badge_earned: { icon: SparklesIcon, style: 'bg-yellow-100 text-yellow-600', label: 'Badge' },
  trust_score_changed: { icon: SparklesIcon, style: 'bg-teal-100 text-teal-600', label: 'Trust' },
  admin_action: { icon: ShieldCheckIcon, style: 'bg-red-100 text-red-600', label: 'Admin' },
  system: { icon: BellIcon, style: 'bg-gray-100 text-gray-600', label: 'System' }
};

const FALLBACK = { icon: BellIcon, style: 'bg-gray-100 text-gray-600', label: 'Update' };

// Route a notification to the screen it is about, so a click does something
// useful. Returns null when the type has no obvious destination.
const linkFor = (notif) => {
  let data = notif.data;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch (_) { data = null; }
  }
  data = data || {};

  switch (notif.type) {
    case 'escrow_funded':
    case 'escrow_refunded':
    case 'payment_received':
    case 'payment_released':
      return '/dashboard/wallet';
    case 'gig_shortlisted':
    case 'gig_accepted':
    case 'gig_completed':
      return data.gig_id ? `/dashboard/gigs/${data.gig_id}` : '/dashboard/gigs';
    case 'mentor_request':
    case 'mentor_accepted':
    case 'session_scheduled':
    case 'session_reminder':
    case 'session_completed':
      return '/dashboard/mentors';
    case 'verification_approved':
    case 'verification_rejected':
      return '/dashboard/verification';
    case 'doubt_answer':
    case 'doubt_accepted':
      return data.doubt_id ? `/dashboard/doubts/${data.doubt_id}` : '/dashboard/doubts';
    case 'new_follower':
      return '/social/people';
    case 'dispute_opened':
    case 'dispute_resolved':
      return '/dashboard/notifications';
    default:
      return null;
  }
};

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, [pagination.page]);

  const fetchNotifications = async () => {
    try {
      const response = await api.get(`/notifications?page=${pagination.page}&limit=20`);
      setNotifications(response.data.notifications);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await api.get('/notifications/unread-count');
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(notifications.map(n =>
        n.id === id ? { ...n, is_read: true } : n
      ));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (error) {
      toast.error('Failed to mark as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error('Failed to mark all as read');
    }
  };

  const getNotificationIcon = (type) => {
    const meta = TYPE_META[type] || FALLBACK;
    const Icon = meta.icon;
    return (
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${meta.style}`}>
        <Icon className="h-5 w-5" />
      </div>
    );
  };

  if (loading) return <LoadingSpinner text="Loading notifications..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-500">{unreadCount} unread notifications</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllAsRead} className="btn-outline text-sm">
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const meta = TYPE_META[notif.type] || FALLBACK;
            const target = linkFor(notif);
            return (
              <div
                key={notif.id}
                onClick={() => {
                  if (!notif.is_read) markAsRead(notif.id);
                  if (target) navigate(target);
                }}
                className={`card-hover flex items-start gap-4 cursor-pointer ${
                  !notif.is_read ? 'bg-primary-50 border-primary-200' : ''
                }`}
              >
                {getNotificationIcon(notif.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900">{notif.title}</p>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${meta.style}`}>
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{notif.message}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(notif.created_at).toLocaleString()}
                    {target && ' · click to open'}
                  </p>
                </div>
                {!notif.is_read && (
                  <div className="w-2 h-2 rounded-full bg-primary-600 mt-2 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon="🔔"
          title="No notifications"
          description="You're all caught up!"
        />
      )}
    </div>
  );
};

export default Notifications;
