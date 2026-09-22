import { useState, useEffect, useMemo } from 'react';
import axiosClient from '../api/axiosClient';
import { Users, ArrowUpDown, X, CheckCircle2, Clock, AlertTriangle, MessageSquare, ChevronRight } from 'lucide-react';

const severityColors = {
  low: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  medium: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  high: 'bg-red-100 text-red-800 ring-1 ring-red-200',
};

const severityPriority = { high: 0, medium: 1, low: 2 };

const statusColors = {
  pending: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  responded: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  closed: 'bg-gray-100 text-gray-700 ring-1 ring-gray-200',
};

const serviceOptions = [
  { value: '', label: 'No medicine / direct evaluation' },
  { value: 'vitamin_a', label: 'Vitamin A Supplementation' },
  { value: 'deworming', label: 'Deworming Tablet' },
  { value: 'feeding', label: 'Supplementary Feeding' },
  { value: 'checkup', label: 'RHU Medical Consultation' },
];

function daysSince(dateStr) {
  if (!dateStr) return null;
  const diffMs = new Date() - new Date(dateStr);
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function Referrals() {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');

  // filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('severity');

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
      setReferrals(response.data || []);
    } catch {
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
        (a, b) => (severityPriority[a.severity] ?? 9) - (severityPriority[b.severity] ?? 9)
      );
    } else if (sortBy === 'date') {
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    return list;
  }, [referrals, statusFilter, severityFilter, sortBy]);

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
    } catch {
      setRespondError('Failed to record response. Please try again.');
    } finally {
      setRespondSubmitting(false);
    }
  };

  const closeReferral = async (id) => {
    if (!window.confirm('Are you sure you want to close and resolve this referral?')) return;
    try {
      await axiosClient.patch(`/bhw/referrals/${id}/status`, { status: 'closed' });
      fetchData();
    } catch {
      alert('Failed to update referral.');
    }
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

  const pendingCount = referrals.filter((r) => r.status === 'pending').length;
  const highSevCount = referrals.filter((r) => r.severity === 'high').length;
  const respondedCount = referrals.filter((r) => r.status === 'responded').length;

  return (
    <div className="space-y-6">

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Referrals</p>
          <p className="text-3xl font-black text-gray-800 mt-2">{referrals.length}</p>
          <p className="text-xs text-gray-400 mt-1">All recorded cases</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-amber-100">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Pending Action</p>
          <p className="text-3xl font-black text-amber-600 mt-2">{pendingCount}</p>
          <p className="text-xs text-amber-500 mt-1">Awaiting BHW follow-up</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-red-100">
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">High Severity</p>
          <p className="text-3xl font-black text-red-600 mt-2">{highSevCount}</p>
          <p className="text-xs text-red-400 mt-1">Urgent attention needed</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-emerald-100">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Responded</p>
          <p className="text-3xl font-black text-emerald-600 mt-2">{respondedCount}</p>
          <p className="text-xs text-emerald-500 mt-1">Services logged</p>
        </div>
      </div>

      {/* ── Controls & List ── */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">

        {/* Filter bar */}
        <div className="p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-gray-50/40">
          {/* Status Tabs */}
          <div className="flex gap-1 bg-white p-1 rounded-xl border border-gray-200">
            {[
              { val: 'all', lbl: 'All' },
              { val: 'pending', lbl: `Pending (${pendingCount})` },
              { val: 'responded', lbl: 'Responded' },
              { val: 'closed', lbl: 'Closed' },
            ].map(({ val, lbl }) => (
              <button
                key={val}
                type="button"
                onClick={() => setStatusFilter(val)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
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
              const overdueDays = r.status === 'pending' ? daysSince(r.created_at) : null;
              const isOverdue = overdueDays !== null && overdueDays > 7;

              return (
                <div
                  key={r.referral_id}
                  className="p-5 rounded-2xl bg-white border border-gray-100 hover:border-green-200 hover:bg-green-50/20 transition-all shadow-xs"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-[260px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-gray-900 text-sm">
                          {r.child_first_name} {r.child_last_name}
                        </h4>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${severityColors[r.severity] || 'bg-gray-100'}`}>
                          {r.severity} Priority
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusColors[r.status] || 'bg-gray-100'}`}>
                          {r.status}
                        </span>
                        {isOverdue && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                            Overdue ({overdueDays}d)
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-gray-700 leading-relaxed font-medium">
                        Reason: {r.reason}
                      </p>

                      {r.response_notes && (
                        <div className="mt-2 p-3 bg-emerald-50/80 border border-emerald-100 rounded-xl text-xs text-emerald-900">
                          <p className="font-bold">Intervention / Response Note:</p>
                          <p className="mt-0.5">{r.response_notes}</p>
                        </div>
                      )}

                      <p className="text-[11px] text-gray-400 pt-1">
                        Guardian: {r.guardian_name || '—'} · Referred by: {r.referred_by_name || r.referred_by || 'BNS/RHU'} · {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>

                    {r.status !== 'closed' && (
                      <div className="flex items-center gap-2 shrink-0">
                        {r.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => openRespondModal(r)}
                            className="bg-gradient-to-r from-[#1b5e20] to-[#2e7d32] hover:from-[#154a1a] hover:to-[#256427] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs"
                          >
                            Log Response
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => closeReferral(r.referral_id)}
                          className="border border-gray-200 text-gray-600 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-gray-50 transition"
                        >
                          Resolve & Close
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* ── Respond Modal ── */}
      {respondTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={() => setRespondTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-[#1b5e20] to-[#2e7d32] px-6 py-5 flex items-center justify-between text-white">
              <div>
                <h3 className="font-bold text-base">Respond to Referral</h3>
                <p className="text-xs text-white/80 mt-0.5">{respondTarget.child_first_name} {respondTarget.child_last_name}</p>
              </div>
              <button onClick={() => setRespondTarget(null)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-3.5">
              {respondError && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200 font-medium">{respondError}</div>}

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Service Provided</label>
                <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32]">
                  {serviceOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Date Action Taken *</label>
                <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32]" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Response / Observation Notes *</label>
                <textarea rows={3} placeholder="Describe the health intervention given, medicines provided, or RHU doctor feedback…" value={responseNotes} onChange={(e) => setResponseNotes(e.target.value)} required className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32] resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setRespondTarget(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50">Cancel</button>
                <button type="button" disabled={respondSubmitting || !responseNotes.trim()} onClick={submitResponse} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#1b5e20] to-[#2e7d32] hover:from-[#154a1a] hover:to-[#256427] disabled:opacity-60">
                  {respondSubmitting ? 'Saving…' : 'Submit Response'}
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