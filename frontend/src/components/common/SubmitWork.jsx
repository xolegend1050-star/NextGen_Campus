import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import {
  DocumentArrowUpIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

/**
 * Submit the work for an accepted gig.
 *
 * The company cannot release escrow until a deliverable exists, and that check
 * exists to stop a company paying for work that was never handed over. It could
 * not be satisfied honestly before this component existed, because nothing in
 * the interface created one, so the only way to release was to bypass the check
 * as an administrator. This is the student side of that guarantee.
 */
const SubmitWork = ({ gigId, gigTitle, onSubmitted }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fileUrl, setFileUrl] = useState('');

  const close = () => {
    setOpen(false);
    setTitle('');
    setDescription('');
    setFileUrl('');
  };

  const submit = async () => {
    if (title.trim().length < 3) {
      toast.error('Give the work a title of at least 3 characters');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post(`/wallet/escrow/${gigId}/deliverable`, {
        title: title.trim(),
        description: description.trim() || undefined,
        file_url: fileUrl.trim() || undefined
      });
      toast.success('Work submitted. The company can now release your payment.');
      setDone(true);
      onSubmitted?.(res.data.deliverable);
      setTimeout(close, 1200);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not submit the work');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); setDone(false); }}
        className="btn-primary text-sm flex items-center gap-1.5"
        title="Hand over your work so the company can release your payment"
      >
        {done ? (
          <CheckCircleIcon className="h-4 w-4" />
        ) : (
          <DocumentArrowUpIcon className="h-4 w-4" />
        )}
        {done ? 'Work submitted' : 'Submit work'}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" onClick={close}>
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={close} />
        <div
          className="relative bg-white rounded-lg p-6 w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-semibold mb-1">Submit your work</h3>
          <p className="text-sm text-gray-500 mb-4">
            {gigTitle ? `For: ${gigTitle}. ` : ''}
            The company can only release your payment once your work is here.
          </p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              What did you build?
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field"
              placeholder="e.g. Completed the checkout flow and tests"
              maxLength={255}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Details (optional)
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field"
              placeholder="What you did, how to review it, anything the company should know"
              maxLength={5000}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Link to your work (optional)
            </label>
            <input
              type="url"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              className="input-field"
              placeholder="https://github.com/you/project"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={close} className="btn-outline">
              Cancel
            </button>
            <button type="button" onClick={submit} disabled={busy} className="btn-primary">
              {busy ? 'Submitting...' : 'Submit work'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubmitWork;
