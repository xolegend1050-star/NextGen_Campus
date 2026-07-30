import { useState, useEffect } from 'react';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import Badge from '../../components/common/Badge';
import { CheckIcon, XMarkIcon, UserIcon } from '@heroicons/react/24/outline';

const MentorRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/mentorship/requests?status=${filter}`);
      setRequests(response.data.requests || []);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (id, action) => {
    try {
      await api.patch(`/mentorship/requests/${id}/${action}`);
      setRequests(reqs => reqs.filter(r => r.id !== id));
    } catch (error) {
      alert(`Failed to ${action} request`);
    }
  };

  if (loading) return <LoadingSpinner text="Loading requests..." />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Mentorship Requests</h1>

      <div className="flex gap-2">
        {['pending', 'accepted', 'rejected'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filter === f ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {requests.length > 0 ? (
        <div className="space-y-4">
          {requests.map(req => (
            <div key={req.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <UserIcon className="h-5 w-5 text-gray-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{req.student_name || 'Student'}</h3>
                    <p className="text-sm text-gray-500">{req.subject || 'General Mentorship'}</p>
                    {req.message && <p className="text-sm text-gray-700 mt-1">{req.message}</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      Requested: {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {filter === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRequest(req.id, 'accept')}
                      className="btn-primary text-sm flex items-center gap-1"
                    >
                      <CheckIcon className="h-4 w-4" /> Accept
                    </button>
                    <button
                      onClick={() => handleRequest(req.id, 'reject')}
                      className="btn-outline text-sm text-red-600 border-red-300 hover:bg-red-50 flex items-center gap-1"
                    >
                      <XMarkIcon className="h-4 w-4" /> Reject
                    </button>
                  </div>
                )}
                {filter !== 'pending' && (
                  <Badge variant={filter === 'accepted' ? 'success' : 'danger'}>{req.status}</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="📬"
          title="No requests found"
          description={`No ${filter} mentorship requests.`}
        />
      )}
    </div>
  );
};

export default MentorRequests;
