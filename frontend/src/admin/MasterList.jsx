import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { Users, Search, Baby, Heart } from 'lucide-react';

function StatCard({ icon: Icon, label, value, sublabel, highlight, onClick, isActive, iconBg }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl shadow-sm p-5 transition ${
        onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''
      } ${isActive ? 'ring-2 ring-green-500' : ''} ${
        highlight
          ? 'bg-gradient-to-br from-green-600 to-emerald-500 text-white'
          : 'bg-white'
      }`}
    >
      <div className="flex items-start justify-between">
        <p className={`text-sm ${highlight ? 'text-white/80' : 'text-gray-400'}`}>{label}</p>
        <div className={`rounded-full p-2.5 ${highlight ? 'bg-white/20' : iconBg || 'bg-green-600'}`}>
          <Icon size={16} className="text-white" />
        </div>
      </div>
      <p className="text-3xl font-bold mt-3">{value}</p>
      <p className={`text-xs mt-1 ${highlight ? 'text-white/70' : 'text-gray-400'}`}>{sublabel}</p>
    </div>
  );
}

const statusColors = {
  normal: 'bg-green-100 text-green-700',
  MAM: 'bg-yellow-100 text-yellow-700',
  SAM: 'bg-red-100 text-red-700',
  overweight: 'bg-orange-100 text-orange-700',
  obese: 'bg-red-100 text-red-700',
};

function Masterlist() {
  const [stats, setStats] = useState(null);
  const [children, setChildren] = useState([]);
  const [mothers, setMothers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('children');
  const [search, setSearch] = useState('');
  const [ageGroupFilter, setAgeGroupFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, childrenRes, mothersRes] = await Promise.all([
          axiosClient.get('/masterlist/stats'),
          axiosClient.get('/masterlist/children'),
          axiosClient.get('/masterlist/mothers'),
        ]);
        setStats(statsRes.data);
        setChildren(childrenRes.data);
        setMothers(mothersRes.data);
      } catch (err) {
        setError('Failed to load masterlist data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const openProfileModal = (person) => {
    setSelectedPerson(person);
    setShowProfileModal(true);
  };


  if (loading) return <p className="text-center text-gray-400 py-10">Loading masterlist...</p>;
  if (error) return <p className="text-center text-red-500 py-10">{error}</p>;

  const barangayCount = new Set(children.map((c) => c.barangay)).size;

  const filteredChildren = children
    .filter((c) => ageGroupFilter === 'all' || c.age_group === ageGroupFilter)
    .filter((c) => statusFilter === 'all' || c.overall_status === statusFilter || (statusFilter === 'graduate' && c.is_graduate))
    .filter((c) =>
      search === '' ||
      `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase().includes(search.toLowerCase()) ||
      (c.overall_status || '').toLowerCase().includes(search.toLowerCase())
    );

  const filteredMothers = mothers
    .filter((m) => statusFilter === 'all' || (statusFilter === 'completed' && m.is_completed))
    .filter((m) =>
      search === '' ||
      `${m.first_name} ${m.last_name}.toLowerCase().includes(search.toLowerCase())`
    );

  return (
    <div className="space-y-6">

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-color-green-100">
        <StatCard
          icon={Baby}
          label="Total Children"
          value={stats.totalChildren}
          sublabel={`${barangayCount} barangays`}
          onClick={() => { setActiveTab('children'); setStatusFilter('all'); setAgeGroupFilter('all'); }}
          isActive={activeTab === 'children' && statusFilter === 'all' && ageGroupFilter === 'all'}
        />
        <StatCard
          icon={Baby}
          label="Graduate Children"
          value={stats.graduateChildren}
          sublabel={`${barangayCount} barangays`}
          iconBg="bg-emerald-500"
          onClick={() => { setActiveTab('children'); setStatusFilter('graduate'); setAgeGroupFilter('all'); }}
          isActive={activeTab === 'children' && statusFilter === 'graduate'}
        />
        <StatCard
          icon={Heart}
          label="Total Mothers"
          value={stats.totalMothers}
          sublabel={`${barangayCount} barangays`}
          iconBg="bg-pink-500"
          onClick={() => { setActiveTab('mothers'); setStatusFilter('all'); }}
          isActive={activeTab === 'mothers' && statusFilter === 'all'}
        />
        <StatCard
          icon={Heart}
          label="Completed Mothers"
          value={stats.completedMothers}
          sublabel={`${barangayCount} barangays`}
          iconBg="bg-lime-600"
          onClick={() => { setActiveTab('mothers'); setStatusFilter('completed'); }}
          isActive={activeTab === 'mothers' && statusFilter === 'completed'}
        />
      </div>

      {/* Tabs + search/filters */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        
       

        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2.5 flex-1 min-w-[200px]">
            <Search size={16} className="text-gray-400" />
            <input
              type="text"
              placeholder={activeTab === 'children' ? 'Search by children or status...' : 'Search by name...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="outline-none text-sm w-full bg-transparent"
            />
          </div>

          {activeTab === 'children' && (
            <>
              <div className="flex gap-1 bg-gray-50 rounded-full p-1">
                {['all', '0-23', '24-59'].map((group) => (
                  <button
                    key={group}
                    onClick={() => setAgeGroupFilter(group)}
                    className={`px-4 py-2 rounded-full text-xs font-medium transition ${
                      ageGroupFilter === group
                        ? 'bg-green-600 text-white shadow-sm'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {group === 'all' ? 'All Ages' : group === '0-23' ? '0–23 mos' : '2–5 yrs'}
                  </button>
                ))}
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-gray-50 border-none rounded-xl px-4 py-2.5 text-sm text-gray-600 outline-none"
              >
                <option value="all">All Status</option>
                <option value="normal">Normal</option>
                <option value="MAM">MAM</option>
                <option value="SAM">SAM</option>
                <option value="overweight">Overweight</option>
                <option value="obese">Obese</option>
                <option value="graduate">Graduate</option>
              </select>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h3 className="font-semibold text-gray-800 mb-4">
          {activeTab === 'children'
            ? `${filteredChildren.length} Children Found`
            : `${filteredMothers.length} Mothers Found`}
        </h3>

        <div className="overflow-x-auto">
          {activeTab === 'children' ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="p-3 font-medium">Name</th>
                  <th className="p-3 font-medium">Age Group</th>
                  <th className="p-3 font-medium">Barangay</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredChildren.map((c) => (
                  <tr key={c.child_id || c.id} className="border-b border-gray-50 hover:bg-gray-50/70 transition">
                    <td className="p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-semibold">
                        {c.first_name?.charAt(0)}
                      </div>
                      <p className="text-gray-800 font-medium">{c.first_name} {c.last_name}</p>
                    </td>
                    <td className="p-3 text-gray-500">{c.age_group}</td>
                    <td className="p-3 text-gray-500">{c.barangay}</td>
                    <td className="p-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${statusColors[c.overall_status] || 'bg-gray-100 text-gray-600'}`}>
                        {c.overall_status || '—'}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => openProfileModal(c)}
                        className="border border-gray-200 text-gray-600 px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50 transition"
                      >
                        View Profile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="p-3 font-medium">Name</th>
                  <th className="p-3 font-medium">Barangay</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredMothers.map((m) => (
                  <tr key={m.mother_id || m.id} className="border-b border-gray-50 hover:bg-gray-50/70 transition">
                    <td className="p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center text-xs font-semibold">
                        {m.first_name?.charAt(0)}
                      </div>
                      <p className="text-gray-800 font-medium">{m.first_name} {m.last_name}</p>
                    </td>
                    <td className="p-3 text-gray-500">{m.barangay}</td>
                    <td className="p-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${m.is_completed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {m.is_completed ? 'Completed' : 'Ongoing'}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => openProfileModal(m)}
                        className="border border-gray-200 text-gray-600 px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50 transition"
                      >
                        View Profile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* View Profile Modal */}
      {showProfileModal && selectedPerson && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">

            <div className="mb-5">
              <h2 className="text-lg font-bold text-gray-800">
                {activeTab === 'children' ? 'Child Profile' : 'Mother Profile'}
              </h2>
              <p className="text-sm text-gray-400">Full record details</p>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">Full Name</p>
                <p className="text-sm font-medium text-gray-800">
                  {selectedPerson.first_name} {selectedPerson.last_name}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Barangay</p>
                <p className="text-sm font-medium text-gray-800">{selectedPerson.barangay}</p>
              </div>

              {activeTab === 'children' ? (
                <>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Age Group</p>
                    <p className="text-sm font-medium text-gray-800">{selectedPerson.age_group}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Nutrition Status</p>
                    <p className="text-sm font-medium text-gray-800 capitalize">
                      {selectedPerson.overall_status || '—'}
                    </p>
                  </div>
                  {selectedPerson.weight && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Weight</p>
                      <p className="text-sm font-medium text-gray-800">{selectedPerson.weight} kg</p>
                    </div>
                  )}
                  {selectedPerson.height && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Height</p>
                      <p className="text-sm font-medium text-gray-800">{selectedPerson.height} cm</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Status</p>
                    <p className="text-sm font-medium text-gray-800">
                      {selectedPerson.is_completed ? 'Completed' : 'Ongoing'}
                    </p>
                  </div>
                  {selectedPerson.contact_number && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Contact Number</p>
                      <p className="text-sm font-medium text-gray-800">{selectedPerson.contact_number}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Linked Child</p>
                    {selectedPerson.linked_children?.length > 0 ? (
                      <div className="space-y-2">
                        {selectedPerson.linked_children.map((child) => (
                          <div key={child.child_id} className="rounded-xl bg-green-50 border border-green-100 p-3">
                            <p className="text-sm font-semibold text-gray-800">
                              {child.first_name} {child.last_name}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {child.age_group} months · {child.barangay || 'No barangay'} · {child.status}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">No child linked to this mother.</p>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="pt-5 mt-5 border-t border-gray-100">
              <button
                onClick={() => setShowProfileModal(false)}
                className="w-full border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
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