import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import Badge from '../../components/common/Badge';
import {
  BanknotesIcon,
  CheckIcon,
  XIcon
} from '@heroicons/react/24/outline';

/**
 * Withdrawal requests awaiting a decision.
 *
 * A withdrawal locks the amount out of the user's available balance the moment
 * it is requested, so until somebody acts on it that money is simply held. With
 * no way to approve or reject, every request stayed pending forever and the
 * funds were stranded, so this page is what closes the loop.
 *
 * Approving releases the hold. The balance was already reduced when the request
 * was made, so it is deliberately not reduced again here. Rejecting puts the
 * amount back, because no money ever moved.
 */
const AdminWithdrawals = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [filter, setFilter] = useState('pending');

  useEffect(() => {
    fetchWithdrawals();
  }, [filter]);

  const fetchWithdrawals = async () => {
    setLoading(true);
    try {
      const res = await api.get('/wallet/admin/withdrawals?limit=50' + (filter ? '&status=' + filter : ''));
      setRows(res.data.withdrawals || []);
    } catch (error) {
      console.error('Failed to load withdrawals:', error);
      toast.error(error.response?.data?.error || 'Could not load withdrawals');
    } finally {
      setLoading(false);
    }
  };

  const decide = async (id, action) => {
    let reason;
    if (action === 'reject') {
      const entered = window.prompt('Why is this withdrawal being rejected?');
      if (entered === null) return;
      reason = entered;
    }
    setBusyId(id);
    try {
      await api.patch('/wallet/admin/withdrawals/' + id, { action, reason });
      toast.success(action === 'approve' ? 'Withdrawal paid out' : 'Withdrawal rejected and refunded');
      fetchWithdrawals();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not process the withdrawal');
    } finally {
      setBusyId(null);
    }
  };

  const getStatusVariant = (status) => {
    if (status === 'pending') return 'warning';
    if (status === 'approved') return 'success';
    if (status === 'rejected') return 'danger';
    return 'gray';
  };

  if (loading) return <LoadingSpinner text="Loading withdrawals..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Withdrawal Requests</h1>
        <p className="text-gray-500">
          Approving releases the hold on the amount. Rejecting returns it to the
          user&rsquo;s balance, because no money has left at this point.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {['pending', 'approved', 'rejected', 'all'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={
              'px-4 py-2 rounded-lg font-medium capitalize whitespace-nowrap ' +
              (filter === s
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
            }
          >
            {s}
          </button>
        ))}
      </div>

      {rows.length > 0 ? (
        <div className="space-y-3">
          {rows.map((w) => (
            <div key={w.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-2 mb-1">
                    <BanknotesIcon className="h-5 w-5 text-primary-600" />
                    <span className="font-semibold text-gray-900">
                      ₹{parseFloat(w.amount).toFixed(2)}
                    </span>
                    <Badge variant={getStatusVariant(w.status)} size="sm">
                      {w.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{w.email}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {w.payment_method || 'no method given'}
                    {' · requested '}
                    {new Date(w.created_at).toLocaleString()}
                  </p>
                  {w.payment_details && Object.keys(w.payment_details).length > 0 && (
                    <p className="text-xs text-gray-500 mt-1 break-all">
                      {Object.entries(w.payment_details)
                        .map(([k, v]) => k + ': ' + v)
                        .join(' · ')}
                    </p>
                  )}
                  {w.rejection_reason && (
                    <p className="text-xs text-red-600 mt-1">
                      Reason: {w.rejection_reason}
                    </p>
                  )}
                </div>

                {w.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => decide(w.id, 'approve')}
                      disabled={busyId === w.id}
                      className="btn-primary text-sm flex items-center gap-1.5"
                      title="Release the hold and pay this out"
                    >
                      <CheckIcon className="h-4 w-4" />
                      {busyId === w.id ? 'Working...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => decide(w.id, 'reject')}
                      disabled={busyId === w.id}
                      className="btn-outline text-sm flex items-center gap-1.5"
                      title="Return the amount to the user's balance"
                    >
                      <XIcon className="h-4 w-4" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="🏦"
          title={'No ' + filter + ' withdrawals'}
          description="Nothing is waiting on a decision here."
        />
      )}
    </div>
  );
};

export default AdminWithdrawals;
