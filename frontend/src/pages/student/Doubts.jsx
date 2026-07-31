import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  HandThumbUpIcon,
  ChatBubbleLeftIcon,
  EyeIcon
} from '@heroicons/react/24/outline';

const Doubts = () => {
  const [doubts, setDoubts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({
    status: '',
    subject: '',
    sort: 'newest',
    search: '',
    filter: ''
  });

  useEffect(() => {
    fetchDoubts();
  }, [pagination.page, filters]);

  const fetchDoubts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: 10,
        sort: filters.sort
      });

      if (filters.status) params.append('status', filters.status);
      if (filters.subject) params.append('subject', filters.subject);
      if (filters.search) params.append('search', filters.search);
      if (filters.filter) params.append('filter', filters.filter);

      const response = await api.get(`/doubts?${params}`);
      setDoubts(response.data.doubts);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Failed to fetch doubts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination({ ...pagination, page: 1 });
    fetchDoubts();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Doubts Forum</h1>
          <p className="text-gray-500">Ask questions, help others learn</p>
        </div>
        <Link to="/dashboard/doubts/create" className="btn-primary flex items-center gap-2">
          <PlusIcon className="h-5 w-5" />
          Ask a Doubt
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {[
          { key: '', label: 'All' },
          { key: 'friends', label: 'Friends' }
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilters({ ...filters, filter: f.key })}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filters.filter === f.key
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search doubts..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="input-field pl-10"
              />
            </div>
          </form>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="input-field w-full md:w-40"
          >
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="answered">Answered</option>
            <option value="closed">Closed</option>
          </select>

          {/* Sort */}
          <select
            value={filters.sort}
            onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
            className="input-field w-full md:w-40"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="popular">Most Popular</option>
            <option value="unanswered">Unanswered</option>
          </select>
        </div>
      </div>

      {/* Doubts List */}
      {loading ? (
        <LoadingSpinner text="Loading doubts..." />
      ) : doubts.length > 0 ? (
        <>
          <div className="space-y-4">
            {doubts.map((doubt) => (
              <Link
                key={doubt.id}
                to={`/dashboard/doubts/${doubt.id}`}
                className="block card-hover"
              >
                <div className="flex items-start gap-4">
                  {/* Stats */}
                  <div className="flex flex-col items-center gap-1 text-center min-w-[60px]">
                    <div className="text-lg font-semibold text-gray-900">
                      {doubt.upvotes || 0}
                    </div>
                    <div className="text-xs text-gray-500">votes</div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">
                        {doubt.title}
                      </h3>
                      <Badge
                        variant={
                          doubt.status === 'open' ? 'warning' :
                          doubt.status === 'answered' ? 'success' : 'gray'
                        }
                        size="sm"
                      >
                        {doubt.status}
                      </Badge>
                    </div>

                    <p className="text-gray-600 mt-1 line-clamp-2">
                      {doubt.content}
                    </p>

                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <ChatBubbleLeftIcon className="h-4 w-4" />
                        {doubt.answer_count || 0} answers
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <EyeIcon className="h-4 w-4" />
                        {doubt.views || 0} views
                      </div>
                      <span className="text-sm text-gray-500">
                        by {doubt.author_name || 'Anonymous'}
                      </span>
                    </div>

                    {doubt.tags && doubt.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {doubt.tags.slice(0, 5).map((tag) => (
                          <Badge key={tag} variant="gray" size="xs">{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.pages}
            onPageChange={(page) => setPagination({ ...pagination, page })}
          />
        </>
      ) : (
        <EmptyState
          icon="❓"
          title="No doubts found"
          description="Be the first to ask a question!"
          actionLabel="Ask a Doubt"
          actionLink="/dashboard/doubts/create"
        />
      )}
    </div>
  );
};

export default Doubts;
