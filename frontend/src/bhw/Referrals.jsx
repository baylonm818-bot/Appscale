import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import axiosClient from '../api/axiosClient';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';

const severityPriority = { high: 0, medium: 1, low: 2 };

const serviceOptions = [
  { value: 'general', label: 'General Follow-up / Health Consultation' },
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

  const [searchParams, setSearchParams] = useSearchParams();
  const urlStatusParam = searchParams.get('status');

  const normalizeFilterParam = (p) => {
    if (!p) return null;
    const lower = p.toLowerCase();
    if (lower === 'pending') return 'Pending';
    if (lower === 'received') return 'Received';
    if (lower === 'ongoing') return 'Ongoing';
    if (lower === 'completed') return 'Completed';
    if (lower === 'archived') return 'Archived';
    if (lower === 'all') return 'all';
    return null;
  };

  const initialStatus = normalizeFilterParam(urlStatusParam);

  // filters
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'child', 'mother'
  const [statusFilter, setStatusFilter] = useState(initialStatus || 'Pending');
  const [userInteractedWithFilter, setUserInteractedWithFilter] = useState(Boolean(initialStatus));
  const [severityFilter, setSeverityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');

  // archive state
  const [rowLoadingId, setRowLoadingId] = useState(null);
  const [batchArchiving, setBatchArchiving] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(null); // { type: 'single'|'batch', id, name, isUnarchive }
  const [toastMessage, setToastMessage] = useState(null); // { text, type: 'success'|'error' }

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // update status modal
  const [actionTarget, setActionTarget] = useState(null);
  const [newStatus, setNewStatus] = useState('Ongoing');
  const [responseNotes, setResponseNotes] = useState('');
  const [selectedServices, setSelectedServices] = useState([]);
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');

  const { data, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ['referrals', user.barangay || ''],
    queryFn: async () => {
      const res = await axiosClient.get('/bhw/referrals', {
        params: { barangay: user.barangay, include_archived: true },
      });
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
    if (lower === 'received') return 'Received';
    if (lower === 'ongoing' || lower === 'responded') return 'Ongoing';
    if (lower === 'cancelled') return 'Cancelled';
    if (lower === 'completed' || lower === 'closed') return 'Completed';
    return s || 'Pending';
  };

  const isMotherReferral = (r) => {
    const t = String(r.referral_type || r.beneficiary_type || '').toLowerCase();
    if (t === 'mother' || t === 'lactating_mother') return true;
    if (r.mother_id && !r.child_id) return true;
    return false;
  };

  const isArchived = (r) => Boolean(r.archived_at || r.is_archived);

  const childReferralsCount = useMemo(() => referrals.filter((r) => !isMotherReferral(r)).length, [referrals]);
  const motherReferralsCount = useMemo(() => referrals.filter((r) => isMotherReferral(r)).length, [referrals]);

  // Default tab rule: Pending if any pending, else Ongoing if any ongoing, else all
  useEffect(() => {
    if (!userInteractedWithFilter && referrals.length > 0) {
      const activeList = referrals.filter((r) => !isArchived(r));
      const hasPending = activeList.some((r) => normalizeStatus(r.status) === 'Pending');
      const hasOngoing = activeList.some((r) => normalizeStatus(r.status) === 'Ongoing');
      if (hasPending) {
        setStatusFilter('Pending');
      } else if (hasOngoing) {
        setStatusFilter('Ongoing');
      } else {
        setStatusFilter('all');
      }
    }
  }, [referrals, userInteractedWithFilter]);

  const handleSelectStatusFilter = (tab) => {
    setUserInteractedWithFilter(true);
    setStatusFilter(tab);
    setSeverityFilter('all');
    setSearchParams(tab === 'all' ? {} : { status: tab }, { replace: true });
  };

  const typeFilteredReferrals = useMemo(() => {
    if (typeFilter === 'child') return referrals.filter((r) => !isMotherReferral(r));
    if (typeFilter === 'mother') return referrals.filter((r) => isMotherReferral(r));
    return referrals;
  }, [referrals, typeFilter]);

  const activeTypeFiltered = useMemo(() => {
    return typeFilteredReferrals.filter((r) => !isArchived(r));
  }, [typeFilteredReferrals]);

  const filteredReferrals = useMemo(() => {
    let list;
    if (statusFilter === 'Archived') {
      list = typeFilteredReferrals.filter(isArchived);
    } else {
      list = [...activeTypeFiltered];
      if (statusFilter !== 'all') {
        list = list.filter((r) => normalizeStatus(r.status) === statusFilter);
      }
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
  }, [typeFilteredReferrals, activeTypeFiltered, statusFilter, severityFilter, sortBy]);

  const confirmArchiveExecution = async () => {
    if (!archiveConfirm) return;
    const { type, id, isUnarchive } = archiveConfirm;
    setArchiveConfirm(null);

    if (type === 'batch') {
      setBatchArchiving(true);
      try {
        const res = await axiosClient.patch('/bhw/referrals/archive-completed', { barangay: user.barangay });
        setToastMessage({ text: res.data?.message || 'Completed referrals archived successfully.', type: 'success' });
        await refetch();
        window.dispatchEvent(new CustomEvent('notifications:updated'));
      } catch (err) {
        setToastMessage({ text: err.response?.data?.message || 'Failed to archive completed referrals.', type: 'error' });
      } finally {
        setBatchArchiving(false);
      }
      return;
    }

    setRowLoadingId(id);
    try {
      if (isUnarchive) {
        await axiosClient.patch(`/bhw/referrals/${id}/unarchive`);
        setToastMessage({ text: 'Referral unarchived successfully.', type: 'success' });
      } else {
        await axiosClient.patch(`/bhw/referrals/${id}/archive`);
        setToastMessage({ text: 'Referral archived successfully.', type: 'success' });
      }
      await refetch();
      window.dispatchEvent(new CustomEvent('notifications:updated'));
    } catch (err) {
      setToastMessage({ text: err.response?.data?.message || `Failed to ${isUnarchive ? 'unarchive' : 'archive'} referral.`, type: 'error' });
    } finally {
      setRowLoadingId(null);
    }
  };

  const handleArchiveRow = (referralId, benName) => {
    setArchiveConfirm({
      type: 'single',
      id: referralId,
      name: benName || 'beneficiary',
      isUnarchive: false,
    });
  };

  const handleUnarchiveRow = (referralId, benName) => {
    setArchiveConfirm({
      type: 'single',
      id: referralId,
      name: benName || 'beneficiary',
      isUnarchive: true,
    });
  };

  const handleBatchArchiveCompleted = () => {
    setArchiveConfirm({
      type: 'batch',
      name: `all completed referrals in ${user.barangay || 'your barangay'}`,
    });
  };

  const openActionModal = (r) => {
    setActionTarget(r);
    const curr = normalizeStatus(r.status);
    setNewStatus(curr === 'Pending' ? 'Ongoing' : curr);
    setResponseNotes(r.response_notes || '');
    setSelectedServices([]);
    setServiceDate(new Date().toISOString().slice(0, 10));
    setActionError('');
  };

  const toggleService = (val) => {
    setSelectedServices((prev) =>
      prev.includes(val) ? prev.filter((s) => s !== val) : [...prev, val]
    );
  };

  const submitStatusUpdate = async () => {
    if (!actionTarget) return;
    setActionSubmitting(true);
    setActionError('');
    try {
      await axiosClient.patch(`/bhw/referrals/${actionTarget.referral_id}/status`, {
        status: newStatus,
        response_notes: responseNotes,
        services: selectedServices,
        service_type: selectedServices[0] || null,
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

  const allCount = activeTypeFiltered.length;
  const pendingCount = activeTypeFiltered.filter((r) => normalizeStatus(r.status) === 'Pending').length;
  const receivedCount = activeTypeFiltered.filter((r) => normalizeStatus(r.status) === 'Received').length;
  const ongoingCount = activeTypeFiltered.filter((r) => normalizeStatus(r.status) === 'Ongoing').length;
  const completedCount = activeTypeFiltered.filter((r) => normalizeStatus(r.status) === 'Completed').length;
  const archivedCount = typeFilteredReferrals.filter(isArchived).length;

  if (loading) {
    return (
      <div className="space-y-6 bg-gray-50 min-h-screen p-6">
        <div className="h-14 rounded-2xl bg-white p-3 shadow-xs border border-gray-100 animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-white p-4 shadow-xs border border-gray-100 animate-pulse" />
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

      {/* ── Status Tabs (Single Top Filter Bar: All | Pending | Ongoing | Completed | Archived) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleSelectStatusFilter('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border ${
              statusFilter === 'all'
                ? 'bg-[#1b5e20] text-white border-[#1b5e20] shadow-xs'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            All <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${statusFilter === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>{allCount}</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectStatusFilter('Pending')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border ${
              statusFilter === 'Pending'
                ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
            }`}
          >
            Pending <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${statusFilter === 'Pending' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>{pendingCount}</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectStatusFilter('Received')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border ${
              statusFilter === 'Received'
                ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                : 'bg-white text-sky-700 border-sky-200 hover:bg-sky-50'
            }`}
          >
            Received <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${statusFilter === 'Received' ? 'bg-white/20 text-white' : 'bg-sky-100 text-sky-800'}`}>{receivedCount}</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectStatusFilter('Ongoing')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border ${
              statusFilter === 'Ongoing'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
            }`}
          >
            Ongoing <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${statusFilter === 'Ongoing' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'}`}>{ongoingCount}</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectStatusFilter('Completed')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border ${
              statusFilter === 'Completed'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
            }`}
          >
            Completed <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${statusFilter === 'Completed' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'}`}>{completedCount}</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectStatusFilter('Archived')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border ${
              statusFilter === 'Archived'
                ? 'bg-slate-700 text-white border-slate-700 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Archived <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${statusFilter === 'Archived' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>{archivedCount}</span>
          </button>
          {statusFilter === 'Completed' && completedCount > 0 && (
            <button
              type="button"
              disabled={batchArchiving}
              onClick={handleBatchArchiveCompleted}
              className="px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            >
              {batchArchiving ? 'Archiving…' : `Archive All Completed (${completedCount})`}
            </button>
          )}
        </div>

        {/* Secondary controls: Beneficiary Type & Sort By */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200">
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                typeFilter === 'all' ? 'bg-white text-gray-800 shadow-xs font-bold' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              All Types
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('child')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                typeFilter === 'child' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Child ({childReferralsCount})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('mother')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                typeFilter === 'mother' ? 'bg-white text-purple-700 shadow-xs font-bold' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Mother ({motherReferralsCount})
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium text-gray-500">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-gray-700 focus:outline-none focus:border-[#2e7d32]"
            >
              <option value="date">Date (Newest first)</option>
              <option value="severity">Severity (High first)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-50 p-4 space-y-3">
        {filteredReferrals.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-xs">No referrals found matching the selected filters.</div>
        ) : (
          filteredReferrals.map((r) => {
            const isMother = isMotherReferral(r);
            const typeBadgeText = isMother ? 'LACTATING MOTHER' : 'CHILD';
            const typeLabel = isMother ? 'MOTHER HEALTH REFERRAL' : 'CHILD HEALTH REFERRAL';
            const badgeClass = isMother
              ? 'bg-purple-50 text-purple-700 border-purple-200'
              : 'bg-blue-50 text-blue-700 border-blue-200';
            const cleanNote = r.notes ? String(r.notes).replace(/Facility:\s*\d+\s+Facility:\s*/gi, 'Facility: ').replace(/(Facility:\s*)+/gi, 'Facility: ').trim() : '';
            const sev = String(r.severity || 'medium').toLowerCase();
            const sevClass = sev === 'high' ? 'bg-red-100 text-red-800 border-red-200' : sev === 'low' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-800 border-amber-200';
            const normStatus = normalizeStatus(r.status);
            const isItemArchived = isArchived(r);
            const statusClass = isItemArchived
              ? 'bg-slate-100 text-slate-700 border-slate-200'
              : normStatus === 'Completed'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : normStatus === 'Ongoing'
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : normStatus === 'Received'
              ? 'bg-sky-50 text-sky-700 border-sky-200'
              : normStatus === 'Cancelled'
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : 'bg-amber-50 text-amber-700 border-amber-200';
            const displayStatus = isItemArchived ? 'Archived' : normStatus;
            const benFullName = `${r.beneficiary_first_name || ''} ${r.beneficiary_last_name || ''}`.trim();

            return (
              <div key={r.referral_id} className="p-4 rounded-xl border border-gray-100 hover:border-gray-200 transition bg-white space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-gray-900">{benFullName}</span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${badgeClass}`}>
                        {typeBadgeText}
                      </span>
                      <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${badgeClass}`}>
                        {typeLabel}
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${sevClass}`}>
                        {sev} severity
                      </span>
                      <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${statusClass}`}>
                        {displayStatus}
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        r.referrer_role === 'BNS'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {r.referrer_by_label || (r.referrer_role === 'BNS' ? 'Referred by BNS' : 'Referred by BHW')}
                      </span>
                      <span className="text-[11px] text-gray-400">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    {r.reason && <p className="text-xs text-gray-800 font-medium">Reason: {r.reason}</p>}
                    {cleanNote && <p className="text-xs text-gray-600 italic">"{cleanNote}"</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isItemArchived ? (
                      <button
                        type="button"
                        disabled={rowLoadingId === r.referral_id}
                        onClick={() => handleUnarchiveRow(r.referral_id, benFullName)}
                        className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        {rowLoadingId === r.referral_id ? 'Unarchiving…' : 'Unarchive'}
                      </button>
                    ) : (
                      <>
                        <button
                          aria-label={`Update status for ${r.beneficiary_first_name} ${r.beneficiary_last_name}`}
                          type="button"
                          onClick={() => openActionModal(r)}
                          className="bg-linear-to-r from-[#1b5e20] to-[#2e7d32] hover:from-[#154a1a] hover:to-[#256427] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
                        >
                          Update Status
                        </button>
                        {normStatus === 'Completed' && (
                          <button
                            type="button"
                            disabled={rowLoadingId === r.referral_id}
                            onClick={() => handleArchiveRow(r.referral_id, benFullName)}
                            className="bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 px-3 py-2 rounded-xl text-xs font-semibold transition shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            {rowLoadingId === r.referral_id ? 'Archiving…' : 'Archive'}
                          </button>
                        )}
                      </>
                    )}
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
                  <option value="Received">Received (Confirmed Receipt)</option>
                  <option value="Ongoing">Ongoing (In Progress)</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              {newStatus === 'Ongoing' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Services Provided
                    </label>
                    {selectedServices.length > 0 && (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        {selectedServices.length} selected
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 rounded-xl border border-gray-200 bg-slate-50/60 p-2.5">
                    {serviceOptions.map((s) => {
                      const isChecked = selectedServices.includes(s.value);
                      return (
                        <div
                          key={s.value}
                          onClick={() => toggleService(s.value)}
                          className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition text-xs select-none ${
                            isChecked
                              ? 'bg-emerald-50 text-emerald-900 border border-emerald-300 font-semibold'
                              : 'bg-white text-gray-700 border border-slate-200 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleService(s.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 accent-[#2e7d32] cursor-pointer shrink-0"
                          />
                          <span className="flex-1 cursor-pointer">{s.label}</span>
                        </div>
                      );
                    })}
                  </div>

                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block mt-3">
                    Service Date
                  </label>
                  <input
                    type="date"
                    value={serviceDate}
                    onChange={(e) => setServiceDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] bg-white"
                  />
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

      {/* Confirmation Modal for Archiving / Unarchiving */}
      {archiveConfirm && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-9999 p-4" onClick={() => setArchiveConfirm(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-base text-gray-900">
                {archiveConfirm.isUnarchive ? 'Unarchive Referral' : 'Archive Referral'}
              </h3>
              <button onClick={() => setArchiveConfirm(null)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 text-sm text-gray-600">
              <p>
                Are you sure you want to {archiveConfirm.isUnarchive ? 'unarchive' : 'archive'} {archiveConfirm.type === 'batch' ? archiveConfirm.name : `referral for ${archiveConfirm.name}`}?
              </p>
              {!archiveConfirm.isUnarchive && (
                <p className="text-xs text-gray-400 mt-2">
                  Archived referrals can be reviewed anytime under the Archived tab.
                </p>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex gap-2.5 justify-end">
              <button
                type="button"
                onClick={() => setArchiveConfirm(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 border border-gray-200 hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmArchiveExecution}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-linear-to-r from-[#1b5e20] to-[#2e7d32] hover:from-[#154a1a] hover:to-[#256427] transition shadow-xs"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>, document.body
      )}

      {/* Styled feedback toast notification */}
      {toastMessage && createPortal(
        <div className="fixed bottom-5 right-5 z-9999 flex items-center gap-2.5 bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-gray-800 text-xs font-medium animate-in slide-in-from-bottom-2 duration-200">
          <span className={`w-2 h-2 rounded-full ${toastMessage.type === 'error' ? 'bg-red-400' : 'bg-green-400'}`} />
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-gray-400 hover:text-white">
            <X size={14} />
          </button>
        </div>, document.body
      )}
    </main>
  );
}

export default Referrals;
