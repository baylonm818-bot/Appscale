import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import axiosClient from '../api/axiosClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Baby, Heart, X, MapPin, ChevronDown, ChevronLeft, ChevronRight, Filter, Check } from 'lucide-react';
import { CountUp, ShimmerSkeleton, modalVariants, backdropVariants } from '../components/ui/motion';

/* ── Custom Popover Select (always drops DOWN with clean scrollbar) ── */
function CustomSelect({ value, onChange, options, placeholder, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-between gap-2 pl-3 pr-2.5 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200 hover:bg-gray-100/70 focus:outline-none focus:border-[#2e7d32] focus:ring-2 focus:ring-green-100 transition cursor-pointer select-none whitespace-nowrap min-w-[120px]"
      >
        <span className="truncate">{selectedOption?.label || placeholder}</span>
        <ChevronDown
          size={14}
          className={`text-gray-400 transition-transform duration-150 shrink-0 ${isOpen ? 'rotate-180 text-emerald-600' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1.5 left-0 z-50 min-w-full w-max max-w-[260px] bg-white rounded-xl border border-gray-200 shadow-xl py-1.5 max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-xs transition cursor-pointer select-none ${
                  isSelected
                    ? 'bg-emerald-50 text-emerald-800 font-bold'
                    : 'text-gray-700 hover:bg-gray-50 font-medium'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check size={13} className="text-emerald-700 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Status badge configuration (exact names and colors aligned with dashboard and app) ── */
const STATUS_CONFIG = {
  normal: {
    label: 'Normal',
    cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  },
  underweight: {
    label: 'Underweight',
    cls: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
  severely_underweight: {
    label: 'Severely Underweight',
    cls: 'bg-red-50 text-red-700 border border-red-200',
  },
  stunted: {
    label: 'Stunted',
    cls: 'bg-orange-50 text-orange-700 border border-orange-200',
  },
  severely_stunted: {
    label: 'Severely Stunted',
    cls: 'bg-red-50 text-red-700 border border-red-200',
  },
  wasted: {
    label: 'Wasted',
    cls: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
  mam: {
    label: 'Wasted',
    cls: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
  MAM: {
    label: 'Wasted',
    cls: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
  severely_wasted: {
    label: 'Severely Wasted',
    cls: 'bg-red-50 text-red-700 border border-red-200',
  },
  sam: {
    label: 'Severely Wasted',
    cls: 'bg-red-50 text-red-700 border border-red-200',
  },
  SAM: {
    label: 'Severely Wasted',
    cls: 'bg-red-50 text-red-700 border border-red-200',
  },
  overweight: {
    label: 'Overweight',
    cls: 'bg-blue-50 text-blue-700 border border-blue-200',
  },
  obese: {
    label: 'Obese',
    cls: 'bg-purple-50 text-purple-700 border border-purple-200',
  },
  graduate: {
    label: 'Graduate',
    cls: 'bg-teal-50 text-teal-700 border border-teal-200',
  },
  active: {
    label: 'Active',
    cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  },
  completed: {
    label: 'Completed',
    cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  },
  ongoing: {
    label: 'Active',
    cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  },
  no_record: {
    label: 'No Record',
    cls: 'bg-gray-100 text-gray-600 border border-gray-200',
  },
};

function normalizeStatusKey(rawStatus) {
  if (!rawStatus) return 'no_record';
  const s = String(rawStatus).trim().toLowerCase();
  if (s === 'sam' || s === 'severely_wasted' || s === 'severely wasted') return 'severely_wasted';
  if (s === 'mam' || s === 'wasted') return 'wasted';
  if (s === 'suw' || s === 'severely_underweight' || s === 'severely underweight') return 'severely_underweight';
  if (s === 'uw' || s === 'underweight') return 'underweight';
  if (s === 'sst' || s === 'severely_stunted' || s === 'severely stunted') return 'severely_stunted';
  if (s === 'st' || s === 'stunted') return 'stunted';
  if (s === 'ow' || s === 'overweight') return 'overweight';
  if (s === 'ob' || s === 'obese') return 'obese';
  if (s === 'normal') return 'normal';
  if (s === 'graduate') return 'graduate';
  if (s === 'active' || s === 'ongoing') return 'active';
  if (s === 'completed') return 'completed';
  return 'no_record';
}

function StatusBadge({ status }) {
  const key = normalizeStatusKey(status);
  const cfg = STATUS_CONFIG[key] || STATUS_CONFIG.no_record;
  return (
    <span
      className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap min-w-[110px] text-center ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
}

/* ── Age formatter ── */
function formatAge(months) {
  if (months == null || months === '') return '—';
  const m = Number(months);
  if (isNaN(m) || m < 0) return '—';
  if (m < 24) return `${m} mos`;
  const years = Math.floor(m / 12);
  const remMonths = m % 12;
  if (remMonths === 0) return `${m} mos (${years}y)`;
  return `${m} mos (${years}y ${remMonths}m)`;
}

/* ── Standard barangays list ── */
const GASAN_BARANGAYS = [
  'Antipolo', 'B. Ibaba', 'B. Ilaya', 'Bacong-Bacong', 'Bahi', 'Bangbang',
  'Banot', 'Banuyo', 'Bognuyan', 'Cabugao', 'Dawis', 'Dili', 'Libtangin',
  'Mahunig', 'Mangiliol', 'Masiga', 'Mat. Gasan', 'Pangi', 'Pinggan',
  'Tabionan', 'Tiguion', 'Brgy. Uno', 'Brgy. Dos', 'Brgy. Tres', 'Tapuyan',
];

const ITEMS_PER_PAGE = 15;

function Masterlist() {
  const [stats, setStats] = useState(null);
  const [children, setChildren] = useState([]);
  const [mothers, setMothers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('child'); // 'child' | 'mother' | 'all'
  const [barangayFilter, setBarangayFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  // View Modal state (view-only)
  const [selectedPerson, setSelectedPerson] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [statsRes, childrenRes, mothersRes] = await Promise.all([
          axiosClient.get('/masterlist/stats'),
          axiosClient.get('/masterlist/children'),
          axiosClient.get('/masterlist/mothers'),
        ]);
        setStats(statsRes.data || {});
        setChildren(childrenRes.data || []);
        setMothers(mothersRes.data || []);
      } catch {
        setError('Failed to load masterlist data.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeFilter, barangayFilter, statusFilter]);

  // Combine and format records
  const allRecords = useMemo(() => {
    const formattedChildren = children.map((c) => ({
      ...c,
      _type: 'child',
      id: `child-${c.child_id}`,
      fullName: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
      displaySex: c.sex ? (c.sex.toLowerCase() === 'boy' || c.sex.toLowerCase() === 'male' ? 'Male' : 'Female') : '—',
      ageMonths: c.age_in_months,
      barangay: c.barangay || '—',
      displayStatus: c.status === 'graduate' ? 'graduate' : (c.overall_status || 'no_record'),
    }));

    const formattedMothers = mothers.map((m) => ({
      ...m,
      _type: 'mother',
      id: `mother-${m.mother_id}`,
      fullName: `${m.first_name || ''} ${m.last_name || ''}`.trim(),
      displaySex: 'Mother',
      ageMonths: null,
      barangay: m.barangay || '—',
      displayStatus: m.is_completed ? 'completed' : (m.status === 'inactive' ? 'completed' : 'active'),
    }));

    return {
      children: formattedChildren,
      mothers: formattedMothers,
      combined: [...formattedChildren, ...formattedMothers],
    };
  }, [children, mothers]);

  // Filter records based on active controls
  const filteredRecords = useMemo(() => {
    let list = [];
    if (typeFilter === 'child') {
      list = allRecords.children;
    } else if (typeFilter === 'mother') {
      list = allRecords.mothers;
    } else {
      list = allRecords.combined;
    }

    const query = search.trim().toLowerCase();

    return list.filter((item) => {
      // Name search
      if (query && !item.fullName.toLowerCase().includes(query)) {
        return false;
      }

      // Barangay filter
      if (barangayFilter !== 'all') {
        if (item.barangay.trim().toLowerCase() !== barangayFilter.trim().toLowerCase()) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all') {
        const itemStatus = normalizeStatusKey(item.displayStatus);
        const filterKey = normalizeStatusKey(statusFilter);
        if (itemStatus !== filterKey) {
          return false;
        }
      }

      return true;
    });
  }, [allRecords, typeFilter, search, barangayFilter, statusFilter]);

  // Pagination calculation
  const totalRecords = filteredRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / ITEMS_PER_PAGE));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRecords.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRecords, currentPage]);

  const hasActiveFilters = search || barangayFilter !== 'all' || statusFilter !== 'all' || typeFilter !== 'child';

  const resetFilters = () => {
    setSearch('');
    setTypeFilter('child');
    setBarangayFilter('all');
    setStatusFilter('all');
    setCurrentPage(1);
  };

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white rounded-2xl p-5 border border-gray-100 shadow-2xs flex flex-col justify-between">
              <ShimmerSkeleton className="h-4 w-1/2 rounded-md" />
              <ShimmerSkeleton className="h-7 w-1/3 rounded-lg" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-2xs space-y-4">
          <ShimmerSkeleton className="h-10 w-full rounded-xl" />
          <ShimmerSkeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  /* ── Error state ── */
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 font-bold">
          <X size={24} />
        </div>
        <p className="text-sm font-semibold text-red-600">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 text-xs font-semibold text-emerald-800 bg-white border border-emerald-600 rounded-lg hover:bg-emerald-50 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Summary Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => { setTypeFilter('child'); setStatusFilter('all'); }}
          className={`p-5 rounded-2xl transition-shadow cursor-pointer border shadow-2xs ${
            typeFilter === 'child' && statusFilter === 'all'
              ? 'bg-linear-to-br from-[#1b5e20] to-[#2e7d32] text-white border-transparent'
              : 'bg-white text-gray-800 border-gray-100 hover:border-gray-200 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${typeFilter === 'child' && statusFilter === 'all' ? 'text-white/80' : 'text-gray-500'}`}>
              Total Children
            </span>
            <div className={`p-2 rounded-xl ${typeFilter === 'child' && statusFilter === 'all' ? 'bg-white/20' : 'bg-emerald-50 text-emerald-700'}`}>
              <Baby size={18} />
            </div>
          </div>
          <p className="text-3xl font-black mt-2 tracking-tight">
            <CountUp value={stats?.totalChildren ?? children.length} />
          </p>
          <p className={`text-[11px] font-medium mt-1 ${typeFilter === 'child' && statusFilter === 'all' ? 'text-white/70' : 'text-gray-400'}`}>
            Registered in municipality
          </p>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => { setTypeFilter('mother'); setStatusFilter('all'); }}
          className={`p-5 rounded-2xl transition-shadow cursor-pointer border shadow-2xs ${
            typeFilter === 'mother' && statusFilter === 'all'
              ? 'bg-linear-to-br from-[#1b5e20] to-[#2e7d32] text-white border-transparent'
              : 'bg-white text-gray-800 border-gray-100 hover:border-gray-200 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${typeFilter === 'mother' && statusFilter === 'all' ? 'text-white/80' : 'text-gray-500'}`}>
              Total Mothers
            </span>
            <div className={`p-2 rounded-xl ${typeFilter === 'mother' && statusFilter === 'all' ? 'bg-white/20' : 'bg-emerald-50 text-emerald-700'}`}>
              <Heart size={18} />
            </div>
          </div>
          <p className="text-3xl font-black mt-2 tracking-tight">
            <CountUp value={stats?.totalMothers ?? mothers.length} />
          </p>
          <p className={`text-[11px] font-medium mt-1 ${typeFilter === 'mother' && statusFilter === 'all' ? 'text-white/70' : 'text-gray-400'}`}>
            Maternal health registry
          </p>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => { setTypeFilter('child'); setStatusFilter('normal'); }}
          className={`p-5 rounded-2xl transition-shadow cursor-pointer border shadow-2xs ${
            typeFilter === 'child' && statusFilter === 'normal'
              ? 'bg-linear-to-br from-[#1b5e20] to-[#2e7d32] text-white border-transparent'
              : 'bg-white text-gray-800 border-gray-100 hover:border-gray-200 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${typeFilter === 'child' && statusFilter === 'normal' ? 'text-white/80' : 'text-gray-500'}`}>
              Normal Growth
            </span>
            <div className={`p-2 rounded-xl ${typeFilter === 'child' && statusFilter === 'normal' ? 'bg-white/20' : 'bg-emerald-50 text-emerald-700'}`}>
              <Baby size={18} />
            </div>
          </div>
          <p className="text-3xl font-black mt-2 tracking-tight">
            <CountUp value={children.filter((c) => normalizeStatusKey(c.overall_status) === 'normal').length} />
          </p>
          <p className={`text-[11px] font-medium mt-1 ${typeFilter === 'child' && statusFilter === 'normal' ? 'text-white/70' : 'text-gray-400'}`}>
            Healthy nutritional status
          </p>
        </motion.div>

        <motion.div
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => { setTypeFilter('child'); setStatusFilter('underweight'); }}
          className={`p-5 rounded-2xl transition-shadow cursor-pointer border shadow-2xs ${
            typeFilter === 'child' && statusFilter === 'underweight'
              ? 'bg-linear-to-br from-[#1b5e20] to-[#2e7d32] text-white border-transparent'
              : 'bg-white text-gray-800 border-gray-100 hover:border-gray-200 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${typeFilter === 'child' && statusFilter === 'underweight' ? 'text-white/80' : 'text-gray-500'}`}>
              Underweight Cases
            </span>
            <div className={`p-2 rounded-xl ${typeFilter === 'child' && statusFilter === 'underweight' ? 'bg-white/20' : 'bg-amber-50 text-amber-700'}`}>
              <Baby size={18} />
            </div>
          </div>
          <p className="text-3xl font-black mt-2 tracking-tight">
            <CountUp value={children.filter((c) => normalizeStatusKey(c.overall_status) === 'underweight').length} />
          </p>
          <p className={`text-[11px] font-medium mt-1 ${typeFilter === 'child' && statusFilter === 'underweight' ? 'text-white/70' : 'text-gray-400'}`}>
            Requires supplementary feeding
          </p>
        </motion.div>
      </div>

      {/* ── Main Table Card ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
        {/* Controls Toolbar */}
        <div className="p-4 sm:p-5 border-b border-gray-100 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search beneficiary by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-9 py-2 rounded-xl text-xs font-medium text-gray-800 bg-gray-50 border border-gray-200 focus:bg-white focus:outline-none focus:border-[#2e7d32] focus:ring-2 focus:ring-green-100 transition"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Type Filter */}
              <CustomSelect
                value={typeFilter}
                onChange={setTypeFilter}
                options={[
                  { value: 'child', label: 'Children Only' },
                  { value: 'mother', label: 'Mothers Only' },
                  { value: 'all', label: 'All Beneficiaries' },
                ]}
                placeholder="Beneficiary Type"
              />

              {/* Barangay Filter */}
              <CustomSelect
                value={barangayFilter}
                onChange={setBarangayFilter}
                options={[
                  { value: 'all', label: 'All Barangays' },
                  ...GASAN_BARANGAYS.map((b) => ({ value: b, label: b })),
                ]}
                placeholder="Select Barangay"
              />

              {/* Status Filter */}
              <CustomSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'underweight', label: 'Underweight' },
                  { value: 'severely_underweight', label: 'Severely Underweight' },
                  { value: 'stunted', label: 'Stunted' },
                  { value: 'severely_stunted', label: 'Severely Stunted' },
                  { value: 'wasted', label: 'Wasted' },
                  { value: 'severely_wasted', label: 'Severely Wasted' },
                  { value: 'overweight', label: 'Overweight' },
                  { value: 'obese', label: 'Obese' },
                  { value: 'graduate', label: 'Graduate' },
                  { value: 'active', label: 'Active (Mother)' },
                  { value: 'completed', label: 'Completed (Mother)' },
                  { value: 'no_record', label: 'No Record' },
                ]}
                placeholder="Select Status"
              />

              {/* Reset Button */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-3 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Records Counter */}
          <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
            <span className="font-semibold text-gray-700">
              Showing {totalRecords} {totalRecords === 1 ? 'record' : 'records'}
              {typeFilter === 'child' ? ' (Children)' : typeFilter === 'mother' ? ' (Mothers)' : ''}
            </span>
            {totalRecords > ITEMS_PER_PAGE && (
              <span>
                Page {currentPage} of {totalPages}
              </span>
            )}
          </div>
        </div>

        {/* ── Table Container (Sticky Header + Horizontal Scroll Support) ── */}
        <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
          <table className="w-full min-w-[760px] text-sm table-fixed border-collapse">
            <colgroup>
              <col className="w-[30%] min-w-[200px]" />
              <col className="w-[18%] min-w-[120px]" />
              <col className="w-[22%] min-w-[140px]" />
              <col className="w-[20%] min-w-[150px]" />
              <col className="w-[10%] min-w-[80px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 shadow-2xs">
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                <th className="px-5 py-3.5">Name</th>
                <th className="px-4 py-3.5">Age</th>
                <th className="px-4 py-3.5">Barangay</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-gray-500 text-sm">
                    No records found matching your filters.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((item, idx) => (
                  <motion.tr
                    key={item.id}
                    initial={idx < 10 ? { opacity: 0, y: 6 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={idx < 10 ? { duration: 0.22, delay: idx * 0.03 } : undefined}
                    className="hover:bg-green-50/40 transition-colors h-14"
                  >
                    {/* Name (with Sex below) */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0">
                          {(item.first_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate leading-tight">
                            {item.fullName}
                          </p>
                          <p className="text-xs text-gray-600 font-medium capitalize mt-0.5">
                            {item.displaySex}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Age */}
                    <td className="px-4 py-3 text-xs text-gray-700 font-medium whitespace-nowrap">
                      {item._type === 'child' ? formatAge(item.ageMonths) : '—'}
                    </td>

                    {/* Barangay */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MapPin size={13} className="shrink-0 text-gray-400" />
                        <span className="text-xs text-gray-700 font-medium truncate">
                          {item.barangay}
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge status={item.displayStatus} />
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedPerson(item)}
                        className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-800 bg-white border border-emerald-600 hover:bg-emerald-50 hover:text-emerald-900 transition shadow-2xs cursor-pointer"
                      >
                        View
                      </button>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination Footer ── */}
        {totalRecords > 0 && (
          <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/50">
            <span className="text-xs font-medium text-gray-600">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
              {Math.min(currentPage * ITEMS_PER_PAGE, totalRecords)} of {totalRecords} records
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <span className="px-3 py-1.5 text-xs font-semibold text-gray-700">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── View-Only Detail Modal ── */}
      {createPortal(
        <AnimatePresence>
          {selectedPerson && (
            <motion.div
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-9999 p-4 overflow-hidden"
              onClick={(e) => { if (e.target === e.currentTarget) setSelectedPerson(null); }}
            >
              <motion.div
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="bg-linear-to-r from-[#1b5e20] to-[#2e7d32] px-6 py-5 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-base shrink-0">
                  {(selectedPerson.first_name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-white text-base leading-tight truncate">
                    {selectedPerson.fullName}
                  </p>
                  <p className="text-white/80 text-xs mt-0.5">
                    {selectedPerson._type === 'child' ? 'Child Beneficiary Record' : 'Mother Beneficiary Record'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPerson(null)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition cursor-pointer shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 overflow-y-auto flex-1 divide-y divide-gray-100 space-y-3">
              {selectedPerson._type === 'child' ? (
                <>
                  <div className="pt-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Barangay</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">{selectedPerson.barangay}</p>
                  </div>
                  <div className="pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Age</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">{formatAge(selectedPerson.ageMonths)}</p>
                  </div>
                  <div className="pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Sex</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">{selectedPerson.displaySex}</p>
                  </div>
                  <div className="pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Guardian</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">{selectedPerson.guardian_name || '—'}</p>
                  </div>
                  <div className="pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Latest Weight</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">{selectedPerson.weight_kg ? `${selectedPerson.weight_kg} kg` : '—'}</p>
                  </div>
                  <div className="pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Latest Height</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">{selectedPerson.height_cm ? `${selectedPerson.height_cm} cm` : '—'}</p>
                  </div>
                  <div className="pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Last Assessment Date</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">
                      {selectedPerson.last_visit ? new Date(selectedPerson.last_visit).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'No records yet'}
                    </p>
                  </div>
                  <div className="pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Nutritional Status</p>
                    <StatusBadge status={selectedPerson.displayStatus} />
                  </div>
                </>
              ) : (
                <>
                  <div className="pt-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Barangay</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">{selectedPerson.barangay}</p>
                  </div>
                  <div className="pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Contact Number</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">{selectedPerson.contact_number || '—'}</p>
                  </div>
                  <div className="pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Monitoring Status</p>
                    <StatusBadge status={selectedPerson.displayStatus} />
                  </div>
                  <div className="pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Linked Children</p>
                    {selectedPerson.linked_children && selectedPerson.linked_children.length > 0 ? (
                      <div className="space-y-2">
                        {selectedPerson.linked_children.map((child) => (
                          <div key={child.child_id} className="flex items-center gap-3 rounded-xl bg-gray-50 border border-gray-200 px-3.5 py-2.5">
                            <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold shrink-0">
                              {(child.first_name || '?').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-800 truncate">{child.first_name} {child.last_name}</p>
                              <p className="text-[11px] text-gray-500">
                                {child.age_in_months != null ? `${child.age_in_months} mos` : ''}{child.barangay ? ` · ${child.barangay}` : ''}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">No children linked to this mother.</p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer (View Only) */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 shrink-0 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPerson(null)}
                className="w-full py-2.5 rounded-xl text-xs font-semibold text-gray-700 border border-gray-300 bg-white hover:bg-gray-50 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )}
    </div>
  );
}

export default Masterlist;