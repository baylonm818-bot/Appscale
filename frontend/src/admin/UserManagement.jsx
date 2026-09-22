import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { Users, Archive, Plus, Search } from 'lucide-react';

const GASAN_BARANGAYS = [
  'Antipolo',
  'B. Ibaba',
  'B. Ilaya',
  'Bacong-Bacong',
  'Bahi',
  'Bangbang',
  'Banot',
  'Banuyo',
  'Bognuyan',
  'Cabugao',
  'Dawis',
  'Dili',
  'Libtangin',
  'Mahunig',
  'Mangiliol',
  'Masiga',
  'Mat. Gasan',
  'Pangi',
  'Pinggan',
  'Tabionan',
  'Tiguion',
  'Brgy. Uno',
  'Brgy. Dos',
  'Brgy. Tres',
  'Tapuyan',
];

const emptyForm = {
  first_name: '', middle_initial: '', last_name: '', email: '', username: '',
  password: '', role: 'bhw', municipality: 'Gasan', barangay: '', purok: '', contact_number: '',
};

function StatCard({ label, value, sublabel, highlight, onClick, isActive }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl shadow-sm p-5 transition ${
        onClick ? 'cursor-pointer hover:shadow-md' : ''
      } ${isActive ? 'ring-2 ring-green-500' : ''} ${
        highlight ? 'bg-green-600 text-white' : 'bg-white'
      }`}
    >
      <div className="flex items-start justify-between">
        <p className={`text-sm ${highlight ? 'text-green-100' : 'text-gray-500'}`}>{label}</p>
        <div className={`rounded-full p-2 ${highlight ? 'bg-white/20' : 'bg-green-600'}`}>
          <Users size={16} className="text-white" />
        </div>
      </div>
      <p className="text-3xl font-bold mt-2">{value}</p>
      <p className={`text-xs mt-1 ${highlight ? 'text-green-100' : 'text-gray-400'}`}>{sublabel}</p>
    </div>
  );
}

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('bhw');
  const [search, setSearch] = useState('');
  const [barangayFilter, setBarangayFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showArchive, setShowArchive] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [viewOnly, setViewOnly] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const [usersRes, statsRes] = await Promise.all([
        axiosClient.get('/users?includeArchived=true'),
        axiosClient.get('/users/stats'),
      ]);
      setUsers(usersRes.data);
      setStats(statsRes.data);
    } catch (err) {
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = (role = activeTab) => {
    setEditingUser(null);
    setViewOnly(false);
    setForm({ ...emptyForm, role });
    setFormError('');
    setShowCreateMenu(false);
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setViewOnly(true);
    setForm({
      first_name: user.first_name || '',
      middle_initial: user.middle_initial || '',
      last_name: user.last_name || '',
      email: user.email || '',
      username: user.username || '',
      password: '',
      role: user.role,
      municipality: user.municipality || 'Gasan',
      barangay: user.barangay || '',
      purok: user.purok || '',
      contact_number: user.contact_number || '',
    });
    setFormError('');
    setShowModal(true);
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const normalizedBarangay = (form.barangay || '').trim().toLowerCase();
      const hasBnsInBarangay = users.some((user) =>
        user.role === 'bns' &&
        !user.deleted_at &&
        user.user_id !== editingUser?.user_id &&
        (user.barangay || '').trim().toLowerCase() === normalizedBarangay
      );
      if (form.role === 'bns' && hasBnsInBarangay) {
        setFormError('This barangay already has a BNS. Archive the existing BNS before adding a replacement.');
        setSaving(false);
        return;
      }

      if (form.role === 'bhw' && normalizedBarangay && !hasBnsInBarangay) {
        setFormError('This barangay has no active BNS assigned yet. Assign the BNS first before adding a BHW.');
        setSaving(false);
        return;
      }

      if (editingUser) {
        await axiosClient.put(`/users/${editingUser.user_id}`, form);
      } else {
        if (!form.password) {
          setFormError('Password is required for new users.');
          setSaving(false);
          return;
        }
        await axiosClient.post('/users', form);
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (user) => {
    const newStatus = user.status === 'active' ? 'locked' : 'active';
    try {
      await axiosClient.patch(`/users/${user.user_id}/status`, {
        status: newStatus,
        deactivation_reason: newStatus === 'locked' ? 'Locked by Administrator' : null,
      });
      fetchData();
    } catch (err) {
      alert('Failed to update user status.');
    }
  };

  const archiveUser = async (user) => {
    if (!window.confirm(`Archive ${user.first_name} ${user.last_name}? This user will no longer appear as an active employee.`)) return;
    try {
      await axiosClient.patch(`/users/${user.user_id}/archive`);
      fetchData();
    } catch (err) {
      alert('Failed to archive user.');
    }
  };

  const restoreUser = async (user) => {
    try {
      await axiosClient.patch(`/users/${user.user_id}/restore`);
      fetchData();
    } catch (err) {
      alert('Failed to restore user.');
    }
  };

  if (loading) return <p className="text-gray-500">Loading users...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  const safeStats = stats || {
    totalUsers: 0,
    totalBNS: 0,
    totalBHW: 0,
    activeUsers: 0,
    activeBNS: 0,
    activeBHW: 0,
  };

  const barangays = GASAN_BARANGAYS;

  const filteredUsers = users
    .filter((u) => activeTab === 'all' || u.role === activeTab)
    .filter((u) => showArchive ? Boolean(u.deleted_at) : !u.deleted_at)
    .filter((u) => barangayFilter === 'all' || u.barangay === barangayFilter)
    .filter((u) => statusFilter === 'all' || u.status === statusFilter)
    .filter((u) =>
      search === '' ||
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      u.barangay.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Users"
          value={safeStats.totalUsers}
          sublabel="All assigned users"
          onClick={() => { setActiveTab('all'); setStatusFilter('all'); }}
          isActive={activeTab === 'all' && statusFilter === 'all'}
        />
        <StatCard
          label="Total BNS"
          value={safeStats.totalBNS}
          sublabel="Barangay Nutrition Scholars"
          onClick={() => { setActiveTab('bns'); setStatusFilter('all'); }}
          isActive={activeTab === 'bns' && statusFilter === 'all'}
        />
        <StatCard
          label="Total BHW"
          value={safeStats.totalBHW}
          sublabel="Barangay Health Workers"
          onClick={() => { setActiveTab('bhw'); setStatusFilter('all'); }}
          isActive={activeTab === 'bhw' && statusFilter === 'all'}
        />
        <StatCard
          label="Active Users"
          value={safeStats.activeUsers}
          sublabel="Currently active"
          onClick={() => { setStatusFilter('active'); }}
          isActive={statusFilter === 'active'}
        />
      </div>

      {/* Tabs + actions */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          <div className="flex gap-2">
            <button
              onClick={() => { setShowArchive(!showArchive); setStatusFilter('all'); }}
              className={`flex items-center gap-2 border px-4 py-2 rounded-lg text-sm ${showArchive ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              <Archive size={16} /> {showArchive ? 'Hide Archive' : 'View Archive'}
            </button>
            <div className="relative">
              <button
                onClick={() => setShowCreateMenu((prev) => !prev)}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm"
              >
                <Plus size={16} /> Add User
              </button>

              {showCreateMenu && (
                <div className="absolute right-0 mt-2 w-44 rounded-lg border border-gray-200 bg-white shadow-lg z-20">
                  <button
                    type="button"
                    onClick={() => openAddModal('bhw')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700"
                  >
                    Add BHW
                  </button>
                  <button
                    type="button"
                    onClick={() => openAddModal('bns')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700"
                  >
                    Add BNS
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search + filters */}
        <div className="flex flex-wrap gap-3 mt-4">
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-50">
            <Search size={16} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or brgy..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="outline-none text-sm w-full"
            />
          </div>
          <select
            value={barangayFilter}
            onChange={(e) => setBarangayFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600"
          >
            <option value="all">All Barangays</option>
            {barangays.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="locked">Locked</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-4">
          {filteredUsers.length} {activeTab === 'bhw' ? 'Barangay Health Workers' : 'Barangay Nutrition Scholars'} Found
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="p-3">Name</th>
                <th className="p-3">Username</th>
                <th className="p-3">Barangay</th>
                <th className="p-3">Role</th>
                <th className="p-3">Status</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.user_id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-semibold">
                      {u.first_name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-gray-800">{u.first_name} {u.last_name}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                  </td>
                  <td className="p-3 text-gray-600">{u.username}</td>
                  <td className="p-3 text-gray-600">{u.barangay}</td>
                  <td className="p-3">
                    <span className="uppercase bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs">
                      {u.role}
                    </span>
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs capitalize ${
                        u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="p-3 flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(u)}
                      className="border border-gray-200 text-gray-600 px-3 py-1 rounded-lg text-xs hover:bg-gray-50"
                    >
                      View Profile
                    </button>
                    {showArchive ? (
                      <button
                        onClick={() => restoreUser(u)}
                        className="border border-green-200 text-green-600 px-3 py-1 rounded-lg text-xs hover:bg-green-50"
                      >
                        Restore
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => toggleStatus(u)}
                          className={`px-3 py-1 rounded-lg text-xs ${
                            u.status === 'active'
                              ? 'border border-red-200 text-red-600 hover:bg-red-50'
                              : 'border border-green-200 text-green-600 hover:bg-green-50'
                          }`}
                        >
                          {u.status === 'active' ? 'Lock' : 'Unlock'}
                        </button>
                        <button
                          onClick={() => archiveUser(u)}
                          className="border border-gray-200 text-gray-600 px-3 py-1 rounded-lg text-xs hover:bg-gray-50"
                        >
                          Archive
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal — Add User / View Profile */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">

            {/* ✅ Label sa taas ng modal */}
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-800">
                {editingUser ? 'User Profile' : `Add ${form.role === 'bhw' ? 'BHW' : 'BNS'}`}
              </h2>
              <p className="text-sm text-gray-400">
                {editingUser ? 'Full account details' : 'Fill in the details to create a new account'}
              </p>
            </div>

            {formError && <p className="text-red-600 text-sm mb-3">{formError}</p>}

            <form onSubmit={handleSubmit} className="space-y-3">

              {/* Role selector — lumalabas lang kapag Add User (bagong account) */}
              {!editingUser && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Role</label>
                  <select
                    name="role"
                    value={form.role}
                    onChange={handleChange}
                    className="border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="bhw">Barangay Health Worker (BHW)</option>
                    <option value="bns">Barangay Nutrition Scholar (BNS)</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <input name="first_name" placeholder="First Name" value={form.first_name} onChange={handleChange} disabled={viewOnly} required className="border rounded-lg px-3 py-2 text-sm disabled:bg-gray-50" />
                <input name="last_name" placeholder="Last Name" value={form.last_name} onChange={handleChange} disabled={viewOnly} required className="border rounded-lg px-3 py-2 text-sm disabled:bg-gray-50" />
              </div>
              <input name="middle_initial" placeholder="Middle Initial" value={form.middle_initial} onChange={handleChange} disabled={viewOnly} className="border rounded-lg px-3 py-2 text-sm w-full disabled:bg-gray-50" />
              <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} disabled={viewOnly} required className="border rounded-lg px-3 py-2 text-sm w-full disabled:bg-gray-50" />
              <input name="username" placeholder="Username" value={form.username} onChange={handleChange} disabled={viewOnly} required className="border rounded-lg px-3 py-2 text-sm w-full disabled:bg-gray-50" />

              {!viewOnly && (
                <input name="password" type="password" placeholder="Password" value={form.password} onChange={handleChange} className="border rounded-lg px-3 py-2 text-sm w-full" />
              )}

              <div className="grid grid-cols-2 gap-3">
                <input name="municipality" placeholder="Municipality" value={form.municipality} onChange={handleChange} disabled={viewOnly} required className="border rounded-lg px-3 py-2 text-sm disabled:bg-gray-50" />
                <select
                  name="barangay"
                  value={form.barangay}
                  onChange={handleChange}
                  disabled={viewOnly}
                  required
                  className="border rounded-lg px-3 py-2 text-sm disabled:bg-gray-50"
                >
                  <option value="">Select Barangay</option>
                  {GASAN_BARANGAYS.map((barangay) => (
                    <option key={barangay} value={barangay}>{barangay}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input name="purok" placeholder="Purok" value={form.purok} onChange={handleChange} disabled={viewOnly} className="border rounded-lg px-3 py-2 text-sm disabled:bg-gray-50" />
                <input name="contact_number" placeholder="Contact Number" value={form.contact_number} onChange={handleChange} disabled={viewOnly} required className="border rounded-lg px-3 py-2 text-sm disabled:bg-gray-50" />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm"
                >
                  Close
                </button>

                {viewOnly ? (
                  <button
                    type="button"
                    onClick={() => setViewOnly(false)}
                    className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 text-sm"
                  >
                    Edit
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 text-sm"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;