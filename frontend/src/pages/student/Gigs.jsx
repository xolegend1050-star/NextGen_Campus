import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';
import {
  MagnifyingGlassIcon,
  CurrencyRupeeIcon,
  ClockIcon,
  MapPinIcon,
  BriefcaseIcon
} from '@heroicons/react/24/outline';

const Gigs = () => {
  const [gigs, setGigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({
    category: '',
    is_remote: '',
    min_compensation: '',
    max_compensation: '',
    search: ''
  });

  const categories = [
    'Web Development', 'Mobile Development', 'UI/UX Design',
    'Data Science', 'Content Writing', 'Digital Marketing',
    'Video Editing', 'Graphic Design', 'Other'
  ];

  useEffect(() => {
    fetchGigs();
  }, [pagination.page, filters]);

  const fetchGigs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: 12
      });

      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await api.get(`/gigs?${params}`);
      setGigs(response.data.gigs);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Failed to fetch gigs:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Browse Gigs</h1>
        <p className="text-gray-500">Find beginner-friendly micro-internships</p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid md:grid-cols-4 gap-4">
          <div className="relative md:col-span-2">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search gigs..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="input-field pl-10"
            />
          </div>

          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            className="input-field"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={filters.is_remote}
            onChange={(e) => setFilters({ ...filters, is_remote: e.target.value })}
            className="input-field"
          >
            <option value="">All Locations</option>
            <option value="true">Remote Only</option>
            <option value="false">On-site</option>
          </select>
        </div>
      </div>

      {/* Gigs Grid */}
      {loading ? (
        <LoadingSpinner text="Loading gigs..." />
      ) : gigs.length > 0 ? (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {gigs.map((gig) => (
              <Link
                key={gig.id}
                to={`/dashboard/gigs/${gig.id}`}
                className="card-hover"
              >
                <div className="flex items-start justify-between mb-2">
                  <Badge variant="primary" size="sm">{gig.category}</Badge>
                  {gig.is_remote && <Badge variant="success" size="sm">Remote</Badge>}
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-1">
                  {gig.title}
                </h3>

                <p className="text-gray-600 text-sm line-clamp-2 mb-4">
                  {gig.description}
                </p>

                <div className="flex flex-wrap gap-1 mb-4">
                  {gig.skills_required?.slice(0, 3).map((skill) => (
                    <Badge key={skill} variant="gray" size="xs">{skill}</Badge>
                  ))}
                  {gig.skills_required?.length > 3 && (
                    <Badge variant="gray" size="xs">+{gig.skills_required.length - 3}</Badge>
                  )}
                </div>

                <div className="border-t pt-4 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-primary-600 font-semibold">
                    <CurrencyRupeeIcon className="h-4 w-4" />
                    {gig.compensation}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <ClockIcon className="h-4 w-4" />
                    {gig.duration_days} days
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
                  <BriefcaseIcon className="h-4 w-4" />
                  {gig.company_name}
                  {gig.company_verified && (
                    <Badge variant="success" size="xs">Verified</Badge>
                  )}
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
          icon="💼"
          title="No gigs found"
          description="Check back later for new opportunities!"
        />
      )}
    </div>
  );
};

export default Gigs;
