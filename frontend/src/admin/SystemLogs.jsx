/**
 * SystemLogs.jsx — Admin-only view of all BNS/BHW activity logs
 * Route: /admin/system-logs
 */
import { useState, useEffect, useCallback } from 'react';
import axiosClient from '../api/axiosClient';
import { motion, AnimatePresence } from 'framer-motion';
import { ShimmerSkeleton } from '../components/ui/motion';
import { Search, X, ChevronLeft, ChevronRight, MapPin, Activity, Eye, Calendar, User, Clock, CheckCircle } from 'lucide-react';

const GASAN_BARANGAYS = [
  'Antipolo', 'B. Ibaba', 'B. Ilaya', 'Bacong-Bacong', 'Bahi', 'Bangbang',
  'Banot', 'Banuyo', 'Bognuyan', 'Cabugao', 'Dawis', 'Dili', 'Libtangin',
  'Mahunig', 'Mangiliol', 'Masiga', 'Mat. Gasan', 'Pangi', 'Pinggan',
  'Tabionan', 'Tiguion', 'Brgy. Uno', 'Brgy. Dos', 'Brgy. Tres', 'Tapuyan',
];

const ACTION_COLORS = {
  CREATE:  'bg-emerald-50 text-emerald-800 border border-emerald-200',
  RECORD:  'bg-teal-50    text-teal-800    border border-teal-200',
  UPDATE:  'bg-blue-50    text-blue-800    border border-blue-200',
  SUBMIT:  'bg-purple-50  text-purple-800  border border-purple-200',
  MARK:    'bg-green-50   text-green-800   border border-green-200',
  DELETE:  'bg-red-50     text-red-800     border border-red-200',
  default: 'bg-gray-100   text-gray-700    border border-gray-200',
};

function actionColor(action) {
  const upper = String(action || '').toUpperCase();
  if (upper.startsWith('CREATE') || upper.startsWith('REGISTER')) return ACTION_COLORS.CREATE;
  if (upper.startsWith('RECORD')) return ACTION_COLORS.RECORD;
  if (upper.startsWith('UPDATE')) return ACTION_COLORS.UPDATE;
  if (upper.startsWith('SUBMIT')) return ACTION_COLORS.SUBMIT;
  if (upper.startsWith('MARK'))   return ACTION_COLORS.MARK;
  if (upper.startsWith('DELETE')) return ACTION_COLORS.DELETE;
  return ACTION_COLORS.default;
}

function formatActionName(action) {
  if (!action) return '—';
  const map = {
    RECORD_NUTRITION_ASSESSMENT: 'Nutrition Assessment',
    RECORD_MEDICAL_INTERVENTION: 'Medical Intervention',
    SUBMIT_REFERRAL: 'Submit Referral',
    UPDATE_REFERRAL_STATUS: 'Update Referral',
    CREATE_SCHEDULE: 'Create Schedule',
    CREATE_SCHEDULE_BHW: 'Create Schedule',
    MARK_SCHEDULE_DONE: 'Completed Schedule',
    SUBMIT_SCHEDULE_AUDIT: 'Schedule Audit',
    RECORD_FEEDING_ATTENDANCE: 'Feeding Attendance',
    PROVIDE_CHILD_SERVICE: 'Child Health Service',
    UPDATE_CHILD: 'Update Child Info',
    REGISTER_CHILD: 'Register Child',
    CREATE_CHILD: 'Register Child',
    TRANSFER_BENEFICIARY: 'Transfer Beneficiary',
    ADD_FEEDING_MEAL: 'Feeding Meal Added',
    UPDATE_SIGNATORIES: 'Update Signatories',
  };
  if (map[action]) return map[action];
  return String(action)
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatFieldKey(key) {
  const map = {
    child_name: 'Child Name',
    name: 'Full Name',
    weight_kg: 'Weight (kg)',
    height_cm: 'Height (cm)',
    muac_cm: 'MUAC (cm)',
    overall_status: 'Nutritional Status',
    beneficiary: 'Beneficiary',
    title: 'Activity Title',
    schedule_type: 'Schedule Type',
    venue: 'Venue / Location',
    barangay: 'Barangay',
    attendee_count: 'Number of Attendees',
    food_served: 'Food Served',
    food: 'Meal',
    diagnosis: 'Diagnosis',
    intervention: 'Intervention',
    reason: 'Reason / Concern',
    action_taken: 'Action Taken',
    notes: 'Notes / Remarks',
    audit_notes: 'Audit Notes',
    from_barangay: 'Origin Barangay',
    to_barangay: 'Destination Barangay',
    count: 'Count',
  };
  if (map[key]) return map[key];
  return String(key)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDateTimeParts(dt) {
  if (!dt) return { date: '—', time: '' };
  const d = new Date(dt);
  return {
    date: d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true }),
  };
}

function parseDetails(details) {
  if (!details) return null;
  if (typeof details === 'object') return details;
  try {
    return JSON.parse(details);
  } catch {
    return null;
  }
}

function formatLogSummary(log) {
  const d = parseDetails(log.details);
  if (!d) return 'Activity logged in the system.';

  if (d.summary) return d.summary;

  const action = String(log.action || '').toUpperCase();
  if (action === 'CREATE_CHILD' || action === 'REGISTER_CHILD') {
    return `Registered new child beneficiary: ${d.child_name || d.name || 'Child'}${d.barangay ? ` in Barangay ${d.barangay}` : ''}`;
  }
  if (action === 'RECORD_NUTRITION_ASSESSMENT') {
    return `Recorded nutrition measurement for ${d.child_name || 'child'}: Weight ${d.weight_kg || '—'}kg, Height ${d.height_cm || '—'}cm${d.overall_status ? `, Status: ${d.overall_status}` : ''}`;
  }
  if (action === 'RECORD_MEDICAL_INTERVENTION') {
    return d.summary || `Recorded medical intervention for ${d.beneficiary || 'beneficiary'}`;
  }
  if (action === 'SUBMIT_REFERRAL') {
    return d.summary || `Submitted referral for ${d.beneficiary || 'beneficiary'}`;
  }
  if (action === 'UPDATE_REFERRAL_STATUS') {
    return d.summary || `Updated referral status for ${d.beneficiary || 'beneficiary'}`;
  }
  if (action === 'RECORD_FEEDING_ATTENDANCE') {
    return d.summary || `Logged feeding program attendance${d.barangay ? ` in Barangay ${d.barangay}` : ''}`;
  }
  if (action === 'PROVIDE_CHILD_SERVICE') {
    return d.summary || `Provided health service to ${d.child_name || 'child'}`;
  }
  if (action === 'UPDATE_CHILD') {
    if (d.after && typeof d.after === 'object') {
      const keys = Object.keys(d.after);
      if (keys.length > 0) {
        return keys
          .map((k) => `${formatFieldKey(k)}: "${d.before?.[k] ?? '—'}" → "${d.after[k]}"`)
          .join('; ');
      }
    }
    return `Updated child profile for ${d.child_name || d.name || 'beneficiary'}`;
  }
  if (action === 'TRANSFER_BENEFICIARY') {
    return `Transferred ${d.name || 'beneficiary'}: ${d.from_barangay || '—'} → ${d.to_barangay || '—'}`;
  }
  if (action === 'CREATE_SCHEDULE_BHW' || action === 'CREATE_SCHEDULE') {
    return `Scheduled: "${d.title || 'Activity'}" (${d.venue || d.barangay || 'Health Center'})`;
  }
  if (action === 'MARK_SCHEDULE_DONE') {
    return `Marked schedule "${d.title || 'Activity'}" as completed`;
  }
  if (action === 'SUBMIT_SCHEDULE_AUDIT') {
    return `Submitted activity audit: "${d.notes || d.audit_notes || 'Completed'}"`;
  }
  if (action === 'ADD_FEEDING_MEAL') {
    return `Recorded meal: ${d.food_served || d.food || 'Feeding meal'}`;
  }
  if (action === 'UPDATE_SIGNATORIES') {
    return `Updated signatories for ${d.barangay || 'All Barangays'} (${d.count || 0} signatories)`;
  }

  // Safe fallback without raw JSON
  const entries = Object.entries(d).filter(
    ([k]) => !['before', 'after', 'summary', 'user_id', 'created_by', 'actor_id'].includes(k)
  );
  if (entries.length === 0) return 'Activity logged in the system.';
  return entries
    .slice(0, 3)
    .map(([k, v]) => `${formatFieldKey(k)}: ${typeof v === 'object' ? Object.values(v).join(', ') : v}`)
    .join(' • ');
}

export default function SystemLogs() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 50, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [barangayFilter, setBarangayFilter] = useState('');
  const [page, setPage] = useState(1);

  // Detail modal
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (roleFilter)     params.append('role', roleFilter);
      if (barangayFilter) params.append('barangay', barangayFilter);
      if (search)         params.append('action', search);
      const { data } = await axiosClient.get(`/admin/logs?${params.toString()}`);
      setLogs(data.logs || []);
      setPagination(data.pagination || { total: 0, page: 1, limit: 50, totalPages: 1 });
    } catch {
      setError('Failed to load system logs.');
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, barangayFilter, search]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [roleFilter, barangayFilter, search]);

  const selectedDetails = selectedLog ? parseDetails(selectedLog.details) : null;
  const hasDiff = selectedDetails && selectedDetails.after && typeof selectedDetails.after === 'object' && Object.keys(selectedDetails.after).length > 0;

  // Filter out meta/system keys so only user-facing information displays in the modal
  const infoEntries = selectedDetails
    ? Object.entries(selectedDetails).filter(
        ([k, v]) =>
          !['summary', 'before', 'after', 'user_id', 'created_by', 'actor_id', 'actor_role'].includes(k) &&
          v !== null &&
          v !== undefined &&
          v !== ''
      )
    : [];

  return (
    <div className="space-y-4">
      {/* Controls & Filters Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex-1 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {/* Keyword Search */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by action, worker, keyword, or barangay…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Barangay Filter */}
          <div className="relative">
            <select
              value={barangayFilter}
              onChange={(e) => setBarangayFilter(e.target.value)}
              className="w-full sm:w-auto text-xs font-semibold border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 text-gray-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 min-w-[160px] cursor-pointer"
            >
              <option value="">All Barangays</option>
              {GASAN_BARANGAYS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Role Filter */}
          <div className="relative">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full sm:w-auto text-xs font-semibold border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 text-gray-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 min-w-[130px] cursor-pointer"
            >
              <option value="">All Roles</option>
              <option value="bns">BNS only</option>
              <option value="bhw">BHW only</option>
              <option value="admin">Admin only</option>
            </select>
          </div>
        </div>

        {/* Counter Badge */}
        <div className="shrink-0 flex items-center gap-2 text-xs font-medium text-gray-500 self-end md:self-auto">
          <Activity size={14} className="text-emerald-600" />
          <span>Showing <strong className="text-gray-800 font-bold">{pagination.total}</strong> recorded activities</span>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => <ShimmerSkeleton key={i} className="h-12 w-full rounded-xl" />)}
          </div>
        ) : error ? (
          <div className="p-10 text-center text-red-600 text-sm font-semibold">{error}</div>
        ) : (
          <>
            <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
              <table className="w-full text-sm border-collapse table-auto">
                <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-xs border-b border-gray-200">
                  <tr className="text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                    <th className="px-3.5 py-3 whitespace-nowrap w-[130px] min-w-[120px]">Date & Time</th>
                    <th className="px-3 py-3 whitespace-nowrap w-[120px] min-w-[110px]">Barangay</th>
                    <th className="px-3 py-3 whitespace-nowrap w-[150px] min-w-[130px]">Worker & Role</th>
                    <th className="px-3 py-3 whitespace-nowrap w-[150px] min-w-[130px]">Action</th>
                    <th className="px-4 py-3 min-w-[240px]">Activity Summary</th>
                    <th className="px-3 py-3 text-center whitespace-nowrap w-[100px] min-w-[100px]">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center text-gray-400 text-sm font-medium">
                        No activity log entries found for the selected criteria.
                      </td>
                    </tr>
                  ) : logs.map((log) => {
                    const dtParts = formatDateTimeParts(log.created_at);
                    const summaryText = formatLogSummary(log);
                    const roleUpper = String(log.actor_role || '').toUpperCase();
                    return (
                      <tr key={log.log_id} className="hover:bg-emerald-50/20 transition-colors">
                        {/* Date & Time */}
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <p className="text-xs font-bold text-gray-800 leading-tight whitespace-nowrap">{dtParts.date}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5 font-medium whitespace-nowrap">{dtParts.time}</p>
                        </td>

                        {/* Barangay */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                            <MapPin size={11} className="text-emerald-600 shrink-0" />
                            {log.barangay || '—'}
                          </span>
                        </td>

                        {/* Worker & Role */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div>
                            <p className="text-xs font-bold text-gray-900 leading-snug truncate max-w-[150px]" title={log.actor_name}>
                              {log.actor_name || (log.actor_id ? `User #${log.actor_id}` : '—')}
                            </p>
                            <span className={`inline-block text-[10px] font-bold px-2 py-0.2 rounded-full uppercase mt-0.5 whitespace-nowrap ${
                              roleUpper === 'BNS'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : roleUpper === 'BHW'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}>
                              {log.actor_role || 'Staff'}
                            </span>
                          </div>
                        </td>

                        {/* Action Badge */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg whitespace-nowrap inline-block ${actionColor(log.action)}`}>
                            {formatActionName(log.action)}
                          </span>
                        </td>

                        {/* Activity Summary (Spacious, wraps cleanly, never squished!) */}
                        <td className="px-4 py-2.5 text-xs text-gray-700 font-medium min-w-[240px]">
                          <p className="line-clamp-2 leading-relaxed" title={summaryText}>
                            {summaryText}
                          </p>
                        </td>

                        {/* Details Button */}
                        <td className="px-3 py-2.5 text-center whitespace-nowrap w-[100px] min-w-[100px]">
                          <button
                            type="button"
                            onClick={() => setSelectedLog(log)}
                            className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition shadow-2xs cursor-pointer"
                          >
                            <Eye size={13} className="shrink-0 text-emerald-700" />
                            <span className="whitespace-nowrap">Details</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>{pagination.total} total activities recorded</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft size={13} /> Prev
                  </button>
                  <span className="px-3 font-semibold text-gray-700">{page} / {pagination.totalPages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={page === pagination.totalPages}
                    className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
                  >
                    Next <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Clean Human-Readable Detail Modal (Zero JSON!) */}
      <AnimatePresence>
        {selectedLog && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setSelectedLog(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-[#1b5e20] to-[#2e7d32] px-6 py-4 flex items-center justify-between text-white shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Activity size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-base leading-snug">{formatActionName(selectedLog.action)}</p>
                    <p className="text-white/80 text-xs mt-0.5">
                      {formatDateTimeParts(selectedLog.created_at).date} • {formatDateTimeParts(selectedLog.created_at).time}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition cursor-pointer text-white"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
                {/* Meta Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Barangay</span>
                    <span className="text-xs font-bold text-emerald-900 mt-0.5 block truncate">
                      {selectedLog.barangay || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Actor / Worker</span>
                    <span className="text-xs font-bold text-gray-800 mt-0.5 block truncate">
                      {selectedLog.actor_name || 'Staff'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Role</span>
                    <span className="text-xs font-bold text-emerald-700 mt-0.5 uppercase block">
                      {selectedLog.actor_role || 'Staff'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Reference</span>
                    <span className="text-xs font-bold text-gray-700 mt-0.5 block truncate">
                      {selectedLog.entity_type ? `${formatFieldKey(selectedLog.entity_type)}${selectedLog.entity_id ? ` #${selectedLog.entity_id}` : ''}` : '—'}
                    </span>
                  </div>
                </div>

                {/* Summary Banner */}
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 mb-1 text-emerald-900">
                    <CheckCircle size={14} className="text-emerald-700 shrink-0" />
                    <p className="text-xs font-bold uppercase tracking-wider">Activity Summary</p>
                  </div>
                  <p className="text-xs text-emerald-950 font-medium leading-relaxed">
                    {formatLogSummary(selectedLog)}
                  </p>
                </div>

                {/* Formatted Key-Value Details (Clean cards, NO RAW JSON!) */}
                {infoEntries.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Activity Details
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {infoEntries.map(([key, val]) => {
                        const displayVal = typeof val === 'object'
                          ? Object.entries(val).map(([k, v]) => `${formatFieldKey(k)}: ${v}`).join(', ')
                          : String(val);
                        return (
                          <div key={key} className="bg-gray-50/90 border border-gray-200/80 rounded-xl p-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                              {formatFieldKey(key)}
                            </span>
                            <span className="text-xs font-semibold text-gray-800 mt-0.5 block break-words">
                              {displayVal}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Before vs After Table (If diff exists) */}
                {hasDiff && (
                  <div>
                    <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Changes Made (Before vs. After)
                    </p>
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-100 text-gray-600 font-semibold border-b border-gray-200">
                          <tr>
                            <th className="px-3 py-2 text-left">Field</th>
                            <th className="px-3 py-2 text-left text-red-700 bg-red-50/40">Dati (Previous)</th>
                            <th className="px-3 py-2 text-left text-emerald-800 bg-emerald-50/40">Bago (Updated)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {Object.keys(selectedDetails.after).map((field) => (
                            <tr key={field} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-medium text-gray-800 capitalize">
                                {formatFieldKey(field)}
                              </td>
                              <td className="px-3 py-2 text-red-600 bg-red-50/20 font-semibold">
                                {String(selectedDetails.before?.[field] ?? '—')}
                              </td>
                              <td className="px-3 py-2 text-emerald-700 bg-emerald-50/20 font-bold">
                                {String(selectedDetails.after[field] ?? '—')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-gray-100 px-6 py-3.5 bg-gray-50 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="px-5 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-100 transition cursor-pointer shadow-2xs"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
