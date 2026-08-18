import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { CloudArrowUpIcon, XMarkIcon, DocumentIcon } from '@heroicons/react/24/outline';
import api from '../../services/api';

const FileUpload = ({ onUpload, onError, accept = '.jpg,.jpeg,.png,.pdf', maxSizeMB = 5, multiple = false }) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previews, setPreviews] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    return () => {
      previews.forEach(p => { if (p.preview) URL.revokeObjectURL(p.preview); });
    };
  }, [previews]);

  const handleFiles = async (files) => {
    const fileArr = Array.from(files);

    for (const file of fileArr) {
      if (file.size > maxSizeMB * 1024 * 1024) {
        toast.error(`${file.name} exceeds ${maxSizeMB}MB limit`);
        return;
      }
    }

    const newPreviews = fileArr.map(file => ({
      file,
      name: file.name,
      size: (file.size / 1024).toFixed(1) + ' KB',
      type: file.type,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    }));
    setPreviews(prev => [...prev, ...newPreviews]);

    setUploading(true);
    const results = [];
    const errors = [];
    for (const file of fileArr) {
      try {
        const formData = new FormData();
        formData.append('document', file);
        const response = await api.post('/upload/document', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        results.push(response.data);
      } catch (err) {
        errors.push(err.response?.data?.error || 'Upload failed');
      }
    }
    setUploading(false);

    if (results.length > 0) onUpload?.(results.length === 1 ? results[0] : results);
    if (errors.length > 0) onError?.(errors.join(', '));
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const removePreview = (index) => {
    setPreviews(prev => {
      const removed = prev[index];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  return (
    <div className="space-y-3">
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          dragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        <CloudArrowUpIcon className="h-10 w-10 mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-600">
          {uploading ? 'Uploading...' : 'Drag & drop or click to upload'}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          JPG, PNG, PDF — max {maxSizeMB}MB
        </p>
      </div>

      {previews.length > 0 && (
        <div className="space-y-2">
          {previews.map((p, i) => (
            <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
              {p.preview ? (
                <img src={p.preview} alt="" className="h-10 w-10 object-cover rounded" />
              ) : (
                <DocumentIcon className="h-10 w-10 text-gray-400" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">{p.name}</p>
                <p className="text-xs text-gray-400">{p.size}</p>
              </div>
              <button
                onClick={() => removePreview(i)}
                className="text-gray-400 hover:text-red-500"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUpload;
