/**
 * Signatories.jsx — Step 7: Admin-only report signatory settings
 * Route: /admin/signatories
 */
import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { motion } from 'framer-motion';
import { ShimmerSkeleton } from '../components/ui/motion';
import { Plus, Trash2, Save, PenLine } from 'lucide-react';

export default function Signatories() {
  const [signatories, setSignatories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    axiosClient.get('/reports/signatories')
      .then((res) => setSignatories(res.data || []))
      .catch(() => setError('Failed to load signatories.'))
      .finally(() => setLoading(false));
  }, []);

  const updateField = (index, field, value) => {
    setSignatories((prev) =>
      prev.map((s, i) => i === index ? { ...s, [field]: value } : s)
    );
  };

  const addRow = () => {
    setSignatories((prev) => [
      ...prev,
      { position: '', name: '', sort_order: prev.length + 1 },
    ]);
  };

  const removeRow = (index) => {
    setSignatories((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');

    for (const sig of signatories) {
      if (!sig.position || !sig.position.trim()) {
        setError('Every signatory must have a position title.');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = signatories.map((s, i) => ({
        position: s.position.trim(),
        name: (s.name || '').trim(),
        sort_order: i + 1,
      }));
      const { data } = await axiosClient.put('/reports/signatories', payload);
      setSignatories(data.signatories || signatories);
      setSuccess('Signatories updated successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save signatories.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
          <PenLine size={18} />
        </div>
        <div>
          <h2 className="text-lg font-black text-gray-900">Report Signatories</h2>
          <p className="text-xs text-gray-500">Set who signs printed reports. Only admins can change these.</p>
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-xl px-4 py-3">{error}</div>
      )}
      {success && (
        <motion.div
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold rounded-xl px-4 py-3"
        >
          {success}
        </motion.div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1,2,3].map((i) => <ShimmerSkeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100">
              {signatories.length === 0 ? (
                <div className="px-6 py-10 text-center text-gray-400 text-sm">
                  No signatories yet. Click &quot;Add Signatory&quot; below.
                </div>
              ) : signatories.map((sig, i) => (
                <div key={i} className="px-5 py-4 flex items-start gap-4">
                  <span className="w-7 h-7 mt-1 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                        Position <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={sig.position || ''}
                        onChange={(e) => updateField(i, 'position', e.target.value)}
                        placeholder="e.g., Municipal Nutrition Action Officer"
                        className="w-full px-3 py-2 text-xs font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Name</label>
                      <input
                        type="text"
                        value={sig.name || ''}
                        onChange={(e) => updateField(i, 'name', e.target.value)}
                        placeholder="Full name"
                        className="w-full px-3 py-2 text-xs font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => removeRow(i)}
                    className="mt-6 text-gray-400 hover:text-red-500 transition shrink-0"
                    title="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add row */}
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
              <button
                onClick={addRow}
                className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 hover:text-emerald-900 transition"
              >
                <Plus size={14} /> Add Signatory
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold bg-[#2e7d32] hover:bg-[#1b5e20] text-white rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <Save size={14} />
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </>
        )}
      </div>

      <p className="text-[11px] text-gray-400 text-center">
        These names and positions will appear on all printed reports generated by the system.
      </p>
    </div>
  );
}
