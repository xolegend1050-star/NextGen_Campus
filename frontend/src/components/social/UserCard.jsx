import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import OnlineIndicator from './OnlineIndicator';
import Badge from '../common/Badge';

const UserCard = ({ user, onFollowChange }) => {
  const [isFollowing, setIsFollowing] = useState(user.i_follow_them);
  const [followerCount, setFollowerCount] = useState(user.follower_count || 0);
  const [loading, setLoading] = useState(false);

  const handleFollow = async () => {
    setLoading(true);
    try {
      if (isFollowing) {
        await api.delete(`/follows/${user.id}`);
        setIsFollowing(false);
        setFollowerCount(prev => Math.max(0, prev - 1));
        toast.success('Unfollowed');
      } else {
        await api.post(`/follows/${user.id}`);
        setIsFollowing(true);
        setFollowerCount(prev => prev + 1);
        toast.success('Following!');
      }
      onFollowChange?.();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <Link to={`/dashboard/mentors/${user.id}`} className="flex-shrink-0">
          <div className="relative">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-primary-600 font-semibold text-lg">
                  {user.full_name?.[0] || '?'}
                </span>
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5">
              <OnlineIndicator userId={user.id} size="sm" />
            </div>
          </div>
        </Link>

        <div className="flex-1 min-w-0">
          <Link to={`/dashboard/mentors/${user.id}`} className="hover:underline">
            <h3 className="font-semibold text-gray-900 truncate">{user.full_name}</h3>
          </Link>
          <p className="text-sm text-gray-500 truncate">
            {user.college_name || user.city || user.email}
          </p>
          {user.bio && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{user.bio}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {user.is_verified && (
              <Badge variant="success">Verified</Badge>
            )}
            {user.talent_tier && user.talent_tier !== 'new' && (
              <Badge variant={user.talent_tier === 'featured' ? 'success' : 'warning'}>
                {user.talent_tier}
              </Badge>
            )}
            <span className="text-xs text-gray-400">{followerCount} followers</span>
            {user.i_follow_them && user.they_follow_me && (
              <span className="text-xs text-primary-500 font-medium">Mutual</span>
            )}
          </div>
        </div>

        <button
          onClick={handleFollow}
          disabled={loading}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            isFollowing
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              : 'bg-primary-600 text-white hover:bg-primary-700'
          } disabled:opacity-50`}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </button>
      </div>
    </div>
  );
};

export default UserCard;
