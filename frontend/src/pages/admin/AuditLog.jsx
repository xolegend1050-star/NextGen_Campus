import { useState, useEffect } from 'react';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import Pagination from '../../components/common/Pagination';
import Badge from '../../components/common/Badge';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';

const AdminAuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  useEffect(() => {
    fetchLogs();
  }, [pagination.page]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/admin/audit-log?page=${pagination.page}&limit=50`);
      setLogs(response.data.logs || []);
      setPagination(response.data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (error) {
      console.error('Failed to fetch audit log:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action) => {
    if (action?.includes('ban') || action?.includes('delete') || action?.includes('reject')) return 'danger';
    if (action?.includes('approve') || action?.includes('accept') || action?.includes('verify')) return 'success';
    return 'gray';
  };

  if (loading) return <LoadingSpinner text="Loading audit log..." />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>

      {logs.length > 0 ? (
        <>
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Badge variant={getActionColor(log.action)}>
                        {log.action || 'unknown'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{log.admin_name || log.user_name || 'System'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{log.target_type || '-'} {log.target_id ? `#${log.target_id}` : ''}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{log.details || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-400">{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.pages}
            onPageChange={page => setPagination({ ...pagination, page })}
          />
        </>
      ) : (
        <EmptyState
          icon="📋"
          title="No audit logs"
          description="No admin actions recorded yet."
        />
      )}
    </div>
  );
};

export default AdminAuditLog;
