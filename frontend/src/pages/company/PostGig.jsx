import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';

const gigSchema = z.object({
  title: z.string().min(10, 'Title must be at least 10 characters'),
  description: z.string().min(50, 'Description must be at least 50 characters'),
  requirements: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  compensation: z.number().min(100, 'Minimum compensation is ₹100'),
  duration_days: z.number().min(1).max(90),
  max_students: z.number().min(1).max(50).optional(),
  is_remote: z.boolean().optional(),
  location: z.string().optional(),
  application_deadline: z.string().min(1, 'Deadline is required')
});

const PostGig = () => {
  const navigate = useNavigate();
  const [skills, setSkills] = useState([]);
  const [newSkill, setNewSkill] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(gigSchema),
    defaultValues: { is_remote: true, max_students: 1 }
  });

  const addSkill = () => {
    if (newSkill && !skills.includes(newSkill)) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill('');
    }
  };

  const removeSkill = (skill) => {
    setSkills(skills.filter(s => s !== skill));
  };

  const onSubmit = async (data) => {
    if (skills.length === 0) {
      toast.error('Add at least one required skill');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/gigs', { ...data, skills_required: skills });
      toast.success('Gig posted successfully!');
      navigate('/company/manage-gigs');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to post gig');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = [
    'Web Development', 'Mobile Development', 'UI/UX Design',
    'Data Science', 'Content Writing', 'Digital Marketing',
    'Video Editing', 'Graphic Design', 'Other'
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Post a New Gig</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="card">
          <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
          <input {...register('title')} className={`input-field ${errors.title ? 'input-error' : ''}`} placeholder="e.g., React Frontend Developer for E-commerce Project" />
          {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
        </div>

        <div className="card">
          <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
          <textarea {...register('description')} rows={6} className={`input-field ${errors.description ? 'input-error' : ''}`} placeholder="Describe the project, deliverables, and expectations..." />
          {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>}
        </div>

        <div className="card">
          <label className="block text-sm font-medium text-gray-700 mb-1">Requirements</label>
          <textarea {...register('requirements')} rows={4} className="input-field" placeholder="Any specific requirements or prerequisites..." />
        </div>

        <div className="card grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select {...register('category')} className={`input-field ${errors.category ? 'input-error' : ''}`}>
              <option value="">Select category</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Compensation (₹) *</label>
            <input type="number" {...register('compensation', { valueAsNumber: true })} className={`input-field ${errors.compensation ? 'input-error' : ''}`} placeholder="e.g., 5000" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration (days) *</label>
            <input type="number" {...register('duration_days', { valueAsNumber: true })} className="input-field" placeholder="e.g., 14" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Students</label>
            <input type="number" {...register('max_students', { valueAsNumber: true })} className="input-field" placeholder="1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Application Deadline *</label>
            <input type="datetime-local" {...register('application_deadline')} className="input-field" />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input type="checkbox" {...register('is_remote')} className="rounded border-gray-300 text-primary-600" />
            <label className="text-sm text-gray-700">Remote work allowed</label>
          </div>
        </div>

        <div className="card">
          <label className="block text-sm font-medium text-gray-700 mb-1">Required Skills *</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {skills.map(skill => (
              <span key={skill} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary-100 text-primary-700">
                {skill}
                <button type="button" onClick={() => removeSkill(skill)}><XMarkIcon className="h-4 w-4" /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="text" value={newSkill} onChange={e => setNewSkill(e.target.value)} onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addSkill())} className="input-field flex-1" placeholder="Add skill" />
            <button type="button" onClick={addSkill} className="btn-outline"><PlusIcon className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button type="button" onClick={() => navigate('/company/manage-gigs')} className="btn-outline">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="btn-primary">{isSubmitting ? 'Posting...' : 'Post Gig'}</button>
        </div>
      </form>
    </div>
  );
};

export default PostGig;
