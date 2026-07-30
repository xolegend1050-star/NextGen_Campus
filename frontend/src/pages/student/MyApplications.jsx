import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import Badge from '../../components/common/Badge';
import {
  BriefcaseIcon,
  CurrencyRupeeIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

const MyApplications = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchApplications();
  }, [filter]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const response = await api.get(`/gigs/my-applications${params}`);
      setApplications(response.data.applications);
    } catch (error) {
      console.error('Failed to fetch applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusVariant = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'shortlisted': return 'info';
      case 'accepted': return 'success';
      case 'rejected': return 'danger';
      default: return 'gray';
    }
  };

  if (loading) return <LoadingSpinner text="Loading applications..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Applications</h1>
        <p className="text-gray-500">Track your gig applications</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {['all', 'pending', 'shortlisted', 'accepted', 'rejected'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg font-medium capitalize whitespace-nowrap ${
              filter === status
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Applications List */}
      {applications.length > 0 ? (
        <div className="space-y-4">
          {applications.map((app) => (
            <Link
              key={app.id}
              to={`/dashboard/gigs/${app.gig_id}`}
              className="card-hover block"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{app.gig_title}</h3>
                    <Badge variant={getStatusVariant(app.status)} size="sm">
                      {app.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500">{app.company_name}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <CurrencyRupeeIcon className="h-4 w-4" />
                      {app.compensation}
                    </div>
                    <div className="flex items-center gap-1">
                      <ClockIcon className="h-4 w-4" />
                      {app.duration_days} days
                    </div>
                    <span>Applied {new Date(app.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                {app.ai_match_score && (
                  <Badge variant="success">
                    {app.ai_match_score}% match
                  </Badge>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="📋"
          title="No applications found"
          description={filter === 'all' ? "You haven't applied to any gigs yet." : `No ${filter} applications.`}
          actionLabel={filter === 'all' ? 'Browse Gigs' : undefined}
          actionLink={filter === 'all' ? '/dashboard/gigs' : undefined}
        />
      )}
    </div>
  );
};

export default MyApplications;
