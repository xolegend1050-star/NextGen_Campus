import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  UsersIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CurrencyRupeeIcon,
  CheckCircleIcon,
  ClockIcon,
  AcademicCapIcon,
  BriefcaseIcon,
  QuestionMarkCircleIcon,
  ChatBubbleLeftIcon
} from '@heroicons/react/24/outline';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const dashRes = await api.get('/admin/dashboard');
      const dash = dashRes.data.stats || {};
      setStats({
        users: dash.users || {},
        content: dash.content || {},
        pending: dash.pending || {},
        wallet: dash.wallet || {},
        recentActivity: dash.recentActivity || []
      });
    } catch (error) {
      console.error('Admin dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading admin dashboard..." />;

  const statCards = [
    { title: 'Total Users', value: stats?.users?.total || 0, subtitle: `${stats?.users?.students || 0} students, ${stats?.users?.alumni || 0} alumni`, icon: UsersIcon, color: 'bg-blue-100 text-blue-600', link: '/admin/users' },
    { title: 'Pending Verifications', value: stats?.pending?.verifications || 0, subtitle: 'Awaiting review', icon: ShieldCheckIcon, color: 'bg-yellow-100 text-yellow-600', link: '/admin/verifications' },
    { title: 'Flagged Content', value: stats?.pending?.flaggedContent || 0, subtitle: 'Needs moderation', icon: ExclamationTriangleIcon, color: 'bg-red-100 text-red-600', link: '/admin/flagged-content' },
    { title: 'Open Disputes', value: stats?.pending?.disputes || 0, subtitle: 'Payment issues', icon: CurrencyRupeeIcon, color: 'bg-orange-100 text-orange-600', link: '/admin/disputes' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500">Platform overview and management</p>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        {statCards.map(stat => (
          <Link key={stat.title} to={stat.link} className="card-hover flex items-center gap-4 group">
            <div className={`p-3 rounded-lg ${stat.color} group-hover:scale-110 transition-transform`}>
              <stat.icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.title}</p>
              <p className="text-xs text-gray-400">{stat.subtitle}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-100">
              <UsersIcon className="h-5 w-5 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900">User Breakdown</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <AcademicCapIcon className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">Students</span>
              </div>
              <span className="font-semibold text-gray-900">{stats?.users?.students || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShieldCheckIcon className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">Alumni / Mentors</span>
              </div>
              <span className="font-semibold text-gray-900">{stats?.users?.alumni || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <BriefcaseIcon className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">Companies</span>
              </div>
              <span className="font-semibold text-gray-900">{stats?.users?.companies || 0}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-green-100">
              <QuestionMarkCircleIcon className="h-5 w-5 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Content Stats</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Doubts Posted</span>
              <span className="font-semibold text-gray-900">{stats?.content?.doubts || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Answers Given</span>
              <span className="font-semibold text-gray-900">{stats?.content?.answers || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Gigs Posted</span>
              <span className="font-semibold text-gray-900">{stats?.content?.gigs || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Applications</span>
              <span className="font-semibold text-gray-900">{stats?.content?.applications || 0}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-purple-100">
              <ChatBubbleLeftIcon className="h-5 w-5 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Mentorship</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Completed Sessions</span>
              <span className="font-semibold text-gray-900">{stats?.content?.sessions || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Platform Wallet</span>
              <span className="font-semibold text-gray-900">₹{(stats?.wallet?.totalBalance || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            {stats?.pending?.verifications > 0 && (
              <Link to="/admin/verifications" className="flex items-center gap-3 p-3 rounded-lg hover:bg-yellow-50 border border-yellow-200 bg-yellow-50/50">
                <ShieldCheckIcon className="h-5 w-5 text-yellow-600" />
                <span className="text-sm font-medium">Review {stats.pending.verifications} Verification Request{stats.pending.verifications > 1 ? 's' : ''}</span>
              </Link>
            )}
            {stats?.pending?.flaggedContent > 0 && (
              <Link to="/admin/flagged-content" className="flex items-center gap-3 p-3 rounded-lg hover:bg-red-50 border border-red-200 bg-red-50/50">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                <span className="text-sm font-medium">Review {stats.pending.flaggedContent} Flagged Item{stats.pending.flaggedContent > 1 ? 's' : ''}</span>
              </Link>
            )}
            {stats?.pending?.disputes > 0 && (
              <Link to="/admin/disputes" className="flex items-center gap-3 p-3 rounded-lg hover:bg-orange-50 border border-orange-200 bg-orange-50/50">
                <CurrencyRupeeIcon className="h-5 w-5 text-orange-600" />
                <span className="text-sm font-medium">Resolve {stats.pending.disputes} Open Dispute{stats.pending.disputes > 1 ? 's' : ''}</span>
              </Link>
            )}
            <Link to="/admin/users" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border">
              <UsersIcon className="h-5 w-5 text-gray-600" />
              <span className="text-sm font-medium">Manage Users</span>
            </Link>
            <Link to="/admin/audit-log" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border">
              <ClockIcon className="h-5 w-5 text-gray-600" />
              <span className="text-sm font-medium">View Audit Log</span>
            </Link>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          {stats?.recentActivity?.length > 0 ? (
            <div className="space-y-3">
              {stats.recentActivity.map((activity, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                  <div className={`p-1.5 rounded-full ${activity.type === 'doubt' ? 'bg-blue-100' : activity.type === 'application' ? 'bg-green-100' : 'bg-purple-100'}`}>
                    {activity.type === 'doubt' && <QuestionMarkCircleIcon className="h-3 w-3 text-blue-600" />}
                    {activity.type === 'application' && <BriefcaseIcon className="h-3 w-3 text-green-600" />}
                    {activity.type === 'session' && <ChatBubbleLeftIcon className="h-3 w-3 text-purple-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 capitalize">New {activity.type}</p>
                    <p className="text-xs text-gray-400">{new Date(activity.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
