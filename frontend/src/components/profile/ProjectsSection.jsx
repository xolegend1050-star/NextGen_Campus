import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Badge from '../common/Badge';
import Modal from '../common/Modal';
import { PlusIcon, PencilIcon, TrashIcon, CodeBracketIcon, LinkIcon } from '@heroicons/react/24/outline';

const projectSchema = z.object({
  title: z.string().min(2, 'Title is required'),
  description: z.string().max(2000).optional(),
  project_url: z.string().url().optional().or(z.literal('')),
  github_url: z.string().url().optional().or(z.literal('')),
  technologies: z.string().optional(),
  image_url: z.string().url().optional().or(z.literal(''))
});

const ProjectsSection = ({ projects, onUpdate, editing }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(projectSchema)
  });

  const openAdd = () => {
    setEditingItem(null);
    reset({ title: '', description: '', project_url: '', github_url: '', technologies: '', image_url: '' });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    reset({
      title: item.title,
      description: item.description || '',
      project_url: item.project_url || '',
      github_url: item.github_url || '',
      technologies: item.technologies?.join(', ') || '',
      image_url: item.image_url || ''
    });
    setShowModal(true);
  };

  const onSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        technologies: data.technologies
          ? data.technologies.split(',').map(t => t.trim()).filter(Boolean)
          : []
      };

      if (editingItem) {
        await api.put(`/profiles/me/projects/${editingItem.id}`, payload);
        toast.success('Project updated');
      } else {
        await api.post('/profiles/me/projects', payload);
        toast.success('Project added');
      }
      setShowModal(false);
      onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save project');
    }
  };

  const handleDelete = async (id) => {
    try {
      setDeleting(id);
      await api.delete(`/profiles/me/projects/${id}`);
      toast.success('Project removed');
      onUpdate();
    } catch (error) {
      toast.error('Failed to delete project');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="card mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <CodeBracketIcon className="h-5 w-5 text-gray-400" />
          Projects
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

      {projects.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-4">
          {projects.map((item) => (
            <div key={item.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <h3 className="font-medium text-gray-900">{item.title}</h3>
                {editing && (
                  <div className="flex items-center gap-1">
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

              {item.description && (
                <p className="text-sm text-gray-500 mt-2 line-clamp-2">{item.description}</p>
              )}

              {item.technologies?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {item.technologies.map((tech) => (
                    <Badge key={tech} variant="gray">{tech}</Badge>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3 mt-3">
                {item.project_url && (
                  <a
                    href={item.project_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary-600 hover:underline flex items-center gap-1"
                  >
                    <LinkIcon className="h-3 w-3" />
                    Live Demo
                  </a>
                )}
                {item.github_url && (
                  <a
                    href={item.github_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-600 hover:underline flex items-center gap-1"
                  >
                    <CodeBracketIcon className="h-3 w-3" />
                    Source Code
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-sm">
          {editing ? 'No projects added yet. Click "Add" to showcase your work.' : 'No projects listed.'}
        </p>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingItem ? 'Edit Project' : 'Add Project'}
        size="md"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Title *</label>
            <input {...register('title')} className="input-field" placeholder="e.g., E-commerce Platform" />
            {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              {...register('description')}
              rows={3}
              className="input-field"
              placeholder="Describe what you built and what you learned..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Technologies</label>
            <input
              {...register('technologies')}
              className="input-field"
              placeholder="e.g., React, Node.js, PostgreSQL (comma separated)"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Live Demo URL</label>
              <input {...register('project_url')} className="input-field" placeholder="https://..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GitHub URL</label>
              <input {...register('github_url')} className="input-field" placeholder="https://github.com/..." />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Screenshot URL</label>
            <input {...register('image_url')} className="input-field" placeholder="https://... (optional)" />
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

export default ProjectsSection;
