import { useState, useEffect } from 'react';
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
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

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
    switch (type) {
      case 'mentor_request':
      case 'mentor_accepted':
        return <AcademicCapIcon className="h-5 w-5 text-blue-600" />;
      case 'gig_shortlisted':
      case 'gig_accepted':
        return <BriefcaseIcon className="h-5 w-5 text-green-600" />;
      case 'payment_received':
      case 'payment_released':
        return <CurrencyRupeeIcon className="h-5 w-5 text-yellow-600" />;
      case 'verification_approved':
        return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
      case 'verification_rejected':
        return <ExclamationCircleIcon className="h-5 w-5 text-red-600" />;
      default:
        return <BellIcon className="h-5 w-5 text-gray-600" />;
    }
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
          {notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => !notif.is_read && markAsRead(notif.id)}
              className={`card-hover flex items-start gap-4 ${
                !notif.is_read ? 'bg-primary-50 border-primary-200' : ''
              }`}
            >
              <div className="p-2 rounded-full bg-gray-100">
                {getNotificationIcon(notif.type)}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{notif.title}</p>
                <p className="text-sm text-gray-600 mt-1">{notif.message}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(notif.created_at).toLocaleString()}
                </p>
              </div>
              {!notif.is_read && (
                <div className="w-2 h-2 rounded-full bg-primary-600 mt-2" />
              )}
            </div>
          ))}
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
