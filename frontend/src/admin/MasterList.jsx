import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { Users, Search, Baby, Heart, X, MapPin } from 'lucide-react';

/* ── Status badge config ── */
const STATUS_CONFIG = {
  normal:      { label: 'Normal',      cls: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' },
  MAM:         { label: 'MAM',         cls: 'bg-amber-100  text-amber-700  ring-1 ring-amber-200'  },
  SAM:         { label: 'SAM',         cls: 'bg-red-100    text-red-700    ring-1 ring-red-200'    },
  overweight:  { label: 'Overweight',  cls: 'bg-orange-100 text-orange-700 ring-1 ring-orange-200' },
  obese:       { label: 'Obese',       cls: 'bg-rose-100   text-rose-700   ring-1 ring-rose-200'   },
  graduate:    { label: 'Graduate',    cls: 'bg-blue-100   text-blue-700   ring-1 ring-blue-200'   },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 ring-1 ring-gray-200">—</span>;
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.cls}`}>{cfg.label}</span>;
}

/* ── Stat card ── */
function StatCard({ icon: Icon, label, value, sublabel, gradient, iconCls, onClick, isActive }) {
  const colored = isActive && gradient;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl p-5 shadow-sm transition-all duration-200 focus:outline-none
        ${colored ? gradient : 'bg-white'}
        ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:translate-y-0' : ''}
        ${isActive && !gradient ? 'ring-2 ring-offset-2 ring-green-500 shadow-md' : ''}
        ${isActive && gradient ? 'shadow-md' : ''}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <p className={`text-sm font-medium leading-tight ${colored ? 'text-white/80' : 'text-gray-500'}`}>{label}</p>
        <div className={`shrink-0 rounded-xl p-2.5 ${colored ? 'bg-white/20' : (iconCls || 'bg-green-600')}`}>
          <Icon size={18} className="text-white" />
        </div>
      </div>
      <p className={`text-4xl font-black mt-3 tracking-tight ${colored ? 'text-white' : 'text-gray-800'}`}>
        {value ?? '—'}
      </p>
      <p className={`text-xs mt-1 font-medium ${colored ? 'text-white/60' : 'text-gray-400'}`}>{sublabel}</p>
    </button>
  );
}


/* ── Profile detail row ── */
function DetailRow({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-800 mt-0.5">{value}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
function Masterlist() {
  const [stats, setStats]         = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [children, setChildren]   = useState([]);
  const [mothers, setMothers]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [activeTab, setActiveTab] = useState('children');
  const [search, setSearch]       = useState('');
  const [ageFilter, setAgeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPerson, setSelectedPerson] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [statsRes, childrenRes, mothersRes, userStatsRes] = await Promise.all([
          axiosClient.get('/masterlist/stats'),
          axiosClient.get('/masterlist/children'),
          axiosClient.get('/masterlist/mothers'),
          axiosClient.get('/users/stats'),
        ]);
        setStats(statsRes.data);
        setChildren(childrenRes.data);
        setMothers(mothersRes.data);
        setUserStats(userStatsRes.data);
      } catch {
        setError('Failed to load masterlist data.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ── Loading / error states ── */
  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-10 h-10 rounded-full border-4 border-green-200 border-t-green-600 animate-spin" />
      <p className="text-sm text-gray-400 font-medium">Loading masterlist…</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
        <X size={28} className="text-red-400" />
      </div>
      <p className="text-sm font-semibold text-red-600">{error}</p>
    </div>
  );

  const hasBnsUsers = Number(userStats?.totalBNS || 0) > 0;
  if (!hasBnsUsers) return (
    <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
      <div className="w-16 h-16 mx-auto rounded-full bg-green-50 flex items-center justify-center mb-4">
        <Users size={28} className="text-green-600" />
      </div>
      <h3 className="text-lg font-bold text-gray-800 mb-1">Masterlist unavailable</h3>
      <p className="text-sm text-gray-400">Add at least one BNS account to populate the masterlist.</p>
    </div>
  );

  const barangayCount = new Set(children.map((c) => c.barangay).filter(Boolean)).size;

  /* ── Filtered lists ── */
  const filteredChildren = children
    .filter((c) => {
      if (ageFilter === 'all') return true;
      const age = Number(c.age_in_months ?? 0);
      if (ageFilter === '0-23')  return age >= 0  && age <= 23;
      if (ageFilter === '24-59') return age >= 24 && age <= 59;
      return true;
    })
    .filter((c) =>
      statusFilter === 'all' ||
      c.overall_status === statusFilter ||
      (statusFilter === 'graduate' && c.status === 'graduate')
    )
    .filter((c) =>
      !search ||
      `${c.first_name ?? ''} ${c.last_name ?? ''}`.toLowerCase().includes(search.toLowerCase()) ||
      (c.barangay ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (c.overall_status ?? '').toLowerCase().includes(search.toLowerCase())
    );

  const filteredMothers = mothers
    .filter((m) => statusFilter === 'all' || (statusFilter === 'completed' && m.is_completed))
    .filter((m) =>
      !search ||
      `${m.first_name ?? ''} ${m.last_name ?? ''}`.toLowerCase().includes(search.toLowerCase()) ||
      (m.barangay ?? '').toLowerCase().includes(search.toLowerCase())
    );

  /* ── Tab switch: reset filters ── */
  const switchTab = (tab) => {
    setActiveTab(tab);
    setSearch('');
    setStatusFilter('all');
    setAgeFilter('all');
  };

  return (
    <div className="space-y-6">

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Baby}
          label="Total Children"
          value={stats.totalChildren}
          sublabel={`${barangayCount} barangay${barangayCount !== 1 ? 's' : ''}`}
          gradient="bg-gradient-to-br from-[#1b5e20] to-[#2e7d32]"
          onClick={() => switchTab('children')}
          isActive={activeTab === 'children' && statusFilter === 'all'}
        />
        <StatCard
          icon={Baby}
          label="Graduate Children"
          value={stats.graduateChildren}
          sublabel="Completed program"
          gradient="bg-gradient-to-br from-[#1b5e20] to-[#2e7d32]"
          onClick={() => { switchTab('children'); setStatusFilter('graduate'); }}
          isActive={activeTab === 'children' && statusFilter === 'graduate'}
        />
        <StatCard
          icon={Heart}
          label="Total Mothers"
          value={stats.totalMothers}
          sublabel={`${barangayCount} barangay${barangayCount !== 1 ? 's' : ''}`}
          gradient="bg-gradient-to-br from-[#1b5e20] to-[#2e7d32]"
          onClick={() => switchTab('mothers')}
          isActive={activeTab === 'mothers' && statusFilter === 'all'}
        />
        <StatCard
          icon={Heart}
          label="Completed Mothers"
          value={stats.completedMothers}
          sublabel="Finished monitoring"
          gradient="bg-gradient-to-br from-[#1b5e20] to-[#2e7d32]"
          onClick={() => { switchTab('mothers'); setStatusFilter('completed'); }}
          isActive={activeTab === 'mothers' && statusFilter === 'completed'}
        />
      </div>

      {/* ── Search + Filters panel ── */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">



        {/* Search + filters bar */}
        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2.5 flex-1 min-w-[200px] border border-gray-100 focus-within:border-green-400 focus-within:ring-2 focus-within:ring-green-100 transition">
            <Search size={15} className="text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder={activeTab === 'children' ? 'Search name, barangay, status…' : 'Search name or barangay…'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="outline-none text-sm w-full bg-transparent text-gray-700 placeholder-gray-400"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Age group pills — children only */}
          {activeTab === 'children' && (
            <div className="flex gap-1 bg-gray-50 rounded-xl p-1 border border-gray-100">
              {[
                { val: 'all',   lbl: 'All Ages'     },
                { val: '0-23',  lbl: '0–23 mos'     },
                { val: '24-59', lbl: '24–59 mos'    },
              ].map(({ val, lbl }) => (
                <button
                  key={val}
                  onClick={() => setAgeFilter(val)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition
                    ${ageFilter === val
                      ? 'bg-[#2e7d32] text-white shadow-sm'
                      : 'text-gray-500 hover:bg-gray-100'
                    }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          )}

          {/* Status dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm text-gray-600 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition font-medium"
          >
            {activeTab === 'children' ? (
              <>
                <option value="all">All Status</option>
                <option value="normal">Normal</option>
                <option value="MAM">MAM</option>
                <option value="SAM">SAM</option>
                <option value="overweight">Overweight</option>
                <option value="obese">Obese</option>
                <option value="graduate">Graduate</option>
              </>
            ) : (
              <>
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
              </>
            )}
          </select>
        </div>

        {/* Result count */}
        <div className="px-6 py-3 bg-gray-50/60 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {activeTab === 'children'
              ? `${filteredChildren.length} of ${children.length} children`
              : `${filteredMothers.length} of ${mothers.length} mothers`}
          </p>
        </div>

        {/* ── Table ── */}
        <div className="overflow-x-auto">
          {activeTab === 'children' ? (
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-[32%]" />
                <col className="w-[14%]" />
                <col className="w-[24%]" />
                <col className="w-[15%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-400 bg-gray-50/80">
                  <th className="px-6 py-3">Name</th>
                  <th className="px-4 py-3">Age</th>
                  <th className="px-4 py-3">Barangay</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredChildren.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-14 text-center text-gray-400 text-sm">
                      No children match your search.
                    </td>
                  </tr>
                ) : filteredChildren.map((c) => (
                  <tr key={c.child_id} className="hover:bg-green-50/40 transition-colors group">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                          {(c.first_name ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 truncate">{c.first_name} {c.last_name}</p>
                          {c.sex && <p className="text-[11px] text-gray-400 capitalize">{c.sex}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-medium whitespace-nowrap">
                      {c.age_in_months != null ? `${c.age_in_months} mos` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MapPin size={12} className="shrink-0 text-gray-400" />
                        <span className="text-gray-600 truncate">{c.barangay || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status === 'graduate' ? 'graduate' : c.overall_status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setSelectedPerson({ ...c, _type: 'child' })}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#2e7d32] border border-green-200 bg-green-50 hover:bg-green-100 transition group-hover:border-green-300"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-[38%]" />
                <col className="w-[27%]" />
                <col className="w-[20%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-400 bg-gray-50/80">
                  <th className="px-6 py-3">Name</th>
                  <th className="px-4 py-3">Barangay</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredMothers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-14 text-center text-gray-400 text-sm">
                      No mothers match your search.
                    </td>
                  </tr>
                ) : filteredMothers.map((m) => (
                  <tr key={m.mother_id} className="hover:bg-green-50/40 transition-colors group">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                          {(m.first_name ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <p className="font-semibold text-gray-800 truncate">{m.first_name} {m.last_name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MapPin size={12} className="shrink-0 text-gray-400" />
                        <span className="text-gray-600 truncate">{m.barangay || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ring-1
                        ${m.is_completed
                          ? 'bg-emerald-100 text-emerald-700 ring-emerald-200'
                          : 'bg-amber-100 text-amber-700 ring-amber-200'
                        }`}>
                        {m.is_completed ? 'Completed' : 'Ongoing'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setSelectedPerson({ ...m, _type: 'mother' })}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#2e7d32] border border-green-200 bg-green-50 hover:bg-green-100 transition group-hover:border-green-300"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Profile Modal ── */}
      {selectedPerson && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedPerson(null); }}
        >
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">

            {/* Modal header */}
            <div className="bg-gradient-to-r from-[#1b5e20] to-[#2e7d32] px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg">
                  {(selectedPerson.first_name ?? '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-white text-base leading-tight">
                    {selectedPerson.first_name} {selectedPerson.last_name}
                  </p>
                  <p className="text-white/70 text-xs mt-0.5">
                    {selectedPerson._type === 'child' ? 'Child Record' : 'Mother Record'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPerson(null)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-4 max-h-[70vh] overflow-y-auto divide-y divide-gray-50">

              {selectedPerson._type === 'child' ? (
                <>
                  <DetailRow label="Barangay"        value={selectedPerson.barangay} />
                  <DetailRow label="Age"              value={selectedPerson.age_in_months != null ? `${selectedPerson.age_in_months} months old` : null} />
                  <DetailRow label="Sex"              value={selectedPerson.sex ? selectedPerson.sex.charAt(0).toUpperCase() + selectedPerson.sex.slice(1) : null} />
                  <DetailRow label="Guardian"         value={selectedPerson.guardian_name} />
                  <DetailRow label="Weight"           value={selectedPerson.weight_kg ? `${selectedPerson.weight_kg} kg` : null} />
                  <DetailRow label="Height"           value={selectedPerson.height_cm  ? `${selectedPerson.height_cm} cm`  : null} />
                  <DetailRow label="Last Visit"       value={selectedPerson.last_visit ? new Date(selectedPerson.last_visit).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null} />
                  <div className="py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Nutrition Status</p>
                    <StatusBadge status={selectedPerson.status === 'graduate' ? 'graduate' : selectedPerson.overall_status} />
                  </div>
                </>
              ) : (
                <>
                  <DetailRow label="Barangay"        value={selectedPerson.barangay} />
                  <DetailRow label="Contact Number"  value={selectedPerson.contact_number} />
                  <div className="py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Monitoring Status</p>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ring-1
                      ${selectedPerson.is_completed
                        ? 'bg-emerald-100 text-emerald-700 ring-emerald-200'
                        : 'bg-amber-100 text-amber-700 ring-amber-200'
                      }`}>
                      {selectedPerson.is_completed ? 'Completed' : 'Ongoing'}
                    </span>
                  </div>
                  <div className="py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Linked Children</p>
                    {selectedPerson.linked_children?.length > 0 ? (
                      <div className="space-y-2">
                        {selectedPerson.linked_children.map((child) => (
                          <div key={child.child_id} className="flex items-center gap-3 rounded-xl bg-green-50 border border-green-100 px-4 py-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {(child.first_name ?? '?').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate">{child.first_name} {child.last_name}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {child.age_in_months != null ? `${child.age_in_months} mos` : ''}{child.barangay ? ` · ${child.barangay}` : ''}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 italic">No child linked to this mother.</p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-6 pb-5 pt-2">
              <button
                onClick={() => setSelectedPerson(null)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-[#2e7d32] border-2 border-green-200 hover:bg-green-50 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Masterlist;