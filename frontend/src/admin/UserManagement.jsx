import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { Users, Archive, Plus, Search, Shield, Lock, Unlock, RefreshCw, X, ChevronRight, CheckCircle2 } from 'lucide-react';

const GASAN_BARANGAYS = [
  'Antipolo', 'B. Ibaba', 'B. Ilaya', 'Bacong-Bacong', 'Bahi', 'Bangbang',
  'Banot', 'Banuyo', 'Bognuyan', 'Cabugao', 'Dawis', 'Dili', 'Libtangin',
  'Mahunig', 'Mangiliol', 'Masiga', 'Mat. Gasan', 'Pangi', 'Pinggan',
  'Tabionan', 'Tiguion', 'Brgy. Uno', 'Brgy. Dos', 'Brgy. Tres', 'Tapuyan',
];

const emptyForm = {
  first_name: '', middle_initial: '', last_name: '', email: '', username: '',
  password: '', role: 'bhw', municipality: 'Gasan', barangay: '', purok: '', contact_number: '',
};

function StatCard({ icon: Icon, label, value, sublabel, isActive, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl p-5 shadow-sm transition-all duration-200 focus:outline-none cursor-pointer
        ${isActive
          ? 'bg-linear-to-br from-[#1b5e20] to-[#2e7d32] text-white shadow-md'
          : 'bg-white hover:shadow-md hover:-translate-y-0.5 active:translate-y-0'
        }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className={`text-sm font-medium leading-tight ${isActive ? 'text-white/80' : 'text-gray-500'}`}>{label}</p>
        <div className={`shrink-0 rounded-xl p-2.5 ${isActive ? 'bg-white/20' : 'bg-green-50'}`}>
          <Icon size={18} className={isActive ? 'text-white' : 'text-[#2e7d32]'} />
        </div>
      </div>
      <p className={`text-4xl font-black mt-3 tracking-tight ${isActive ? 'text-white' : 'text-gray-800'}`}>{value ?? 0}</p>
      <p className={`text-xs mt-1 font-medium ${isActive ? 'text-white/60' : 'text-gray-400'}`}>{sublabel}</p>
    </button>
  );
}

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [barangayFilter, setBarangayFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showArchive, setShowArchive] = useState(false);

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
      setUsers(usersRes.data || []);
      setStats(statsRes.data || {});
    } catch (err) {
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = (role = 'bhw') => {
    setEditingUser(null);
    setViewOnly(false);
    setForm({ ...emptyForm, role });
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (u) => {
    setEditingUser(u);
    setViewOnly(true);
    setForm({
      first_name: u.first_name || '',
      middle_initial: u.middle_initial || '',
      last_name: u.last_name || '',
      email: u.email || '',
      username: u.username || '',
      password: '',
      role: u.role,
      municipality: u.municipality || 'Gasan',
      barangay: u.barangay || '',
      purok: u.purok || '',
      contact_number: u.contact_number || '',
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
      const hasBnsInBarangay = users.some((u) =>
        u.role === 'bns' &&
        !u.deleted_at &&
        u.user_id !== editingUser?.user_id &&
        (u.barangay || '').trim().toLowerCase() === normalizedBarangay
      );

      if (form.role === 'bns' && hasBnsInBarangay && !editingUser) {
        setFormError('This barangay already has an active BNS. Archive the existing BNS before assigning a replacement.');
        setSaving(false);
        return;
      }

      if (form.role === 'bhw' && normalizedBarangay && !hasBnsInBarangay && !editingUser) {
        setFormError('This barangay has no active BNS assigned yet. Assign a BNS first before adding a BHW.');
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
      setFormError(err.response?.data?.message || 'Failed to save user.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (u) => {
    const newStatus = u.status === 'active' ? 'locked' : 'active';
    try {
      await axiosClient.patch(`/users/${u.user_id}/status`, {
        status: newStatus,
        deactivation_reason: newStatus === 'locked' ? 'Locked by Administrator' : null,
      });
      fetchData();
    } catch {
      alert('Failed to update user status.');
    }
  };

  const archiveUser = async (u) => {
    if (!window.confirm(`Archive ${u.first_name} ${u.last_name}? This user will no longer be able to log in.`)) return;
    try {
      await axiosClient.patch(`/users/${u.user_id}/archive`);
      fetchData();
    } catch {
      alert('Failed to archive user.');
    }
  };

  const restoreUser = async (u) => {
    try {
      await axiosClient.patch(`/users/${u.user_id}/restore`);
      fetchData();
    } catch {
      alert('Failed to restore user.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-10 h-10 rounded-full border-4 border-green-200 border-t-green-600 animate-spin" />
        <p className="text-sm font-medium text-gray-400">Loading user accounts…</p>
      </div>
    );
  }

  if (error) return <p className="text-red-600 p-6">{error}</p>;

  const safeStats = stats || {
    totalUsers: 0,
    totalBNS: 0,
    totalBHW: 0,
    activeUsers: 0,
  };

  const filteredUsers = users
    .filter((u) => activeTab === 'all' || u.role === activeTab)
    .filter((u) => showArchive ? Boolean(u.deleted_at) : !u.deleted_at)
    .filter((u) => barangayFilter === 'all' || u.barangay === barangayFilter)
    .filter((u) => statusFilter === 'all' || u.status === statusFilter)
    .filter((u) =>
      !search ||
      `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase().includes(search.toLowerCase()) ||
      (u.barangay || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(search.toLowerCase())
    );

  const inputCls = "w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32] focus:ring-2 focus:ring-green-100 transition bg-white disabled:bg-gray-50 disabled:text-gray-500";

  return (
    <div className="space-y-6">

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Users"
          value={safeStats.totalUsers}
          sublabel="All assigned accounts"
          isActive={activeTab === 'all' && !showArchive}
          onClick={() => { setActiveTab('all'); setShowArchive(false); setStatusFilter('all'); }}
        />
        <StatCard
          icon={Shield}
          label="Total BNS"
          value={safeStats.totalBNS}
          sublabel="Nutrition Scholars"
          isActive={activeTab === 'bns' && !showArchive}
          onClick={() => { setActiveTab('bns'); setShowArchive(false); setStatusFilter('all'); }}
        />
        <StatCard
          icon={Users}
          label="Total BHW"
          value={safeStats.totalBHW}
          sublabel="Health Workers"
          isActive={activeTab === 'bhw' && !showArchive}
          onClick={() => { setActiveTab('bhw'); setShowArchive(false); setStatusFilter('all'); }}
        />
        <StatCard
          icon={CheckCircle2}
          label="Active Users"
          value={safeStats.activeUsers}
          sublabel="Currently verified active"
          isActive={statusFilter === 'active'}
          onClick={() => { setStatusFilter(statusFilter === 'active' ? 'all' : 'active'); setShowArchive(false); }}
        />
      </div>

      {/* ── Main Panel ── */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">

        {/* Search & Action Bar */}
        <div className="p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-1 min-w-[260px] items-center gap-2 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-100 focus-within:border-green-400 focus-within:ring-2 focus-within:ring-green-100 transition">
            <Search size={16} className="text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search user by name, email, or barangay…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="outline-none text-sm w-full bg-transparent text-gray-700 placeholder-gray-400"
            />
            {search && <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <select
              value={barangayFilter}
              onChange={(e) => setBarangayFilter(e.target.value)}
              className="border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:border-[#2e7d32]"
            >
              <option value="all">All Barangays</option>
              {GASAN_BARANGAYS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:border-[#2e7d32]"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="locked">Locked</option>
            </select>

            <button
              type="button"
              onClick={() => setShowArchive(!showArchive)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition ${
                showArchive
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Archive size={15} /> {showArchive ? 'Active Users' : 'Archives'}
            </button>

            <button
              type="button"
              onClick={() => openAddModal(activeTab === 'bns' ? 'bns' : 'bhw')}
              className="flex items-center gap-2 bg-gradient-to-r from-[#1b5e20] to-[#2e7d32] hover:from-[#154a1a] hover:to-[#256427] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-sm"
            >
              <Plus size={16} /> Add User
            </button>
          </div>
        </div>

        {/* User Count bar */}
        <div className="px-6 py-3 bg-gray-50/60 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {filteredUsers.length} {showArchive ? 'archived' : 'active'} {activeTab === 'all' ? 'accounts' : activeTab.toUpperCase() + ' accounts'}
          </p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[30%]" />
              <col className="w-[18%]" />
              <col className="w-[16%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[14%]" />
            </colgroup>
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-400 bg-gray-50/80 border-b border-gray-100">
                <th className="px-6 py-3.5">Name</th>
                <th className="px-4 py-3.5">Username</th>
                <th className="px-4 py-3.5">Barangay</th>
                <th className="px-4 py-3.5 text-center">Role</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-gray-400 text-sm">
                    No users match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.user_id} className="hover:bg-green-50/40 transition-colors group">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="shrink-0 w-9 h-9 rounded-full bg-linear-to-br from-emerald-400 to-green-600 flex items-center justify-center text-white text-xs font-bold shadow-xs">
                          {(u.first_name ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{u.first_name} {u.last_name}</p>
                          <p className="text-xs text-gray-400 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-600 font-medium truncate">{u.username}</td>
                    <td className="px-4 py-3.5 text-gray-600 truncate">{u.barangay || '—'}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                        u.role === 'bns' ? 'bg-emerald-100 text-emerald-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                        u.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                          : 'bg-red-50 text-red-700 ring-1 ring-red-200'
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(u)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[#2e7d32] border border-green-200 bg-green-50 hover:bg-green-100 transition"
                        >
                          View
                        </button>

                        {showArchive ? (
                          <button
                            type="button"
                            onClick={() => restoreUser(u)}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-700 border border-emerald-300 hover:bg-emerald-50 transition"
                          >
                            Restore
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => toggleStatus(u)}
                              title={u.status === 'active' ? 'Lock Account' : 'Unlock Account'}
                              className={`p-1.5 rounded-lg text-xs font-semibold transition ${
                                u.status === 'active'
                                  ? 'text-amber-600 hover:bg-amber-50'
                                  : 'text-green-600 hover:bg-green-50'
                              }`}
                            >
                              {u.status === 'active' ? <Lock size={14} /> : <Unlock size={14} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => archiveUser(u)}
                              title="Archive Account"
                              className="p-1.5 rounded-lg text-xs text-red-600 hover:bg-red-50 transition"
                            >
                              <Archive size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* ── User Modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">

            {/* Header */}
            <div className="bg-gradient-to-r from-[#1b5e20] to-[#2e7d32] px-6 py-5 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-base font-bold text-white">
                  {editingUser ? (viewOnly ? 'User Account Profile' : 'Edit User Account') : `Add New ${form.role.toUpperCase()}`}
                </h2>
                <p className="text-white/70 text-xs mt-0.5">
                  {editingUser ? 'Account & Barangay assignment details' : 'Fill in the credentials to register an account'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <div className="overflow-y-auto flex-1 px-6 py-5">
              {formError && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-3 font-medium">
                  {formError}
                </div>
              )}

              <form id="userForm" onSubmit={handleSubmit} className="space-y-3.5">

                {!editingUser && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Role</label>
                    <select name="role" value={form.role} onChange={handleChange} className={inputCls}>
                      <option value="bhw">Barangay Health Worker (BHW)</option>
                      <option value="bns">Barangay Nutrition Scholar (BNS)</option>
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">First Name *</label>
                    <input name="first_name" placeholder="First Name" value={form.first_name} onChange={handleChange} disabled={viewOnly} required className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Last Name *</label>
                    <input name="last_name" placeholder="Last Name" value={form.last_name} onChange={handleChange} disabled={viewOnly} required className={inputCls} />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Middle Initial</label>
                  <input name="middle_initial" placeholder="e.g. M" value={form.middle_initial} onChange={handleChange} disabled={viewOnly} className={inputCls} />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Email Address *</label>
                  <input name="email" type="email" placeholder="email@address.com" value={form.email} onChange={handleChange} disabled={viewOnly} required className={inputCls} />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Username *</label>
                  <input name="username" placeholder="Username" value={form.username} onChange={handleChange} disabled={viewOnly} required className={inputCls} />
                </div>

                {!viewOnly && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                      {editingUser ? 'New Password (leave blank to keep current)' : 'Password *'}
                    </label>
                    <input name="password" type="password" placeholder="••••••••" value={form.password} onChange={handleChange} className={inputCls} />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Municipality</label>
                    <input name="municipality" value={form.municipality} onChange={handleChange} disabled={viewOnly} required className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Barangay *</label>
                    <select name="barangay" value={form.barangay} onChange={handleChange} disabled={viewOnly} required className={inputCls}>
                      <option value="">Select Barangay</option>
                      {GASAN_BARANGAYS.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Purok</label>
                    <input name="purok" placeholder="Purok" value={form.purok} onChange={handleChange} disabled={viewOnly} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Contact Number</label>
                    <input name="contact_number" placeholder="09xxxxxxxxx" value={form.contact_number} onChange={handleChange} disabled={viewOnly} className={inputCls} />
                  </div>
                </div>

              </form>
            </div>

            {/* Footer */}
            <div className="shrink-0 px-6 pb-5 pt-3 flex gap-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border-2 border-gray-200 hover:bg-gray-50 transition"
              >
                Close
              </button>

              {viewOnly ? (
                <button
                  type="button"
                  onClick={() => setViewOnly(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#1b5e20] to-[#2e7d32] hover:from-[#154a1a] hover:to-[#256427] transition shadow-sm"
                >
                  Edit Profile
                </button>
              ) : (
                <button
                  type="submit"
                  form="userForm"
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#1b5e20] to-[#2e7d32] hover:from-[#154a1a] hover:to-[#256427] transition shadow-sm disabled:opacity-60"
                >
                  {saving ? 'Saving…' : (editingUser ? 'Save Changes' : 'Create Account')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default UserManagement;