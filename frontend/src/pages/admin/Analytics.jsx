import { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import {
  ChartBarIcon,
  UsersIcon,
  CurrencyRupeeIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';

const PERIODS = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' }
];

const fmtDay = (iso, period) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return period === '90d'
    ? d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
    : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
};

const Card = ({ icon: Icon, label, value, tone = 'text-gray-900' }) => (
  <div className="card">
    <div className="flex items-center gap-2 mb-1">
      <Icon className="h-4 w-4 text-gray-400" />
      <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
    </div>
    <div className={`text-2xl font-bold ${tone}`}>{value}</div>
  </div>
);

/**
 * Admin platform analytics. Everything here is derived from live tables, so
 * the charts are populated from the first request rather than depending on a
 * scheduled rollup having run.
 */
const Analytics = () => {
  const [period, setPeriod] = useState('30d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .get(`/analytics/platform?period=${period}`)
      .then((res) => {
        if (!cancelled) setData(res.data.analytics);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.response?.data?.error || 'Could not load analytics');
          setData(null);
        }
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [period]);

  if (loading) {
    return (
      <div className="grid md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="card h-24 animate-pulse bg-gray-100" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card border-red-200 bg-red-50">
        <p className="text-sm text-red-800">{error}</p>
      </div>
    );
  }

  const totals = data?.totals || {};
  const trends = data?.trends || [];
  const escrow = data?.escrow || [];
  const active = data?.users?.active ?? 0;
  const newUsers = data?.users?.new ?? 0;

  const escrowTotal = escrow.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const escrowHeld = escrow
    .filter((e) => e.status === 'locked')
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const activityData = trends.map((t) => ({
    day: fmtDay(t.day, period),
    Doubts: t.doubts,
    Answers: t.answers,
    Applications: t.applications
  }));

  const signupsData = trends.map((t) => ({
    day: fmtDay(t.day, period),
    'New students': t.new_users
  }));

  const hasActivity = trends.some(
    (t) => t.doubts || t.answers || t.applications || t.new_users
  );

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          icon={UsersIcon}
          label="Active users"
          value={active}
          tone={active > 0 ? 'text-green-600' : 'text-gray-400'}
        />
        <Card icon={UsersIcon} label={`New (${data?.interval || period})`} value={newUsers} />
        <Card icon={ChatBubbleLeftRightIcon} label="Total doubts" value={totals.doubts ?? 0} />
        <Card
          icon={CurrencyRupeeIcon}
          label="Paid out"
          value={`₹${Number(totals.paid_out || 0).toLocaleString()}`}
        />
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              period === p.key
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {!hasActivity ? (
        <div className="card text-center py-10">
          <ChartBarIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-600 font-medium">No activity in this period</p>
          <p className="text-sm text-gray-500 mt-1">
            Try a longer range, or post a doubt to see the chart fill in.
          </p>
        </div>
      ) : (
        <>
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Doubts, answers & applications</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Doubts" fill="#6366f1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Answers" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Applications" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">New student signups</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={signupsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="New students"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Escrow breakdown */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Escrow</h3>
          <span className="text-sm text-gray-500">
            ₹{escrowHeld.toLocaleString()} held of ₹{escrowTotal.toLocaleString()} total
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {escrow.map((e) => (
            <div key={e.status} className="p-3 border border-gray-100 rounded-lg">
              <p className="text-xs text-gray-500 capitalize">{e.status}</p>
              <p className="text-lg font-bold text-gray-900">{e.count}</p>
              <p className="text-xs text-gray-500">₹{Number(e.amount || 0).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
