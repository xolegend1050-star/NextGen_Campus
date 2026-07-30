import { useState, useEffect } from 'react';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';
import {
  BookOpenIcon,
  DocumentIcon,
  PlayIcon,
  LinkIcon,
  CodeBracketIcon,
  ArrowDownTrayIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline';

const Resources = () => {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [activeTab, setActiveTab] = useState('resources');
  const [filters, setFilters] = useState({ subject: '', difficulty: '', type: '' });

  useEffect(() => {
    fetchResources();
  }, [pagination.page, filters, activeTab]);

  const fetchResources = async () => {
    setLoading(true);
    try {
      if (activeTab === 'resources') {
        const params = new URLSearchParams({ page: pagination.page, limit: 12 });
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.append(key, value);
        });
        const response = await api.get(`/resources?${params}`);
        setResources(response.data.resources);
        setPagination(response.data.pagination);
      } else {
        const response = await api.get('/resources/interview-questions?limit=20');
        setResources(response.data.questions);
      }
    } catch (error) {
      console.error('Failed to fetch resources:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'document': return <DocumentIcon className="h-6 w-6" />;
      case 'video': return <PlayIcon className="h-6 w-6" />;
      case 'link': return <LinkIcon className="h-6 w-6" />;
      case 'code': return <CodeBracketIcon className="h-6 w-6" />;
      default: return <BookOpenIcon className="h-6 w-6" />;
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Resources & Interview Prep</h1>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('resources')}
          className={`px-4 py-2 font-medium border-b-2 ${
            activeTab === 'resources'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Resources
        </button>
        <button
          onClick={() => setActiveTab('interview')}
          className={`px-4 py-2 font-medium border-b-2 ${
            activeTab === 'interview'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Interview Questions
        </button>
      </div>

      {/* Filters */}
      {activeTab === 'resources' && (
        <div className="flex gap-4">
          <select
            value={filters.subject}
            onChange={(e) => setFilters({ ...filters, subject: e.target.value })}
            className="input-field w-48"
          >
            <option value="">All Subjects</option>
            <option value="programming">Programming</option>
            <option value="databases">Databases</option>
            <option value="networking">Networking</option>
            <option value="webdev">Web Development</option>
          </select>
          <select
            value={filters.difficulty}
            onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
            className="input-field w-48"
          >
            <option value="">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingSpinner text="Loading..." />
      ) : resources.length > 0 ? (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {resources.map((item) => (
              <div key={item.id} className="card-hover">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary-100 text-primary-600">
                    {activeTab === 'interview' ? (
                      <AcademicCapIcon className="h-6 w-6" />
                    ) : (
                      getTypeIcon(item.resource_type)
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 line-clamp-1">{item.title}</h3>
                    {activeTab === 'resources' ? (
                      <>
                        <p className="text-sm text-gray-500 line-clamp-2 mt-1">{item.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="gray" size="xs">{item.resource_type}</Badge>
                          {item.difficulty_level && (
                            <Badge variant="info" size="xs">{item.difficulty_level}</Badge>
                          )}
                          <span className="text-xs text-gray-400">{item.download_count || 0} downloads</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-gray-500 line-clamp-2 mt-1">{item.question}</p>
                        <div className="flex items-center gap-2 mt-2">
                          {item.difficulty_level && (
                            <Badge variant="warning" size="xs">{item.difficulty_level}</Badge>
                          )}
                          {item.company_name && (
                            <Badge variant="info" size="xs">{item.company_name}</Badge>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {activeTab === 'resources' && (
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.pages}
              onPageChange={(page) => setPagination({ ...pagination, page })}
            />
          )}
        </>
      ) : (
        <EmptyState
          icon="📚"
          title="No resources found"
          description="Check back later for new content!"
        />
      )}
    </div>
  );
};

export default Resources;
