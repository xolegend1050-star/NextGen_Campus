import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import {
  ArrowLeftIcon,
  CurrencyRupeeIcon,
  ClockIcon,
  CalendarIcon,
  MapPinIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';

const GigDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [gig, setGig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');

  useEffect(() => {
    fetchGig();
  }, [id]);

  const fetchGig = async () => {
    try {
      const response = await api.get(`/gigs/${id}`);
      setGig(response.data.gig);
    } catch (error) {
      toast.error('Failed to load gig');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      await api.post(`/gigs/${id}/apply`, { cover_letter: coverLetter });
      toast.success('Application submitted!');
      setShowApplyModal(false);
      fetchGig();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to apply');
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading gig..." />;
  if (!gig) return <div>Gig not found</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link to="/dashboard/gigs" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Gigs
      </Link>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="flex items-start justify-between mb-4">
              <div>
                <Badge variant="primary" size="sm">{gig.category}</Badge>
                <h1 className="text-2xl font-bold text-gray-900 mt-2">{gig.title}</h1>
              </div>
              <Badge variant={gig.status === 'open' ? 'success' : 'gray'}>
                {gig.status}
              </Badge>
            </div>

            <div className="prose max-w-none text-gray-700 mb-6">
              {gig.description}
            </div>

            {gig.requirements && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">Requirements</h3>
                <div className="text-gray-700 whitespace-pre-wrap">{gig.requirements}</div>
              </div>
            )}

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Skills Required</h3>
              <div className="flex flex-wrap gap-2">
                {gig.skills_required?.map((skill) => (
                  <Badge key={skill} variant="primary">{skill}</Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Company Info */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">About the Company</h3>
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center">
                <BuildingOfficeIcon className="h-8 w-8 text-gray-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-gray-900">{gig.company_name}</h4>
                  {gig.company_verified && (
                    <Badge variant="success" size="sm">Verified</Badge>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">{gig.company_description}</p>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                  <span>Trust Score: {gig.company_trust_score || 0}</span>
                  <span>•</span>
                  <span>{gig.total_gigs_posted || 0} gigs posted</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="card">
            <div className="text-center mb-6">
              <div className="text-3xl font-bold text-primary-600">
                ₹{gig.compensation}
              </div>
              <p className="text-sm text-gray-500">Total Compensation</p>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-3 text-gray-700">
                <ClockIcon className="h-5 w-5 text-gray-400" />
                <span>{gig.duration_days} days duration</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <CalendarIcon className="h-5 w-5 text-gray-400" />
                <span>Deadline: {new Date(gig.application_deadline).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <MapPinIcon className="h-5 w-5 text-gray-400" />
                <span>{gig.is_remote ? 'Remote' : gig.location || 'Not specified'}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <BriefcaseIcon className="h-5 w-5 text-gray-400" />
                <span>{gig.total_applications || 0} applicants</span>
              </div>
            </div>

            <button
              onClick={() => setShowApplyModal(true)}
              disabled={gig.status !== 'open'}
              className="w-full btn-primary py-3"
            >
              {gig.status === 'open' ? 'Apply Now' : 'Applications Closed'}
            </button>
          </div>

          {/* Escrow Info */}
          <div className="card bg-green-50 border-green-200">
            <div className="flex items-start gap-3">
              <CheckCircleIcon className="h-6 w-6 text-green-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-green-900">Escrow Protected</h4>
                <p className="text-sm text-green-700 mt-1">
                  Payment is secured in escrow. You&apos;ll receive payment upon successful completion.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Apply Modal */}
      <Modal
        isOpen={showApplyModal}
        onClose={() => setShowApplyModal(false)}
        title="Apply for this Gig"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cover Letter (Optional)
            </label>
            <textarea
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              rows={6}
              className="input-field"
              placeholder="Why are you a good fit for this gig?"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowApplyModal(false)}
              className="btn-outline"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={applying}
              className="btn-primary"
            >
              {applying ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default GigDetail;
