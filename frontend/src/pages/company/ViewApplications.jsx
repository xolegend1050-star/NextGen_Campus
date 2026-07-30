import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import Badge from '../../components/common/Badge';
import { CheckIcon, XMarkIcon, UserIcon } from '@heroicons/react/24/outline';

const ViewApplications = () => {
  const { id } = useParams();
  const [applications, setApplications] = useState([]);
  const [gig, setGig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApplications();
  }, [id]);

  const fetchApplications = async () => {
    try {
      const [appRes, gigRes] = await Promise.all([
        api.get(`/gigs/${id}/applications`),
        api.get(`/gigs/${id}`)
      ]);
      setApplications(appRes.data.applications || []);
      setGig(gigRes.data.gig || gigRes.data);
    } catch (error) {
      console.error('Failed to fetch applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (applicationId, status) => {
    try {
      await api.patch(`/gigs/applications/${applicationId}`, { status });
      setApplications(apps =>
        apps.map(a => a.id === applicationId ? { ...a, status } : a)
      );
    } catch (error) {
      alert('Failed to update application');
    }
  };

  if (loading) return <LoadingSpinner text="Loading applications..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Applications for: {gig?.title || 'Gig'}
        </h1>
        <p className="text-gray-500">
          {applications.length} total applications
        </p>
      </div>

      {applications.length > 0 ? (
        <div className="space-y-4">
          {applications.map(app => (
            <div key={app.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                    {app.avatar_url ? (
                      <img src={app.avatar_url} alt="" className="w-12 h-12 rounded-full" />
                    ) : (
                      <UserIcon className="h-6 w-6 text-gray-500" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {app.full_name || app.user_name || 'Applicant'}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Applied: {new Date(app.created_at).toLocaleDateString()}
                    </p>
                    {app.cover_letter && (
                      <p className="text-sm text-gray-700 mt-2">{app.cover_letter}</p>
                    )}
                    {app.skills && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {app.skills.split(',').map(skill => (
                          <span key={skill} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                            {skill.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      app.status === 'accepted' ? 'success' :
                      app.status === 'rejected' ? 'danger' :
                      app.status === 'shortlisted' ? 'info' : 'gray'
                    }
                  >
                    {app.status}
                  </Badge>
                  {app.status === 'pending' && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => updateStatus(app.id, 'shortlisted')}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                        title="Shortlist"
                      >
                        <CheckIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => updateStatus(app.id, 'rejected')}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                        title="Reject"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                  {app.status === 'shortlisted' && (
                    <button
                      onClick={() => updateStatus(app.id, 'accepted')}
                      className="btn-primary text-sm"
                    >
                      Accept
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="📋"
          title="No applications yet"
          description="Students haven't applied to this gig yet."
        />
      )}
    </div>
  );
};

export default ViewApplications;
