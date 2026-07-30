import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';
import {
  MagnifyingGlassIcon,
  AcademicCapIcon,
  StarIcon,
  MapPinIcon,
  BriefcaseIcon
} from '@heroicons/react/24/outline';

const Mentors = () => {
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({
    skill: '',
    city: '',
    min_rating: ''
  });

  useEffect(() => {
    fetchMentors();
  }, [pagination.page, filters]);

  const fetchMentors = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: 12
      });

      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await api.get(`/mentorship/mentors?${params}`);
      setMentors(response.data.mentors);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Failed to fetch mentors:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Find Mentors</h1>
        <p className="text-gray-500">Connect with alumni who&apos;ve been in your shoes</p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by skill..."
              value={filters.skill}
              onChange={(e) => setFilters({ ...filters, skill: e.target.value })}
              className="input-field pl-10"
            />
          </div>
          <input
            type="text"
            placeholder="Filter by city..."
            value={filters.city}
            onChange={(e) => setFilters({ ...filters, city: e.target.value })}
            className="input-field"
          />
          <select
            value={filters.min_rating}
            onChange={(e) => setFilters({ ...filters, min_rating: e.target.value })}
            className="input-field"
          >
            <option value="">Any Rating</option>
            <option value="4">4+ Stars</option>
            <option value="3">3+ Stars</option>
          </select>
        </div>
      </div>

      {/* Mentors Grid */}
      {loading ? (
        <LoadingSpinner text="Loading mentors..." />
      ) : mentors.length > 0 ? (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mentors.map((mentor) => (
              <Link
                key={mentor.id}
                to={`/dashboard/mentors/${mentor.id}`}
                className="card-hover"
              >
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                    {mentor.avatar_url ? (
                      <img src={mentor.avatar_url} alt={mentor.full_name} className="w-16 h-16 rounded-full object-cover" />
                    ) : (
                      <AcademicCapIcon className="h-8 w-8 text-primary-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900">{mentor.full_name}</h3>
                    <p className="text-sm text-gray-500">{mentor.current_designation}</p>
                    <p className="text-sm text-gray-500">{mentor.current_company}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <StarIcon className="h-4 w-4 text-yellow-500" />
                    {mentor.avg_rating ? Number(mentor.avg_rating).toFixed(1) : 'New'}
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPinIcon className="h-4 w-4" />
                    {mentor.city || 'India'}
                  </div>
                  <div className="flex items-center gap-1">
                    <BriefcaseIcon className="h-4 w-4" />
                    {mentor.years_of_experience || 0}y exp
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {mentor.mentorship_areas?.slice(0, 3).map((area) => (
                    <Badge key={area} variant="gray" size="xs">{area}</Badge>
                  ))}
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
          icon="🎓"
          title="No mentors found"
          description="Try adjusting your filters"
        />
      )}
    </div>
  );
};

export default Mentors;
