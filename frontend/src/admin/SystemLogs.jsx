/**
 * SystemLogs.jsx — Step 9: Admin-only view of all BNS/BHW activity logs
 * Route: /admin/system-logs
 */
import { useState, useEffect, useCallback } from 'react';
import axiosClient from '../api/axiosClient';
import { motion, AnimatePresence } from 'framer-motion';
import { ShimmerSkeleton } from '../components/ui/motion';
import { Search, X, ChevronLeft, ChevronRight, FileText, Shield } from 'lucide-react';

const ACTION_COLORS = {
  CREATE:  'bg-emerald-50 text-emerald-700 border border-emerald-200',
  UPDATE:  'bg-blue-50   text-blue-700   border border-blue-200',
  DELETE:  'bg-red-50    text-red-700    border border-red-200',
  SUBMIT:  'bg-purple-50 text-purple-700 border border-purple-200',
  default: 'bg-gray-100  text-gray-600   border border-gray-200',
};

function actionColor(action) {
  const upper = String(action || '').toUpperCase();
  if (upper.startsWith('CREATE')) return ACTION_COLORS.CREATE;
  if (upper.startsWith('UPDATE')) return ACTION_COLORS.UPDATE;
  if (upper.startsWith('DELETE')) return ACTION_COLORS.DELETE;
  if (upper.startsWith('SUBMIT')) return ACTION_COLORS.SUBMIT;
  return ACTION_COLORS.default;
}

function formatDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
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
  if (!d) return '—';

  if (d.summary) return d.summary;

  const action = String(log.action || '').toUpperCase();
  if (action === 'CREATE_CHILD') {
    return `Registered new child: ${d.name || 'Child'}${d.barangay ? ` (${d.barangay})` : ''}`;
  }
  if (action === 'UPDATE_CHILD') {
    if (d.after && typeof d.after === 'object') {
      const keys = Object.keys(d.after);
      if (keys.length > 0) {
        return keys
          .map((k) => `${k.replace(/_/g, ' ')}: "${d.before?.[k] ?? '—'}" → "${d.after[k]}"`)
          .join('; ');
      }
    }
    return `Updated child ${d.child_name || d.name || ''}`;
  }
  if (action === 'TRANSFER_BENEFICIARY') {
    return `Transferred ${d.name || 'beneficiary'}: ${d.from_barangay || '—'} → ${d.to_barangay || '—'}`;
  }
  if (action === 'CREATE_SCHEDULE_BHW' || action === 'CREATE_SCHEDULE') {
    return `Scheduled: "${d.title || 'Activity'}" (${d.venue || d.barangay || 'Barangay'})`;
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

  return Object.entries(d)
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(', ');
}

export default function SystemLogs() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 50, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);

  // Detail drawer
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (roleFilter) params.append('role', roleFilter);
      if (search)     params.append('action', search);
      const { data } = await axiosClient.get(`/admin/logs?${params.toString()}`);
      setLogs(data.logs || []);
      setPagination(data.pagination || { total: 0, page: 1, limit: 50, totalPages: 1 });
    } catch {
      setError('Failed to load system logs.');
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, search]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [roleFilter, search]);

  const selectedDetails = selectedLog ? parseDetails(selectedLog.details) : null;
  const hasDiff = selectedDetails && selectedDetails.after && typeof selectedDetails.after === 'object' && Object.keys(selectedDetails.after).length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={18} className="text-[#2e7d32]" />
            <h2 className="text-lg font-black text-gray-900">System Activity Logs</h2>
          </div>
          <p className="text-xs text-gray-500">Audit trail of all changes and activities performed by BNS and BHW workers.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by action or keyword…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="text-xs font-semibold border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 text-gray-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 min-w-[140px]"
        >
          <option value="">All Roles</option>
          <option value="bns">BNS only</option>
          <option value="bhw">BHW only</option>
          <option value="admin">Admin only</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1,2,3,4,5].map((i) => <ShimmerSkeleton key={i} className="h-10 w-full rounded-xl" />)}
          </div>
        ) : error ? (
          <div className="p-10 text-center text-red-600 text-sm font-semibold">{error}</div>
        ) : (
          <>
            <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
              <table className="w-full min-w-[850px] text-sm border-collapse">
                <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-5 py-3.5 whitespace-nowrap">Timestamp</th>
                    <th className="px-4 py-3.5 whitespace-nowrap">Actor</th>
                    <th className="px-4 py-3.5 whitespace-nowrap">Role</th>
                    <th className="px-4 py-3.5 whitespace-nowrap">Action</th>
                    <th className="px-4 py-3.5 whitespace-nowrap">Entity</th>
                    <th className="px-4 py-3.5">Changes / Summary</th>
                    <th className="px-4 py-3.5 text-center whitespace-nowrap">Diff / Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center text-gray-400 text-sm">
                        No log entries found.
                      </td>
                    </tr>
                  ) : logs.map((log) => {
                    const summaryText = formatLogSummary(log);
                    return (
                      <tr key={log.log_id} className="hover:bg-gray-50 transition">
                        <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(log.created_at)}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-gray-800 whitespace-nowrap">{log.actor_name || `User #${log.actor_id}` || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                            log.actor_role === 'bns' ? 'bg-blue-50 text-blue-700'
                            : log.actor_role === 'bhw' ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-gray-100 text-gray-600'
                          }`}>{log.actor_role || '—'}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${actionColor(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                          {log.entity_type ? `${log.entity_type}${log.entity_id ? ` #${log.entity_id}` : ''}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700 max-w-md font-medium">
                          <span className="line-clamp-2" title={summaryText}>
                            {summaryText}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {log.details ? (
                            <button
                              onClick={() => setSelectedLog(log)}
                              className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                            >
                              <FileText size={12} /> Inspect
                            </button>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
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
                <span>{pagination.total} total entries</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft size={13} /> Prev
                  </button>
                  <span className="px-3 font-semibold">{page} / {pagination.totalPages}</span>
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

      {/* Detail Modal */}
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
              <div className="bg-gradient-to-r from-[#1b5e20] to-[#2e7d32] px-6 py-4 flex items-center justify-between text-white shrink-0">
                <div>
                  <p className="font-bold text-base">{selectedLog.action}</p>
                  <p className="text-white/70 text-xs mt-0.5">{formatDate(selectedLog.created_at)}</p>
                </div>
                <button onClick={() => setSelectedLog(null)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition cursor-pointer">
                  <X size={15} />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
                {/* Meta Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <div>
                    <p className="font-semibold text-gray-400 uppercase tracking-wider text-[10px]">Actor</p>
                    <p className="font-bold text-gray-800 mt-0.5 truncate">{selectedLog.actor_name || '—'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-400 uppercase tracking-wider text-[10px]">Role</p>
                    <p className="font-bold text-emerald-800 mt-0.5 uppercase">{selectedLog.actor_role || '—'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-400 uppercase tracking-wider text-[10px]">Target Entity</p>
                    <p className="font-bold text-gray-800 mt-0.5 truncate">
                      {selectedLog.entity_type || '—'} {selectedLog.entity_id ? `#${selectedLog.entity_id}` : ''}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-400 uppercase tracking-wider text-[10px]">IP Address</p>
                    <p className="font-medium text-gray-600 mt-0.5">{selectedLog.ip_address || '—'}</p>
                  </div>
                </div>

                {/* Summary Banner */}
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3">
                  <p className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">Activity Summary</p>
                  <p className="text-xs text-emerald-950 font-medium mt-1 leading-relaxed">
                    {formatLogSummary(selectedLog)}
                  </p>
                </div>

                {/* Side-by-Side Before vs After Table */}
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
                            <th className="px-3 py-2 text-left text-red-700 bg-red-50/40">Previous Value (Dati)</th>
                            <th className="px-3 py-2 text-left text-emerald-800 bg-emerald-50/40">Updated Value (Bago)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {Object.keys(selectedDetails.after).map((field) => (
                            <tr key={field} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-medium text-gray-800 capitalize">{field.replace(/_/g, ' ')}</td>
                              <td className="px-3 py-2 text-red-600 bg-red-50/20 font-mono">
                                {String(selectedDetails.before?.[field] ?? '—')}
                              </td>
                              <td className="px-3 py-2 text-emerald-700 bg-emerald-50/20 font-bold font-mono">
                                {String(selectedDetails.after[field] ?? '—')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Raw JSON Details (Collapsible) */}
                {selectedDetails && (
                  <details className="text-xs text-gray-500 cursor-pointer">
                    <summary className="font-semibold text-gray-600 hover:text-gray-900 mb-1">
                      View Raw Payload (JSON)
                    </summary>
                    <pre className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-[11px] text-gray-700 overflow-x-auto whitespace-pre-wrap font-mono mt-1">
                      {JSON.stringify(selectedDetails, null, 2)}
                    </pre>
                  </details>
                )}
              </div>

              <div className="border-t border-gray-100 px-6 py-3 bg-gray-50 flex justify-end shrink-0">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-100 transition cursor-pointer"
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
