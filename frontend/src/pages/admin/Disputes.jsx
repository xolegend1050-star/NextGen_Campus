import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';
import { CurrencyRupeeIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

const AdminDisputes = () => {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filter, setFilter] = useState('open');

  useEffect(() => {
    fetchDisputes();
  }, [pagination.page, filter]);

  const fetchDisputes = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/admin/disputes?page=${pagination.page}&limit=20&status=${filter}`);
      setDisputes(response.data.disputes || []);
      setPagination(response.data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (error) {
      toast.error('Failed to fetch disputes');
    } finally {
      setLoading(false);
    }
  };

  const resolveDispute = async (id, resolution) => {
    try {
      await api.patch(`/admin/disputes/${id}/resolve`, { resolution });
      setDisputes(d => d.filter(dis => dis.id !== id));
      toast.success('Dispute resolved');
    } catch (error) {
      toast.error('Failed to resolve dispute');
    }
  };

  if (loading) return <LoadingSpinner text="Loading disputes..." />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Payment Disputes</h1>

      <div className="flex gap-2">
        {['open', 'resolved'].map(f => (
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

      {disputes.length > 0 ? (
        <>
          <div className="space-y-4">
            {disputes.map(dispute => (
              <div key={dispute.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-yellow-100">
                      <CurrencyRupeeIcon className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{dispute.gig_title || 'Gig'}</h3>
                      <p className="text-sm text-gray-500">
                        Amount: ₹{(dispute.compensation || 0).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-700 mt-1">
                        {dispute.reason || dispute.description || 'No description'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Filed by: {dispute.raiser_name || 'User'} • {new Date(dispute.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant={dispute.status === 'open' ? 'warning' : 'success'}>
                    {dispute.status}
                  </Badge>
                </div>
                {filter === 'open' && (
                  <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                    <button
                      onClick={() => resolveDispute(dispute.id, 'refund_student')}
                      className="btn-outline text-sm text-blue-600 border-blue-300 hover:bg-blue-50 flex items-center gap-1"
                    >
                      Refund Student
                    </button>
                    <button
                      onClick={() => resolveDispute(dispute.id, 'release_to_mentor')}
                      className="btn-primary text-sm flex items-center gap-1"
                    >
                      <CheckIcon className="h-4 w-4" /> Release to Mentor
                    </button>
                  </div>
                )}
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
        <EmptyState icon="✅" title="No disputes" description={`No ${filter} disputes found.`} />
      )}
    </div>
  );
};

export default AdminDisputes;
