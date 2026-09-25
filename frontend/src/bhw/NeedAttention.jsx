import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import {
  AlertCircle,
  Phone,
  Search,
  ArrowUpDown,
  ClipboardPlus,
  Stethoscope,
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

const statusColors = {
  normal: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  MAM: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  SAM: 'bg-red-100 text-red-800 ring-1 ring-red-200',
  underweight: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  severely_underweight: 'bg-red-100 text-red-800 ring-1 ring-red-200',
  overweight: 'bg-blue-100 text-blue-800 ring-1 ring-blue-200',
  obese: 'bg-purple-100 text-purple-800 ring-1 ring-purple-200',
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
  const navigate = useNavigate();
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
  const [referSeverity, setReferSeverity] = useState('medium');
  const [referReason, setReferReason] = useState('');
  const [referSubmitting, setReferSubmitting] = useState(false);
  const [referError, setReferError] = useState('');

  // log visit / service modal
  const [visitTarget, setVisitTarget] = useState(null);
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10));
  const [serviceType, setServiceType] = useState('vitamin_a');
  const [visitWeight, setVisitWeight] = useState('');
  const [visitHeight, setVisitHeight] = useState('');
  const [visitNotes, setVisitNotes] = useState('');
  const [visitSubmitting, setVisitSubmitting] = useState(false);
  const [visitError, setVisitError] = useState('');

  const fetchData = async () => {
    try {
      const response = await axiosClient.get('/bhw/need-attention', {
        params: { barangay: user.barangay },
      });
      setChildren(response.data || []);
    } catch {
      setError('Failed to load attention list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
        if (ageFilter === '0-11') return c.age_in_months <= 11;
        if (ageFilter === '12-23') return c.age_in_months >= 12 && c.age_in_months <= 23;
        return c.age_in_months >= 24;
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
    setReferTarget(child);
    setReferSeverity('medium');
    setReferReason('');
    setReferError('');
  };

  const submitReferral = async () => {
    if (!referTarget) return;
    setReferSubmitting(true);
    setReferError('');
    try {
      await axiosClient.post('/bhw/referrals', {
        child_id: referTarget.child_id,
        severity: referSeverity,
        reason: referReason || 'Nutrition intervention follow-up needed',
        referred_by: user.user_id,
      });
      setReferTarget(null);
      alert('Referral submitted successfully.');
    } catch {
      setReferError('Failed to submit referral. Please try again.');
    } finally {
      setReferSubmitting(false);
    }
  };

  const openVisitModal = (child, e) => {
    e.stopPropagation();
    setVisitTarget(child);
    setVisitDate(new Date().toISOString().slice(0, 10));
    setServiceType('vitamin_a');
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
      await axiosClient.post('/bhw/need-attention/child-services', {
        child_id: visitTarget.child_id,
        service_date: visitDate,
        service_type: serviceType,
        provided_by: user.user_id,
        weight_kg: visitWeight || null,
        height_cm: visitHeight || null,
        notes: visitNotes,
      });
      setChildren((prev) =>
        prev.map((c) =>
          c.child_id === visitTarget.child_id
            ? { ...c, last_visit: visitDate, weight_kg: visitWeight || c.weight_kg, height_cm: visitHeight || c.height_cm }
            : c
        )
      );
      setVisitTarget(null);
      alert('Health service recorded successfully.');
    } catch {
      setVisitError('Failed to log service visit. Please try again.');
    } finally {
      setVisitSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-10 h-10 rounded-full border-4 border-green-200 border-t-green-600 animate-spin" />
        <p className="text-sm font-medium text-gray-400">Loading attention cases…</p>
      </div>
    );
  }

  if (error) return <p className="text-red-600 p-6">{error}</p>;

  const samCount = children.filter((c) => c.overall_status === 'SAM' || c.weight_status === 'severely_underweight').length;
  const mamCount = children.filter((c) => c.overall_status === 'MAM' || c.weight_status === 'underweight').length;
  const overdueCount = children.filter((c) => (daysSince(c.last_visit) ?? 999) > 30).length;

  return (
    <div className="space-y-6">

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
          <div className="flex flex-1 min-w-[240px] items-center gap-2 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-100 focus-within:border-green-400 focus-within:ring-2 focus-within:ring-green-100 transition">
            <Search size={16} className="text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search child by name or guardian…"
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
              <option value="0-11">0–11 months</option>
              <option value="12-23">12–23 months</option>
              <option value="24+">24+ months</option>
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
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[12%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
              <col className="w-[18%]" />
            </colgroup>
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-400 bg-gray-50/80 border-b border-gray-100">
                <th className="px-6 py-3.5">Child & Guardian</th>
                <th className="px-4 py-3.5">Age</th>
                <th className="px-4 py-3.5">Weight / Height</th>
                <th className="px-4 py-3.5 text-center">Nutrition Status</th>
                <th className="px-4 py-3.5">Last Visit</th>
                <th className="px-4 py-3.5 text-center">Interventions</th>
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
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${statusColors[c.overall_status] || 'bg-gray-100 text-gray-700'}`}>
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
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => openVisitModal(c, e)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#2e7d32] border border-green-200 bg-green-50 hover:bg-green-100 transition inline-flex items-center gap-1"
                          >
                            <Stethoscope size={13} /> Log Visit
                          </button>
                          <button
                            type="button"
                            onClick={(e) => openReferModal(c, e)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-700 border border-amber-200 bg-amber-50 hover:bg-amber-100 transition inline-flex items-center gap-1"
                          >
                            <ClipboardPlus size={13} /> Refer
                          </button>
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
      {visitTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={() => setVisitTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-[#1b5e20] to-[#2e7d32] px-6 py-5 flex items-center justify-between text-white">
              <div>
                <h3 className="font-bold text-base">Record Health Visit / Service</h3>
                <p className="text-xs text-white/70 mt-0.5">{visitTarget.first_name} {visitTarget.last_name}</p>
              </div>
              <button onClick={() => setVisitTarget(null)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-3.5">
              {visitError && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200 font-medium">{visitError}</div>}

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Service Provided *</label>
                <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32]">
                  {serviceOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
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

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setVisitTarget(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50">Cancel</button>
                <button type="button" disabled={visitSubmitting} onClick={submitVisit} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#1b5e20] to-[#2e7d32] hover:from-[#154a1a] hover:to-[#256427] disabled:opacity-60">
                  {visitSubmitting ? 'Saving…' : 'Save Service'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Refer Modal ── */}
      {referTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={() => setReferTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-5 flex items-center justify-between text-white">
              <div>
                <h3 className="font-bold text-base">Refer Child to RHU / Doctor</h3>
                <p className="text-xs text-white/80 mt-0.5">{referTarget.first_name} {referTarget.last_name}</p>
              </div>
              <button onClick={() => setReferTarget(null)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-3.5">
              {referError && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200 font-medium">{referError}</div>}

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Severity Level *</label>
                <select value={referSeverity} onChange={(e) => setReferSeverity(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-600">
                  <option value="low">Low — Routine checkup</option>
                  <option value="medium">Medium — Growth faltering / MAM</option>
                  <option value="high">High (Urgent) — SAM / Severe health concern</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Reason for Referral *</label>
                <textarea rows={3} placeholder="Describe current condition, symptoms, or why RHU medical evaluation is recommended…" value={referReason} onChange={(e) => setReferReason(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-600 resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setReferTarget(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50">Cancel</button>
                <button type="button" disabled={referSubmitting} onClick={submitReferral} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:opacity-60">
                  {referSubmitting ? 'Submitting…' : 'Submit Referral'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default NeedAttention;