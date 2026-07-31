import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import Badge from '../../components/common/Badge';
import { HandThumbUpIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';

const Feed = () => {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  const fetchFeed = async (page = 1) => {
    setLoading(true);
    try {
      const response = await api.get(`/follows/feed?page=${page}&limit=20`);
      setFeed(response.data.feed || []);
      setPagination(response.data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (error) {
      console.error('Failed to fetch feed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed(1);
  }, []);

  if (loading) return <LoadingSpinner text="Loading feed..." />;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Activity Feed</h1>
      <p className="text-gray-500">See what people you follow are posting</p>

      {feed.length > 0 ? (
        <div className="space-y-4">
          {feed.map(item => (
            <div key={`${item.type}-${item.id}`} className="card p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  {item.author_avatar ? (
                    <img src={item.author_avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-primary-600 font-semibold">
                        {item.author_name?.[0] || '?'}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{item.author_name}</span>
                    <Badge variant={item.type === 'doubt' ? 'info' : 'success'}>
                      {item.type === 'doubt' ? 'Asked a doubt' : 'Answered'}
                    </Badge>
                    <span className="text-xs text-gray-400">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {item.type === 'doubt' ? (
                    <Link to={`/dashboard/doubts/${item.id}`} className="block mt-2 hover:underline">
                      <h3 className="font-semibold text-gray-900">{item.title}</h3>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.content}</p>
                    </Link>
                  ) : (
                    <div className="mt-2">
                      {item.question_title && (
                        <p className="text-xs text-gray-400 mb-1">
                          on: <span className="font-medium">{item.question_title}</span>
                        </p>
                      )}
                      <p className="text-sm text-gray-700 line-clamp-3">{item.content}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-4 mt-3 text-gray-500">
                    <span className="flex items-center gap-1 text-sm">
                      <HandThumbUpIcon className="h-4 w-4" />
                      {item.upvotes || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="📰"
          title="Your feed is empty"
          description="Follow people to see their activity here. Visit the People page to find users to follow."
          action={{ label: 'Find People', href: '/dashboard/people' }}
        />
      )}
    </div>
  );
};

export default Feed;
