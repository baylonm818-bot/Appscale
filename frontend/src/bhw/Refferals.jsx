import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { Users, ArrowUpDown, X } from 'lucide-react';

const severityColors = {
  low: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
};

const severityPriority = { high: 0, medium: 1, low: 2 };

const statusColors = {
  pending: 'bg-lime-100 text-lime-700',
  responded: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
};

const serviceOptions = [
  { value: '', label: 'No medicine / refer to RHU' },
  { value: 'vitamin_a', label: 'Vitamin A' },
  { value: 'deworming', label: 'Deworming' },
  { value: 'feeding', label: 'Feeding Program' },
  { value: 'checkup', label: 'General Checkup' },
];

function daysSince(dateStr) {
  if (!dateStr) return null;
  const diffMs = new Date() - new Date(dateStr);
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function Referrals() {
  const navigate = useNavigate();
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');

  // filters
  const [statusFilter, setStatusFilter] = useState('pending'); // default: show actionable ones first
  const [severityFilter, setSeverityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('severity'); // severity | date

  // respond modal
  const [respondTarget, setRespondTarget] = useState(null);
  const [responseNotes, setResponseNotes] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [respondSubmitting, setRespondSubmitting] = useState(false);
  const [respondError, setRespondError] = useState('');

  const fetchData = async () => {
    try {
      const response = await axiosClient.get('/bhw/referrals', {
        params: { barangay: user.barangay },
      });
      setReferrals(response.data);
    } catch (err) {
      setError('Failed to load referrals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredReferrals = useMemo(() => {
    let list = [...referrals];

    if (statusFilter !== 'all') {
      list = list.filter((r) => r.status === statusFilter);
    }
    if (severityFilter !== 'all') {
      list = list.filter((r) => r.severity === severityFilter);
    }

    if (sortBy === 'severity') {
      list.sort(
        (a, b) =>
          (severityPriority[a.severity] ?? 9) - (severityPriority[b.severity] ?? 9)
      );
    } else if (sortBy === 'date') {
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    return list;
  }, [referrals, statusFilter, severityFilter, sortBy]);

  const pendingCount = referrals.filter((r) => r.status === 'pending').length;

  const openRespondModal = (r) => {
    setRespondTarget(r);
    setResponseNotes('');
    setServiceType('');
    setServiceDate(new Date().toISOString().slice(0, 10));
    setRespondError('');
  };

  const submitResponse = async () => {
    if (!respondTarget) return;
    setRespondSubmitting(true);
    setRespondError('');
    try {
      await axiosClient.patch(`/bhw/referrals/${respondTarget.referral_id}/status`, {
        status: 'responded',
        response_notes: responseNotes,
        service_type: serviceType || null,
        service_date: serviceDate,
        provided_by: user.user_id,
      });
      setRespondTarget(null);
      fetchData();
    } catch (err) {
      setRespondError('Failed to submit response. Please try again.');
    } finally {
      setRespondSubmitting(false);
    }
  };

  const closeReferral = async (id) => {
    try {
      await axiosClient.patch(`/bhw/referrals/${id}/status`, { status: 'closed' });
      fetchData();
    } catch (err) {
      alert('Failed to update referral.');
    }
  };

  const goToProfile = (childId) => {
    if (childId) navigate(`/bhw/child/${childId}`);
  };

  if (loading) return <p className="text-gray-500">Loading referrals...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div>
      

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-center">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="responded">Responded</option>
          <option value="closed">Closed</option>
        </select>

        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="all">All Severities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <button
          onClick={() => setSortBy((prev) => (prev === 'severity' ? 'date' : 'severity'))}
          className="text-sm flex items-center gap-1 border border-gray-200 rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-50"
        >
          <ArrowUpDown size={14} />
          Sort: {sortBy === 'severity' ? 'Severity' : 'Newest'}
        </button>
      </div>

      <div className="space-y-3">
        {filteredReferrals.length === 0 ? (
          <p className="text-sm text-gray-400">No referrals found.</p>
        ) : (
          filteredReferrals.map((r) => {
            const overdueDays = r.status === 'pending' ? daysSince(r.created_at) : null;
            const isOverdue = overdueDays !== null && overdueDays > 7;
            return (
              <div
                key={r.referral_id}
                onClick={() => goToProfile(r.child_id)}
                className="bg-white rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-gray-800">
                        {r.child_first_name} {r.child_last_name}
                      </h4>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs capitalize ${
                          severityColors[r.severity] || 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {r.severity} severity
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs capitalize ${statusColors[r.status]}`}
                      >
                        {r.status}
                      </span>
                      {isOverdue && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">
                          Overdue ⚠
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{r.reason}</p>
                    {r.response_notes && (
                      <p className="text-sm text-green-600 mt-1">Response: {r.response_notes}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Guardian: {r.guardian_name || '—'} · Referred by: {r.referred_by || '—'} ·{' '}
                      {new Date(r.created_at).toLocaleDateString()}
                      {overdueDays !== null && ` · ${overdueDays}d ago`}
                    </p>
                  </div>
                  {r.status !== 'closed' && (
                    <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {r.status === 'pending' && (
                        <button
                          onClick={() => openRespondModal(r)}
                          className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-green-700"
                        >
                          Mark Responded
                        </button>
                      )}
                      <button
                        onClick={() => closeReferral(r.referral_id)}
                        className="border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50"
                      >
                        Close
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Respond Modal */}
      {respondTarget && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setRespondTarget(null)}
        >
          <div
            className="bg-white rounded-xl shadow-lg w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-800">
                Respond — {respondTarget.child_first_name} {respondTarget.child_last_name}
              </h3>
              <button
                onClick={() => setRespondTarget(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <label className="block text-xs text-gray-500 mb-1">What was done?</label>
            <textarea
              value={responseNotes}
              onChange={(e) => setResponseNotes(e.target.value)}
              rows={3}
              className="w-full mb-3 text-sm border border-gray-200 rounded-lg px-3 py-2"
              placeholder="e.g. Follow-up visit scheduled, gamot ibinigay"
            />

            <label className="block text-xs text-gray-500 mb-1">Medicine / Service Given</label>
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              className="w-full mb-3 text-sm border border-gray-200 rounded-lg px-3 py-2"
            >
              {serviceOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            {serviceType && (
              <>
                <label className="block text-xs text-gray-500 mb-1">Service Date</label>
                <input
                  type="date"
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  className="w-full mb-3 text-sm border border-gray-200 rounded-lg px-3 py-2"
                />
              </>
            )}

            {respondError && <p className="text-xs text-red-500 mb-2">{respondError}</p>}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRespondTarget(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={submitResponse}
                disabled={respondSubmitting}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {respondSubmitting ? 'Submitting...' : 'Submit Response'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Referrals;