import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import ExperienceSection from '../../components/profile/ExperienceSection';
import ProjectsSection from '../../components/profile/ProjectsSection';
import {
  UserIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  PlusIcon,
  TrashIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';

const profileSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  bio: z.string().max(1000).optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  college_name: z.string().optional(),
  course: z.string().optional(),
  year_of_study: z.number().min(1).max(6).optional(),
  graduation_year: z.number().min(2020).max(2030).optional(),
  linkedin_url: z.string().url().optional().or(z.literal('')),
  github_url: z.string().url().optional().or(z.literal('')),
  portfolio_url: z.string().url().optional().or(z.literal(''))
});

const Profile = () => {
  const { user, setUser } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [skills, setSkills] = useState([]);
  const [newSkill, setNewSkill] = useState('');
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [badges, setBadges] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [experience, setExperience] = useState([]);
  const [projects, setProjects] = useState([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(profileSchema)
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const [profileRes, badgesRes, verificationsRes, expRes, projRes] = await Promise.all([
        api.get('/auth/me'),
        api.get('/auth/me/badges').catch(() => ({ data: { badges: [] } })),
        api.get('/verification/status').catch(() => ({ data: { verifications: [] } })),
        api.get('/profiles/me/experience').catch(() => ({ data: { experience: [] } })),
        api.get('/profiles/me/projects').catch(() => ({ data: { projects: [] } }))
      ]);
      setProfile(profileRes.data.user);
      setSkills(profileRes.data.user.skills || []);
      setBadges(badgesRes.data.badges || []);
      setVerifications(verificationsRes.data.verifications || []);
      setExperience(expRes.data.experience || []);
      setProjects(projRes.data.projects || []);
      reset(profileRes.data.user);
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      await api.put(`/profiles/${user.id}`, { ...data, skills });
      toast.success('Profile updated successfully');
      setEditing(false);
      fetchProfile();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update profile');
    }
  };

  const addSkill = () => {
    if (newSkill && !skills.includes(newSkill)) {
      setSkills([...skills, newSkill]);
      setNewSkill('');
      setShowSkillModal(false);
    }
  };

  const removeSkill = (skill) => {
    setSkills(skills.filter(s => s !== skill));
  };

  if (loading) return <LoadingSpinner text="Loading profile..." />;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile Header */}
      <div className="card">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <UserIcon className="h-10 w-10 text-primary-600" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {profile?.full_name || 'Your Name'}
              </h1>
              <p className="text-gray-500">{profile?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="primary">{user?.role}</Badge>
                <Badge variant={profile?.is_email_verified ? 'success' : 'warning'}>
                  {profile?.is_email_verified ? 'Verified' : 'Unverified'}
                </Badge>
                <Badge variant="info">Trust Score: {profile?.trust_score || 0}</Badge>
            <Badge variant={
              (profile?.trust_score || 0) >= 70 ? 'success' :
              (profile?.trust_score || 0) >= 30 ? 'warning' : 'gray'
            }>
              {(profile?.trust_score || 0) >= 70 ? 'Featured' :
               (profile?.trust_score || 0) >= 30 ? 'Rising' : 'New'}
            </Badge>
              </div>
            </div>
          </div>
          <button
            onClick={() => setEditing(!editing)}
            className="btn-outline flex items-center gap-2"
          >
            {editing ? (
              <>
                <XMarkIcon className="h-4 w-4" />
                Cancel
              </>
            ) : (
              <>
                <PencilIcon className="h-4 w-4" />
                Edit Profile
              </>
            )}
          </button>
        </div>
      </div>

      {/* Profile Form */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="card space-y-6">
          <h2 className="text-lg font-semibold">Personal Information</h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name *
              </label>
              <input
                {...register('full_name')}
                disabled={!editing}
                className={`input-field ${!editing ? 'bg-gray-50' : ''} ${errors.full_name ? 'input-error' : ''}`}
              />
              {errors.full_name && (
                <p className="mt-1 text-sm text-red-600">{errors.full_name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                {...register('phone')}
                disabled={!editing}
                className={`input-field ${!editing ? 'bg-gray-50' : ''}`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City
              </label>
              <input
                {...register('city')}
                disabled={!editing}
                className={`input-field ${!editing ? 'bg-gray-50' : ''}`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State
              </label>
              <input
                {...register('state')}
                disabled={!editing}
                className={`input-field ${!editing ? 'bg-gray-50' : ''}`}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bio
            </label>
            <textarea
              {...register('bio')}
              disabled={!editing}
              rows={3}
              className={`input-field ${!editing ? 'bg-gray-50' : ''}`}
              placeholder="Tell us about yourself..."
            />
          </div>
        </div>

        {/* Education */}
        <div className="card mt-6 space-y-6">
          <h2 className="text-lg font-semibold">Education</h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                College/University
              </label>
              <input
                {...register('college_name')}
                disabled={!editing}
                className={`input-field ${!editing ? 'bg-gray-50' : ''}`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Course
              </label>
              <input
                {...register('course')}
                disabled={!editing}
                className={`input-field ${!editing ? 'bg-gray-50' : ''}`}
                placeholder="e.g., B.Sc. Computer Science"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Year of Study
              </label>
              <select
                {...register('year_of_study', { valueAsNumber: true })}
                disabled={!editing}
                className={`input-field ${!editing ? 'bg-gray-50' : ''}`}
              >
                <option value="">Select year</option>
                <option value={1}>1st Year</option>
                <option value={2}>2nd Year</option>
                <option value={3}>3rd Year</option>
                <option value={4}>4th Year</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Graduation Year
              </label>
              <input
                {...register('graduation_year', { valueAsNumber: true })}
                type="number"
                disabled={!editing}
                className={`input-field ${!editing ? 'bg-gray-50' : ''}`}
              />
            </div>
          </div>
        </div>

        {/* Experience */}
        <ExperienceSection
          experience={experience}
          onUpdate={fetchProfile}
          editing={editing}
        />

        {/* Projects */}
        <ProjectsSection
          projects={projects}
          onUpdate={fetchProfile}
          editing={editing}
        />

        {/* Skills */}
        <div className="card mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Skills</h2>
            {editing && (
              <button
                type="button"
                onClick={() => setShowSkillModal(true)}
                className="btn-outline text-sm flex items-center gap-1"
              >
                <PlusIcon className="h-4 w-4" />
                Add Skill
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {skills.length > 0 ? (
              skills.map((skill) => (
                <div key={skill} className="flex items-center gap-1">
                  <Badge variant="primary">{skill}</Badge>
                  {editing && (
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No skills added yet</p>
            )}
          </div>
        </div>

        {/* Verification Badges */}
        {badges.length > 0 && (
          <div className="card mt-6 space-y-4">
            <h2 className="text-lg font-semibold">Badges</h2>
            <div className="flex flex-wrap gap-3">
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  className="flex items-center gap-2 bg-gradient-to-r from-primary-50 to-primary-100 border border-primary-200 rounded-full px-4 py-2"
                >
                  <span className="text-lg">{badge.icon_url || '🏅'}</span>
                  <span className="text-sm font-medium text-primary-700">{badge.name}</span>
                  <span className="text-xs text-primary-500">+{badge.points_value}pts</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Verification Status */}
        {verifications.length > 0 && (
          <div className="card mt-6 space-y-4">
            <h2 className="text-lg font-semibold">Verification Status</h2>
            <div className="space-y-2">
              {verifications.map((v) => (
                <div key={v.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      v.status === 'approved' ? 'bg-green-500' :
                      v.status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                    <span className="text-sm font-medium text-gray-700">
                      {v.verification_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    v.status === 'approved' ? 'bg-green-100 text-green-700' :
                    v.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {v.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Social Links */}
        <div className="card mt-6 space-y-6">
          <h2 className="text-lg font-semibold">Social Links</h2>

          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                LinkedIn URL
              </label>
              <input
                {...register('linkedin_url')}
                disabled={!editing}
                className={`input-field ${!editing ? 'bg-gray-50' : ''}`}
                placeholder="https://linkedin.com/in/..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                GitHub URL
              </label>
              <input
                {...register('github_url')}
                disabled={!editing}
                className={`input-field ${!editing ? 'bg-gray-50' : ''}`}
                placeholder="https://github.com/..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Portfolio URL
              </label>
              <input
                {...register('portfolio_url')}
                disabled={!editing}
                className={`input-field ${!editing ? 'bg-gray-50' : ''}`}
                placeholder="https://..."
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        {editing && (
          <div className="flex justify-end gap-4 mt-6">
            <button
              type="button"
              onClick={() => { setEditing(false); reset(profile); }}
              className="btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary flex items-center gap-2"
            >
              {isSubmitting ? (
                'Saving...'
              ) : (
                <>
                  <CheckIcon className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        )}
      </form>

      {/* Add Skill Modal */}
      <Modal
        isOpen={showSkillModal}
        onClose={() => setShowSkillModal(false)}
        title="Add Skill"
        size="sm"
      >
        <div className="space-y-4">
          <input
            type="text"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            placeholder="Enter skill name"
            className="input-field"
            onKeyPress={(e) => e.key === 'Enter' && addSkill()}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowSkillModal(false)}
              className="btn-outline"
            >
              Cancel
            </button>
            <button
              onClick={addSkill}
              className="btn-primary"
            >
              Add Skill
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Profile;
