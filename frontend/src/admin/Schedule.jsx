import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';

/* ── Helpers ── */
const statusLabels = { pending: 'Scheduled', done: 'Completed', cancelled: 'Cancelled', archived: 'Archived', missed: 'Missed' };

const isUpcoming = (a) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return a.status === 'pending' && new Date(a.schedule_date) >= today;
};
const isMissed = (a) => a.status === 'pending' && !isUpcoming(a);
const getDisplayStatus = (a) => isMissed(a) ? 'missed' : a.status;

const STATUS_STYLE = {
  pending:   'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
  done:      'bg-green-100   text-green-700   ring-1 ring-green-200',
  cancelled: 'bg-red-100     text-red-700     ring-1 ring-red-200',
  archived:  'bg-gray-100    text-gray-600    ring-1 ring-gray-200',
  missed:    'bg-amber-100   text-amber-700   ring-1 ring-amber-200',
};

function StatusBadge({ status }) {
  return (
    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${STATUS_STYLE[status] || 'bg-gray-100 text-gray-600'}`}>
      {statusLabels[status] || status}
    </span>
  );
}

/* ── Summary Card ── */
function SummaryCard({ icon, label, value, sublabel, isActive, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl p-5 shadow-sm transition-all duration-200 focus:outline-none
        ${isActive
          ? 'bg-gradient-to-br from-[#1b5e20] to-[#2e7d32] shadow-md'
          : 'bg-white hover:shadow-md hover:-translate-y-0.5 active:translate-y-0'
        }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className={`text-sm font-medium leading-tight ${isActive ? 'text-white/80' : 'text-gray-500'}`}>{label}</p>
        <div className={`shrink-0 rounded-xl p-2.5 ${isActive ? 'bg-white/20' : 'bg-green-50'}`}>
          <div className={isActive ? 'text-white' : 'text-green-700'}>{icon}</div>
        </div>
      </div>
      <p className={`text-4xl font-black mt-3 tracking-tight ${isActive ? 'text-white' : 'text-gray-800'}`}>{value}</p>
      <p className={`text-xs mt-1 font-medium ${isActive ? 'text-white/60' : 'text-gray-400'}`}>{sublabel}</p>
    </button>
  );
}

/* ── Activity Row ── */
function ActivityRow({ activity, onCancel, onComplete, onArchive }) {
  const date  = new Date(activity.schedule_date);
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day   = date.getDate();
  const status = getDisplayStatus(activity);

  return (
    <div className="flex flex-col gap-3 px-6 py-4 hover:bg-green-50/30 transition-colors border-b border-gray-50 last:border-0 sm:flex-row sm:items-center sm:gap-5">
      {/* Date box */}
      <div className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1b5e20] to-[#2e7d32] text-white shrink-0 shadow-sm">
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{month}</span>
        <span className="text-xl font-black leading-none">{day}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-gray-900 text-sm">{activity.title}</h3>
          <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-[11px] font-medium capitalize">
            {activity.schedule_type?.replace('_', ' ')}
          </span>
          <StatusBadge status={status} />
        </div>
        <p className="text-xs text-gray-400 mt-1 break-words">
          {activity.barangay || 'All Barangays'}
          {activity.target_role && ` · For ${activity.target_role.toUpperCase()}s`}
          {activity.venue && ` · ${activity.venue}`}
          {activity.assigned_name && ` · ${activity.assigned_name}`}
          {activity.facilitator && ` · ${activity.facilitator}`}
          {activity.schedule_time && ` · ${activity.schedule_time}`}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 shrink-0">
        {(activity.status === 'cancelled' || activity.status === 'done') && (
          <button onClick={() => onArchive(activity.schedule_id)}
            className="px-3 py-1.5 text-xs font-semibold border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition">
            Archive
          </button>
        )}
        {activity.status === 'pending' && !isMissed(activity) && (
          <>
            <button onClick={() => onComplete(activity.schedule_id)}
              className="px-3 py-1.5 text-xs font-semibold border border-green-200 text-green-700 rounded-lg hover:bg-green-50 transition">
              Mark Done
            </button>
            <button onClick={() => onCancel(activity.schedule_id)}
              className="px-3 py-1.5 text-xs font-semibold border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition">
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Form field helper ── */
const fieldCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32] focus:ring-2 focus:ring-green-100 transition bg-white";

const emptyForm = {
  title: '', schedule_type: 'feeding', schedule_date: '', schedule_time: '',
  venue: '', barangay: 'All Barangays', assigned_to: '', target_role: '',
  recipient_type: 'all', facilitator: '', notes: '',
};

/* ══════════════════════════════════════════════════════════ */
function Schedule() {
  const [activities, setActivities]   = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch]           = useState('');
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [showModal, setShowModal]     = useState(false);
  const [form, setForm]               = useState(emptyForm);
  const [formError, setFormError]     = useState('');
  const [saving, setSaving]           = useState(false);
  const [users, setUsers]             = useState([]);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const [schedRes, usersRes] = await Promise.all([
        axiosClient.get('/schedule'),
        axiosClient.get('/users'),
      ]);
      setActivities(schedRes.data || []);
      setUsers((usersRes.data || []).filter((u) => u.status === 'active'));
    } catch { setError('Failed to load schedule.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchActivities(); }, []);

  const updateStatus = async (id, status) => {
    try { await axiosClient.patch(`/schedule/${id}/status`, { status }); fetchActivities(); }
    catch { alert('Failed to update schedule.'); }
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleRecipientChange = (e) => {
    setForm({ ...form, recipient_type: e.target.value,
      barangay: e.target.value === 'all' ? 'All Barangays' : '',
      assigned_to: '', target_role: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setFormError(''); setSaving(true);
    try {
      const { recipient_type, ...schedule } = form;
      if (recipient_type === 'all')      { schedule.barangay = 'All Barangays'; schedule.assigned_to = null; schedule.target_role = null; }
      if (recipient_type === 'barangay') { schedule.assigned_to = null; schedule.target_role = null; }
      if (recipient_type === 'role')     { schedule.barangay = 'All Barangays'; schedule.assigned_to = null; }
      if (recipient_type === 'user')     { schedule.target_role = null; }
      await axiosClient.post('/schedule', schedule);
      setShowModal(false); setForm(emptyForm); fetchActivities();
    } catch (err) { setFormError(err.response?.data?.message || 'Something went wrong.'); }
    finally { setSaving(false); }
  };

  const counts = {
    all:       activities.length,
    upcoming:  activities.filter(isUpcoming).length,
    completed: activities.filter((a) => a.status === 'done').length,
    archived:  activities.filter((a) => a.status === 'archived' || a.status === 'cancelled' || isMissed(a)).length,
  };

  const filteredActivities = activities.filter((a) => {
    const matchFilter =
      activeFilter === 'all'       ? true :
      activeFilter === 'upcoming'  ? isUpcoming(a) :
      activeFilter === 'completed' ? a.status === 'done' :
      a.status === 'archived' || a.status === 'cancelled' || isMissed(a);
    const matchSearch = !search ||
      a.title?.toLowerCase().includes(search.toLowerCase()) ||
      a.barangay?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const calIcon = <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
  const clockIcon = <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
  const checkIcon = <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
  const archIcon  = <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 00-2 2v8a2 2 0 002 2h14a2 2 0 002-2v-8a2 2 0 00-2-2M5 8V6a2 2 0 012-2h10a2 2 0 012 2v2" /></svg>;

  return (
    <div className="space-y-6">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={calIcon}   label="Total Activities" value={counts.all}       sublabel="All records"          isActive={activeFilter === 'all'}       onClick={() => setActiveFilter('all')} />
        <SummaryCard icon={clockIcon} label="Upcoming"         value={counts.upcoming}  sublabel="Scheduled activities"  isActive={activeFilter === 'upcoming'}  onClick={() => setActiveFilter('upcoming')} />
        <SummaryCard icon={checkIcon} label="Completed"        value={counts.completed} sublabel="Done activities"       isActive={activeFilter === 'completed'} onClick={() => setActiveFilter('completed')} />
        <SummaryCard icon={archIcon}  label="Archived"         value={counts.archived}  sublabel="Archived & cancelled"  isActive={activeFilter === 'archived'}  onClick={() => setActiveFilter('archived')} />
      </div>

      {/* ── Search + Add button ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or barangay…"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2e7d32] focus:ring-2 focus:ring-green-100 transition"
          />
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#1b5e20] to-[#2e7d32] hover:from-[#154a1a] hover:to-[#256427] text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Activity
        </button>
      </div>

      {/* ── Activity List ── */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {/* Result count bar */}
        <div className="px-6 py-3 bg-gray-50/70 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {filteredActivities.length} {activeFilter === 'all' ? 'total' : activeFilter} activities
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-8 h-8 rounded-full border-4 border-green-200 border-t-green-600 animate-spin" />
            <p className="text-sm text-gray-400">Loading schedule…</p>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
              {calIcon}
            </div>
            <p className="text-sm font-semibold text-gray-500">No activities found</p>
            <p className="text-xs text-gray-400">Try adjusting your filters or add a new activity.</p>
          </div>
        ) : (
          filteredActivities.map((activity) => (
            <ActivityRow key={activity.schedule_id} activity={activity}
              onCancel={(id) => updateStatus(id, 'cancelled')}
              onComplete={(id) => updateStatus(id, 'done')}
              onArchive={(id) => updateStatus(id, 'archived')}
            />
          ))
        )}
      </div>

      {/* ── Add Schedule Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">

            {/* Modal header */}
            <div className="bg-gradient-to-r from-[#1b5e20] to-[#2e7d32] px-6 py-5 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-base font-bold text-white">New Schedule Activity</h2>
                <p className="text-white/70 text-xs mt-0.5">Fill in the activity details below</p>
              </div>
              <button onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <div className="overflow-y-auto flex-1 px-6 py-5">
              {formError && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                  {formError}
                </div>
              )}
              <form id="schedForm" onSubmit={handleSubmit} className="space-y-3.5">

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Activity Title *</label>
                  <input name="title" placeholder="e.g. Feeding Program – Brgy. Poblacion" value={form.title}
                    onChange={handleChange} required className={fieldCls} />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Activity Type</label>
                  <select name="schedule_type" value={form.schedule_type} onChange={handleChange} className={fieldCls}>
                    <option value="feeding">Feeding</option>
                    <option value="home_visit">Home Visit</option>
                    <option value="seminar">Seminar</option>
                    <option value="checkup">Checkup</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Date *</label>
                    <input name="schedule_date" type="date" value={form.schedule_date} onChange={handleChange} required className={fieldCls} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Time</label>
                    <input name="schedule_time" type="time" value={form.schedule_time} onChange={handleChange} className={fieldCls} />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Send To</label>
                  <select name="recipient_type" value={form.recipient_type} onChange={handleRecipientChange} className={fieldCls}>
                    <option value="all">📍 Whole Municipality (All Barangays)</option>
                    <option value="barangay">🏘️ Specific Barangay</option>
                    <option value="role">👥 By Role (BHW / BNS)</option>
                    <option value="user">👤 Specific User</option>
                  </select>
                </div>

                {form.recipient_type === 'barangay' && (
                  <select name="barangay" value={form.barangay} onChange={handleChange} required className={fieldCls}>
                    <option value="">Select barangay…</option>
                    {[...new Set(users.map((u) => u.barangay).filter(Boolean))].sort().map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                )}

                {form.recipient_type === 'role' && (
                  <select name="target_role" value={form.target_role} onChange={handleChange} required className={fieldCls}>
                    <option value="">Select role…</option>
                    <option value="bhw">BHW — Barangay Health Worker</option>
                    <option value="bns">BNS — Barangay Nutrition Scholar</option>
                  </select>
                )}

                {form.recipient_type === 'user' && (
                  <select name="assigned_to" value={form.assigned_to} onChange={(e) => {
                    const u = users.find((x) => String(x.user_id) === e.target.value);
                    setForm({ ...form, assigned_to: e.target.value, barangay: u?.barangay || '' });
                  }} required className={fieldCls}>
                    <option value="">Select user…</option>
                    {users.map((u) => (
                      <option key={u.user_id} value={u.user_id}>
                        {u.first_name} {u.last_name} ({u.role.toUpperCase()}) — {u.barangay}
                      </option>
                    ))}
                  </select>
                )}

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Venue</label>
                  <input name="venue" placeholder="e.g. Barangay Hall" value={form.venue} onChange={handleChange} className={fieldCls} />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Facilitator</label>
                  <input name="facilitator" placeholder="e.g. Dr. Santos" value={form.facilitator} onChange={handleChange} className={fieldCls} />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Notes</label>
                  <textarea name="notes" placeholder="Optional notes or reminders…" value={form.notes}
                    onChange={handleChange} rows={3} className={`${fieldCls} resize-none`} />
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="shrink-0 px-6 pb-5 pt-3 flex gap-3 border-t border-gray-100">
              <button type="button" onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border-2 border-gray-200 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button type="submit" form="schedForm" disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#1b5e20] to-[#2e7d32] hover:from-[#154a1a] hover:to-[#256427] transition disabled:opacity-60">
                {saving ? 'Creating…' : 'Create Activity'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Schedule;