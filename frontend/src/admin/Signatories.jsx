/**
 * Signatories.jsx — Admin-only report signatory settings
 * Route: /admin/signatories
 */
import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { motion } from 'framer-motion';
import { ShimmerSkeleton } from '../components/ui/motion';
import { Plus, Trash2, Save, MapPin, CheckCircle } from 'lucide-react';

// Exactly the 25 Barangays of Gasan, Marinduque
const GASAN_BARANGAYS = [
  'Antipolo', 'B. Ibaba', 'B. Ilaya', 'Bacong-Bacong', 'Bahi', 'Bangbang',
  'Banot', 'Banuyo', 'Bognuyan', 'Cabugao', 'Dawis', 'Dili', 'Libtangin',
  'Mahunig', 'Mangiliol', 'Masiga', 'Mat. Gasan', 'Pangi', 'Pinggan',
  'Tabionan', 'Tiguion', 'Brgy. Uno', 'Brgy. Dos', 'Brgy. Tres', 'Tapuyan',
];

export default function Signatories() {
  // Default to Antipolo (first of the 25 barangays, no 'All Barangays')
  const [selectedBarangay, setSelectedBarangay] = useState('Antipolo');
  const [signatories, setSignatories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const targetBarangay = selectedBarangay;

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError('');

    axiosClient.get('/reports/signatories', { params: { barangay: targetBarangay } })
      .then((res) => {
        if (isMounted) setSignatories(res.data || []);
      })
      .catch(() => {
        if (isMounted) setError('Failed to load signatories.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [targetBarangay]);

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
      const payload = {
        barangay: targetBarangay,
        signatories: signatories.map((s, i) => ({
          position: s.position.trim(),
          name: (s.name || '').trim(),
          sort_order: i + 1,
        })),
      };
      const { data } = await axiosClient.put('/reports/signatories', payload);
      setSignatories(data.signatories || signatories);
      setSuccess(`Signatories for Barangay ${targetBarangay} saved successfully.`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save signatories.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Barangay Selector Card (Top bar aligned) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <MapPin size={18} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              Active Barangay
            </span>
            <p className="text-sm font-bold text-gray-900">
              Barangay {selectedBarangay}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="barangay-select" className="text-xs font-semibold text-gray-500 shrink-0">
            Select Barangay:
          </label>
          <select
            id="barangay-select"
            value={selectedBarangay}
            onChange={(e) => setSelectedBarangay(e.target.value)}
            className="text-xs font-bold text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 cursor-pointer min-w-[200px]"
          >
            {GASAN_BARANGAYS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <CheckCircle size={15} className="text-emerald-700 shrink-0" />
          <span className="text-emerald-950 font-medium">
            Currently editing signatories for: <strong className="font-bold text-emerald-900">Barangay {targetBarangay}</strong>
          </span>
        </div>
        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/60 px-2.5 py-0.5 rounded-full">
          25 Barangays of Gasan
        </span>
      </div>

      {/* Feedback Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl px-4 py-3">
          {error}
        </div>
      )}
      {success && (
        <motion.div
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl px-4 py-3"
        >
          {success}
        </motion.div>
      )}

      {/* Signatories Form Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => <ShimmerSkeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100">
              {signatories.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-400 text-xs font-medium">
                  No signatories configured yet for Barangay {targetBarangay}. Click &quot;Add Signatory&quot; below to configure.
                </div>
              ) : signatories.map((sig, i) => (
                <div key={i} className="px-5 py-4 flex items-start gap-4">
                  <span className="w-7 h-7 mt-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                        Position Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={sig.position || ''}
                        onChange={(e) => updateField(i, 'position', e.target.value)}
                        placeholder="e.g., Barangay Nutrition Scholar"
                        className="w-full px-3.5 py-2 text-xs font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                        Signatory Full Name
                      </label>
                      <input
                        type="text"
                        value={sig.name || ''}
                        onChange={(e) => updateField(i, 'name', e.target.value)}
                        placeholder="Full name (e.g., Maria Santos)"
                        className="w-full px-3.5 py-2 text-xs font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="mt-6 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition shrink-0 cursor-pointer"
                    title="Remove signatory"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            {/* Actions Bar */}
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-3 bg-gray-50/50">
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3.5 py-2 rounded-xl transition cursor-pointer"
              >
                <Plus size={14} /> Add Signatory
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold bg-[#2e7d32] hover:bg-[#1b5e20] text-white rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
              >
                <Save size={14} />
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </>
        )}
      </div>

      <p className="text-[11px] text-gray-400 text-center font-medium">
        These signatories will appear on printed nutritional reports and certificates for Barangay {targetBarangay}.
      </p>
    </div>
  );
}
