import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';
import {
  WalletIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  BanknotesIcon,
  CurrencyRupeeIcon
} from '@heroicons/react/24/outline';

const Wallet = () => {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    fetchWallet();
    fetchTransactions();
  }, [pagination.page]);

  const fetchWallet = async () => {
    try {
      const response = await api.get('/wallet');
      setWallet(response.data.wallet);
    } catch (error) {
      console.error('Failed to fetch wallet:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await api.get(`/wallet/transactions?page=${pagination.page}&limit=10`);
      setTransactions(response.data.transactions);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) < 100) {
      toast.error('Minimum withdrawal amount is ₹100');
      return;
    }

    setWithdrawing(true);
    try {
      await api.post('/wallet/withdraw', {
        amount: parseFloat(withdrawAmount),
        payment_method: 'bank_transfer',
        payment_details: {}
      });
      toast.success('Withdrawal request submitted!');
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      fetchWallet();
      fetchTransactions();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Withdrawal failed');
    } finally {
      setWithdrawing(false);
    }
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'credit':
      case 'escrow_release':
        return <ArrowDownIcon className="h-5 w-5 text-green-600" />;
      case 'debit':
      case 'escrow_lock':
      case 'withdrawal':
        return <ArrowUpIcon className="h-5 w-5 text-red-600" />;
      default:
        return <CurrencyRupeeIcon className="h-5 w-5 text-gray-600" />;
    }
  };

  const getTransactionColor = (type) => {
    switch (type) {
      case 'credit':
      case 'escrow_release':
        return 'text-green-600';
      case 'debit':
      case 'escrow_lock':
      case 'withdrawal':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) return <LoadingSpinner text="Loading wallet..." />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Wallet</h1>

      {/* Wallet Balance */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card bg-gradient-to-r from-primary-600 to-primary-700 text-white">
          <div className="flex items-center gap-3 mb-2">
            <WalletIcon className="h-8 w-8" />
            <span className="text-primary-100">Available Balance</span>
          </div>
          <div className="text-3xl font-bold">₹{wallet?.balance || 0}</div>
          <button
            onClick={() => setShowWithdrawModal(true)}
            className="mt-4 bg-white text-primary-600 px-4 py-2 rounded-lg font-medium hover:bg-primary-50"
          >
            Withdraw
          </button>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <BanknotesIcon className="h-8 w-8 text-green-600" />
            <span className="text-gray-500">Total Earned</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">₹{wallet?.total_earned || 0}</div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <ArrowUpIcon className="h-8 w-8 text-orange-600" />
            <span className="text-gray-500">Locked in Escrow</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">₹{wallet?.locked_balance || 0}</div>
        </div>
      </div>

      {/* Transactions */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Transaction History</h2>

        {transactions.length > 0 ? (
          <>
            <div className="space-y-3">
              {transactions.map((txn) => (
                <div key={txn.id} className="flex items-center justify-between p-4 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-gray-100">
                      {getTransactionIcon(txn.transaction_type)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{txn.description}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(txn.created_at).toLocaleDateString()} • {txn.transaction_type}
                      </p>
                    </div>
                  </div>
                  <div className={`text-lg font-semibold ${getTransactionColor(txn.transaction_type)}`}>
                    {txn.transaction_type === 'credit' || txn.transaction_type === 'escrow_release' ? '+' : '-'}₹{txn.amount}
                  </div>
                </div>
              ))}
            </div>

            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.pages}
              onPageChange={(page) => setPagination({ ...pagination, page })}
            />
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <CurrencyRupeeIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>No transactions yet</p>
          </div>
        )}
      </div>

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowWithdrawModal(false)} />
            <div className="relative bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Withdraw Funds</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (Min ₹100)
                </label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="input-field"
                  placeholder="Enter amount"
                  min="100"
                  max={wallet?.balance || 0}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowWithdrawModal(false)}
                  className="btn-outline"
                >
                  Cancel
                </button>
                <button
                  onClick={handleWithdraw}
                  disabled={withdrawing}
                  className="btn-primary"
                >
                  {withdrawing ? 'Processing...' : 'Withdraw'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Wallet;
