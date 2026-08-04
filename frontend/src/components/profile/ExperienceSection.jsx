import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Modal from '../common/Modal';
import { PlusIcon, PencilIcon, TrashIcon, BriefcaseIcon } from '@heroicons/react/24/outline';

const experienceSchema = z.object({
  title: z.string().min(2, 'Title is required'),
  company_name: z.string().optional(),
  description: z.string().max(2000).optional(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional().nullable(),
  is_current: z.boolean().optional()
});

const ExperienceSection = ({ experience, onUpdate, editing }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(experienceSchema),
    defaultValues: { is_current: false }
  });

  const isCurrent = watch('is_current');

  const openAdd = () => {
    setEditingItem(null);
    reset({ title: '', company_name: '', description: '', start_date: '', end_date: null, is_current: false });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    reset({
      title: item.title,
      company_name: item.company_name || '',
      description: item.description || '',
      start_date: item.start_date?.split('T')[0] || '',
      end_date: item.end_date?.split('T')[0] || null,
      is_current: item.is_current
    });
    setShowModal(true);
  };

  const onSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        end_date: data.is_current ? null : data.end_date || null
      };

      if (editingItem) {
        await api.put(`/profiles/me/experience/${editingItem.id}`, payload);
        toast.success('Experience updated');
      } else {
        await api.post('/profiles/me/experience', payload);
        toast.success('Experience added');
      }
      setShowModal(false);
      onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save experience');
    }
  };

  const handleDelete = async (id) => {
    try {
      setDeleting(id);
      await api.delete(`/profiles/me/experience/${id}`);
      toast.success('Experience removed');
      onUpdate();
    } catch (error) {
      toast.error('Failed to delete experience');
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <div className="card mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BriefcaseIcon className="h-5 w-5 text-gray-400" />
          Experience
        </h2>
        {editing && (
          <button
            type="button"
            onClick={openAdd}
            className="btn-outline text-sm flex items-center gap-1"
          >
            <PlusIcon className="h-4 w-4" />
            Add
          </button>
        )}
      </div>

      {experience.length > 0 ? (
        <div className="space-y-4">
          {experience.map((item) => (
            <div key={item.id} className="border-l-2 border-primary-200 pl-4 py-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{item.title}</h3>
                  {item.company_name && (
                    <p className="text-sm text-gray-600">{item.company_name}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDate(item.start_date)} - {item.is_current ? 'Present' : formatDate(item.end_date)}
                  </p>
                  {item.description && (
                    <p className="text-sm text-gray-500 mt-2">{item.description}</p>
                  )}
                </div>
                {editing && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="text-gray-400 hover:text-primary-600"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      disabled={deleting === item.id}
                      className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-sm">
          {editing ? 'No experience added yet. Click "Add" to get started.' : 'No experience listed.'}
        </p>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingItem ? 'Edit Experience' : 'Add Experience'}
        size="md"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
            <input {...register('title')} className="input-field" placeholder="e.g., Software Engineering Intern" />
            {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
            <input {...register('company_name')} className="input-field" placeholder="e.g., Google" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
              <input {...register('start_date')} type="date" className="input-field" />
              {errors.start_date && <p className="mt-1 text-sm text-red-600">{errors.start_date.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                {...register('end_date')}
                type="date"
                className="input-field"
                disabled={isCurrent}
              />
            </div>
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" {...register('is_current')} className="rounded border-gray-300" />
            <span className="text-sm text-gray-700">I currently work here</span>
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              {...register('description')}
              rows={3}
              className="input-field"
              placeholder="Describe your role and achievements..."
            />
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowModal(false)} className="btn-outline">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Saving...' : editingItem ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ExperienceSection;
