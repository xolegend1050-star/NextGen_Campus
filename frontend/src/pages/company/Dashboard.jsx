import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { CardSkeleton } from '../../components/common/Skeleton';
import Badge from '../../components/common/Badge';
import {
  BriefcaseIcon,
  UsersIcon,
  CurrencyRupeeIcon,
  PlusIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

const CompanyDashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentGigs, setRecentGigs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [gigsRes] = await Promise.all([
        api.get('/gigs?limit=5')
      ]);
      setRecentGigs(gigsRes.data.gigs || []);
      setStats({
        totalGigs: gigsRes.data.pagination?.total || 0,
        activeGigs: gigsRes.data.gigs?.filter(g => g.status === 'open').length || 0,
        totalApplications: gigsRes.data.gigs?.reduce((acc, g) => acc + (g.total_applications || 0), 0) || 0
      });
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <CardSkeleton count={3} />;

  const statCards = [
    { title: 'Total Gigs', value: stats?.totalGigs || 0, icon: BriefcaseIcon, color: 'bg-primary-100 text-primary-600' },
    { title: 'Active Gigs', value: stats?.activeGigs || 0, icon: ChartBarIcon, color: 'bg-green-100 text-green-600' },
    { title: 'Applications', value: stats?.totalApplications || 0, icon: UsersIcon, color: 'bg-yellow-100 text-yellow-600' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Company Dashboard</h1>
          <p className="text-gray-500">Manage your gigs and find talent</p>
        </div>
        <Link to="/company/post-gig" className="btn-primary flex items-center gap-2">
          <PlusIcon className="h-5 w-5" />
          Post New Gig
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {statCards.map((stat) => (
          <div key={stat.title} className="card flex items-center gap-4">
            <div className={`p-3 rounded-lg ${stat.color}`}>
              <stat.icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{stat.title}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Gigs</h2>
          <Link to="/company/manage-gigs" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
            View All
          </Link>
        </div>
        {recentGigs.length > 0 ? (
          <div className="space-y-3">
            {recentGigs.map((gig) => (
              <Link
                key={gig.id}
                to={`/company/gigs/${gig.id}/applications`}
                className="flex items-center justify-between p-4 rounded-lg border hover:border-primary-200"
              >
                <div>
                  <h3 className="font-medium text-gray-900">{gig.title}</h3>
                  <p className="text-sm text-gray-500">₹{gig.compensation} • {gig.duration_days} days</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={gig.status === 'open' ? 'success' : 'gray'}>{gig.status}</Badge>
                  <span className="text-sm text-gray-500">{gig.total_applications || 0} applications</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <BriefcaseIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>No gigs yet. Post your first gig!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyDashboard;
