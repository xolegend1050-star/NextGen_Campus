import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { MentorDashboardSkeleton } from '../../components/common/Skeleton';
import Badge from '../../components/common/Badge';
import { CalendarIcon, UserGroupIcon, StarIcon, ClockIcon } from '@heroicons/react/24/outline';

const MentorDashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const [requestsRes, sessionsRes, ratingsRes] = await Promise.all([
        api.get('/mentorship/requests?limit=5'),
        api.get('/mentorship/sessions?limit=5'),
        api.get('/trust/my-score').catch(() => ({ data: { trust_score: 0 } }))
      ]);
      const requests = requestsRes.data.requests || [];
      const sessions = sessionsRes.data.sessions || [];
      const trustData = ratingsRes.data;
      setRecentSessions(sessions);
      setStats({
        pendingRequests: requestsRes.data.pagination?.total || 0,
        totalSessions: sessionsRes.data.pagination?.total || 0,
        upcomingSessions: sessions.filter(s => s.status === 'scheduled').length,
        avgRating: trustData.average_rating || trustData.trust_score / 20 || 0
      });
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <MentorDashboardSkeleton />;

  const statCards = [
    { title: 'Pending Requests', value: stats?.pendingRequests || 0, icon: ClockIcon, color: 'bg-yellow-100 text-yellow-600' },
    { title: 'Total Sessions', value: stats?.totalSessions || 0, icon: CalendarIcon, color: 'bg-primary-100 text-primary-600' },
    { title: 'Upcoming Sessions', value: stats?.upcomingSessions || 0, icon: UserGroupIcon, color: 'bg-green-100 text-green-600' },
    { title: 'Avg Rating', value: stats?.avgRating?.toFixed(1) || 'N/A', icon: StarIcon, color: 'bg-orange-100 text-orange-600' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mentor Dashboard</h1>
        <p className="text-gray-500">Manage your mentoring sessions and requests</p>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        {statCards.map(stat => (
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

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Requests</h2>
            <Link to="/mentor/requests" className="text-primary-600 hover:text-primary-700 text-sm font-medium">View All</Link>
          </div>
          {recentSessions.length > 0 ? (
            <div className="space-y-3">
              {recentSessions.slice(0, 5).map(s => (
                <div key={s.id} className="p-3 rounded-lg border flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{s.student_name || 'Student'}</p>
                    <p className="text-sm text-gray-500">{s.topic || s.subject || 'Mentorship'}</p>
                  </div>
                  <Badge variant={s.status === 'scheduled' ? 'success' : 'gray'}>{s.status}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No recent requests</p>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Upcoming Sessions</h2>
            <Link to="/mentor/sessions" className="text-primary-600 hover:text-primary-700 text-sm font-medium">View All</Link>
          </div>
          {recentSessions.filter(s => s.status === 'scheduled').length > 0 ? (
            <div className="space-y-3">
              {recentSessions.filter(s => s.status === 'scheduled').map(s => (
                <div key={s.id} className="p-3 rounded-lg border">
                  <p className="font-medium text-gray-900">{s.student_name || 'Student'}</p>
                  <p className="text-sm text-gray-500">{new Date(s.scheduled_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No upcoming sessions</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MentorDashboard;
