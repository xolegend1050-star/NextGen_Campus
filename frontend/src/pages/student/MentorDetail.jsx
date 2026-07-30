import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import {
  ArrowLeftIcon,
  StarIcon,
  MapPinIcon,
  BriefcaseIcon,
  AcademicCapIcon,
  CalendarIcon,
  ChatBubbleLeftIcon,
  VideoCameraIcon
} from '@heroicons/react/24/outline';

const MentorDetail = () => {
  const { id } = useParams();
  const [mentor, setMentor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestData, setRequestData] = useState({
    message: '',
    student_goals: '',
    preferred_session_type: 'chat'
  });

  useEffect(() => {
    fetchMentor();
  }, [id]);

  const fetchMentor = async () => {
    try {
      const response = await api.get(`/mentorship/mentors?limit=100`);
      const foundMentor = response.data.mentors.find(m => m.id === id);
      setMentor(foundMentor);
    } catch (error) {
      toast.error('Failed to load mentor');
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async () => {
    setRequesting(true);
    try {
      await api.post('/mentorship/requests', {
        mentor_id: id,
        ...requestData
      });
      toast.success('Mentorship request sent!');
      setShowRequestModal(false);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to send request');
    } finally {
      setRequesting(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading mentor..." />;
  if (!mentor) return <div>Mentor not found</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link to="/dashboard/mentors" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Mentors
      </Link>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="flex items-start gap-6">
              <div className="w-24 h-24 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                {mentor.avatar_url ? (
                  <img src={mentor.avatar_url} alt={mentor.full_name} className="w-24 h-24 rounded-full object-cover" />
                ) : (
                  <AcademicCapIcon className="h-12 w-12 text-primary-600" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{mentor.full_name}</h1>
                <p className="text-lg text-gray-600">{mentor.current_designation}</p>
                <p className="text-gray-500">{mentor.current_company}</p>
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1">
                    <StarIcon className="h-5 w-5 text-yellow-500" />
                    <span className="font-medium">{mentor.avg_rating ? Number(mentor.avg_rating).toFixed(1) : 'New'}</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-500">
                    <MapPinIcon className="h-5 w-5" />
                    {mentor.city || 'India'}
                  </div>
                  <div className="flex items-center gap-1 text-gray-500">
                    <BriefcaseIcon className="h-5 w-5" />
                    {mentor.years_of_experience || 0} years experience
                  </div>
                </div>
              </div>
            </div>

            {mentor.bio && (
              <div className="mt-6">
                <h3 className="font-semibold text-gray-900 mb-2">About</h3>
                <p className="text-gray-700">{mentor.bio}</p>
              </div>
            )}

            <div className="mt-6">
              <h3 className="font-semibold text-gray-900 mb-2">Mentorship Areas</h3>
              <div className="flex flex-wrap gap-2">
                {mentor.mentorship_areas?.map((area) => (
                  <Badge key={area} variant="primary">{area}</Badge>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <h3 className="font-semibold text-gray-900 mb-2">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {mentor.skills?.map((skill) => (
                  <Badge key={skill} variant="gray">{skill}</Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Education */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Education & Background</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <AcademicCapIcon className="h-5 w-5 text-gray-400" />
                <span>Graduated in {mentor.graduation_year}</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPinIcon className="h-5 w-5 text-gray-400" />
                <span>From {mentor.city}, India</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="card">
            <div className="text-center mb-6">
              <Badge variant="success" size="lg">Available for Mentoring</Badge>
              <p className="text-sm text-gray-500 mt-2">
                Max {mentor.max_mentees || 5} mentees at a time
              </p>
            </div>

            <button
              onClick={() => setShowRequestModal(true)}
              className="w-full btn-primary py-3 mb-3"
            >
              Request Mentorship
            </button>
            <button className="w-full btn-outline flex items-center justify-center gap-2">
              <ChatBubbleLeftIcon className="h-5 w-5" />
              Send Message
            </button>
          </div>

          <div className="card">
            <h4 className="font-semibold text-gray-900 mb-3">Quick Stats</h4>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Sessions Completed</span>
                <span className="font-medium">{mentor.sessions_completed || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Trust Score</span>
                <span className="font-medium">{mentor.trust_score || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Response Rate</span>
                <span className="font-medium">95%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Request Modal */}
      <Modal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        title="Request Mentorship"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message to Mentor
            </label>
            <textarea
              value={requestData.message}
              onChange={(e) => setRequestData({ ...requestData, message: e.target.value })}
              rows={4}
              className="input-field"
              placeholder="Introduce yourself and explain why you want this mentorship..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Goals
            </label>
            <textarea
              value={requestData.student_goals}
              onChange={(e) => setRequestData({ ...requestData, student_goals: e.target.value })}
              rows={3}
              className="input-field"
              placeholder="What do you hope to achieve through this mentorship?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Preferred Session Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'chat', label: 'Chat', icon: ChatBubbleLeftIcon },
                { value: 'video', label: 'Video', icon: VideoCameraIcon },
                { value: 'in_person', label: 'In Person', icon: CalendarIcon }
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRequestData({ ...requestData, preferred_session_type: value })}
                  className={`p-3 rounded-lg border-2 flex flex-col items-center gap-2 ${
                    requestData.preferred_session_type === value
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              onClick={() => setShowRequestModal(false)}
              className="btn-outline"
            >
              Cancel
            </button>
            <button
              onClick={handleRequest}
              disabled={requesting}
              className="btn-primary"
            >
              {requesting ? 'Sending...' : 'Send Request'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MentorDetail;
