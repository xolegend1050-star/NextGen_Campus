import { useState, useEffect } from 'react';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import Pagination from '../../components/common/Pagination';
import { CheckIcon, XMarkIcon, DocumentIcon, EyeIcon, FunnelIcon } from '@heroicons/react/24/outline';

const AdminVerifications = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filter, setFilter] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showRejectModal, setShowRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showPreview, setShowPreview] = useState(null);

  useEffect(() => {
    fetchRequests();
  }, [pagination.page, filter, typeFilter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      let url = `/admin/verifications?page=${pagination.page}&limit=20&status=${filter}`;
      if (typeFilter !== 'all') url += `&type=${typeFilter}`;
      const response = await api.get(url);
      setRequests(response.data.requests || []);
      setPagination(response.data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (error) {
      console.error('Failed to fetch verification requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.patch(`/admin/verifications/${id}`, { status: 'approved' });
      setRequests(reqs => reqs.filter(r => r.id !== id));
    } catch (error) {
      alert('Failed to update verification');
    }
  };

  const handleReject = async () => {
    if (!showRejectModal) return;
    try {
      await api.patch(`/admin/verifications/${showRejectModal.id}`, {
        status: 'rejected',
        rejection_reason: rejectReason
      });
      setRequests(reqs => reqs.filter(r => r.id !== showRejectModal.id));
      setShowRejectModal(null);
      setRejectReason('');
    } catch (error) {
      alert('Failed to update verification');
    }
  };

  const verificationTypes = {
    student_college_email: 'Student - College Email',
    student_id_card: 'Student - ID Card',
    alumni_linkedin: 'Alumni - LinkedIn',
    alumni_college_id: 'Alumni - College ID',
    company_domain: 'Company - Domain Email',
    company_gst: 'Company - GST'
  };

  if (loading) return <LoadingSpinner text="Loading verifications..." />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Verification Requests</h1>

      {/* Status Filter Tabs */}
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

      {/* Type Filter */}
      <div className="flex items-center gap-2">
        <FunnelIcon className="h-4 w-4 text-gray-500" />
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPagination({ ...pagination, page: 1 }); }}
          className="text-sm border rounded-lg px-3 py-1.5 text-gray-700"
        >
          <option value="all">All Types</option>
          {Object.entries(verificationTypes).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
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
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{req.full_name || 'User'}</h3>
                      <p className="text-sm text-gray-500">{req.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          {verificationTypes[req.verification_type] || req.verification_type?.replace(/_/g, ' ')}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          req.tier === 'tier1_auto' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {req.tier === 'tier1_auto' ? 'Auto (Tier 1)' : 'Manual (Tier 2)'}
                        </span>
                      </div>

                      {/* Metadata display */}
                      {req.metadata && (() => {
                        const parsed = typeof req.metadata === 'string' ? JSON.parse(req.metadata || '{}') : (req.metadata || {});
                        return Object.keys(parsed).length > 0 && (
                          <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                            {Object.entries(parsed).map(([key, val]) => (
                              <p key={key}><span className="font-medium">{key.replace(/_/g, ' ')}:</span> {String(val)}</p>
                            ))}
                          </div>
                        );
                      })()}

                      {/* Document preview link */}
                      {req.document_url && (
                        <button
                          onClick={() => setShowPreview(req)}
                          className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 mt-2"
                        >
                          <EyeIcon className="h-4 w-4" />
                          View Document
                        </button>
                      )}

                      <p className="text-xs text-gray-400 mt-1">
                        Submitted: {new Date(req.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {filter === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(req.id)}
                          className="btn-primary text-sm flex items-center gap-1"
                        >
                          <CheckIcon className="h-4 w-4" /> Approve
                        </button>
                        <button
                          onClick={() => setShowRejectModal(req)}
                          className="btn-outline text-sm text-red-600 border-red-300 hover:bg-red-50 flex items-center gap-1"
                        >
                          <XMarkIcon className="h-4 w-4" /> Reject
                        </button>
                      </div>
                    )}
                    {filter !== 'pending' && (
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          filter === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {req.status}
                        </span>
                        {req.rejection_reason && (
                          <p className="text-xs text-red-500 max-w-[200px] text-right">{req.rejection_reason}</p>
                        )}
                      </div>
                    )}
                  </div>
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

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Reject Verification</h3>
            <p className="text-sm text-gray-600 mb-4">
              Provide a reason for rejecting {showRejectModal.full_name || 'this user'}'s verification.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full input-field mb-4"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowRejectModal(null); setRejectReason(''); }} className="btn-outline text-sm">
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim()}
                className="btn-primary text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Document Preview</h3>
              <button onClick={() => setShowPreview(null)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            {showPreview.document_url?.endsWith('.pdf') ? (
              <iframe src={showPreview.document_url} className="w-full h-96 rounded-lg" title="Document" />
            ) : (
              <img src={showPreview.document_url} alt="Verification document" className="w-full rounded-lg object-contain max-h-96" />
            )}
            <div className="mt-4 flex justify-end">
              <button onClick={() => setShowPreview(null)} className="btn-outline text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminVerifications;
