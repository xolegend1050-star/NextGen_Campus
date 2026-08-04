import { useState, useEffect } from 'react';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import FileUpload from '../../components/common/FileUpload';
import Badge from '../../components/common/Badge';
import { CheckCircleIcon, XCircleIcon, ClockIcon, EnvelopeIcon, LinkIcon, DocumentCheckIcon } from '@heroicons/react/24/outline';

const StudentVerification = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [collegeEmail, setCollegeEmail] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [activeTab, setActiveTab] = useState('email');

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const response = await api.get('/verification/status');
      setStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch verification status:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitCollegeEmail = async () => {
    if (!collegeEmail) return;
    setSubmitting(true);
    try {
      await api.post('/verification/submit', {
        verification_type: 'student_college_email',
        metadata: { college_email: collegeEmail }
      });
      alert('Verification email sent! Check your inbox.');
      setCollegeEmail('');
      fetchStatus();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const submitLinkedin = async () => {
    if (!linkedinUrl) return;
    setSubmitting(true);
    try {
      await api.post('/verification/submit', {
        verification_type: 'student_college_email',
        metadata: { linkedin_url: linkedinUrl }
      });
      alert('LinkedIn verification submitted!');
      setLinkedinUrl('');
      fetchStatus();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDocumentUpload = async (uploadData) => {
    setSubmitting(true);
    try {
      await api.post('/verification/submit', {
        verification_type: 'student_id_card',
        document_url: uploadData.url
      });
      alert('ID card submitted for review!');
      fetchStatus();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading verification status..." />;

  const verifications = status?.verifications || [];
  const getVerification = (type) => verifications.find(v => v.verification_type === type);

  const emailStatus = getVerification('student_college_email');
  const idStatus = getVerification('student_id_card');

  const verifiedCount = verifications.filter(v => v.status === 'approved').length;
  const totalRequired = 2;
  const progress = (verifiedCount / totalRequired) * 100;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Student Verification</h1>
        <p className="text-gray-600 mt-1">Verify your identity to earn the Verified Student badge</p>
      </div>

      {/* Progress */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Verification Progress</span>
          <span className="text-sm text-gray-500">{verifiedCount}/{totalRequired} verified</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-primary-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        {verifiedCount >= totalRequired && (
          <div className="mt-3 flex items-center gap-2 text-green-600">
            <CheckCircleIcon className="h-5 w-5" />
            <span className="text-sm font-medium">You're fully verified! Badge earned.</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {[
          { id: 'email', label: 'College Email', icon: EnvelopeIcon },
          { id: 'id', label: 'ID Card', icon: DocumentCheckIcon }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.id === 'email' && emailStatus && (
              <StatusBadge status={emailStatus.status} />
            )}
            {tab.id === 'id' && idStatus && (
              <StatusBadge status={idStatus.status} />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="card">
        {activeTab === 'email' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">College Email Verification</h3>
            <p className="text-sm text-gray-600">
              Enter your college email address. We'll send a verification link to confirm your student status.
            </p>
            {emailStatus?.status === 'approved' ? (
              <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
                <CheckCircleIcon className="h-5 w-5" />
                <span className="text-sm">Email verified successfully!</span>
              </div>
            ) : emailStatus?.status === 'pending' ? (
              <div className="flex items-center gap-2 text-yellow-600 bg-yellow-50 p-3 rounded-lg">
                <ClockIcon className="h-5 w-5" />
                <span className="text-sm">Verification pending. Check your email.</span>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="email"
                  value={collegeEmail}
                  onChange={(e) => setCollegeEmail(e.target.value)}
                  placeholder="yourname@college.edu"
                  className="flex-1 input-field"
                />
                <button
                  onClick={submitCollegeEmail}
                  disabled={submitting || !collegeEmail}
                  className="btn-primary disabled:opacity-50"
                >
                  {submitting ? 'Sending...' : 'Verify'}
                </button>
              </div>
            )}
            {emailStatus?.status === 'rejected' && (
              <p className="text-sm text-red-600">Rejected: {emailStatus.rejection_reason}</p>
            )}
          </div>
        )}

        {activeTab === 'id' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Student ID Card</h3>
            <p className="text-sm text-gray-600">
              Upload a photo of your student ID card. This will be reviewed by our admin team.
            </p>
            {idStatus?.status === 'approved' ? (
              <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
                <CheckCircleIcon className="h-5 w-5" />
                <span className="text-sm">ID card verified!</span>
              </div>
            ) : idStatus?.status === 'pending' ? (
              <div className="flex items-center gap-2 text-yellow-600 bg-yellow-50 p-3 rounded-lg">
                <ClockIcon className="h-5 w-5" />
                <span className="text-sm">ID card submitted. Awaiting admin review.</span>
              </div>
            ) : (
              <FileUpload
                onUpload={handleDocumentUpload}
                onError={(err) => alert(err)}
                accept=".jpg,.jpeg,.png,.pdf"
                maxSizeMB={5}
              />
            )}
            {idStatus?.status === 'rejected' && (
              <p className="text-sm text-red-600">Rejected: {idStatus.rejection_reason}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const colors = {
    approved: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    rejected: 'bg-red-100 text-red-700'
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
};

export default StudentVerification;
