import { useState, useEffect } from 'react';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import FileUpload from '../../components/common/FileUpload';
import { CheckCircleIcon, ClockIcon, LinkIcon, DocumentCheckIcon } from '@heroicons/react/24/outline';

const AlumniVerification = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [activeTab, setActiveTab] = useState('linkedin');

  useEffect(() => { fetchStatus(); }, []);

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

  const submitLinkedin = async () => {
    if (!linkedinUrl) return;
    setSubmitting(true);
    try {
      await api.post('/verification/submit', {
        verification_type: 'alumni_linkedin',
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

  const submitCompanyEmail = async () => {
    if (!companyEmail) return;
    setSubmitting(true);
    try {
      await api.post('/verification/submit', {
        verification_type: 'alumni_linkedin',
        metadata: { company_email: companyEmail }
      });
      alert('Verification email sent!');
      setCompanyEmail('');
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
        verification_type: 'alumni_college_id',
        document_url: uploadData.url
      });
      alert('College ID submitted for review!');
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

  const linkedinStatus = getVerification('alumni_linkedin');
  const collegeIdStatus = getVerification('alumni_college_id');

  const verifiedCount = verifications.filter(v => v.status === 'approved').length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Alumni Verification</h1>
        <p className="text-gray-600 mt-1">Verify your alumni status to earn the Verified Alumni badge</p>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Verification Progress</span>
          <span className="text-sm text-gray-500">{verifiedCount}/2 verified</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-primary-600 h-2 rounded-full transition-all" style={{ width: `${(verifiedCount / 2) * 100}%` }} />
        </div>
      </div>

      <div className="flex gap-2 border-b">
        {[
          { id: 'linkedin', label: 'LinkedIn Profile', icon: LinkIcon },
          { id: 'college', label: 'College ID', icon: DocumentCheckIcon }
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
          </button>
        ))}
      </div>

      <div className="card">
        {activeTab === 'linkedin' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">LinkedIn Profile Verification</h3>
            <p className="text-sm text-gray-600">
              Enter your LinkedIn profile URL to verify your professional identity.
            </p>
            {linkedinStatus?.status === 'approved' ? (
              <StatusAlert type="success" message="LinkedIn verified!" />
            ) : linkedinStatus?.status === 'pending' ? (
              <StatusAlert type="pending" message="Verification pending..." />
            ) : (
              <div className="flex gap-2">
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/yourprofile"
                  className="flex-1 input-field"
                />
                <button onClick={submitLinkedin} disabled={submitting || !linkedinUrl} className="btn-primary disabled:opacity-50">
                  {submitting ? 'Submitting...' : 'Verify'}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'college' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">College ID Upload</h3>
            <p className="text-sm text-gray-600">
              Upload a photo of your college ID or degree certificate.
            </p>
            {collegeIdStatus?.status === 'approved' ? (
              <StatusAlert type="success" message="College ID verified!" />
            ) : collegeIdStatus?.status === 'pending' ? (
              <StatusAlert type="pending" message="Awaiting admin review..." />
            ) : (
              <FileUpload onUpload={handleDocumentUpload} onError={(err) => alert(err)} />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const StatusAlert = ({ type, message }) => (
  <div className={`flex items-center gap-2 p-3 rounded-lg ${
    type === 'success' ? 'text-green-600 bg-green-50' : 'text-yellow-600 bg-yellow-50'
  }`}>
    {type === 'success' ? <CheckCircleIcon className="h-5 w-5" /> : <ClockIcon className="h-5 w-5" />}
    <span className="text-sm">{message}</span>
  </div>
);

export default AlumniVerification;
