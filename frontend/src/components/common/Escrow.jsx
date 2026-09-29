import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import {
  LockClosedIcon,
  BanknotesIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

const STATUS_STYLES = {
  locked: {
    label: 'In escrow',
    icon: LockClosedIcon,
    className: 'bg-amber-100 text-amber-800',
    hint: 'Funds are held until you release them.'
  },
  released: {
    label: 'Released',
    icon: CheckCircleIcon,
    className: 'bg-green-100 text-green-800',
    hint: 'Paid out to the student.'
  },
  refunded: {
    label: 'Refunded',
    icon: ArrowPathIcon,
    className: 'bg-gray-100 text-gray-700',
    hint: 'Returned to the company.'
  }
};

export const EscrowBadge = ({ status }) => {
  const cfg = STATUS_STYLES[status] || {
    label: status,
    icon: ExclamationTriangleIcon,
    className: 'bg-gray-100 text-gray-700'
  };
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}
      title={cfg.hint || ''}
    >
      <Icon className="h-3.5 w-3.5" />
      {cfg.label}
    </span>
  );
};

/**
 * Company-side escrow controls for one accepted application.
 * Renders nothing when the application is not yet accepted.
 */
export const EscrowActions = ({ gigId, applicationId, escrow, onChange, compensation }) => {
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const fund = async () => {
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Enter an amount greater than 0');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post(`/wallet/escrow/${gigId}`, {
        application_id: applicationId,
        amount: value
      });
      toast.success(`₹${value} held in escrow`);
      setAmount('');
      onChange?.(res.data.escrow);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to fund escrow');
    } finally {
      setBusy(false);
    }
  };

  const release = async () => {
    setBusy(true);
    try {
      // application_id is required here, not cosmetic. Without it the backend
      // falls back to "the most recent escrow for this gig", so on a gig with
      // several accepted applicants the company would keep paying the newest one
      // and have no way to name anybody else.
      const res = await api.post(`/wallet/escrow/${gigId}/release`, {
        application_id: applicationId
      });
      toast.success(
        res.data.alreadyReleased
          ? 'This escrow was already released'
          : 'Payment released to the student'
      );
      onChange?.(res.data.escrow);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to release');
    } finally {
      setBusy(false);
    }
  };

  const refund = async () => {
    setBusy(true);
    try {
      const res = await api.post(`/wallet/escrow/${gigId}/refund`, {
        application_id: applicationId,
        reason: 'Refunded by company'
      });
      toast.success('Escrow refunded to your wallet');
      onChange?.(res.data.escrow);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to refund');
    } finally {
      setBusy(false);
    }
  };

  if (!escrow) {
    const suggested = compensation ? parseFloat(compensation) : '';
    return (
      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-xs text-amber-900 mb-2">
          No escrow yet. Fund this applicant so their payment is guaranteed before they start.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
            <input
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={suggested ? String(suggested) : 'Amount'}
              className="input-field pl-7 w-32"
            />
          </div>
          {suggested > 0 && !amount && (
            <button
              type="button"
              onClick={() => setAmount(String(suggested))}
              className="text-xs text-amber-800 underline"
            >
              use ₹{suggested}
            </button>
          )}
          <button
            type="button"
            onClick={fund}
            disabled={busy}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            <LockClosedIcon className="h-4 w-4" />
            {busy ? 'Funding...' : 'Fund escrow'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
      <div className="flex flex-wrap items-center gap-2">
        <EscrowBadge status={escrow.status} />
        <span className="text-sm font-medium text-gray-900">₹{escrow.amount}</span>
        {escrow.status === 'locked' && (
          <>
            <button
              type="button"
              onClick={release}
              disabled={busy}
              className="btn-primary text-sm flex items-center gap-1.5"
              title="Pay the student. Requires submitted work."
            >
              <BanknotesIcon className="h-4 w-4" />
              Release payment
            </button>
            <button
              type="button"
              onClick={refund}
              disabled={busy}
              className="text-sm text-gray-600 underline hover:text-gray-800 disabled:opacity-50"
            >
              Refund
            </button>
          </>
        )}
        {escrow.status === 'released' && (
          <span className="text-xs text-gray-500">
            Paid out to the student&rsquo;s wallet
          </span>
        )}
        {escrow.status === 'refunded' && (
          <span className="text-xs text-gray-500">Returned to your wallet</span>
        )}
      </div>
    </div>
  );
};

/** Read-only escrow summary used on student-facing screens. */
export const EscrowSummary = ({ escrow }) => {
  if (!escrow) return null;
  const cfg = STATUS_STYLES[escrow.status] || { label: escrow.status, className: 'bg-gray-100 text-gray-700' };
  return (
    <div className="flex items-center gap-2 text-sm">
      <EscrowBadge status={escrow.status} />
      <span className="text-gray-700">₹{escrow.amount}</span>
      <span className="text-xs text-gray-500">{cfg.hint}</span>
    </div>
  );
};
