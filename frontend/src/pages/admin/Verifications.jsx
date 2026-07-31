import { useState, useEffect } from 'react';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';
import { CheckIcon, XMarkIcon, DocumentIcon } from '@heroicons/react/24/outline';

const AdminVerifications = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filter, setFilter] = useState('pending');

  useEffect(() => {
    fetchRequests();
  }, [pagination.page, filter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/admin/verifications?page=${pagination.page}&limit=20&status=${filter}`);
      setRequests(response.data.requests || []);
      setPagination(response.data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (error) {
      console.error('Failed to fetch verification requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (id, status) => {
    try {
      await api.patch(`/admin/verifications/${id}`, { status });
      setRequests(reqs => reqs.filter(r => r.id !== id));
    } catch (error) {
      alert('Failed to update verification');
    }
  };

  if (loading) return <LoadingSpinner text="Loading verifications..." />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Verification Requests</h1>

      <div className="flex gap-2">
        {['pending', 'approved', 'rejected'].map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPagination({ ...pagination, page: 1 }); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filter === f ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {requests.length > 0 ? (
        <>
          <div className="space-y-4">
            {requests.map(req => (
              <div key={req.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold text-sm">
                      {(req.full_name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{req.full_name || 'User'}</h3>
                      <p className="text-sm text-gray-500">{req.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          {req.verification_type?.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {req.tier === 'tier1_auto' ? 'Auto (Tier 1)' : 'Manual (Tier 2)'}
                        </span>
                      </div>
                      {req.document_url && (
                        <a href={req.document_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 hover:text-primary-700 mt-1 inline-block">
                          View Document
                        </a>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        Submitted: {new Date(req.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {filter === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleVerification(req.id, 'approved')}
                        className="btn-primary text-sm flex items-center gap-1"
                      >
                        <CheckIcon className="h-4 w-4" /> Approve
                      </button>
                      <button
                        onClick={() => handleVerification(req.id, 'rejected')}
                        className="btn-outline text-sm text-red-600 border-red-300 hover:bg-red-50 flex items-center gap-1"
                      >
                        <XMarkIcon className="h-4 w-4" /> Reject
                      </button>
                    </div>
                  )}
                  {filter !== 'pending' && (
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={filter === 'approved' ? 'success' : 'danger'}>{req.status}</Badge>
                      {req.rejection_reason && (
                        <p className="text-xs text-red-500 max-w-[200px] text-right">{req.rejection_reason}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.pages}
            onPageChange={page => setPagination({ ...pagination, page })}
          />
        </>
      ) : (
        <EmptyState icon="🛡️" title="No verification requests" description={`No ${filter} requests found.`} />
      )}
    </div>
  );
};

export default AdminVerifications;
