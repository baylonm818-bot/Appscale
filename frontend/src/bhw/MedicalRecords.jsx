import { useState, useEffect, useMemo } from 'react';
import axiosClient from '../api/axiosClient';
import { FileText, Search, Phone, ArrowLeft } from 'lucide-react';

const statusColors = {
  normal: 'bg-green-100 text-green-700',
  MAM: 'bg-yellow-100 text-yellow-700',
  SAM: 'bg-red-100 text-red-700',
  overweight: 'bg-orange-100 text-orange-700',
  obese: 'bg-red-100 text-red-800',
};

const severityColors = {
  low: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
};

const referralStatusColors = {
  pending: 'bg-lime-100 text-lime-700',
  responded: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
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
  const [selectedChild, setSelectedChild] = useState(null); // basic row
  const [detail, setDetail] = useState(null); // { child, growth_history, services, referrals }
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [activeTab, setActiveTab] = useState('growth'); // growth | services | referrals

  useEffect(() => {
    const fetchList = async () => {
      try {
        const response = await axiosClient.get('/bhw/medical-records', {
          params: { barangay: user.barangay },
        });
        setChildren(response.data);
      } catch (err) {
        setError('Failed to load children list.');
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
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
        (c.guardian_name || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      list = list.filter((c) => c.overall_status === statusFilter);
    }
    if (ageFilter !== 'all') {
      list = list.filter((c) =>
        ageFilter === '0-23' ? c.age_in_months <= 23 : c.age_in_months >= 24
      );
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
    } catch (err) {
      setDetailError('Failed to load records for this child.');
    } finally {
      setDetailLoading(false);
    }
  };

  const backToList = () => {
    setSelectedChild(null);
    setDetail(null);
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div>
      

      <div className="flex gap-4">
        {/* LIST PANEL */}
        <div className={`${selectedChild ? 'hidden md:block md:w-1/3' : 'w-full'} shrink-0`}>
          <div className="bg-white rounded-xl shadow-sm p-4 mb-3 flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search child or guardian..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-2"
            >
              <option value="all">All Statuses</option>
              <option value="normal">Normal</option>
              <option value="MAM">MAM</option>
              <option value="SAM">SAM</option>
              <option value="overweight">Overweight</option>
              <option value="obese">Obese</option>
            </select>
            <select
              value={ageFilter}
              onChange={(e) => setAgeFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-2"
            >
              <option value="all">All Ages</option>
              <option value="0-23">0–23 mos</option>
              <option value="24-59">24–59 mos</option>
            </select>
          </div>

          <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-50 max-h-[70vh] overflow-y-auto">
            {filteredChildren.length === 0 ? (
              <p className="text-sm text-gray-400 p-4">No children found.</p>
            ) : (
              filteredChildren.map((c) => (
                <button
                  key={c.child_id}
                  onClick={() => openChild(c)}
                  className={`w-full text-left p-3 flex items-center gap-3 hover:bg-gray-50 ${
                    selectedChild?.child_id === c.child_id ? 'bg-green-50' : ''
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center text-xs font-semibold shrink-0">
                    {c.first_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {c.first_name} {c.last_name}
                    </p>
                    <p className="text-xs text-gray-400">{c.age_in_months} mos</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs shrink-0 ${
                      statusColors[c.overall_status] || 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {c.overall_status}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* DETAIL PANEL */}
        {selectedChild && (
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-xl shadow-sm p-5">
              <button
                onClick={backToList}
                className="md:hidden flex items-center gap-1 text-sm text-gray-500 mb-3"
              >
                <ArrowLeft size={14} /> Back to list
              </button>

              {/* Header */}
              <div className="flex items-start justify-between flex-wrap gap-2 mb-4 pb-4 border-b border-gray-100">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">
                    {selectedChild.first_name} {selectedChild.last_name}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {selectedChild.age_in_months} mos · Guardian: {selectedChild.guardian_name || '—'}
                  </p>
                  {selectedChild.guardian_contact && (
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                      <Phone size={12} /> {selectedChild.guardian_contact}
                    </p>
                  )}
                </div>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    statusColors[selectedChild.overall_status] || 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {selectedChild.overall_status}
                </span>
              </div>

              {detailLoading && <p className="text-sm text-gray-400">Loading records...</p>}
              {detailError && <p className="text-sm text-red-500">{detailError}</p>}

              {detail && (
                <>
                  {/* Tabs */}
                  <div className="flex gap-2 mb-4 border-b border-gray-100">
                    {[
                      { key: 'growth', label: `Growth History (${detail.growth_history?.length || 0})` },
                      { key: 'services', label: `Services Given (${detail.services?.length || 0})` },
                      { key: 'referrals', label: `Referrals (${detail.referrals?.length || 0})` },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`text-sm px-3 py-2 border-b-2 -mb-px ${
                          activeTab === tab.key
                            ? 'border-green-600 text-green-700 font-medium'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Growth History */}
                  {activeTab === 'growth' && (
                    <div className="overflow-x-auto">
                      {!detail.growth_history || detail.growth_history.length === 0 ? (
                        <p className="text-sm text-gray-400">No growth records yet.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-500 border-b border-gray-100">
                              <th className="p-2">Date</th>
                              <th className="p-2">Weight</th>
                              <th className="p-2">Height</th>
                              <th className="p-2">MUAC</th>
                              <th className="p-2">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.growth_history.map((g, i) => (
                              <tr key={i} className="border-b border-gray-50">
                                <td className="p-2 text-gray-600">
                                  {new Date(g.record_date).toLocaleDateString()}
                                </td>
                                <td className="p-2 text-gray-600">{g.weight_kg} kg</td>
                                <td className="p-2 text-gray-600">{g.height_cm} cm</td>
                                <td className="p-2 text-gray-600">{g.muac_cm ? `${g.muac_cm} cm` : '—'}</td>
                                <td className="p-2">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-xs ${
                                      statusColors[g.overall_status] || 'bg-gray-100 text-gray-600'
                                    }`}
                                  >
                                    {g.overall_status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* Services Given */}
                  {activeTab === 'services' && (
                    <div className="overflow-x-auto">
                      {!detail.services || detail.services.length === 0 ? (
                        <p className="text-sm text-gray-400">No services logged yet.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-500 border-b border-gray-100">
                              <th className="p-2">Date</th>
                              <th className="p-2">Service</th>
                              <th className="p-2">Given By</th>
                              <th className="p-2">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.services.map((s, i) => (
                              <tr key={i} className="border-b border-gray-50">
                                <td className="p-2 text-gray-600">
                                  {new Date(s.service_date).toLocaleDateString()}
                                </td>
                                <td className="p-2 text-gray-600 capitalize">
                                  {s.service_type?.replace('_', ' ')}
                                </td>
                                <td className="p-2 text-gray-600 uppercase text-xs">{s.given_by}</td>
                                <td className="p-2 text-gray-500">{s.notes || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* Referral History */}
                  {activeTab === 'referrals' && (
                    <div className="space-y-3">
                      {!detail.referrals || detail.referrals.length === 0 ? (
                        <p className="text-sm text-gray-400">No referral history.</p>
                      ) : (
                        detail.referrals.map((r, i) => (
                          <div key={i} className="border border-gray-100 rounded-lg p-3">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs capitalize ${
                                  severityColors[r.severity] || 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {r.severity} severity
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs capitalize ${
                                  referralStatusColors[r.status] || 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {r.status}
                              </span>
                              <span className="text-xs text-gray-400">
                                {new Date(r.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">{r.reason}</p>
                            {r.response_notes && (
                              <p className="text-sm text-green-600 mt-1">
                                Response: {r.response_notes}
                              </p>
                            )}
                          </div>
                        ))
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
  );
}

export default MedicalRecords;