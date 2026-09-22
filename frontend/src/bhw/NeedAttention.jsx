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
} from 'lucide-react';

const statusColors = {
  normal: 'bg-green-100 text-green-700',
  MAM: 'bg-yellow-100 text-yellow-700',
  SAM: 'bg-red-100 text-red-700',
  overweight: 'bg-orange-100 text-orange-700',
  obese: 'bg-red-100 text-red-800',
};

const statusPriority = {
  SAM: 0,
  MAM: 1,
  overweight: 2,
  obese: 2,
  normal: 3,
};

const serviceOptions = [
  { value: 'vitamin_a', label: 'Vitamin A' },
  { value: 'deworming', label: 'Deworming' },
  { value: 'feeding', label: 'Feeding Program' },
  { value: 'checkup', label: 'General Checkup' },
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
  const [sortBy, setSortBy] = useState('priority'); // priority | overdue | name

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
  const [givenBy, setGivenBy] = useState('bhw'); // bhw | bns
  const [visitWeight, setVisitWeight] = useState('');
  const [visitHeight, setVisitHeight] = useState('');
  const [visitNotes, setVisitNotes] = useState('');
  const [visitSubmitting, setVisitSubmitting] = useState(false);
  const [visitError, setVisitError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axiosClient.get('/bhw/need-attention', {
          params: { barangay: user.barangay },
        });
        setChildren(response.data);
      } catch (err) {
        setError('Failed to load data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredChildren = useMemo(() => {
    let list = [...children];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) =>
        `${c.first_name} ${c.last_name}.toLowerCase().includes(q)` ||
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
        `${a.first_name} ${a.last_name}.localeCompare(${b.first_name} ${b.last_name})`
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
        reason: referReason || 'Nutrition follow-up needed',
        referred_by: user.user_id,
      });
      setReferTarget(null);
    } catch (err) {
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
    setGivenBy('bhw');
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
            ? { ...c, last_visit: visitDate }
            : c
        )
      );
      setVisitTarget(null);
    } catch (err) {
      setVisitError('Failed to log visit. Please try again.');
    } finally {
      setVisitSubmitting(false);
    }
  };

  const goToProfile = () => navigate('/bhw/medical-records');

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div>
      

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
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
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="all">All Statuses</option>
          <option value="SAM">SAM</option>
          <option value="MAM">MAM</option>
          <option value="overweight">Overweight</option>
          <option value="obese">Obese</option>
        </select>

        <select
          value={ageFilter}
          onChange={(e) => setAgeFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="all">All Ages</option>
          <option value="0-23">0–23 mos</option>
          <option value="24-59">24–59 mos</option>
        </select>

        <button
          onClick={() =>
            setSortBy((prev) =>
              prev === 'priority' ? 'overdue' : prev === 'overdue' ? 'name' : 'priority'
            )
          }
          className="text-sm flex items-center gap-1 border border-gray-200 rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-50"
        >
          <ArrowUpDown size={14} />
          Sort:{' '}
          {sortBy === 'priority' ? 'Severity' : sortBy === 'overdue' ? 'Most Overdue' : 'Name'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-4">
          {filteredChildren.length} Children Found
        </h3>

        {filteredChildren.length === 0 ? (
          <p className="text-sm text-gray-400">No children currently flagged. Great work!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="p-3">Child</th>
                  <th className="p-3">Age</th>
                  <th className="p-3">Guardian</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Weight</th>
                  <th className="p-3">Height</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Last Visit</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedChildren.map((c) => {
                  const overdueDays = daysSince(c.last_visit);
                  const isOverdue = overdueDays !== null && overdueDays > 30;
                  return (
                    <tr
                      key={c.child_id}
                      onClick={() => goToProfile(c.child_id)}
                      className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="p-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-semibold">
                          {c.first_name.charAt(0)}
                        </div>
                        <span className="text-gray-800">
                          {c.first_name} {c.last_name}
                        </span>
                      </td>
                      <td className="p-3 text-gray-600">{c.age_in_months} mos</td>
                      <td className="p-3 text-gray-600">{c.guardian_name || '—'}</td>
                      <td className="p-3 text-gray-600">
                        {c.guardian_contact ? (
                          <span className="flex items-center gap-1">
                            <Phone size={12} /> {c.guardian_contact}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-3 text-gray-600">{c.weight_kg} kg</td>
                      <td className="p-3 text-gray-600">{c.height_cm} cm</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            statusColors[c.overall_status] || 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {c.overall_status}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="text-gray-600">
                          {c.last_visit ? new Date(c.last_visit).toLocaleDateString() : '—'}
                        </div>
                        {overdueDays !== null && (
                          <div className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                            {overdueDays}d ago{isOverdue ? ' ⚠' : ''}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => openVisitModal(c, e)}
                            title="Log visit / service given"
                            className="p-1.5 rounded-lg text-green-700 hover:bg-green-50"
                          >
                            <Stethoscope size={16} />
                          </button>
                          <button
                            onClick={(e) => openReferModal(c, e)}
                            title="Refer this child"
                            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                          >
                            <ClipboardPlus size={16} /> Refer
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

        {/* Pagination */}
        {filteredChildren.length > pageSize && (
          <div className="flex justify-between items-center mt-4 text-sm text-gray-500">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40"
              >
                Prev
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Refer Modal */}
      {referTarget && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setReferTarget(null)}
        >
          <div
            className="bg-white rounded-xl shadow-lg w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-800">
                Refer {referTarget.first_name} {referTarget.last_name}
              </h3>
              <button onClick={() => setReferTarget(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <label className="block text-xs text-gray-500 mb-1">Severity</label>
            <select
              value={referSeverity}
              onChange={(e) => setReferSeverity(e.target.value)}
              className="w-full mb-3 text-sm border border-gray-200 rounded-lg px-3 py-2"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>

            <label className="block text-xs text-gray-500 mb-1">Reason / Notes</label>
            <textarea
              value={referReason}
              onChange={(e) => setReferReason(e.target.value)}
              rows={3}
              className="w-full mb-3 text-sm border border-gray-200 rounded-lg px-3 py-2"
              placeholder="e.g. Persistent weight loss, needs RHU evaluation"
            />

            {referError && <p className="text-xs text-red-500 mb-2">{referError}</p>}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setReferTarget(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={submitReferral}
                disabled={referSubmitting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {referSubmitting ? 'Submitting...' : 'Submit Referral'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Visit / Service Modal */}
      {visitTarget && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setVisitTarget(null)}
        >
          <div
            className="bg-white rounded-xl shadow-lg w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-800">
                Log Visit — {visitTarget.first_name} {visitTarget.last_name}
              </h3>
              <button onClick={() => setVisitTarget(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <label className="block text-xs text-gray-500 mb-1">Visit Date</label>
            <input
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              className="w-full mb-3 text-sm border border-gray-200 rounded-lg px-3 py-2"
            />

            <label className="block text-xs text-gray-500 mb-1">Medicine / Service Given</label>
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              className="w-full mb-3 text-sm border border-gray-200 rounded-lg px-3 py-2"
            >
              {serviceOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <label className="block text-xs text-gray-500 mb-1">Given By</label>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setGivenBy('bhw')}
                className={`flex-1 text-sm py-2 rounded-lg border ${
                  givenBy === 'bhw'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                BHW
              </button>
              <button
                type="button"
                onClick={() => setGivenBy('bns')}
                className={`flex-1 text-sm py-2 rounded-lg border ${
                  givenBy === 'bns'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                BNS
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Weight (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  value={visitWeight}
                  onChange={(e) => setVisitWeight(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Height (cm)</label>
                <input
                  type="number"
                  step="0.01"
                  value={visitHeight}
                  onChange={(e) => setVisitHeight(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea
              value={visitNotes}
              onChange={(e) => setVisitNotes(e.target.value)}
              rows={2}
              className="w-full mb-3 text-sm border border-gray-200 rounded-lg px-3 py-2"
              placeholder="Optional notes"
            />

            {visitError && <p className="text-xs text-red-500 mb-2">{visitError}</p>}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setVisitTarget(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={submitVisit}
                disabled={visitSubmitting}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {visitSubmitting ? 'Saving...' : 'Save Visit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NeedAttention;