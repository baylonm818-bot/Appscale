/**
 * PurokManagement.jsx — Admin Purok Management by Barangay
 * Route: /admin/puroks
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import axiosClient from '../api/axiosClient';
import { motion, AnimatePresence } from 'framer-motion';
import { ShimmerSkeleton } from '../components/ui/motion';
import {
  MapPin,
  Plus,
  Edit2,
  Check,
  X,
  Power,
  Search,
  Building,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

const GASAN_BARANGAYS = [
  'Antipolo', 'B. Ibaba', 'B. Ilaya', 'Bacong-Bacong', 'Bahi', 'Bangbang',
  'Banot', 'Banuyo', 'Bognuyan', 'Cabugao', 'Dawis', 'Dili', 'Libtangin',
  'Mahunig', 'Mangiliol', 'Masiga', 'Mat. Gasan', 'Pangi', 'Pinggan',
  'Tabionan', 'Tiguion', 'Brgy. Uno', 'Brgy. Dos', 'Brgy. Tres', 'Tapuyan',
];

// Helper to auto-capitalize words
function capitalizeWords(str) {
  if (!str) return '';
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function PurokManagement() {
  const [selectedBarangay, setSelectedBarangay] = useState('Antipolo');
  const [puroks, setPuroks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPurokName, setNewPurokName] = useState('');
  const [adding, setAdding] = useState(false);

  // Edit / Rename State
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Deactivate confirm modal
  const [confirmTogglePurok, setConfirmTogglePurok] = useState(null);

  const fetchPuroks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/puroks', {
        params: {
          barangay: selectedBarangay,
          include_inactive: 'true',
        },
      });
      setPuroks(res.data || []);
    } catch (err) {
      console.error('Fetch puroks error:', err);
      setError('Failed to load puroks for this barangay.');
    } finally {
      setLoading(false);
    }
  }, [selectedBarangay]);

  useEffect(() => {
    fetchPuroks();
  }, [fetchPuroks]);

  const handleAddPurok = async (e) => {
    e.preventDefault();
    if (!newPurokName.trim()) {
      setError('Please provide a purok name.');
      return;
    }
    setAdding(true);
    setError('');
    try {
      await axiosClient.post('/puroks', {
        barangay: selectedBarangay,
        name: capitalizeWords(newPurokName.trim()),
      });
      setSuccess(`Purok "${capitalizeWords(newPurokName.trim())}" added successfully.`);
      setNewPurokName('');
      setShowAddModal(false);
      await fetchPuroks();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add purok.');
    } finally {
      setAdding(false);
    }
  };

  const startRename = (p) => {
    setEditingId(p.id);
    setEditName(p.name);
  };

  const handleSaveRename = async (id) => {
    if (!editName.trim()) return;
    setSavingEdit(true);
    setError('');
    try {
      await axiosClient.put(`/puroks/${id}`, {
        name: capitalizeWords(editName.trim()),
      });
      setSuccess('Purok renamed successfully.');
      setEditingId(null);
      await fetchPuroks();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to rename purok.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleStatus = async (purok) => {
    try {
      const newStatus = purok.is_active ? 0 : 1;
      await axiosClient.patch(`/puroks/${purok.id}/status`, {
        is_active: newStatus,
      });
      setSuccess(`Purok "${purok.name}" ${newStatus ? 'activated' : 'deactivated'} successfully.`);
      setConfirmTogglePurok(null);
      await fetchPuroks();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update purok status.');
    }
  };

  const filteredPuroks = useMemo(() => {
    if (!search.trim()) return puroks;
    const q = search.trim().toLowerCase();
    return puroks.filter((p) => p.name.toLowerCase().includes(q));
  }, [puroks, search]);

  const activeCount = useMemo(() => puroks.filter((p) => p.is_active).length, [puroks]);
  const inactiveCount = useMemo(() => puroks.filter((p) => !p.is_active).length, [puroks]);

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
              <MapPin size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Purok Management</h1>
              <p className="text-xs text-gray-500">
                Configure community puroks per barangay. Seeded with "Purok 1" placeholder.
              </p>
            </div>
          </div>
        </div>

        {/* Barangay Picker & Add Button */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
            <Building size={16} className="text-gray-400" />
            <span className="text-xs font-semibold text-gray-500">Barangay:</span>
            <select
              value={selectedBarangay}
              onChange={(e) => setSelectedBarangay(e.target.value)}
              className="text-xs font-bold text-gray-800 bg-transparent focus:outline-none cursor-pointer"
            >
              {GASAN_BARANGAYS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-[#2e7d32] hover:bg-[#1b5e20] text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm"
          >
            <Plus size={16} />
            Add Purok
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">
            <X size={14} />
          </button>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 text-emerald-800 text-xs border border-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="text-emerald-600 hover:text-emerald-800">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400">Total Puroks</p>
            <p className="text-2xl font-black text-gray-800 mt-1">{puroks.length}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Barangay {selectedBarangay}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
            <MapPin size={22} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-600">Active Puroks</p>
            <p className="text-2xl font-black text-emerald-700 mt-1">{activeCount}</p>
            <p className="text-[11px] text-emerald-600 mt-0.5">Available for selection</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-500">Deactivated</p>
            <p className="text-2xl font-black text-gray-600 mt-1">{inactiveCount}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Hidden from form dropdowns</p>
          </div>
          <div className="p-3 bg-gray-100 text-gray-500 rounded-xl">
            <Power size={22} />
          </div>
        </div>
      </div>

      {/* ── Purok Table Container ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-[#2e7d32]" />
            <h3 className="font-bold text-sm text-gray-800">
              Purok List for {selectedBarangay} ({filteredPuroks.length})
            </h3>
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search purok name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#2e7d32]"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <ShimmerSkeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : filteredPuroks.length === 0 ? (
          <div className="p-12 text-center">
            <MapPin size={36} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm font-semibold text-gray-600">No puroks found</p>
            <p className="text-xs text-gray-400 mt-1">
              Add a new purok or choose another barangay.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100">
                <tr>
                  <th className="px-5 py-3">Purok Name</th>
                  <th className="px-5 py-3">Barangay</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPuroks.map((p) => {
                  const isEditing = editingId === p.id;
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-5 py-3 font-semibold text-gray-900">
                        {isEditing ? (
                          <div className="flex items-center gap-2 max-w-xs">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(capitalizeWords(e.target.value))}
                              className="px-2 py-1 border border-emerald-500 rounded-lg text-xs w-full focus:outline-none"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveRename(p.id)}
                              disabled={savingEdit}
                              className="p-1 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
                              title="Save"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <span className={p.is_active ? 'text-gray-900' : 'text-gray-400 line-through'}>
                            {p.name}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-600">{p.barangay_name || selectedBarangay}</td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            p.is_active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {p.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => startRename(p)}
                            className="p-1.5 rounded-lg text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 transition"
                            title="Rename"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmTogglePurok(p)}
                            className={`p-1.5 rounded-lg transition ${
                              p.is_active
                                ? 'text-amber-600 hover:bg-amber-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={p.is_active ? 'Deactivate' : 'Activate'}
                          >
                            <Power size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add Purok Modal ── */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <Plus size={18} />
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm">Add Purok — {selectedBarangay}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddPurok} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Purok Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder='e.g. Purok 2, Pag-asa, Riverside'
                    value={newPurokName}
                    onChange={(e) => setNewPurokName(capitalizeWords(e.target.value))}
                    required
                    autoFocus
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-[#2e7d32] focus:ring-1 focus:ring-[#2e7d32]"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Names are free text and automatically capitalized.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={adding}
                    className="px-4 py-2 text-xs font-bold text-white bg-[#2e7d32] hover:bg-[#1b5e20] rounded-xl transition disabled:opacity-50"
                  >
                    {adding ? 'Adding…' : 'Add Purok'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Toggle Status Confirm Modal ── */}
      <AnimatePresence>
        {confirmTogglePurok && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-gray-100 space-y-4"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
                <Power size={22} />
              </div>
              <div className="text-center">
                <h3 className="font-bold text-gray-900 text-sm">
                  {confirmTogglePurok.is_active ? 'Deactivate Purok?' : 'Activate Purok?'}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {confirmTogglePurok.is_active
                    ? `Deactivating "${confirmTogglePurok.name}" will hide it from new registrations in ${selectedBarangay}. Historical records will remain intact.`
                    : `Activating "${confirmTogglePurok.name}" will make it available for selection in ${selectedBarangay}.`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmTogglePurok(null)}
                  className="w-1/2 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleStatus(confirmTogglePurok)}
                  className={`w-1/2 py-2 text-xs font-bold text-white rounded-xl transition ${
                    confirmTogglePurok.is_active
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {confirmTogglePurok.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
