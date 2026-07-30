import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Badge from '../../components/common/Badge';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  UsersIcon,
  CurrencyRupeeIcon,
  BriefcaseIcon
} from '@heroicons/react/24/outline';

const ManageGigs = () => {
  const [gigs, setGigs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGigs();
  }, []);

  const fetchGigs = async () => {
    try {
      const response = await api.get('/gigs?limit=50');
      setGigs(response.data.gigs);
    } catch (error) {
      console.error('Failed to fetch gigs:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteGig = async (id) => {
    if (!confirm('Are you sure you want to delete this gig?')) return;
    try {
      await api.delete(`/gigs/${id}`);
      setGigs(gigs.filter(g => g.id !== id));
    } catch (error) {
      alert('Failed to delete gig');
    }
  };

  if (loading) return <LoadingSpinner text="Loading gigs..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Manage Gigs</h1>
        <Link to="/company/post-gig" className="btn-primary flex items-center gap-2">
          <PlusIcon className="h-5 w-5" /> Post New Gig
        </Link>
      </div>

      {gigs.length > 0 ? (
        <div className="space-y-4">
          {gigs.map(gig => (
            <div key={gig.id} className="card flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{gig.title}</h3>
                  <Badge variant={gig.status === 'open' ? 'success' : 'gray'}>{gig.status}</Badge>
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                  <span className="flex items-center gap-1"><CurrencyRupeeIcon className="h-4 w-4" />{gig.compensation}</span>
                  <span>{gig.duration_days} days</span>
                  <span className="flex items-center gap-1"><UsersIcon className="h-4 w-4" />{gig.total_applications || 0} applicants</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link to={`/company/gigs/${gig.id}/applications`} className="btn-outline text-sm">View Applications</Link>
                <button onClick={() => deleteGig(gig.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><TrashIcon className="h-5 w-5" /></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12 text-gray-500">
          <BriefcaseIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p>No gigs posted yet</p>
        </div>
      )}
    </div>
  );
};

export default ManageGigs;
