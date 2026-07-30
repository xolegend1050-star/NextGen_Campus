import { useState, useEffect } from 'react';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import Badge from '../../components/common/Badge';
import { CalendarIcon, VideoCameraIcon, ClockIcon } from '@heroicons/react/24/outline';

const MentorSessions = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await api.get('/mentorship/sessions?limit=50');
      setSessions(response.data.sessions || []);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading sessions..." />;

  const upcoming = sessions.filter(s => s.status === 'scheduled');
  const completed = sessions.filter(s => s.status === 'completed');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Mentorship Sessions</h1>

      {/* Upcoming */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-primary-600" /> Upcoming Sessions
        </h2>
        {upcoming.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-4">
            {upcoming.map(session => (
              <div key={session.id} className="card-hover">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{session.student_name || 'Student'}</h3>
                    <p className="text-sm text-gray-500 mt-1">{session.topic || session.subject || 'General'}</p>
                    <p className="text-sm text-gray-600 mt-2 flex items-center gap-1">
                      <ClockIcon className="h-4 w-4" />
                      {new Date(session.scheduled_at).toLocaleString()}
                    </p>
                    {session.duration_minutes && (
                      <p className="text-sm text-gray-500">{session.duration_minutes} min</p>
                    )}
                  </div>
                  <Badge variant="success">Scheduled</Badge>
                </div>
                {session.meeting_link && (
                  <a
                    href={session.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary text-sm mt-3 w-full flex items-center justify-center gap-2"
                  >
                    <VideoCameraIcon className="h-4 w-4" /> Join Meeting
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No upcoming sessions</p>
        )}
      </div>

      {/* Completed */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Completed Sessions</h2>
        {completed.length > 0 ? (
          <div className="space-y-3">
            {completed.map(session => (
              <div key={session.id} className="card flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{session.student_name || 'Student'}</h3>
                  <p className="text-sm text-gray-500">{session.topic || 'General'} • {session.duration_minutes || 60} min</p>
                  <p className="text-xs text-gray-400">
                    {new Date(session.completed_at || session.updated_at).toLocaleDateString()}
                  </p>
                </div>
                {session.rating && (
                  <div className="flex items-center gap-1 text-yellow-600">
                    {'★'.repeat(Math.floor(session.rating))} {session.rating}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No completed sessions yet</p>
        )}
      </div>
    </div>
  );
};

export default MentorSessions;
