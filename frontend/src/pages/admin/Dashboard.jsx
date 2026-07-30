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
  ClockIcon
} from '@heroicons/react/24/outline';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const [usersRes, dashRes] = await Promise.all([
        api.get('/admin/users?limit=1'),
        api.get('/admin/dashboard')
      ]);
      const dash = dashRes.data.stats || {};
      setStats({
        totalUsers: dash.users?.total || usersRes.data.pagination?.total || 0,
        pendingVerifications: dash.pending?.verifications || 0,
        flaggedContent: dash.pending?.flaggedContent || 0,
        totalTransactions: dash.wallet?.totalBalance || 0,
        totalDoubts: dash.content?.doubts || 0,
        totalGigs: dash.content?.gigs || 0,
        activeUsers30d: dash.users?.total || 0,
        totalSessions: dash.content?.sessions || 0
      });
    } catch (error) {
      console.error('Admin dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading admin dashboard..." />;

  const statCards = [
    { title: 'Total Users', value: stats?.totalUsers || 0, icon: UsersIcon, color: 'bg-primary-100 text-primary-600', link: '/admin/users' },
    { title: 'Pending Verifications', value: stats?.pendingVerifications || 0, icon: ShieldCheckIcon, color: 'bg-yellow-100 text-yellow-600', link: '/admin/verifications' },
    { title: 'Flagged Content', value: stats?.flaggedContent || 0, icon: ExclamationTriangleIcon, color: 'bg-red-100 text-red-600', link: '/admin/flagged-content' },
    { title: 'Total Transactions', value: stats?.totalTransactions || 0, icon: CurrencyRupeeIcon, color: 'bg-green-100 text-green-600', link: '/admin/disputes' }
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
              <p className="text-sm text-gray-500">{stat.title}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link to="/admin/verifications" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border">
              <CheckCircleIcon className="h-5 w-5 text-yellow-600" />
              <span>Review Verification Requests</span>
            </Link>
            <Link to="/admin/flagged-content" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
              <span>Review Flagged Content</span>
            </Link>
            <Link to="/admin/disputes" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border">
              <ClockIcon className="h-5 w-5 text-blue-600" />
              <span>Resolve Disputes</span>
            </Link>
            <Link to="/admin/audit-log" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border">
              <ShieldCheckIcon className="h-5 w-5 text-gray-600" />
              <span>View Audit Log</span>
            </Link>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Platform Stats</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 rounded-lg bg-gray-50">
              <span className="text-gray-600">Total Doubts</span>
              <span className="font-semibold">{stats?.totalDoubts || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-gray-50">
              <span className="text-gray-600">Total Gigs</span>
              <span className="font-semibold">{stats?.totalGigs || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-gray-50">
              <span className="text-gray-600">Active Users (30d)</span>
              <span className="font-semibold">{stats?.activeUsers30d || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-gray-50">
              <span className="text-gray-600">Total Sessions</span>
              <span className="font-semibold">{stats?.totalSessions || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
