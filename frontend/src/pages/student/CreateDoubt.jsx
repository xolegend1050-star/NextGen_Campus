import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';

const doubtSchema = z.object({
  title: z.string().min(10, 'Title must be at least 10 characters').max(500),
  content: z.string().min(20, 'Content must be at least 20 characters'),
  subject: z.string().optional(),
  topic: z.string().optional()
});

const CreateDoubt = () => {
  const navigate = useNavigate();
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(doubtSchema)
  });

  const addTag = () => {
    if (newTag && !tags.includes(newTag) && tags.length < 5) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tag) => {
    setTags(tags.filter(t => t !== tag));
  };

  const onSubmit = async (data) => {
    if (tags.length === 0) {
      toast.error('Please add at least one tag');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/doubts', { ...data, tags });
      toast.success('Doubt posted successfully!');
      navigate('/dashboard/doubts');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to post doubt');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ask a Doubt</h1>
        <p className="text-gray-500">Get help from peers and AI</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Title */}
        <div className="card">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title *
          </label>
          <input
            {...register('title')}
            className={`input-field ${errors.title ? 'input-error' : ''}`}
            placeholder="What's your question? Be specific."
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            A clear title helps others understand your question quickly
          </p>
        </div>

        {/* Content */}
        <div className="card">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description *
          </label>
          <textarea
            {...register('content')}
            rows={8}
            className={`input-field ${errors.content ? 'input-error' : ''}`}
            placeholder="Explain your doubt in detail. Include what you've tried so far."
          />
          {errors.content && (
            <p className="mt-1 text-sm text-red-600">{errors.content.message}</p>
          )}
        </div>

        {/* Subject & Topic */}
        <div className="card grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject
            </label>
            <select {...register('subject')} className="input-field">
              <option value="">Select subject</option>
              <option value="mathematics">Mathematics</option>
              <option value="physics">Physics</option>
              <option value="chemistry">Chemistry</option>
              <option value="computer_science">Computer Science</option>
              <option value="electronics">Electronics</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Topic
            </label>
            <input
              {...register('topic')}
              className="input-field"
              placeholder="e.g., DBMS Normalization"
            />
          </div>
        </div>

        {/* Tags */}
        <div className="card">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tags * (1-5 tags)
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary-100 text-primary-700 text-sm"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="hover:text-primary-900"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              className="input-field flex-1"
              placeholder="Add a tag (e.g., react, javascript)"
              disabled={tags.length >= 5}
            />
            <button
              type="button"
              onClick={addTag}
              disabled={tags.length >= 5 || !newTag}
              className="btn-outline flex items-center gap-1"
            >
              <PlusIcon className="h-4 w-4" />
              Add
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {tags.length}/5 tags added. Tags help others find your question.
          </p>
        </div>

        {/* AI Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🤖</span>
            <div>
              <h4 className="font-medium text-blue-900">AI-Powered Assistance</h4>
              <p className="text-sm text-blue-700">
                After posting, our AI will generate a draft answer instantly while you wait for
                verified seniors to provide detailed solutions.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/dashboard/doubts')}
            className="btn-outline"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary"
          >
            {isSubmitting ? 'Posting...' : 'Post Doubt'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateDoubt;
