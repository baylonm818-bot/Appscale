import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { Calendar, Clock, CheckCircle2, Archive, Search, X } from 'lucide-react';

const statusLabels = { pending: 'Scheduled', done: 'Completed', cancelled: 'Cancelled', archived: 'Archived', missed: 'Missed' };

const isUpcoming = (activity) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return activity.status === 'pending' && new Date(activity.schedule_date) >= today;
};

const isMissed = (activity) => activity.status === 'pending' && !isUpcoming(activity);

const getDisplayStatus = (activity) => (isMissed(activity) ? 'missed' : activity.status);

const STATUS_STYLE = {
  pending:   'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  done:      'bg-green-100   text-green-800   ring-1 ring-green-200',
  cancelled: 'bg-red-100     text-red-800     ring-1 ring-red-200',
  archived:  'bg-gray-100    text-gray-700    ring-1 ring-gray-200',
  missed:    'bg-amber-100   text-amber-800   ring-1 ring-amber-200',
};

function StatusBadge({ status }) {
  return (
    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase ${STATUS_STYLE[status] || 'bg-gray-100 text-gray-600'}`}>
      {statusLabels[status] || status}
    </span>
  );
}

function SummaryCard({ icon: Icon, label, value, sublabel, isActive, onClick }) {
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
      <p className={`text-4xl font-black mt-3 tracking-tight ${isActive ? 'text-white' : 'text-gray-800'}`}>{value}</p>
      <p className={`text-xs mt-1 font-medium ${isActive ? 'text-white/60' : 'text-gray-400'}`}>{sublabel}</p>
    </button>
  );
}

function ActivityRow({ activity, onComplete, onArchive }) {
  const date = new Date(activity.schedule_date);
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();
  const status = getDisplayStatus(activity);

  return (
    <div className="flex flex-col gap-3 px-6 py-4 hover:bg-green-50/30 transition-colors border-b border-gray-50 last:border-0 sm:flex-row sm:items-center sm:gap-5">
      <div className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-linear-to-br from-[#1b5e20] to-[#2e7d32] text-white shrink-0 shadow-xs">
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{month}</span>
        <span className="text-xl font-black leading-none">{day}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-bold text-gray-900 text-sm">{activity.title}</h3>
          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize">
            {activity.schedule_type?.replace('_', ' ')}
          </span>
          <StatusBadge status={status} />
        </div>
        <p className="text-xs text-gray-400 mt-1 wrap-break-word">
          {activity.barangay || 'Barangay Activity'}
          {activity.venue && ` · ${activity.venue}`}
          {activity.facilitator && ` · ${activity.facilitator}`}
          {activity.schedule_time && ` · ${activity.schedule_time}`}
        </p>
      </div>

      <div className="flex gap-2 shrink-0">
        {(activity.status === 'cancelled' || activity.status === 'done') && (
          <button
            onClick={() => onArchive(activity.schedule_id)}
            className="px-3 py-1.5 text-xs font-semibold border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition"
          >
            Archive
          </button>
        )}
        {activity.status === 'pending' && !isMissed(activity) && (
          <button
            onClick={() => onComplete(activity.schedule_id)}
            className="px-3.5 py-1.5 text-xs font-bold border border-green-300 bg-green-50 text-green-800 rounded-xl hover:bg-green-100 transition shadow-xs"
          >
            Mark Done
          </button>
        )}
      </div>
    </div>
  );
}

const emptyForm = { title: '', schedule_type: 'weighing', schedule_date: '', schedule_time: '', venue: '', facilitator: '', notes: '' };

function Schedule() {
  const [activities, setActivities] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const response = await axiosClient.get('/bhw/schedule', {
        params: { barangay: user.barangay, user_id: user.user_id, role: user.role },
      });
      setActivities(response.data || []);
    } catch {
      setError('Failed to load schedule.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const updateStatus = async (id, status) => {
    try {
      await axiosClient.patch(`/bhw/schedule/${id}/status`, { status });
      fetchActivities();
    } catch {
      alert('Failed to update activity status.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.schedule_date) { setFormError('Title and date are required.'); return; }
    setSaving(true); setFormError('');
    try {
      await axiosClient.post('/bhw/schedule', form);
      setShowModal(false); setForm(emptyForm); fetchActivities();
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Failed to save schedule.');
    } finally { setSaving(false); }
  };

  const counts = {
    all: activities.length,
    upcoming: activities.filter(isUpcoming).length,
    completed: activities.filter((a) => a.status === 'done').length,
    archived: activities.filter((a) => a.status === 'archived' || a.status === 'cancelled' || isMissed(a)).length,
  };

  const filteredActivities = activities.filter((a) => {
    const matchesFilter =
      activeFilter === 'all'
        ? true
        : activeFilter === 'upcoming'
        ? isUpcoming(a)
        : activeFilter === 'completed'
        ? a.status === 'done'
        : a.status === 'archived' || a.status === 'cancelled' || isMissed(a);
    const matchesSearch =
      search === '' ||
      a.title?.toLowerCase().includes(search.toLowerCase()) ||
      a.barangay?.toLowerCase().includes(search.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-10 h-10 rounded-full border-4 border-green-200 border-t-green-600 animate-spin" />
        <p className="text-sm font-medium text-gray-400">Loading schedule…</p>
      </div>
    );
  }

  if (error) return <p className="text-red-600 p-6">{error}</p>;

  return (
    <div className="space-y-6">

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={Calendar}
          label="Total Activities"
          value={counts.all}
          sublabel="All scheduled events"
          isActive={activeFilter === 'all'}
          onClick={() => setActiveFilter('all')}
        />
        <SummaryCard
          icon={Clock}
          label="Upcoming"
          value={counts.upcoming}
          sublabel="Pending activities"
          isActive={activeFilter === 'upcoming'}
          onClick={() => setActiveFilter('upcoming')}
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Completed"
          value={counts.completed}
          sublabel="Done & executed"
          isActive={activeFilter === 'completed'}
          onClick={() => setActiveFilter('completed')}
        />
        <SummaryCard
          icon={Archive}
          label="Archived"
          value={counts.archived}
          sublabel="Past & archived"
          isActive={activeFilter === 'archived'}
          onClick={() => setActiveFilter('archived')}
        />
      </div>

      {/* ── Search Bar + Add Activity Button ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search activity by title or venue…"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2e7d32] focus:ring-2 focus:ring-green-100 transition bg-white"
          />
        </div>
        <button
          type="button"
          onClick={() => { setShowModal(true); setForm(emptyForm); setFormError(''); }}
          className="flex items-center justify-center gap-2 bg-linear-to-r from-[#1b5e20] to-[#2e7d32] hover:from-[#154a1a] hover:to-[#256427] text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition shadow-sm shrink-0 cursor-pointer"
        >
          <Calendar size={16} />
          Add Activity
        </button>
      </div>

      {/* ── Activity List ── */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-3.5 bg-gray-50/70 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {filteredActivities.length} {activeFilter === 'all' ? 'total' : activeFilter} activities in {user.barangay || 'Barangay'}
          </p>
        </div>

        {filteredActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Calendar className="text-gray-300" size={32} />
            <p className="text-sm font-semibold text-gray-500">No activities found</p>
            <p className="text-xs text-gray-400">There are no activities matching your filter criteria.</p>
          </div>
        ) : (
          filteredActivities.map((act) => (
            <ActivityRow
              key={act.schedule_id}
              activity={act}
              onComplete={(id) => updateStatus(id, 'done')}
              onArchive={(id) => updateStatus(id, 'archived')}
            />
          ))
        )}
      </div>

      {/* ── Centered Add Schedule Modal Popup ── */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-hidden animate-in fade-in duration-200"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[88vh] flex flex-col transform transition-all scale-100">
            {/* Modal header */}
            <div className="bg-linear-to-r from-[#1b5e20] to-[#2e7d32] px-6 py-4 flex items-center justify-between shrink-0 text-white">
              <div>
                <h2 className="text-base font-bold">New Activity Schedule</h2>
                <p className="text-white/80 text-xs mt-0.5">Barangay: {user.barangay || 'Community'}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 px-6 py-5">
              {formError && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-3 font-medium">
                  {formError}
                </div>
              )}
              <form id="bhwSchedForm" onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">Activity Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Supplemental Feeding Session"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32] focus:ring-2 focus:ring-green-100"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">Activity Type</label>
                  <select
                    value={form.schedule_type}
                    onChange={(e) => setForm({ ...form, schedule_type: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32]"
                  >
                    <option value="feeding">Feeding Program</option>
                    <option value="home_visit">Home Visit</option>
                    <option value="immunization">Immunization / Checkup</option>
                    <option value="checkup">General Health Consultation</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">Date *</label>
                    <input
                      type="date"
                      required
                      value={form.schedule_date}
                      onChange={(e) => setForm({ ...form, schedule_date: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">Time</label>
                    <input
                      type="time"
                      value={form.schedule_time}
                      onChange={(e) => setForm({ ...form, schedule_time: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">Venue / Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Barangay Health Center Hall"
                    value={form.venue}
                    onChange={(e) => setForm({ ...form, venue: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32]"
                  />
                </div>
              </form>
            </div>

            {/* Modal footer */}
            <div className="border-t border-gray-100 px-6 py-4 bg-gray-50/70 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-200/60 border border-gray-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="bhwSchedForm"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-linear-to-r from-[#1b5e20] to-[#2e7d32] text-white hover:from-[#154a1a] hover:to-[#256427] transition shadow-xs disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save Activity'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Schedule;