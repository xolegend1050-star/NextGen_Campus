import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';
import { ExclamationTriangleIcon, CheckIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline';

const AdminFlaggedContent = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  useEffect(() => {
    fetchFlagged();
  }, [pagination.page]);

  const fetchFlagged = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/admin/flagged-content?page=${pagination.page}&limit=20`);
      setItems(response.data.flagged || []);
      setPagination(response.data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (error) {
      toast.error('Failed to fetch flagged content');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, action) => {
    try {
      await api.patch(`/admin/flagged-content/${id}`, { action });
      setItems(items.filter(i => i.id !== id));
      toast.success('Action completed');
    } catch (error) {
      toast.error('Failed to perform action');
    }
  };

  if (loading) return <LoadingSpinner text="Loading flagged content..." />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Flagged Content</h1>

      {items.length > 0 ? (
        <>
          <div className="space-y-4">
            {items.map(item => (
              <div key={item.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-red-100">
                      <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">
                        <span className="capitalize">{item.content_type}</span> — {item.reason || 'Reported'}
                      </h3>
                      {item.description && (
                        <p className="text-sm text-gray-700 mt-1 bg-gray-50 p-2 rounded">
                          &quot;{item.description}&quot;
                        </p>
                      )}
                      <p className="text-sm text-gray-500 mt-1">
                        Reported by: {item.reporter_name || 'User'} • {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant="danger">Flagged</Badge>
                </div>
                <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                  <button
                    onClick={() => handleAction(item.id, 'dismiss')}
                    className="btn-outline text-sm flex items-center gap-1"
                  >
                    <CheckIcon className="h-4 w-4" /> Dismiss
                  </button>
                  <button
                    onClick={() => handleAction(item.id, 'remove')}
                    className="btn-outline text-sm text-red-600 border-red-300 hover:bg-red-50 flex items-center gap-1"
                  >
                    <TrashIcon className="h-4 w-4" /> Remove Content
                  </button>
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
        <EmptyState icon="✅" title="No flagged content" description="The platform is clean!" />
      )}
    </div>
  );
};

export default AdminFlaggedContent;
