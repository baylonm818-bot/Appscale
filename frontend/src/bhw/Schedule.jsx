import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';

function SummaryCard({ icon, label, value, sublabel, isActive, onClick, highlight }) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-2xl p-5 shadow-sm transition ${
        highlight
          ? 'bg-gradient-to-br from-green-500 to-green-600 text-white'
          : isActive
          ? 'bg-green-50 border-2 border-green-500'
          : 'bg-white border border-gray-100 hover:border-green-300'
      }`}
    >
      <div className="flex justify-between items-start mb-3">
        <p className={`text-sm font-medium ${highlight ? 'text-white/90' : 'text-gray-500'}`}>{label}</p>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${highlight ? 'bg-white/20' : 'bg-green-100'}`}>
          {icon}
        </div>
      </div>
      <p className={`text-3xl font-bold ${highlight ? 'text-white' : 'text-gray-900'}`}>{value}</p>
      <p className={`text-xs mt-1 ${highlight ? 'text-white/80' : 'text-gray-400'}`}>{sublabel}</p>
    </button>
  );
}

const statusLabels = { pending: 'Scheduled', done: 'Completed', cancelled: 'Cancelled', archived: 'Archived', missed: 'Missed' };

const isUpcoming = (activity) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return activity.status === 'pending' && new Date(activity.schedule_date) >= today;
};

const isMissed = (activity) => activity.status === 'pending' && !isUpcoming(activity);

const getDisplayStatus = (activity) => (isMissed(activity) ? 'missed' : activity.status);

function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-emerald-100 text-emerald-700',
    done: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
    archived: 'bg-gray-100 text-gray-600',
    missed: 'bg-amber-100 text-amber-700',
  };
  return (
    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {statusLabels[status] || status}
    </span>
  );
}

function ActivityRow({ activity, onComplete, onArchive }) {
  const date = new Date(activity.schedule_date);
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();

  return (
    <div className="flex flex-col gap-3 p-4 hover:bg-gray-50 rounded-xl transition border-b border-gray-100 last:border-0 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-green-50 text-green-700 flex-shrink-0 self-start sm:self-auto">
        <span className="text-xs font-semibold uppercase">{month}</span>
        <span className="text-lg font-bold leading-none">{day}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-gray-900">{activity.title}</h3>
          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs capitalize">
            {activity.schedule_type?.replace('_', ' ')}
          </span>
          <StatusBadge status={getDisplayStatus(activity)} />
        </div>
        <p className="text-sm text-gray-400 mt-0.5 break-words">
          {activity.barangay} {activity.venue && `· ${activity.venue}`} {activity.facilitator && `· ${activity.facilitator}`}
        </p>
      </div>

      <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">
        {(activity.status === 'cancelled' || activity.status === 'done') && (
          <button
            onClick={() => onArchive(activity.schedule_id)}
            className="flex-1 px-4 py-1.5 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition sm:flex-none"
          >
            Archive
          </button>
        )}
        {activity.status === 'pending' && !isMissed(activity) && (
          <button
            onClick={() => onComplete(activity.schedule_id)}
            className="flex-1 px-4 py-1.5 text-sm border border-green-200 text-green-700 rounded-lg hover:bg-green-50 transition sm:flex-none"
          >
            Mark Done
          </button>
        )}
      </div>
    </div>
  );
}

const emptyForm = {
  title: '', schedule_type: 'feeding', schedule_date: '', schedule_time: '',
  venue: '', barangay: '', assigned_to: '', facilitator: '', notes: '',
};

function Schedule() {
  const [activities, setActivities] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/bhw/schedule', {
        params: { barangay: user.barangay, user_id: user.user_id },
      });
      setActivities(res.data || []);
    } catch (err) {
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
      if (status === 'done') {
        await axiosClient.patch(`/bhw/schedule/${id}/done`);
      }
      fetchActivities();
    } catch (err) {
      alert('Failed to update schedule.');
    }
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await axiosClient.post('/schedule', form);
      setShowModal(false);
      setForm(emptyForm);
      fetchActivities();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
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

  return (
    <div>
     

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard
          label="Total Activities" value={counts.all} sublabel="All barangays" 
          isActive={activeFilter === 'all'} onClick={() => setActiveFilter('all')}
          icon={<svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
        />
        <SummaryCard
          label="Upcoming" value={counts.upcoming} sublabel="Scheduled activities"
          isActive={activeFilter === 'upcoming'} onClick={() => setActiveFilter('upcoming')}
          icon={<svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <SummaryCard
          label="Completed" value={counts.completed} sublabel="Done activities"
          isActive={activeFilter === 'completed'} onClick={() => setActiveFilter('completed')}
          icon={<svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <SummaryCard
          label="Archived" value={counts.archived} sublabel="Archived activities"
          isActive={activeFilter === 'archived'} onClick={() => setActiveFilter('archived')}
          icon={<svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 00-2 2v8a2 2 0 002 2h14a2 2 0 002-2v-8a2 2 0 00-2-2M5 8V6a2 2 0 012-2h10a2 2 0 012 2v2" /></svg>}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1 relative">
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by date or brgy..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-green-500"
          />
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Schedule Activity
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <p className="text-center text-gray-400 py-10 text-sm">Loading...</p>
        ) : filteredActivities.length === 0 ? (
          <p className="text-center text-gray-400 py-10 text-sm">No activities found.</p>
        ) : (
          <div className="px-2">
            {filteredActivities.map((activity) => (
              <ActivityRow
                key={activity.schedule_id}
                activity={activity}
                onComplete={(id) => updateStatus(id, 'done')}
                onArchive={(id) => updateStatus(id, 'archived')}
              />
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Add Schedule Activity</h2>
            {formError && <p className="text-red-600 text-sm mb-3">{formError}</p>}
            <form onSubmit={handleSubmit} className="space-y-3">
              <input name="title" placeholder="Activity Title" value={form.title} onChange={handleChange} required className="border rounded-lg px-3 py-2 text-sm w-full" />
              <select name="schedule_type" value={form.schedule_type} onChange={handleChange} className="border rounded-lg px-3 py-2 text-sm w-full">
                <option value="feeding">Feeding</option>
                <option value="home_visit">Home Visit</option>
                <option value="seminar">Seminar</option>
                <option value="checkup">Checkup</option>
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input name="schedule_date" type="date" value={form.schedule_date} onChange={handleChange} required className="border rounded-lg px-3 py-2 text-sm" />
                <input name="schedule_time" type="time" value={form.schedule_time} onChange={handleChange} className="border rounded-lg px-3 py-2 text-sm" />
              </div>
              <input name="barangay" placeholder="Barangay" value={form.barangay} onChange={handleChange} required className="border rounded-lg px-3 py-2 text-sm w-full" />
              <input name="venue" placeholder="Venue" value={form.venue} onChange={handleChange} className="border rounded-lg px-3 py-2 text-sm w-full" />
              <input name="facilitator" placeholder="Facilitator" value={form.facilitator} onChange={handleChange} className="border rounded-lg px-3 py-2 text-sm w-full" />
              <textarea name="notes" placeholder="Notes" value={form.notes} onChange={handleChange} className="border rounded-lg px-3 py-2 text-sm w-full" rows={3} />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 text-sm">
                  {saving ? 'Saving...' : 'Create Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Schedule;