import { useState, useEffect, useMemo } from 'react';
import axiosClient from '../api/axiosClient';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { CountUp, ShimmerSkeleton, modalVariants, backdropVariants } from '../components/ui/motion';
import {
  Search,
  Stethoscope,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
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
  const [selectedServices, setSelectedServices] = useState([]);
  const [visitNotes, setVisitNotes] = useState('');
  const [visitSubmitting, setVisitSubmitting] = useState(false);
  const [visitError, setVisitError] = useState('');

  const toggleService = (value) => {
    setSelectedServices((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  };

  // Lock body scroll when visit modal is open
  useEffect(() => {
    if (visitTarget) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [visitTarget]);

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

  const openVisitModal = (child) => {
    setVisitTarget(child);
    setVisitDate(new Date().toISOString().slice(0, 10));
    setSelectedServices([]);
    setVisitNotes('');
    setVisitError('');
  };

  const submitVisit = async () => {
    if (!visitTarget) return;
    setVisitSubmitting(true);
    setVisitError('');
    try {
      // Validate service selection
      if (!selectedServices || selectedServices.length === 0) {
        setVisitError('Pumili ng kahit isang serbisyo (Please select at least one service).');
        setVisitSubmitting(false);
        return;
      }
      const age = visitTarget.age_in_months ?? 0;
      // Vitamin A not for <6 months
      if (selectedServices.includes('vitamin_a') && age < 6) {
        setVisitError('Vitamin A supplementation is not indicated for infants under 6 months.');
        setVisitSubmitting(false);
        return;
      }
      // Deworming not for <12 months
      if (selectedServices.includes('deworming') && age < 12) {
        setVisitError('Deworming tablets are not indicated for infants under 12 months.');
        setVisitSubmitting(false);
        return;
      }
      await axiosClient.post('/bhw/need-attention/child-services', {
        child_id: visitTarget.child_id,
        service_date: visitDate,
        service_types: selectedServices,
        service_type: selectedServices[0],
        provided_by: user.user_id,
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
      <div className="space-y-6 bg-gray-50 min-h-screen p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <ShimmerSkeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <ShimmerSkeleton className="h-10 rounded-xl w-full" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <ShimmerSkeleton key={i} className="h-14 rounded-xl w-full" />
            ))}
          </div>
        </div>
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
        <motion.div
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 transition-shadow hover:shadow-md"
        >
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total At-Risk</p>
          <p className="text-3xl font-black text-gray-800 mt-2">
            <CountUp value={children.length} />
          </p>
          <p className="text-xs text-gray-400 mt-1">Children in {user.barangay}</p>
        </motion.div>
        <motion.div
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-red-100 transition-shadow hover:shadow-md"
        >
          <p className="text-xs font-semibold text-red-500 uppercase tracking-wider">Severe (SAM)</p>
          <p className="text-3xl font-black text-red-600 mt-2">
            <CountUp value={samCount} />
          </p>
          <p className="text-xs text-red-400 mt-1">Immediate intervention required</p>
        </motion.div>
        <motion.div
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-amber-100 transition-shadow hover:shadow-md"
        >
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Moderate (MAM)</p>
          <p className="text-3xl font-black text-amber-600 mt-2">
            <CountUp value={mamCount} />
          </p>
          <p className="text-xs text-amber-500 mt-1">Supplementary feeding priority</p>
        </motion.div>
        <motion.div
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-orange-100 transition-shadow hover:shadow-md"
        >
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-wider">Overdue (&gt;30d)</p>
          <p className="text-3xl font-black text-orange-600 mt-2">
            <CountUp value={overdueCount} />
          </p>
          <p className="text-xs text-orange-400 mt-1">Needs home visit checkup</p>
        </motion.div>
      </div>

      {/* ── Controls & Table ── */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">

        {/* Filter bar - One Line */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
          <div className="flex flex-1 min-w-[200px] items-center gap-2 bg-gray-50 rounded-xl px-3.5 py-2.5 border border-gray-200 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100 transition">
            <Search size={16} className="text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search child by name or guardian…"
              aria-label="Search child by name or guardian"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="outline-none text-xs sm:text-sm w-full bg-transparent text-gray-700 placeholder-gray-400"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:border-emerald-600 cursor-pointer shadow-2xs"
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
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:border-emerald-600 cursor-pointer shadow-2xs"
            >
              <option value="all">All Age Groups</option>
              <option value="0-23">0–23 months</option>
              <option value="24-59">24–59 months</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:border-emerald-600 cursor-pointer shadow-2xs"
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
              <col className="w-[28%]" />
              <col className="w-[10%]" />
              <col className="w-[14%]" />
              <col className="w-[18%]" />
              <col className="w-[16%]" />
              <col className="w-[14%]" />
            </colgroup>
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-400 bg-gray-50/80 border-b border-gray-100">
                <th scope="col" className="px-6 py-3.5">Child & Guardian</th>
                <th scope="col" className="px-4 py-3.5">Age</th>
                <th scope="col" className="px-4 py-3.5">Weight / Height</th>
                <th scope="col" className="px-4 py-3.5 text-center">Nutrition Status</th>
                <th scope="col" className="px-4 py-3.5">Last Visit</th>
                <th scope="col" className="px-4 py-3.5 text-center">Action</th>
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
                    <tr
                      key={c.child_id}
                      className="hover:bg-green-50/40 transition-colors"
                    >
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
                        <button
                          type="button"
                          onClick={() => openVisitModal(c)}
                          aria-label={`Log visit for ${c.first_name} ${c.last_name}`}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition-all shadow-2xs inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer active:scale-95"
                        >
                          <Stethoscope size={14} className="text-emerald-700" />
                          <span>Log Visit</span>
                        </button>
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
                className="p-2 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-2 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── Log Visit Modal ── */}
      <AnimatePresence>
        {visitTarget && (
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 overflow-hidden"
            onClick={(e) => {
              if (e.target === e.currentTarget && !visitSubmitting) {
                setVisitTarget(null);
              }
            }}
          >
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-linear-to-r from-[#1b5e20] to-[#2e7d32] px-6 py-5 flex items-center justify-between text-white shrink-0">
                <div>
                  <h3 className="font-bold text-base">Record Health Visit / Service</h3>
                  <p className="text-xs text-white/70 mt-0.5">{visitTarget.first_name} {visitTarget.last_name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setVisitTarget(null)}
                  disabled={visitSubmitting}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                {visitError && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200 font-medium">{visitError}</div>}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                      Services Provided *
                    </label>
                    <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      {selectedServices.length === 0
                        ? 'Select all that apply'
                        : `${selectedServices.length} selected`}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {serviceOptions.map((opt) => {
                      const age = visitTarget?.age_in_months ?? 0;
                      const isVitADisabled = opt.value === 'vitamin_a' && age < 6;
                      const isDewormDisabled = opt.value === 'deworming' && age < 12;
                      const isDisabled = isVitADisabled || isDewormDisabled;
                      const isChecked = selectedServices.includes(opt.value);

                      return (
                        <label
                          key={opt.value}
                          className={`flex items-start gap-2.5 p-3 rounded-xl border transition cursor-pointer select-none ${
                            isDisabled
                              ? 'opacity-40 bg-gray-50 border-gray-200 cursor-not-allowed'
                              : isChecked
                              ? 'border-emerald-600 bg-emerald-50/90 ring-1 ring-emerald-500 shadow-2xs'
                              : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            value={opt.value}
                            disabled={isDisabled}
                            checked={isChecked}
                            onChange={() => !isDisabled && toggleService(opt.value)}
                            className="mt-0.5 rounded-md text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer accent-emerald-600"
                          />
                          <div className="min-w-0 flex-1">
                            <span
                              className={`text-xs block ${
                                isChecked ? 'text-emerald-950 font-bold' : 'text-gray-800 font-semibold'
                              }`}
                            >
                              {opt.label}
                            </span>
                            {isDisabled && (
                              <span className="text-[10px] text-amber-700 font-semibold block mt-0.5">
                                {isVitADisabled ? '6+ buwan lamang' : '12+ buwan lamang'}
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Visit Date *</label>
                  <input
                    type="date"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Observation / Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Optional notes regarding child response, health condition…"
                    value={visitNotes}
                    onChange={(e) => setVisitNotes(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32] resize-none"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-gray-100 bg-white flex gap-3 pt-2 sticky bottom-0">
                <button
                  type="button"
                  onClick={() => setVisitTarget(null)}
                  disabled={visitSubmitting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={visitSubmitting}
                  onClick={submitVisit}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-linear-to-r from-[#1b5e20] to-[#2e7d32] hover:from-[#154a1a] hover:to-[#256427] transition disabled:opacity-60 cursor-pointer shadow-sm"
                >
                  {visitSubmitting ? 'Saving…' : 'Save Service'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toast Notification Banner ── */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[9999] animate-in fade-in slide-in-from-bottom-5 duration-200">
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

    </main>
  );
}

export default NeedAttention;