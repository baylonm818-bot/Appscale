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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={18} className="text-[#2e7d32]" />
            <h2 className="text-lg font-black text-gray-900">System Activity Logs</h2>
          </div>
          <p className="text-xs text-gray-500">All BNS and BHW edits and activities, recorded automatically.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by action…"
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
              <table className="w-full min-w-[700px] text-sm border-collapse">
                <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-5 py-3.5">Timestamp</th>
                    <th className="px-4 py-3.5">Actor</th>
                    <th className="px-4 py-3.5">Role</th>
                    <th className="px-4 py-3.5">Action</th>
                    <th className="px-4 py-3.5">Entity</th>
                    <th className="px-4 py-3.5 text-center">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center text-gray-400 text-sm">
                        No log entries found.
                      </td>
                    </tr>
                  ) : logs.map((log) => (
                    <tr key={log.log_id} className="hover:bg-gray-50 transition">
                      <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(log.created_at)}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-800">{log.actor_name || `User #${log.actor_id}` || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                          log.actor_role === 'bns' ? 'bg-blue-50 text-blue-700'
                          : log.actor_role === 'bhw' ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-gray-100 text-gray-600'
                        }`}>{log.actor_role || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${actionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {log.entity_type ? `${log.entity_type}${log.entity_id ? ` #${log.entity_id}` : ''}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {log.details ? (
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="text-[11px] font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1"
                          >
                            <FileText size={12} /> View
                          </button>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
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
                    className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
                  >
                    <ChevronLeft size={13} /> Prev
                  </button>
                  <span className="px-3 font-semibold">{page} / {pagination.totalPages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={page === pagination.totalPages}
                    className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
                  >
                    Next <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Drawer */}
      <AnimatePresence>
        {selectedLog && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setSelectedLog(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
            >
              <div className="bg-gradient-to-r from-[#1b5e20] to-[#2e7d32] px-6 py-4 flex items-center justify-between text-white">
                <div>
                  <p className="font-bold text-base">{selectedLog.action}</p>
                  <p className="text-white/70 text-xs mt-0.5">{formatDate(selectedLog.created_at)}</p>
                </div>
                <button onClick={() => setSelectedLog(null)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
                  <X size={15} />
                </button>
              </div>
              <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Actor</p>
                    <p className="font-semibold text-gray-800 mt-0.5">{selectedLog.actor_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Role</p>
                    <p className="font-semibold text-gray-800 mt-0.5 uppercase">{selectedLog.actor_role || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Entity</p>
                    <p className="font-semibold text-gray-800 mt-0.5">
                      {selectedLog.entity_type || '—'} {selectedLog.entity_id ? `#${selectedLog.entity_id}` : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">IP</p>
                    <p className="font-semibold text-gray-800 mt-0.5">{selectedLog.ip_address || '—'}</p>
                  </div>
                </div>
                {selectedLog.details && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Details</p>
                    <pre className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap font-mono">
                      {JSON.stringify(
                        typeof selectedLog.details === 'string'
                          ? JSON.parse(selectedLog.details)
                          : selectedLog.details,
                        null, 2
                      )}
                    </pre>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
