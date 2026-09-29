import { useState, useEffect, useMemo } from 'react';
import axiosClient from '../api/axiosClient';
import { ArrowUpDown, X, CheckCircle2, Clock, AlertTriangle, ChevronRight, RefreshCw } from 'lucide-react';

const severityColors = {
  low: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  medium: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  high: 'bg-red-100 text-red-800 ring-1 ring-red-200',
};

const severityPriority = { high: 0, medium: 1, low: 2 };

// Module 4 Requirement: "The system shall allow BHW to update referral status (Pending, Ongoing, Cancelled, Completed)."
const statusColors = {
  Pending: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  Ongoing: 'bg-blue-100 text-blue-800 ring-1 ring-blue-200',
  Cancelled: 'bg-rose-100 text-rose-800 ring-1 ring-rose-200',
  Completed: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  // Backward compatibility
  pending: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  responded: 'bg-blue-100 text-blue-800 ring-1 ring-blue-200',
  closed: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
};

const serviceOptions = [
  { value: '', label: 'General Follow-up / Health Consultation' },
  { value: 'vitamin_a', label: 'Vitamin A Supplementation' },
  { value: 'deworming', label: 'Deworming Tablet' },
  { value: 'feeding', label: 'Supplementary Feeding' },
  { value: 'checkup', label: 'RHU Medical Consultation' },
];

function Referrals() {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  let user = {};
  try {
    user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
  } catch {
    user = {};
  }

  // filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('severity');

  // update status modal
  const [actionTarget, setActionTarget] = useState(null);
  const [newStatus, setNewStatus] = useState('Ongoing');
  const [responseNotes, setResponseNotes] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');

  const fetchData = async (isBackground = false) => {
    if (!user?.barangay) {
      setError('No barangay is assigned to this account.');
      setLoading(false);
      return;
    }

    try {
      const response = await axiosClient.get('/bhw/referrals', {
        params: { barangay: user.barangay },
      });
      setReferrals(response.data || []);
      setError('');
    } catch {
      if (!isBackground) setError('Failed to load referrals.');
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Real-time automatic polling every 12 seconds
    // Module 4: "The system shall send real-time notifications to Barangay Health Workers (BHW) upon receiving referrals from BNS."
    const interval = setInterval(() => {
      fetchData(true);
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  const normalizeStatus = (s) => {
    const lower = String(s || '').toLowerCase();
    if (lower === 'pending') return 'Pending';
    if (lower === 'ongoing' || lower === 'responded') return 'Ongoing';
    if (lower === 'cancelled') return 'Cancelled';
    if (lower === 'completed' || lower === 'closed') return 'Completed';
    return s || 'Pending';
  };

  const filteredReferrals = useMemo(() => {
    let list = [...referrals];

    if (statusFilter !== 'all') {
      list = list.filter((r) => normalizeStatus(r.status) === statusFilter);
    }
    if (severityFilter !== 'all') {
      list = list.filter((r) => r.severity === severityFilter);
    }

    if (sortBy === 'severity') {
      list.sort(
        (a, b) => (severityPriority[a.severity] ?? 9) - (severityPriority[b.severity] ?? 9)
      );
    } else if (sortBy === 'date') {
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    return list;
  }, [referrals, statusFilter, severityFilter, sortBy]);

  const openActionModal = (r) => {
    setActionTarget(r);
    const curr = normalizeStatus(r.status);
    setNewStatus(curr === 'Pending' ? 'Ongoing' : curr);
    setResponseNotes(r.response_notes || '');
    setServiceType('');
    setServiceDate(new Date().toISOString().slice(0, 10));
    setActionError('');
  };

  const submitStatusUpdate = async () => {
    if (!actionTarget) return;
    setActionSubmitting(true);
    setActionError('');
    try {
      await axiosClient.patch(`/bhw/referrals/${actionTarget.referral_id}/status`, {
        status: newStatus,
        response_notes: responseNotes,
        service_type: serviceType || null,
        service_date: serviceDate,
        provided_by: user.first_name ? `${user.first_name} ${user.last_name || ''}` : 'BHW',
      });
      setActionTarget(null);
      fetchData();
    } catch {
      setActionError('Failed to update referral status. Please try again.');
    } finally {
      setActionSubmitting(false);
    }
  };

  const getBeneficiaryDisplay = (r) => {
    const isMother = r.beneficiary_type === 'mother';
    const firstName = isMother
      ? r.mother_first_name || r.beneficiary_first_name || ''
      : r.child_first_name || r.beneficiary_first_name || '';
    const lastName = isMother
      ? r.mother_last_name || r.beneficiary_last_name || ''
      : r.child_last_name || r.beneficiary_last_name || '';
    return `${firstName} ${lastName}`.trim();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-10 h-10 rounded-full border-4 border-green-200 border-t-green-600 animate-spin" />
        <p className="text-sm font-medium text-gray-400">Loading referrals…</p>
      </div>
    );
  }

  if (error) return <p className="text-red-600 p-6">{error}</p>;

  const pendingCount = referrals.filter((r) => normalizeStatus(r.status) === 'Pending').length;
  const ongoingCount = referrals.filter((r) => normalizeStatus(r.status) === 'Ongoing').length;
  const highSevCount = referrals.filter((r) => r.severity === 'high').length;
  const completedCount = referrals.filter((r) => normalizeStatus(r.status) === 'Completed').length;
  const cancelledCount = referrals.filter((r) => normalizeStatus(r.status) === 'Cancelled').length;

  return (
    <div className="space-y-6">

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total Referrals</p>
          <p className="text-2xl font-black text-gray-800 mt-1">{referrals.length}</p>
          <p className="text-[11px] text-gray-400">All cases</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-amber-100">
          <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Pending</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{pendingCount}</p>
          <p className="text-[11px] text-amber-500">Needs action</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-blue-100">
          <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Ongoing</p>
          <p className="text-2xl font-black text-blue-600 mt-1">{ongoingCount}</p>
          <p className="text-[11px] text-blue-500">In progress</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-red-100">
          <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wider">High Severity</p>
          <p className="text-2xl font-black text-red-600 mt-1">{highSevCount}</p>
          <p className="text-[11px] text-red-400">Immediate care</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-100">
          <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Completed</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{completedCount}</p>
          <p className="text-[11px] text-emerald-500">Resolved</p>
        </div>
      </div>

      {/* ── Controls & List ── */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">

        {/* Filter bar */}
        <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-gray-50/40">
          {/* Status Tabs */}
          <div className="flex flex-wrap gap-1 bg-white p-1 rounded-xl border border-gray-200">
            {[
              { val: 'all', lbl: 'All' },
              { val: 'Pending', lbl: `Pending (${pendingCount})` },
              { val: 'Ongoing', lbl: `Ongoing (${ongoingCount})` },
              { val: 'Cancelled', lbl: `Cancelled (${cancelledCount})` },
              { val: 'Completed', lbl: `Completed (${completedCount})` },
            ].map(({ val, lbl }) => (
              <button
                key={val}
                type="button"
                onClick={() => setStatusFilter(val)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === val
                    ? 'bg-[#2e7d32] text-white shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 bg-white"
            >
              <option value="all">All Severity Levels</option>
              <option value="high">High Severity</option>
              <option value="medium">Medium Severity</option>
              <option value="low">Low Severity</option>
            </select>

            <button
              type="button"
              onClick={() => setSortBy((prev) => (prev === 'severity' ? 'date' : 'severity'))}
              className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-600 bg-white hover:bg-gray-50 transition"
            >
              <ArrowUpDown size={13} />
              {sortBy === 'severity' ? 'Severity' : 'Date'}
            </button>

            <button
              type="button"
              onClick={() => fetchData()}
              title="Refresh Referrals"
              className="p-2 border border-gray-200 rounded-xl text-gray-600 bg-white hover:bg-gray-50 transition"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="divide-y divide-gray-50 p-4 space-y-3">
          {filteredReferrals.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-xs">
              No referrals found matching the selected filters.
            </div>
          ) : (
            filteredReferrals.map((r) => {
              const currentStatus = normalizeStatus(r.status);
              return (
                <div key={r.referral_id} className="p-4 rounded-xl border border-gray-100 hover:border-gray-200 transition bg-white space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-gray-900">{getBeneficiaryDisplay(r)}</span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {r.beneficiary_type === 'mother' ? 'Lactating Mother' : 'Child'}
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${severityColors[r.severity] || 'bg-gray-100'}`}>
                          {r.severity} Severity
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${statusColors[currentStatus] || 'bg-gray-100'}`}>
                          {currentStatus}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1 font-medium">{r.reason}</p>
                      {r.response_notes && (
                        <p className="text-xs text-gray-500 mt-1 bg-gray-50 p-2 rounded-lg border border-gray-100">
                          <strong className="text-gray-700">BHW Response:</strong> {r.response_notes}
                        </p>
                      )}
                      <p className="text-[11px] text-gray-400 mt-1">
                        Referred on {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openActionModal(r)}
                        className="bg-linear-to-r from-[#1b5e20] to-[#2e7d32] hover:from-[#154a1a] hover:to-[#256427] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs"
                      >
                        Update Status
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* ── Status Update Modal ── */}
      {actionTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={() => setActionTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] my-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="bg-linear-to-r from-[#1b5e20] to-[#2e7d32] px-6 py-5 flex items-center justify-between text-white">
              <div>
                <h3 className="font-bold text-base">Update Referral Status</h3>
                <p className="text-xs text-white/80 mt-0.5">
                  Beneficiary: {getBeneficiaryDisplay(actionTarget)}
                </p>
              </div>
              <button onClick={() => setActionTarget(null)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-3.5">
              {actionError && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200 font-medium">{actionError}</div>}

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Referral Status *</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32] font-semibold"
                >
                  <option value="Pending">Pending</option>
                  <option value="Ongoing">Ongoing</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              {newStatus === 'Ongoing' && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Service / Intervention Given</label>
                  <select
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32]"
                  >
                    {serviceOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Action Date *</label>
                <input
                  type="date"
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Response / Intervention Notes</label>
                <textarea
                  rows={3}
                  placeholder="Record medical actions taken, supplements provided, or feedback…"
                  value={responseNotes}
                  onChange={(e) => setResponseNotes(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32] resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setActionTarget(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionSubmitting}
                  onClick={submitStatusUpdate}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-linear-to-r from-[#1b5e20] to-[#2e7d32] hover:from-[#154a1a] hover:to-[#256427] disabled:opacity-60"
                >
                  {actionSubmitting ? 'Saving…' : 'Save Status'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Referrals;