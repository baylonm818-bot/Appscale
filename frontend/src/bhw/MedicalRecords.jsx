import { useState, useEffect, useMemo } from 'react';
import axiosClient from '../api/axiosClient';
import { FileText, Search, Phone, ArrowLeft, Calendar, User, Activity, PlusCircle, CheckCircle2, ChevronRight, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const statusColors = {
  normal: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  MAM: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  SAM: 'bg-red-100 text-red-800 ring-1 ring-red-200',
  underweight: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  overweight: 'bg-blue-100 text-blue-800 ring-1 ring-blue-200',
  obese: 'bg-purple-100 text-purple-800 ring-1 ring-purple-200',
};

const severityColors = {
  low: 'bg-emerald-100 text-emerald-800',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-red-100 text-red-800',
};

function MedicalRecords() {
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');

  // list filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ageFilter, setAgeFilter] = useState('all');

  // detail view
  const [selectedChild, setSelectedChild] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [activeTab, setActiveTab] = useState('growth');

  useEffect(() => {
    const fetchList = async () => {
      try {
        const response = await axiosClient.get('/bhw/medical-records', {
          params: { barangay: user.barangay },
        });
        setChildren(response.data || []);
        if (response.data && response.data.length > 0 && window.innerWidth >= 1024) {
          openChild(response.data[0]);
        }
      } catch {
        setError('Failed to load registered children.');
      } finally {
        setLoading(false);
      }
    };
    fetchList();
  }, []);

  const filteredChildren = useMemo(() => {
    let list = [...children];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) =>
        `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase().includes(q) ||
        (c.guardian_name || '').toLowerCase().includes(q)
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
    return list;
  }, [children, search, statusFilter, ageFilter]);

  const openChild = async (child) => {
    setSelectedChild(child);
    setDetail(null);
    setDetailError('');
    setActiveTab('growth');
    setDetailLoading(true);
    try {
      const response = await axiosClient.get(`/bhw/medical-records/${child.child_id}`);
      setDetail(response.data);
    } catch {
      setDetailError('Failed to load clinical records for this child.');
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-10 h-10 rounded-full border-4 border-green-200 border-t-green-600 animate-spin" />
        <p className="text-sm font-medium text-gray-400">Loading medical records…</p>
      </div>
    );
  }

  if (error) return <p className="text-red-600 p-6">{error}</p>;

  // Prepare growth chart data
  const growthChartData = (detail?.growth_history || [])
    .map((g) => ({
      date: new Date(g.record_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      weight: Number(g.weight_kg) || 0,
      height: Number(g.height_cm) || 0,
    }))
    .reverse();

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ── LEFT: Children Directory ── */}
        <div className={`lg:col-span-4 ${selectedChild ? 'hidden lg:block' : 'block'}`}>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col max-h-[82vh]">

            {/* Header + Search */}
            <div className="p-4 border-b border-gray-100 space-y-3 bg-gray-50/50">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-900">Registered Children</p>
                <span className="text-xs font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                  {filteredChildren.length}
                </span>
              </div>

              <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-gray-200 focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-100 transition">
                <Search size={15} className="text-gray-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search child or guardian…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="outline-none text-xs w-full bg-transparent text-gray-700 placeholder-gray-400"
                />
                {search && <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-gray-700 bg-white"
                >
                  <option value="all">All Statuses</option>
                  <option value="normal">Normal</option>
                  <option value="MAM">MAM</option>
                  <option value="SAM">SAM</option>
                  <option value="underweight">Underweight</option>
                </select>

                <select
                  value={ageFilter}
                  onChange={(e) => setAgeFilter(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-gray-700 bg-white"
                >
                  <option value="all">All Ages</option>
                  <option value="0-11">0–11 mos</option>
                  <option value="12-23">12–23 mos</option>
                  <option value="24-59">24–59 mos</option>
                </select>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto divide-y divide-gray-50 flex-1">
              {filteredChildren.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs">No children found matching criteria.</div>
              ) : (
                filteredChildren.map((c) => {
                  const isSelected = selectedChild?.child_id === c.child_id;
                  return (
                    <button
                      key={c.child_id}
                      type="button"
                      onClick={() => openChild(c)}
                      className={`w-full text-left p-3.5 flex items-center gap-3 transition-colors ${
                        isSelected
                          ? 'bg-green-50/80 border-l-4 border-green-600'
                          : 'hover:bg-gray-50/70'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white ${
                        isSelected
                          ? 'bg-gradient-to-br from-[#1b5e20] to-[#2e7d32]'
                          : 'bg-gray-400'
                      }`}>
                        {(c.first_name ?? '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-gray-900 truncate">{c.first_name} {c.last_name}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{c.age_in_months != null ? `${c.age_in_months} mos` : '—'} · {c.sex || '—'}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${statusColors[c.overall_status] || 'bg-gray-100 text-gray-600'}`}>
                        {c.overall_status || 'Active'}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

          </div>
        </div>

        {/* ── RIGHT: Medical Record Details ── */}
        <div className={`lg:col-span-8 ${selectedChild ? 'block' : 'hidden lg:block'}`}>
          {!selectedChild ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center text-gray-400">
              <FileText className="mx-auto mb-3 text-gray-300" size={36} />
              <p className="text-sm font-semibold text-gray-700">Select a child from the directory</p>
              <p className="text-xs text-gray-400 mt-1">View growth history, health assessments, and recorded interventions.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

              {/* Mobile Back Button */}
              <div className="p-4 border-b border-gray-100 lg:hidden flex items-center">
                <button
                  type="button"
                  onClick={() => setSelectedChild(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-green-700 hover:text-green-900"
                >
                  <ArrowLeft size={14} /> Back to Directory
                </button>
              </div>

              {/* Profile Card Header */}
              <div className="bg-gradient-to-r from-[#1b5e20] to-[#2e7d32] p-6 text-white flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-white text-xl font-black shadow-sm">
                    {(selectedChild.first_name ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-black">{selectedChild.first_name} {selectedChild.last_name}</h2>
                    <p className="text-xs text-white/80 mt-0.5">
                      {selectedChild.age_in_months} months old · {selectedChild.sex ? selectedChild.sex.toUpperCase() : 'N/A'} · Guardian: {selectedChild.guardian_name || '—'}
                    </p>
                    {selectedChild.guardian_contact && (
                      <p className="text-xs text-emerald-100/75 mt-0.5 flex items-center gap-1">
                        <Phone size={11} /> {selectedChild.guardian_contact}
                      </p>
                    )}
                  </div>
                </div>

                <span className="bg-white text-[#1b5e20] text-xs font-black px-3.5 py-1.5 rounded-full uppercase shadow-xs">
                  {selectedChild.overall_status || 'Normal'}
                </span>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-100 bg-gray-50/70 px-6 gap-2">
                {[
                  { key: 'growth', label: `Growth History (${detail?.growth_history?.length || 0})` },
                  { key: 'services', label: `Services Provided (${detail?.services?.length || 0})` },
                  { key: 'referrals', label: `Referral Logs (${detail?.referrals?.length || 0})` },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`text-xs font-bold py-3.5 px-3 border-b-2 transition-all ${
                      activeTab === tab.key
                        ? 'border-[#2e7d32] text-[#2e7d32]'
                        : 'border-transparent text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {detailLoading ? (
                  <div className="py-16 text-center text-gray-400 text-xs">Loading records…</div>
                ) : detailError ? (
                  <div className="p-4 bg-red-50 text-red-700 text-xs rounded-xl font-medium">{detailError}</div>
                ) : (
                  <>
                    {/* GROWTH HISTORY TAB */}
                    {activeTab === 'growth' && (
                      <div className="space-y-6">
                        {/* Chart */}
                        {growthChartData.length > 1 && (
                          <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-100">
                            <p className="text-xs font-bold text-gray-700 mb-3">Weight (kg) Progress Over Time</p>
                            <div className="h-44 w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={growthChartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                  <Tooltip />
                                  <Line type="monotone" dataKey="weight" name="Weight (kg)" stroke="#2e7d32" strokeWidth={2.5} dot={{ r: 3 }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        )}

                        {/* Table */}
                        {!detail?.growth_history || detail.growth_history.length === 0 ? (
                          <p className="text-xs text-gray-400 py-8 text-center">No growth records recorded yet.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left font-semibold text-gray-400 border-b border-gray-100 pb-2">
                                  <th className="py-2.5">Date</th>
                                  <th className="py-2.5">Age</th>
                                  <th className="py-2.5">Weight</th>
                                  <th className="py-2.5">Height</th>
                                  <th className="py-2.5">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {detail.growth_history.map((g, idx) => (
                                  <tr key={idx} className="hover:bg-gray-50/60">
                                    <td className="py-3 font-semibold text-gray-800">
                                      {new Date(g.record_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </td>
                                    <td className="py-3 text-gray-600">{g.age_in_months} mos</td>
                                    <td className="py-3 font-bold text-gray-800">{g.weight_kg} kg</td>
                                    <td className="py-3 text-gray-600">{g.height_cm ? `${g.height_cm} cm` : '—'}</td>
                                    <td className="py-3">
                                      <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${statusColors[g.overall_status] || 'bg-gray-100 text-gray-700'}`}>
                                        {g.overall_status || 'Normal'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SERVICES TAB */}
                    {activeTab === 'services' && (
                      <div>
                        {!detail?.services || detail.services.length === 0 ? (
                          <p className="text-xs text-gray-400 py-8 text-center">No health services logged yet.</p>
                        ) : (
                          <div className="space-y-3">
                            {detail.services.map((s, idx) => (
                              <div key={idx} className="p-3.5 rounded-xl bg-gray-50/70 border border-gray-100 flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs font-bold text-gray-900 capitalize">{s.service_type?.replace('_', ' ')}</p>
                                  <p className="text-[11px] text-gray-500 mt-0.5">
                                    Administered on {new Date(s.service_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                  </p>
                                  {s.notes && <p className="text-xs text-gray-600 mt-1 italic">"{s.notes}"</p>}
                                </div>
                                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                                  Completed
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* REFERRALS TAB */}
                    {activeTab === 'referrals' && (
                      <div>
                        {!detail?.referrals || detail.referrals.length === 0 ? (
                          <p className="text-xs text-gray-400 py-8 text-center">No referrals made for this child.</p>
                        ) : (
                          <div className="space-y-3">
                            {detail.referrals.map((r, idx) => (
                              <div key={idx} className="p-4 rounded-xl bg-gray-50/70 border border-gray-100">
                                <div className="flex items-center justify-between mb-2">
                                  <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${severityColors[r.severity] || 'bg-gray-100'}`}>
                                    {r.severity} Priority
                                  </span>
                                  <span className="text-[11px] text-gray-400">
                                    {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </span>
                                </div>
                                <p className="text-xs font-semibold text-gray-800">{r.reason}</p>
                                {r.notes && <p className="text-xs text-gray-500 mt-1">Feedback: {r.notes}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

            </div>
          )}
        </div>

      </div>

    </div>
  );
}

export default MedicalRecords;