import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import axiosClient from '../api/axiosClient';
import { useQuery } from '@tanstack/react-query';
import { Search, X, CheckCircle2, CheckCircle, Clock, AlertCircle, Plus, Heart, Layers, RotateCcw, Archive } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CountUp, ShimmerSkeleton, modalVariants, backdropVariants } from '../components/ui/motion';

const severityPriority = { high: 0, medium: 1, low: 2 };

const serviceOptions = [
  { value: 'general', label: 'General Follow-up / Health Consultation' },
  { value: 'vitamin_a', label: 'Vitamin A Supplementation' },
  { value: 'deworming', label: 'Deworming Tablet' },
  { value: 'feeding', label: 'Supplementary Feeding' },
  { value: 'checkup', label: 'RHU Medical Consultation' },
];

function SummaryCard({ icon: Icon, label, value, sublabel, isActive, onClick }) {
  const numVal = typeof value === 'number' ? value : parseInt(value, 10) || 0;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      whileTap={{ scale: 0.98 }}
      className={`w-full text-left rounded-2xl p-3.5 sm:p-4 shadow-xs transition-all duration-200 focus:outline-none cursor-pointer border ${
        isActive
          ? 'bg-linear-to-br from-[#1b5e20] to-[#2e7d32] text-white shadow-md border-emerald-700'
          : 'bg-white hover:bg-gray-50/90 border-gray-200/80 hover:shadow-xs text-gray-800'
      }`}
    >
      <div className="flex items-center justify-between gap-1.5">
        <p className={`text-xs font-bold leading-tight truncate ${isActive ? 'text-white/95' : 'text-gray-600'}`} title={label}>
          {label}
        </p>
        <div className={`shrink-0 rounded-lg p-1.5 ${isActive ? 'bg-white/20 text-white' : 'bg-green-50 text-[#2e7d32]'}`}>
          <Icon size={15} />
        </div>
      </div>
      <p className={`text-2xl sm:text-3xl font-black mt-2 tracking-tight ${isActive ? 'text-white' : 'text-gray-900'}`}>
        <CountUp value={numVal} />
      </p>
      <p className={`text-[10px] sm:text-[11px] mt-1 font-medium truncate ${isActive ? 'text-white/70' : 'text-gray-400'}`}>
        {sublabel}
      </p>
    </motion.button>
  );
}

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
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'child', 'mother'
  const [statusFilter, setStatusFilter] = useState(initialStatus || 'Pending');
  const [userInteractedWithFilter, setUserInteractedWithFilter] = useState(Boolean(initialStatus));
  const [referrerRoleFilter, setReferrerRoleFilter] = useState('all'); // 'all', 'BHW', 'BNS'
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

  // Refer Mother state
  const [showReferMotherModal, setShowReferMotherModal] = useState(false);
  const [mothersList, setMothersList] = useState([]);
  const [loadingMothers, setLoadingMothers] = useState(false);
  const [selectedMotherId, setSelectedMotherId] = useState('');
  const [motherFacility, setMotherFacility] = useState('Rural Health Unit (RHU)');
  const [motherUrgency, setMotherUrgency] = useState('Routine');
  const [motherReason, setMotherReason] = useState('');
  const [motherNotes, setMotherNotes] = useState('');
  const [motherSubmitting, setMotherSubmitting] = useState(false);
  const [motherError, setMotherError] = useState('');

  const handleOpenReferMother = async () => {
    setShowReferMotherModal(true);
    setSelectedMotherId('');
    setMotherReason('');
    setMotherNotes('');
    setMotherError('');
    setLoadingMothers(true);
    try {
      const res = await axiosClient.get('/masterlist/mothers');
      setMothersList(Array.isArray(res.data) ? res.data : []);
    } catch {
      setMothersList([]);
    } finally {
      setLoadingMothers(false);
    }
  };

  const handleSubmitMotherReferral = async (e) => {
    e.preventDefault();
    if (!selectedMotherId) {
      setMotherError('Please select a mother to refer.');
      return;
    }
    if (!motherReason.trim()) {
      setMotherError('Please provide a reason for the referral.');
      return;
    }

    setMotherSubmitting(true);
    setMotherError('');
    const targetMom = mothersList.find((m) => String(m.mother_id) === String(selectedMotherId));
    const momName = targetMom ? `${targetMom.first_name} ${targetMom.last_name}` : 'Mother';

    try {
      await axiosClient.post('/bhw/referrals', {
        mother_id: Number(selectedMotherId),
        beneficiary_name: momName,
        beneficiary_type: 'mother',
        referral_type: 'mother',
        barangay: targetMom?.barangay || user.barangay,
        facility: motherFacility,
        severity: motherUrgency === 'Urgent' ? 'high' : 'medium',
        urgency: motherUrgency,
        reason: motherReason.trim(),
        notes: motherNotes.trim() || `Referred by ${user.first_name || 'BHW'} for maternal consultation.`,
        referred_by: user.user_id,
      });

      setShowReferMotherModal(false);
      setToastMessage({ text: `Referral submitted for ${momName}.`, type: 'success' });
      await refetch();
      window.dispatchEvent(new CustomEvent('notifications:updated'));
    } catch (err) {
      setMotherError(err.response?.data?.message || 'Failed to submit mother referral.');
    } finally {
      setMotherSubmitting(false);
    }
  };

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

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => {
        const benName = `${r.beneficiary_first_name || ''} ${r.beneficiary_last_name || ''}`.toLowerCase();
        const reason = String(r.reason || '').toLowerCase();
        const notes = String(r.notes || '').toLowerCase();
        const refName = String(r.referrer_name || '').toLowerCase();
        return benName.includes(q) || reason.includes(q) || notes.includes(q) || refName.includes(q);
      });
    }

    if (severityFilter !== 'all') {
      list = list.filter((r) => r.severity === severityFilter);
    }

    if (referrerRoleFilter !== 'all') {
      list = list.filter((r) => String(r.referrer_role || 'BHW').toUpperCase() === referrerRoleFilter.toUpperCase());
    }

    if (sortBy === 'severity') {
      list.sort(
        (a, b) => (severityPriority[a.severity] ?? 9) - (severityPriority[b.severity] ?? 9)
      );
    } else if (sortBy === 'date') {
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    return list;
  }, [typeFilteredReferrals, activeTypeFiltered, statusFilter, search, severityFilter, referrerRoleFilter, sortBy]);

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
        <ShimmerSkeleton className="h-14 rounded-2xl w-full" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <ShimmerSkeleton key={i} className="h-24 rounded-xl w-full" />
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

      {/* ── Summary Stat Cards (1 single line on desktop/laptop) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-6 gap-2.5 sm:gap-3">
        <SummaryCard
          icon={Layers}
          label="All Referrals"
          value={allCount}
          sublabel="Total active cases"
          isActive={statusFilter === 'all'}
          onClick={() => handleSelectStatusFilter('all')}
        />
        <SummaryCard
          icon={Clock}
          label="Pending"
          value={pendingCount}
          sublabel="Awaiting action"
          isActive={statusFilter === 'Pending'}
          onClick={() => handleSelectStatusFilter('Pending')}
        />
        <SummaryCard
          icon={CheckCircle}
          label="Received"
          value={receivedCount}
          sublabel="Acknowledged"
          isActive={statusFilter === 'Received'}
          onClick={() => handleSelectStatusFilter('Received')}
        />
        <SummaryCard
          icon={RotateCcw}
          label="Ongoing"
          value={ongoingCount}
          sublabel="In intervention"
          isActive={statusFilter === 'Ongoing'}
          onClick={() => handleSelectStatusFilter('Ongoing')}
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Completed"
          value={completedCount}
          sublabel="Resolved cases"
          isActive={statusFilter === 'Completed'}
          onClick={() => handleSelectStatusFilter('Completed')}
        />
        <SummaryCard
          icon={Archive}
          label="Archived"
          value={archivedCount}
          sublabel="Past & archived"
          isActive={statusFilter === 'Archived'}
          onClick={() => handleSelectStatusFilter('Archived')}
        />
      </div>

      {/* ── Filter & Search Controls Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-gray-100 shadow-xs">
        <div className="flex items-center gap-3 flex-wrap flex-1">
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3.5 py-2 border border-gray-200 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-100 transition min-w-[240px] flex-1 max-w-md">
            <Search size={15} className="text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search beneficiary, reason, or notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="outline-none text-xs w-full bg-transparent text-gray-700 placeholder-gray-400"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200">
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                typeFilter === 'all' ? 'bg-white text-gray-800 shadow-xs font-bold' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              All Types
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('child')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                typeFilter === 'child' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Child ({childReferralsCount})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('mother')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                typeFilter === 'mother' ? 'bg-white text-purple-700 shadow-xs font-bold' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Mother ({motherReferralsCount})
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium text-gray-500">Referred by:</label>
            <select
              value={referrerRoleFilter}
              onChange={(e) => setReferrerRoleFilter(e.target.value)}
              className="text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-gray-700 focus:outline-none focus:border-[#2e7d32] cursor-pointer"
            >
              <option value="all">All Referrers</option>
              <option value="BHW">Referred by BHW</option>
              <option value="BNS">Referred by BNS</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium text-gray-500">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-gray-700 focus:outline-none focus:border-[#2e7d32] cursor-pointer"
            >
              <option value="date">Date (Newest first)</option>
              <option value="severity">Severity (High first)</option>
            </select>
          </div>
        </div>

        {statusFilter === 'Completed' && completedCount > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={batchArchiving}
              onClick={handleBatchArchiveCompleted}
              className="px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            >
              {batchArchiving ? 'Archiving…' : `Archive All Completed (${completedCount})`}
            </button>
          </div>
        )}
      </div>

      <div className="divide-y divide-gray-50 p-4 space-y-3">
        {filteredReferrals.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-xs">No referrals found matching the selected filters.</div>
        ) : (
          filteredReferrals.map((r, idx) => {
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
              <motion.div
                key={r.referral_id}
                initial={idx < 10 ? { opacity: 0, y: 10 } : false}
                animate={idx < 10 ? { opacity: 1, y: 0 } : false}
                transition={idx < 10 ? { duration: 0.25, delay: idx * 0.03 } : undefined}
                whileHover={{ y: -2, transition: { duration: 0.15 } }}
                className="p-4 rounded-xl border border-gray-100/90 hover:border-gray-200 hover:shadow-md transition-all duration-200 bg-white space-y-2.5"
              >
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
              </motion.div>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {actionTarget && createPortal(
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-9999 p-4 overflow-hidden"
            onClick={() => setActionTarget(null)}
          >
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
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
            </motion.div>
          </motion.div>, document.body
        )}
      </AnimatePresence>

      {/* Confirmation Modal for Archiving / Unarchiving */}
      <AnimatePresence>
        {archiveConfirm && createPortal(
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-9999 p-4"
            onClick={() => setArchiveConfirm(null)}
          >
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
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
            </motion.div>
          </motion.div>, document.body
        )}
      </AnimatePresence>

      {/* ── Refer Mother Modal ── */}
      <AnimatePresence>
        {showReferMotherModal && createPortal(
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-9999 p-4 overflow-hidden"
            onClick={(e) => { if (e.target === e.currentTarget) setShowReferMotherModal(false); }}
          >
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="bg-linear-to-r from-purple-600 to-purple-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
                <div className="flex items-center gap-2.5">
                  <Heart size={20} />
                  <div>
                    <h2 className="text-base font-bold">New Maternal Health Referral</h2>
                    <p className="text-white/80 text-xs mt-0.5">Refer a registered mother to RHU or hospital</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReferMotherModal(false)}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmitMotherReferral} className="p-6 space-y-4 overflow-y-auto flex-1">
                {motherError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3">
                    {motherError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Select Mother <span className="text-red-500">*</span>
                  </label>
                  {loadingMothers ? (
                    <p className="text-xs text-gray-400 py-2">Loading mothers registry…</p>
                  ) : (
                    <select
                      value={selectedMotherId}
                      onChange={(e) => setSelectedMotherId(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 bg-white focus:outline-none focus:border-purple-600"
                    >
                      <option value="">Choose a mother…</option>
                      {mothersList.map((m) => (
                        <option key={m.mother_id} value={m.mother_id}>
                          {m.first_name} {m.last_name} ({m.barangay || 'Unknown'}) — {m.contact_number || 'No contact'}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Target Facility</label>
                    <select
                      value={motherFacility}
                      onChange={(e) => setMotherFacility(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 bg-white focus:outline-none focus:border-purple-600"
                    >
                      <option value="Rural Health Unit (RHU)">Rural Health Unit (RHU)</option>
                      <option value="District Hospital">District Hospital</option>
                      <option value="Provincial Hospital">Provincial Hospital</option>
                      <option value="Barangay Health Station">Barangay Health Station</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Urgency</label>
                    <select
                      value={motherUrgency}
                      onChange={(e) => setMotherUrgency(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 bg-white focus:outline-none focus:border-purple-600"
                    >
                      <option value="Routine">Routine / Normal</option>
                      <option value="Urgent">Urgent / Immediate Attention</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Reason for Referral <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={motherReason}
                    onChange={(e) => setMotherReason(e.target.value)}
                    placeholder="e.g. Prenatal high blood pressure, nutritional deficiency, postpartum follow-up"
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Clinical Notes / Symptoms</label>
                  <textarea
                    rows={3}
                    value={motherNotes}
                    onChange={(e) => setMotherNotes(e.target.value)}
                    placeholder="Optional details, observations, symptoms, or instructions for the receiving health unit…"
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-purple-600 resize-none"
                  />
                </div>

                <div className="border-t border-gray-100 pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowReferMotherModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 border border-gray-200 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={motherSubmitting}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-linear-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800 transition shadow-xs disabled:opacity-60 cursor-pointer"
                  >
                    {motherSubmitting ? 'Submitting…' : 'Submit Referral'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>,
          document.body
        )}
      </AnimatePresence>

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
