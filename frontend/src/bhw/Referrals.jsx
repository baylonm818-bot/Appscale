import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axiosClient from '../api/axiosClient';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';

const severityPriority = { high: 0, medium: 1, low: 2 };

const serviceOptions = [
  { value: '', label: 'General Follow-up / Health Consultation' },
  { value: 'vitamin_a', label: 'Vitamin A Supplementation' },
  { value: 'deworming', label: 'Deworming Tablet' },
  { value: 'feeding', label: 'Supplementary Feeding' },
  { value: 'checkup', label: 'RHU Medical Consultation' },
];

function Referrals() {
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

  const { data, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ['referrals', user.barangay || ''],
    queryFn: async () => {
      const res = await axiosClient.get('/bhw/referrals', { params: { barangay: user.barangay } });
      return res.data || [];
    },
    staleTime: 1000 * 20,
    gcTime: 1000 * 60 * 2,
    refetchInterval: 12000,
  });
  const referrals = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const loading = isLoading && !data;
  const error = queryError ? (queryError.response?.data?.message || 'Failed to load referrals.') : '';

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
      });
      setActionTarget(null);
      await refetch();
    } catch (_err) {
      setActionError('Failed to update referral status. Please try again.');
    } finally {
      setActionSubmitting(false);
    }
  };

  const pendingCount = referrals.filter((r) => normalizeStatus(r.status) === 'Pending').length;
  const ongoingCount = referrals.filter((r) => normalizeStatus(r.status) === 'Ongoing').length;
  const highSevCount = referrals.filter((r) => r.severity === 'high').length;
  const completedCount = referrals.filter((r) => normalizeStatus(r.status) === 'Completed').length;

  if (loading) {
    return (
      <div className="space-y-6 bg-gray-50 min-h-screen p-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-white p-4 shadow-sm border border-gray-100 animate-pulse" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-white p-4 shadow-sm border border-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <main role="main" aria-label="Referrals" className="space-y-6 bg-gray-50 min-h-screen p-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-3 font-medium">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => { setStatusFilter('all'); setSeverityFilter('all'); }}
          className={`text-left rounded-2xl p-4 shadow-sm border transition cursor-pointer ${
            statusFilter === 'all' && severityFilter === 'all'
              ? 'bg-green-50 border-green-300 ring-2 ring-green-600'
              : 'bg-white border-gray-100 hover:border-gray-200'
          }`}
        >
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total Referrals</p>
          <p className="text-2xl font-black text-gray-800 mt-1">{referrals.length}</p>
          <p className="text-[11px] text-gray-400">All cases</p>
        </button>
        <button
          type="button"
          onClick={() => { setStatusFilter('Pending'); setSeverityFilter('all'); }}
          className={`text-left rounded-2xl p-4 shadow-sm border transition cursor-pointer ${
            statusFilter === 'Pending' && severityFilter === 'all'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500'
              : 'bg-white border-amber-100 hover:border-amber-200'
          }`}
        >
          <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Pending</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{pendingCount}</p>
          <p className="text-[11px] text-amber-600">Awaiting action</p>
        </button>
        <button
          type="button"
          onClick={() => { setStatusFilter('Ongoing'); setSeverityFilter('all'); }}
          className={`text-left rounded-2xl p-4 shadow-sm border transition cursor-pointer ${
            statusFilter === 'Ongoing' && severityFilter === 'all'
              ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500'
              : 'bg-white border-blue-100 hover:border-blue-200'
          }`}
        >
          <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Ongoing</p>
          <p className="text-2xl font-black text-blue-600 mt-1">{ongoingCount}</p>
          <p className="text-[11px] text-blue-600">In-progress</p>
        </button>
        <button
          type="button"
          onClick={() => { setSeverityFilter('high'); setStatusFilter('all'); }}
          className={`text-left rounded-2xl p-4 shadow-sm border transition cursor-pointer ${
            severityFilter === 'high'
              ? 'bg-red-50 border-red-300 ring-2 ring-red-500'
              : 'bg-white border-red-100 hover:border-red-200'
          }`}
        >
          <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wider">High Severity</p>
          <p className="text-2xl font-black text-red-600 mt-1">{highSevCount}</p>
          <p className="text-[11px] text-red-600">Urgent cases</p>
        </button>
        <button
          type="button"
          onClick={() => { setStatusFilter('Completed'); setSeverityFilter('all'); }}
          className={`text-left rounded-2xl p-4 shadow-sm border transition cursor-pointer ${
            statusFilter === 'Completed' && severityFilter === 'all'
              ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500'
              : 'bg-white border-emerald-100 hover:border-emerald-200'
          }`}
        >
          <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Completed</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{completedCount}</p>
          <p className="text-[11px] text-emerald-600">Resolved</p>
        </button>
      </div>

      {/* ── Status Tabs & Sort Controls ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => { setStatusFilter('all'); setSeverityFilter('all'); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              statusFilter === 'all' && severityFilter === 'all'
                ? 'bg-[#1b5e20] text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            All Cases ({referrals.length})
          </button>
          <button
            type="button"
            onClick={() => { setStatusFilter('Pending'); setSeverityFilter('all'); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'Pending' && severityFilter === 'all'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-amber-700 hover:bg-amber-50'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => { setStatusFilter('Ongoing'); setSeverityFilter('all'); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'Ongoing' && severityFilter === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-blue-700 hover:bg-blue-50'
            }`}
          >
            Ongoing ({ongoingCount})
          </button>
          <button
            type="button"
            onClick={() => { setStatusFilter('Completed'); setSeverityFilter('all'); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'Completed' && severityFilter === 'all'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            Completed ({completedCount})
          </button>
          <button
            type="button"
            onClick={() => { setSeverityFilter('high'); setStatusFilter('all'); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              severityFilter === 'high'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-red-700 hover:bg-red-50'
            }`}
          >
            High Severity ({highSevCount})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-gray-700 focus:outline-none focus:border-[#2e7d32]"
          >
            <option value="severity">Severity (High first)</option>
            <option value="date">Date (Newest first)</option>
          </select>
        </div>
      </div>

      <div className="divide-y divide-gray-50 p-4 space-y-3">
        {filteredReferrals.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-xs">No referrals found matching the selected filters.</div>
        ) : (
          filteredReferrals.map((r) => {
            const isChild = r.child_id != null || r.beneficiary_type === 'child';
            const typeLabel = isChild ? 'Child Health Referral' : 'Maternal Health Referral';
            const cleanNote = r.notes ? String(r.notes).replace(/Facility:\s*\d+\s+Facility:\s*/gi, 'Facility: ').replace(/(Facility:\s*)+/gi, 'Facility: ').trim() : '';
            const sev = String(r.severity || 'medium').toLowerCase();
            const sevClass = sev === 'high' ? 'bg-red-100 text-red-800 border-red-200' : sev === 'low' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-800 border-amber-200';
            const normStatus = normalizeStatus(r.status);
            const statusClass = normStatus === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : normStatus === 'Ongoing' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200';

            return (
              <div key={r.referral_id} className="p-4 rounded-xl border border-gray-100 hover:border-gray-200 transition bg-white space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-gray-900">{(r.beneficiary_first_name || '') + ' ' + (r.beneficiary_last_name || '')}</span>
                      <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${isChild ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-pink-50 text-pink-700 border-pink-200'}`}>
                        {typeLabel}
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${sevClass}`}>
                        {sev} severity
                      </span>
                      <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${statusClass}`}>
                        {normStatus}
                      </span>
                      <span className="text-[11px] text-gray-400">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    {r.reason && <p className="text-xs text-gray-800 font-medium">Reason: {r.reason}</p>}
                    {cleanNote && <p className="text-xs text-gray-600 italic">"{cleanNote}"</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button aria-label={`Update status for ${r.beneficiary_first_name} ${r.beneficiary_last_name}`} type="button" onClick={() => openActionModal(r)} className="bg-linear-to-r from-[#1b5e20] to-[#2e7d32] hover:from-[#154a1a] hover:to-[#256427] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-white">Update Status</button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {actionTarget && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-9999 p-4 overflow-hidden" onClick={() => setActionTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="bg-linear-to-r from-[#1b5e20] to-[#2e7d32] px-6 py-5 flex items-center justify-between text-white shrink-0">
              <div>
                <h3 className="font-bold text-base">Update Referral Status</h3>
                <p className="text-xs text-white/80 mt-0.5">Beneficiary: {(actionTarget.beneficiary_first_name || '') + ' ' + (actionTarget.beneficiary_last_name || '')}</p>
              </div>
              <button onClick={() => setActionTarget(null)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"><X size={16} /></button>
            </div>

            <div className="p-6 space-y-3.5 overflow-y-auto flex-1">
              {actionError && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200 font-medium">{actionError}</div>}

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Referral Status *</label>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32] font-semibold">
                  <option value="Pending">Pending</option>
                  <option value="Ongoing">Ongoing</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              {newStatus === 'Ongoing' && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Service Provided</label>
                  <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32]">
                    <option value="">Select service</option>
                    {serviceOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block mt-3">Service Date</label>
                  <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32]" />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Response Notes</label>
                <textarea rows={3} placeholder="Optional notes" value={responseNotes} onChange={(e) => setResponseNotes(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32] resize-none" />
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-white flex gap-3 pt-2 sticky bottom-0">
              <button type="button" onClick={() => setActionTarget(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50">Cancel</button>
              <button type="button" disabled={actionSubmitting} onClick={submitStatusUpdate} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-linear-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:opacity-60">{actionSubmitting ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>, document.body
      )}
    </main>
  );
}

export default Referrals;
