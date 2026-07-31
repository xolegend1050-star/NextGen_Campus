import { useState, useEffect } from 'react';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import UserCard from '../../components/social/UserCard';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

const People = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'following', label: 'Following' },
    { key: 'followers', label: 'Followers' },
    { key: 'mutual', label: 'Mutual' }
  ];

  const fetchUsers = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20, filter });
      if (search) params.append('search', search);
      const response = await api.get(`/follows/discover?${params}`);
      setUsers(response.data.users || []);
      setPagination(response.data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(1);
  }, [filter]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchUsers(1);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">People</h1>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <button type="submit" className="btn-primary">Search</button>
      </form>

      {/* Filters */}
      <div className="flex gap-2">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filter === f.key
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <LoadingSpinner text="Loading people..." />
      ) : users.length > 0 ? (
        <>
          <div className="space-y-3">
            {users.map(user => (
              <UserCard key={user.id} user={user} onFollowChange={() => fetchUsers(pagination.page)} />
            ))}
          </div>

          {pagination.pages > 1 && (
            <div className="flex justify-center gap-2">
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => fetchUsers(page)}
                  className={`px-3 py-1 rounded ${
                    page === pagination.page
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon="👥"
          title="No people found"
          description={search ? 'Try a different search term' : 'No users match this filter'}
        />
      )}
    </div>
  );
};

export default People;
