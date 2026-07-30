import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Badge from '../../components/common/Badge';
import {
  QuestionMarkCircleIcon,
  AcademicCapIcon,
  BriefcaseIcon,
  WalletIcon,
  ArrowUpRightIcon,
  ClockIcon,
  FireIcon
} from '@heroicons/react/24/outline';

const StudentDashboard = () => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [recentDoubts, setRecentDoubts] = useState([]);
  const [recommendedGigs, setRecommendedGigs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, doubtsRes, gigsRes, notifRes] = await Promise.all([
        api.get('/analytics/student/' + user.id).catch(() => ({ data: { analytics: {} } })),
        api.get('/doubts?limit=3&sort=newest').catch(() => ({ data: { doubts: [] } })),
        api.get('/ai/recommend-gigs').catch(() => ({ data: { gigs: [] } })),
        api.get('/notifications?limit=5&unread_only=true').catch(() => ({ data: { notifications: [] } }))
      ]);

      setStats(statsRes.data.analytics);
      setRecentDoubts(doubtsRes.data.doubts || []);
      setRecommendedGigs(gigsRes.data.gigs || []);
      setNotifications(notifRes.data.notifications || []);
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading dashboard..." />;

  const statCards = [
    {
      title: 'Doubts Asked',
      value: stats?.stats?.doubtsAsked || 0,
      icon: QuestionMarkCircleIcon,
      color: 'primary',
      link: '/dashboard/doubts'
    },
    {
      title: 'Sessions Completed',
      value: stats?.stats?.mentorshipSessions || 0,
      icon: AcademicCapIcon,
      color: 'secondary',
      link: '/dashboard/mentors'
    },
    {
      title: 'Gigs Applied',
      value: stats?.stats?.gigsApplied || 0,
      icon: BriefcaseIcon,
      color: 'accent',
      link: '/dashboard/gigs'
    },
    {
      title: 'Total Earned',
      value: `₹${stats?.stats?.totalEarned || 0}`,
      icon: WalletIcon,
      color: 'success',
      link: '/dashboard/wallet'
    }
  ];

  const colorClasses = {
    primary: 'bg-primary-100 text-primary-600',
    secondary: 'bg-secondary-100 text-secondary-600',
    accent: 'bg-yellow-100 text-yellow-600',
    success: 'bg-green-100 text-green-600'
  };

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          Welcome back, {user?.full_name || 'Student'}! 👋
        </h1>
        <p className="text-primary-100">
          Keep up the great work. Here&apos;s your progress overview.
        </p>
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <FireIcon className="h-5 w-5 text-yellow-300" />
            <span className="text-sm">Trust Score: {stats?.profile?.trust_score || 0}</span>
          </div>
          <Badge variant="warning" size="sm">
            {stats?.profile?.talent_tier?.toUpperCase() || 'NEW'} TIER
          </Badge>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Link
            key={stat.title}
            to={stat.link}
            className="card-hover flex items-start justify-between"
          >
            <div>
              <p className="text-sm text-gray-500">{stat.title}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
            </div>
            <div className={`p-3 rounded-lg ${colorClasses[stat.color]}`}>
              <stat.icon className="h-6 w-6" />
            </div>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Doubts */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Doubts</h2>
            <Link to="/dashboard/doubts" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
              View All
            </Link>
          </div>
          {recentDoubts.length > 0 ? (
            <div className="space-y-3">
              {recentDoubts.map((doubt) => (
                <Link
                  key={doubt.id}
                  to={`/dashboard/doubts/${doubt.id}`}
                  className="block p-4 rounded-lg border border-gray-100 hover:border-primary-200 hover:bg-primary-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 line-clamp-1">
                        {doubt.title}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {doubt.content}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {doubt.tags?.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="gray" size="xs">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <Badge
                        variant={doubt.status === 'open' ? 'warning' : doubt.status === 'answered' ? 'success' : 'gray'}
                        size="sm"
                      >
                        {doubt.status}
                      </Badge>
                      <p className="text-xs text-gray-400 mt-1">
                        {doubt.answer_count || 0} answers
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <QuestionMarkCircleIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No doubts yet. Ask your first question!</p>
              <Link to="/dashboard/doubts/create" className="btn-primary mt-4 inline-block">
                Ask a Doubt
              </Link>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Notifications</h2>
            <Link to="/dashboard/notifications" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
              View All
            </Link>
          </div>
          {notifications.length > 0 ? (
            <div className="space-y-3">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className="p-3 rounded-lg bg-gray-50 border border-gray-100"
                >
                  <p className="font-medium text-sm text-gray-900">{notif.title}</p>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {notif.message}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(notif.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <ClockIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No new notifications</p>
            </div>
          )}
        </div>
      </div>

      {/* Recommended Gigs */}
      {recommendedGigs.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recommended Gigs</h2>
            <Link to="/dashboard/gigs" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
              View All
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {recommendedGigs.slice(0, 3).map((item) => {
              const gig = item.gig || item;
              return (
                <Link
                  key={gig.id}
                  to={`/dashboard/gigs/${gig.id}`}
                  className="block p-4 rounded-lg border border-gray-100 hover:border-primary-200 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-gray-900 line-clamp-1">{gig.title}</h3>
                    {item.score && (
                      <Badge variant="success" size="xs">{item.score}% match</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                    {gig.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-primary-600 font-semibold">
                      ₹{gig.compensation}
                    </span>
                    <span className="text-xs text-gray-400">
                      {gig.duration_days} days
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to="/dashboard/doubts/create"
            className="flex flex-col items-center p-4 rounded-lg border border-gray-100 hover:border-primary-200 hover:bg-primary-50 transition-colors"
          >
            <QuestionMarkCircleIcon className="h-8 w-8 text-primary-600 mb-2" />
            <span className="text-sm font-medium text-gray-700">Ask Doubt</span>
          </Link>
          <Link
            to="/dashboard/mentors"
            className="flex flex-col items-center p-4 rounded-lg border border-gray-100 hover:border-secondary-200 hover:bg-secondary-50 transition-colors"
          >
            <AcademicCapIcon className="h-8 w-8 text-secondary-600 mb-2" />
            <span className="text-sm font-medium text-gray-700">Find Mentor</span>
          </Link>
          <Link
            to="/dashboard/gigs"
            className="flex flex-col items-center p-4 rounded-lg border border-gray-100 hover:border-yellow-200 hover:bg-yellow-50 transition-colors"
          >
            <BriefcaseIcon className="h-8 w-8 text-yellow-600 mb-2" />
            <span className="text-sm font-medium text-gray-700">Browse Gigs</span>
          </Link>
          <Link
            to="/dashboard/wallet"
            className="flex flex-col items-center p-4 rounded-lg border border-gray-100 hover:border-green-200 hover:bg-green-50 transition-colors"
          >
            <WalletIcon className="h-8 w-8 text-green-600 mb-2" />
            <span className="text-sm font-medium text-gray-700">My Wallet</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
