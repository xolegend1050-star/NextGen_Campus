import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';
import { UserIcon, ShieldCheckIcon, NoSymbolIcon } from '@heroicons/react/24/outline';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ role: '', search: '' });

  useEffect(() => {
    fetchUsers();
  }, [pagination.page, filters]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: pagination.page, limit: 20 });
      if (filters.role) params.append('role', filters.role);
      if (filters.search) params.append('search', filters.search);
      const response = await api.get(`/admin/users?${params}`);
      setUsers(response.data.users || []);
      setPagination(response.data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (error) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const toggleBan = async (userId, isBanned) => {
    if (!confirm(isBanned ? 'Unban this user?' : 'Ban this user?')) return;
    try {
      await api.patch(`/admin/users/${userId}/${isBanned ? 'unban' : 'ban'}`);
      setUsers(users.map(u => u.id === userId ? { ...u, is_banned: !isBanned } : u));
      toast.success(isBanned ? 'User unbanned' : 'User banned');
    } catch (error) {
      toast.error('Failed to update user');
    }
  };

  const updateRole = async (userId, role) => {
    try {
      await api.patch(`/admin/users/${userId}/role`, { role });
      setUsers(users.map(u => u.id === userId ? { ...u, role } : u));
      toast.success('Role updated');
    } catch (error) {
      toast.error('Failed to update role');
    }
  };

  if (loading) return <LoadingSpinner text="Loading users..." />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">User Management</h1>

      <div className="flex gap-4">
        <select
          value={filters.role}
          onChange={e => setFilters({ ...filters, role: e.target.value })}
          className="input-field w-48"
        >
          <option value="">All Roles</option>
          <option value="student">Student</option>
          <option value="alumni">Alumni</option>
          <option value="company">Company</option>
          <option value="admin">Admin</option>
        </select>
        <input
          type="text"
          placeholder="Search users..."
          value={filters.search}
          onChange={e => setFilters({ ...filters, search: e.target.value })}
          className="input-field flex-1"
        />
      </div>

      {users.length > 0 ? (
        <>
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trust Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                          <UserIcon className="h-4 w-4 text-gray-500" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{user.full_name}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={user.role}
                        onChange={e => updateRole(user.id, e.target.value)}
                        className="text-sm border rounded px-2 py-1"
                      >
                        <option value="student">Student</option>
                        <option value="alumni">Alumni</option>
                        <option value="company">Company</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`font-semibold ${
                        user.trust_score >= 70 ? 'text-green-600' :
                        user.trust_score >= 30 ? 'text-yellow-600' : 'text-gray-500'
                      }`}>
                        {user.trust_score || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={user.is_banned ? 'danger' : 'success'}>
                        {user.is_banned ? 'Banned' : 'Active'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => toggleBan(user.id, user.is_banned)}
                        className={`p-2 rounded ${user.is_banned ? 'text-green-600 hover:bg-green-50' : 'text-red-600 hover:bg-red-50'}`}
                      >
                        {user.is_banned ? <ShieldCheckIcon className="h-5 w-5" /> : <NoSymbolIcon className="h-5 w-5" />}
                      </button>
                    </td>
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
        <EmptyState icon="👥" title="No users found" description="No users match your filters." />
      )}
    </div>
  );
};

export default AdminUsers;
