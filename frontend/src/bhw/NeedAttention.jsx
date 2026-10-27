import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  ClipboardPlus,
  Stethoscope,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Building2,
  Calendar,
  ExternalLink,
} from 'lucide-react';

const statusColors = {
  normal: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  MAM: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  SAM: 'bg-red-100 text-red-800 ring-1 ring-red-200',
  underweight: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  severely_underweight: 'bg-red-100 text-red-800 ring-1 ring-red-200',
  overweight: 'bg-blue-100 text-blue-800 ring-1 ring-blue-200',
  OVERWEIGHT: 'bg-blue-100 text-blue-800 ring-1 ring-blue-200',
  obese: 'bg-purple-100 text-purple-800 ring-1 ring-purple-200',
  OBESE: 'bg-purple-100 text-purple-800 ring-1 ring-purple-200',
};

const statusPriority = {
  SAM: 0,
  severely_underweight: 0,
  MAM: 1,
  underweight: 1,
  obese: 2,
  overweight: 2,
  normal: 3,
};

const serviceOptions = [
  { value: 'vitamin_a', label: 'Vitamin A Supplementation' },
  { value: 'deworming', label: 'Deworming Tablet' },
  { value: 'feeding', label: 'Supplementary Feeding' },
  { value: 'checkup', label: 'General Health Checkup' },
];

function daysSince(dateStr) {
  if (!dateStr) return null;
  const diffMs = new Date() - new Date(dateStr);
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function NeedAttention() {
  const user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');

  // filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ageFilter, setAgeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('priority');

  // pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // refer modal
  const [referTarget, setReferTarget] = useState(null);
  const [referDestination, setReferDestination] = useState('Rural Health Unit (RHU)');
  const [referUrgency, setReferUrgency] = useState('Routine');
  const [referReason, setReferReason] = useState('');
  const [referSubmitting, setReferSubmitting] = useState(false);
  const [referError, setReferError] = useState('');

  // toast state
  const [toastMessage, setToastMessage] = useState(null); // { text, type: 'success' | 'error' }

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // log visit / service modal
  const [visitTarget, setVisitTarget] = useState(null);
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10));
  const [serviceType, setServiceType] = useState('vitamin_a');
  const [visitWeight, setVisitWeight] = useState('');
  const [visitHeight, setVisitHeight] = useState('');
  const [visitNotes, setVisitNotes] = useState('');
  const [visitSubmitting, setVisitSubmitting] = useState(false);
  const [visitError, setVisitError] = useState('');

  const { data, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ['need-attention', user.barangay || ''],
    queryFn: async () => {
      const res = await axiosClient.get('/bhw/need-attention', { params: { barangay: user.barangay } });
      return res.data || [];
    },
    staleTime: 1000 * 20,
    gcTime: 1000 * 60 * 2,
  });

  const children = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const loading = isLoading && !data;
  const error = queryError ? (queryError.response?.data?.message || 'Failed to load children list.') : '';

  const filteredChildren = useMemo(() => {
    let list = [...children];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) =>
        `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase().includes(q) ||
        (c.guardian_name || '').toLowerCase().includes(q) ||
        (c.barangay || '').toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'all') {
      list = list.filter((c) => c.overall_status === statusFilter);
    }

    if (ageFilter !== 'all') {
      list = list.filter((c) => {
        if (ageFilter === '0-23') return c.age_in_months >= 0 && c.age_in_months <= 23;
        if (ageFilter === '24-59') return c.age_in_months >= 24 && c.age_in_months <= 59;
        return true;
      });
    }

    if (sortBy === 'priority') {
      list.sort(
        (a, b) =>
          (statusPriority[a.overall_status] ?? 9) -
          (statusPriority[b.overall_status] ?? 9)
      );
    } else if (sortBy === 'overdue') {
      list.sort((a, b) => {
        const da = daysSince(a.last_visit) ?? -1;
        const db = daysSince(b.last_visit) ?? -1;
        return db - da;
      });
    } else if (sortBy === 'name') {
      list.sort((a, b) =>
        `${a.first_name || ''} ${a.last_name || ''}`.localeCompare(`${b.first_name || ''} ${b.last_name || ''}`)
      );
    }

    return list;
  }, [children, search, statusFilter, ageFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredChildren.length / pageSize));
  const pagedChildren = filteredChildren.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, ageFilter, sortBy]);

  const openReferModal = (child, e) => {
    e.stopPropagation();
    if (child.is_referred) return;
    setReferTarget(child);

    // Auto-detect urgency
    const isSevere = child.overall_status === 'SAM' ||
      child.weight_status === 'severely_underweight' ||
      child.weight_status === 'severly_underweight' ||
      child.height_status === 'severely_stunted' ||
      child.height_status === 'severly_stunted';

    const defaultUrgency = isSevere ? 'Urgent' : 'Routine';
    setReferDestination('Rural Health Unit (RHU)');
    setReferUrgency(defaultUrgency);

    let defaultReason = '';
    if (isSevere) {
      defaultReason = `Severely malnourished (${child.overall_status || 'SAM'}) with complications. Immediate medical attention and specialized therapeutic feeding required.`;
    } else {
      defaultReason = `Under child nutrition monitoring (${child.overall_status || 'MAM'}). Requires medical checkup and nutritional consultation.`;
    }

    setReferReason(defaultReason);
    setReferError('');
  };

  const submitReferral = async () => {
    if (!referTarget || referSubmitting) return;

    if (!referReason.trim()) {
      setReferError('Please provide a reason or symptoms for the referral.');
      return;
    }

    setReferSubmitting(true);
    setReferError('');
    const benName = `${referTarget.first_name || ''} ${referTarget.last_name || ''}`.trim() || 'the child';
    const severityMapped = referUrgency === 'Urgent' ? 'high' : 'medium';

    try {
      await axiosClient.post('/bhw/referrals', {
        child_id: referTarget.child_id,
        referral_type: 'child',
        beneficiary_type: 'child',
        facility: referDestination,
        severity: severityMapped,
        urgency: referUrgency,
        reason: referReason.trim(),
        nutrition_status: referTarget.overall_status || 'SAM',
        notes: `Referred from Need Attention monitoring (${referTarget.overall_status || 'At Risk'}). Latest Weight: ${referTarget.weight_kg ? `${referTarget.weight_kg} kg` : 'N/A'}, Latest Height: ${referTarget.height_cm ? `${referTarget.height_cm} cm` : 'N/A'}.`,
        referred_by: user.user_id,
      });

      setReferTarget(null);
      await refetch();
      window.dispatchEvent(new CustomEvent('notifications:updated'));
      setToastMessage({
        text: `Referral submitted for ${benName} to ${referDestination}. Partner BNS notified.`,
        type: 'success',
      });
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to submit referral. Please try again.';
      setReferError(errMsg);
      setToastMessage({
        text: errMsg,
        type: 'error',
      });
    } finally {
      setReferSubmitting(false);
    }
  };

  const openVisitModal = (child, e) => {
    e.stopPropagation();
    setVisitTarget(child);
    setVisitDate(new Date().toISOString().slice(0, 10));
    // start with placeholder selection
    setServiceType('');
    setVisitWeight(child.weight_kg || '');
    setVisitHeight(child.height_cm || '');
    setVisitNotes('');
    setVisitError('');
  };

  const submitVisit = async () => {
    if (!visitTarget) return;
    setVisitSubmitting(true);
    setVisitError('');
    try {
      // Validate service selection
      if (!serviceType) {
        setVisitError('Please select a service before saving.');
        setVisitSubmitting(false);
        return;
      }
      const age = visitTarget.age_in_months ?? 0;
      // Vitamin A not for <6 months
      if (serviceType === 'vitamin_a' && age < 6) {
        setVisitError('Vitamin A supplementation is not indicated for infants under 6 months.');
        setVisitSubmitting(false);
        return;
      }
      // Deworming not for <12 months
      if (serviceType === 'deworming' && age < 12) {
        setVisitError('Deworming tablets are not indicated for infants under 12 months.');
        setVisitSubmitting(false);
        return;
      }
      await axiosClient.post('/bhw/need-attention/child-services', {
        child_id: visitTarget.child_id,
        service_date: visitDate,
        service_type: serviceType,
        provided_by: user.user_id,
        weight_kg: visitWeight || null,
        height_cm: visitHeight || null,
        notes: visitNotes,
      });
      await refetch();
      setVisitTarget(null);
      alert('Health visit recorded successfully. Medical records and audit trail updated.');
    } catch (err) {
      setVisitError(err.response?.data?.message || 'Failed to log service visit. Please try again.');
    } finally {
      setVisitSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 p-6">
        {[1,2,3].map(i => (
          <div key={i} className="animate-pulse bg-white rounded-xl p-4">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
            <div className="h-3 bg-gray-200 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (error) return <p className="text-red-600 p-6">{error}</p>;

  const samCount = children.filter((c) => c.overall_status === 'SAM' || c.weight_status === 'severely_underweight').length;
  const mamCount = children.filter((c) => c.overall_status === 'MAM' || c.weight_status === 'underweight').length;
  const overdueCount = children.filter((c) => (daysSince(c.last_visit) ?? 999) > 30).length;

  return (
    <main role="main" aria-label="Need Attention" className="space-y-6 bg-gray-50 min-h-screen p-6">

      {/* ── Summary Counters ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total At-Risk</p>
          <p className="text-3xl font-black text-gray-800 mt-2">{children.length}</p>
          <p className="text-xs text-gray-400 mt-1">Children in {user.barangay}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-red-100">
          <p className="text-xs font-semibold text-red-500 uppercase tracking-wider">Severe (SAM)</p>
          <p className="text-3xl font-black text-red-600 mt-2">{samCount}</p>
          <p className="text-xs text-red-400 mt-1">Immediate intervention required</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-amber-100">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Moderate (MAM)</p>
          <p className="text-3xl font-black text-amber-600 mt-2">{mamCount}</p>
          <p className="text-xs text-amber-500 mt-1">Supplementary feeding priority</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-orange-100">
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-wider">Overdue (&gt;30d)</p>
          <p className="text-3xl font-black text-orange-600 mt-2">{overdueCount}</p>
          <p className="text-xs text-orange-400 mt-1">Needs home visit checkup</p>
        </div>
      </div>

      {/* ── Controls & Table ── */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">

        {/* Filter bar */}
            <div className="p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-1 min-w-60 items-center gap-2 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-100 focus-within:border-green-400 focus-within:ring-2 focus-within:ring-green-100 transition">
            <Search size={16} className="text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search child by name or guardian…"
              aria-label="Search child by name or guardian"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="outline-none text-sm w-full bg-transparent text-gray-700 placeholder-gray-400"
            />
            {search && <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:border-[#2e7d32]"
            >
              <option value="all">All Statuses</option>
              <option value="SAM">SAM (Severe)</option>
              <option value="MAM">MAM (Moderate)</option>
              <option value="underweight">Underweight</option>
              <option value="overweight">Overweight</option>
              <option value="obese">Obese</option>
            </select>

            <select
              value={ageFilter}
              onChange={(e) => setAgeFilter(e.target.value)}
              className="border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:border-[#2e7d32]"
            >
              <option value="all">All Age Groups</option>
              <option value="0-23">0–23 months</option>
              <option value="24-59">24–59 months</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:border-[#2e7d32]"
            >
              <option value="priority">Sort: Severity Priority</option>
              <option value="overdue">Sort: Most Overdue</option>
              <option value="name">Sort: Name (A–Z)</option>
            </select>
          </div>
        </div>

        {/* Count bar */}
        <div className="px-6 py-3 bg-gray-50/60 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {filteredChildren.length} children need monitoring
          </p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed min-w-[800px]">
            <colgroup>
              <col className="w-[24%]" />
              <col className="w-[8%]" />
              <col className="w-[12%]" />
              <col className="w-[18%]" />
              <col className="w-[14%]" />
              <col className="w-[24%]" />
            </colgroup>
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-400 bg-gray-50/80 border-b border-gray-100">
                <th scope="col" className="px-6 py-3.5">Child & Guardian</th>
                <th scope="col" className="px-4 py-3.5">Age</th>
                <th scope="col" className="px-4 py-3.5">Weight / Height</th>
                <th scope="col" className="px-4 py-3.5 text-center">Nutrition Status</th>
                <th scope="col" className="px-4 py-3.5">Last Visit</th>
                <th scope="col" className="px-4 py-3.5 text-center">Interventions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pagedChildren.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-gray-400 text-sm">
                    No children matching your filters.
                  </td>
                </tr>
              ) : (
                pagedChildren.map((c) => {
                  const days = daysSince(c.last_visit);
                  const isOverdue = days == null || days > 30;

                  return (
                    <tr key={c.child_id} className="hover:bg-green-50/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="shrink-0 w-9 h-9 rounded-full bg-linear-to-br from-amber-400 to-red-500 flex items-center justify-center text-white text-xs font-bold shadow-xs">
                            {(c.first_name ?? '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 truncate">{c.first_name} {c.last_name}</p>
                            <p className="text-xs text-gray-400 truncate">Guardian: {c.guardian_name || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-gray-700 font-medium">
                        {c.age_in_months != null ? `${c.age_in_months} mos` : '—'}
                      </td>
                      <td className="px-4 py-4 text-gray-700 font-medium text-xs">
                        <p>{c.weight_kg ? `${c.weight_kg} kg` : '—'}</p>
                        <p className="text-gray-400">{c.height_cm ? `${c.height_cm} cm` : '—'}</p>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span
                          style={{ overflowWrap: 'normal', wordBreak: 'keep-all', whiteSpace: 'nowrap' }}
                          className={`px-3 py-1 rounded-full text-xs font-bold uppercase whitespace-nowrap inline-block shrink-0 ${statusColors[c.overall_status] || 'bg-gray-100 text-gray-700'}`}
                        >
                          {c.overall_status || 'At Risk'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs">
                        <p className="font-semibold text-gray-800">
                          {c.last_visit ? new Date(c.last_visit).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No records'}
                        </p>
                        <p className={`mt-0.5 font-medium ${isOverdue ? 'text-red-600' : 'text-emerald-600'}`}>
                          {days != null ? `${days}d ago` : 'Overdue'}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2 flex-nowrap">
                          <button
                            type="button"
                            onClick={(e) => openVisitModal(c, e)}
                            aria-label={`Log visit for ${c.first_name} ${c.last_name}`}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition-colors shadow-2xs inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
                          >
                            <Stethoscope size={13} className="text-emerald-700" /> Log Visit
                          </button>
                          {Boolean(c.is_referred) ? (
                            <div className="relative inline-block text-left group">
                              <Link
                                to="/bhw/referrals"
                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50/90 hover:bg-blue-100 hover:text-blue-800 border border-blue-200/80 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all shadow-2xs group-hover:border-blue-300"
                              >
                                <CheckCircle2 size={13} className="text-blue-600" />
                                <span>Referred</span>
                              </Link>

                              {/* Beautiful Popover Card on Hover */}
                              <div className="absolute bottom-full right-0 mb-2.5 hidden group-hover:flex flex-col w-64 p-3 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-blue-100 text-left z-50 pointer-events-none transition-all duration-200 animate-in fade-in zoom-in-95">
                                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-700">
                                    <CheckCircle2 size={13} className="text-blue-600 shrink-0" />
                                    <span>Active Referral</span>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    String(c.referral_status).toLowerCase() === 'received'
                                      ? 'bg-sky-100 text-sky-800'
                                      : String(c.referral_status).toLowerCase() === 'ongoing'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {c.referral_status || 'Pending'}
                                  </span>
                                </div>

                                <div className="py-2 space-y-1.5 text-xs">
                                  <div className="flex items-start gap-2 text-gray-700">
                                    <Building2 size={13} className="text-gray-400 mt-0.5 shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-[10px] text-gray-400 uppercase font-semibold">Facility</p>
                                      <p className="font-semibold text-gray-900 leading-tight truncate">
                                        {c.destination_facility || 'Rural Health Unit (RHU)'}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-start gap-2 text-gray-700">
                                    <Calendar size={13} className="text-gray-400 mt-0.5 shrink-0" />
                                    <div>
                                      <p className="text-[10px] text-gray-400 uppercase font-semibold">Referred Date</p>
                                      <p className="font-medium text-gray-800">
                                        {c.referral_date
                                          ? new Date(c.referral_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                          : 'Recently'}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] font-semibold text-blue-600">
                                  <span>View in Referrals</span>
                                  <ExternalLink size={12} className="text-blue-500" />
                                </div>

                                {/* Arrow pointer */}
                                <div className="absolute top-full right-5 -mt-1 w-2.5 h-2.5 bg-white border-r border-b border-blue-100 transform rotate-45" />
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => openReferModal(c, e)}
                              aria-label={`Refer ${c.first_name} ${c.last_name}`}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 transition-colors shadow-2xs inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 cursor-pointer"
                            >
                              <ClipboardPlus size={13} className="text-amber-700" /> Refer
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-2 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-2 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── Log Visit Modal ── */}
      {visitTarget && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-9999 p-4 overflow-hidden" onClick={() => setVisitTarget(null)}>
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="bg-linear-to-r from-[#1b5e20] to-[#2e7d32] px-6 py-5 flex items-center justify-between text-white shrink-0">
                <div>
                  <h3 className="font-bold text-base">Record Health Visit / Service</h3>
                  <p className="text-xs text-white/70 mt-0.5">{visitTarget.first_name} {visitTarget.last_name}</p>
                </div>
                <button onClick={() => setVisitTarget(null)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white">
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-3.5 overflow-y-auto flex-1">
                {visitError && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200 font-medium">{visitError}</div>}

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Service Provided *</label>
                  <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32]">
                    <option value="">Select service</option>
                    {serviceOptions.map((opt) => {
                      const age = visitTarget?.age_in_months ?? 0;
                      const isVitADisabled = opt.value === 'vitamin_a' && age < 6;
                      const isDewormDisabled = opt.value === 'deworming' && age < 12;
                      const isDisabled = isVitADisabled || isDewormDisabled;

                      let label = opt.label;
                      if (isVitADisabled) {
                        label += ' (6+ buwan lamang)';
                      } else if (isDewormDisabled) {
                        label += ' (12+ buwan lamang)';
                      }

                      return (
                        <option key={opt.value} value={opt.value} disabled={isDisabled} className={isDisabled ? 'text-gray-400' : ''}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Visit Date *</label>
                  <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32]" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">New Weight (kg)</label>
                    <input type="number" step="0.1" placeholder="e.g. 10.5" value={visitWeight} onChange={(e) => setVisitWeight(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32]" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">New Height (cm)</label>
                    <input type="number" step="0.1" placeholder="e.g. 82.0" value={visitHeight} onChange={(e) => setVisitHeight(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32]" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Observation / Notes</label>
                  <textarea rows={2} placeholder="Optional notes regarding child response, health condition…" value={visitNotes} onChange={(e) => setVisitNotes(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32] resize-none" />
                </div>
              </div>
              <div className="p-4 border-t border-gray-100 bg-white flex gap-3 pt-2 sticky bottom-0">
                <button type="button" onClick={() => setVisitTarget(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50">Cancel</button>
                <button type="button" disabled={visitSubmitting} onClick={submitVisit} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-linear-to-r from-[#1b5e20] to-[#2e7d32] hover:from-[#154a1a] hover:to-[#256427] disabled:opacity-60">
                  {visitSubmitting ? 'Saving…' : 'Save Service'}
                </button>
              </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Toast Notification Banner ── */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-9999 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold ${
              toastMessage.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/20'
                : 'bg-red-600 text-white border-red-500 shadow-red-900/20'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 size={18} className="shrink-0 text-white" />
            ) : (
              <X size={18} className="shrink-0 text-white cursor-pointer" onClick={() => setToastMessage(null)} />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* ── Refer Modal ── */}
      {referTarget && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-9999 p-4 overflow-hidden" onClick={() => setReferTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="bg-linear-to-r from-amber-600 to-orange-600 px-6 py-5 flex items-center justify-between text-white shrink-0">
                <div>
                  <h3 className="font-bold text-base">Refer Child to Health Facility</h3>
                  <p className="text-xs text-white/80 mt-0.5">BHW Referral for Specialized Medical / Nutrition Follow-up</p>
                </div>
                <button onClick={() => setReferTarget(null)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                {referError && (
                  <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200 font-semibold flex items-center gap-2">
                    <X size={14} className="shrink-0 text-red-500" />
                    <span>{referError}</span>
                  </div>
                )}

                {/* Auto-filled Child Overview Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Child (Auto-filled)</span>
                      <p className="text-sm font-bold text-gray-900">
                        {referTarget.first_name} {referTarget.middle_initial ? `${referTarget.middle_initial}. ` : ''}{referTarget.last_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nutrition Status</span>
                      <div>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase inline-block mt-0.5 ${statusColors[referTarget.overall_status] || 'bg-amber-100 text-amber-800'}`}>
                          {referTarget.overall_status || 'SAM'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Latest Weight</span>
                      <span className="font-bold text-gray-800">{referTarget.weight_kg ? `${referTarget.weight_kg} kg` : 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Latest Height</span>
                      <span className="font-bold text-gray-800">{referTarget.height_cm ? `${referTarget.height_cm} cm` : 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Recorded Date</span>
                      <span className="font-bold text-gray-800">
                        {referTarget.latest_measurement_date
                          ? new Date(referTarget.latest_measurement_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : (referTarget.last_visit ? new Date(referTarget.last_visit).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Refer To Facility */}
                <div>
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5 block">
                    Refer To Destination Facility <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={referDestination}
                    onChange={(e) => setReferDestination(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:border-amber-600 bg-white"
                  >
                    <option value="Barangay Health Station (BHS)">Barangay Health Station (BHS)</option>
                    <option value="Rural Health Unit (RHU)">Rural Health Unit (RHU)</option>
                    <option value="District Hospital">District Hospital</option>
                  </select>
                </div>

                {/* Urgency */}
                <div>
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5 block">
                    Urgency Level <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <label
                      className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition text-xs ${
                        referUrgency === 'Urgent'
                          ? 'border-red-400 bg-red-50 text-red-900 font-bold ring-1 ring-red-300'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="referUrgency"
                        value="Urgent"
                        checked={referUrgency === 'Urgent'}
                        onChange={(e) => setReferUrgency(e.target.value)}
                        className="mt-0.5 accent-red-600 cursor-pointer"
                      />
                      <div>
                        <span className="block font-bold">Urgent</span>
                        <span className="text-[11px] font-normal text-red-700/80">SAM with complications / acute illness</span>
                      </div>
                    </label>

                    <label
                      className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition text-xs ${
                        referUrgency === 'Routine'
                          ? 'border-blue-400 bg-blue-50 text-blue-900 font-bold ring-1 ring-blue-300'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="referUrgency"
                        value="Routine"
                        checked={referUrgency === 'Routine'}
                        onChange={(e) => setReferUrgency(e.target.value)}
                        className="mt-0.5 accent-blue-600 cursor-pointer"
                      />
                      <div>
                        <span className="block font-bold">Routine</span>
                        <span className="text-[11px] font-normal text-blue-700/80">Growth monitoring & standard checkup</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Reason / Symptoms (Required) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide block">
                      Reason / Symptoms <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[11px] text-gray-400 font-medium">Required</span>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="Describe specific symptoms, clinical observations, or reasons for referral…"
                    value={referReason}
                    onChange={(e) => setReferReason(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-600 resize-none font-normal placeholder:text-gray-400"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-gray-100 bg-white flex gap-3 pt-3 sticky bottom-0">
                <button
                  type="button"
                  onClick={() => setReferTarget(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={referSubmitting}
                  onClick={submitReferral}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-linear-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:opacity-60 cursor-pointer transition shadow-xs"
                >
                  {referSubmitting ? 'Submitting Referral…' : 'Submit Referral'}
                </button>
              </div>
          </div>
        </div>,
        document.body
      )}

    </main>
  );
}

export default NeedAttention;