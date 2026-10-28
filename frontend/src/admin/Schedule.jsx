import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axiosClient from '../api/axiosClient';
import FormLabel, { FormRequiredNote } from '../components/ui/FormLabel';
import { 
  Calendar as CalendarIcon, 
  List, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  MapPin, 
  User, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Archive,
  Search,
  Filter
} from 'lucide-react';

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

const TYPE_COLORS = {
  feeding: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  immunization: 'bg-blue-50 text-blue-700 border-blue-200',
  deworming: 'bg-purple-50 text-purple-700 border-purple-200',
  seminar: 'bg-amber-50 text-amber-700 border-amber-200',
  home_visit: 'bg-teal-50 text-teal-700 border-teal-200',
  checkup: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  weighing: 'bg-lime-50 text-lime-700 border-lime-200',
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
      className={`w-full text-left rounded-2xl p-5 shadow-sm transition-all duration-200 focus:outline-none cursor-pointer
        ${isActive
          ? 'bg-linear-to-br from-[#1b5e20] to-[#2e7d32] shadow-md'
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

function formatScheduleTime(timeStr) {
  if (!timeStr) return '';
  const parts = String(timeStr).trim().split(':');
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1].padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
  }
  return timeStr;
}

function formatDateKey(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
      <div className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-linear-to-br from-[#1b5e20] to-[#2e7d32] text-white shrink-0 shadow-sm text-center">
        <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">{month} {date.getFullYear()}</span>
        <span className="text-base font-black leading-none">{day}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-gray-900 text-sm">{activity.title}</h3>
          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[11px] font-medium capitalize">
            {activity.schedule_type?.replace('_', ' ')}
          </span>
          <StatusBadge status={status} />
        </div>
        <p className="text-xs text-gray-400 mt-1 wrap-break-word">
          {activity.barangay || 'All Barangays'}
          {activity.target_role && ` · For ${activity.target_role.toUpperCase()}s`}
          {activity.venue && ` · ${activity.venue}`}
          {activity.assigned_name && ` · ${activity.assigned_name}`}
          {activity.facilitator && ` · ${activity.facilitator}`}
          {activity.schedule_time && ` · ${formatScheduleTime(activity.schedule_time)}`}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 shrink-0">
        {(activity.status === 'cancelled' || activity.status === 'done') && (
          <button onClick={() => onArchive(activity.schedule_id)}
            className="px-3 py-1.5 text-xs font-semibold border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition cursor-pointer">
            Archive
          </button>
        )}
        {activity.status === 'pending' && !isMissed(activity) && (
          <>
            <button onClick={() => onComplete(activity.schedule_id)}
              className="px-3 py-1.5 text-xs font-semibold border border-green-200 text-green-700 rounded-lg hover:bg-green-50 transition cursor-pointer">
              Mark Done
            </button>
            <button onClick={() => onCancel(activity.schedule_id)}
              className="px-3 py-1.5 text-xs font-semibold border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition cursor-pointer">
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
  const [activities, setActivities]     = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch]             = useState('');
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [showModal, setShowModal]       = useState(false);
  const [form, setForm]                 = useState(emptyForm);
  const [formError, setFormError]       = useState('');
  const [schedErrors, setSchedErrors]   = useState({});
  const [saving, setSaving]             = useState(false);
  const [users, setUsers]               = useState([]);

  // View mode: 'calendar' (default per user preference) or 'list'
  const [viewMode, setViewMode]         = useState('calendar');
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(() => formatDateKey(new Date()));

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (schedErrors[name]) {
      setSchedErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleRecipientChange = (e) => {
    setForm({ ...form, recipient_type: e.target.value,
      barangay: e.target.value === 'all' ? 'All Barangays' : '',
      assigned_to: '', target_role: '' });
    setSchedErrors((prev) => ({ ...prev, barangay: '', target_role: '', assigned_to: '' }));
  };

  const handleOpenAddForDate = (dateKey) => {
    setForm({
      ...emptyForm,
      schedule_date: dateKey || formatDateKey(new Date()),
    });
    setSchedErrors({});
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const errs = {};
    if (!form.title?.trim()) errs.title = 'This field is required';
    if (!form.schedule_date) errs.schedule_date = 'This field is required';
    if (form.recipient_type === 'barangay' && !form.barangay) errs.barangay = 'This field is required';
    if (form.recipient_type === 'role' && !form.target_role) errs.target_role = 'This field is required';
    if (form.recipient_type === 'user' && !form.assigned_to) errs.assigned_to = 'This field is required';

    if (Object.keys(errs).length > 0) {
      setSchedErrors(errs);
      const firstInvalid = Object.keys(errs)[0];
      setTimeout(() => {
        const el = document.querySelector(`[name="${firstInvalid}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus();
        }
      }, 50);
      return;
    }

    setSchedErrors({});
    setSaving(true);
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

  const filteredActivities = useMemo(() => {
    return activities.filter((a) => {
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
  }, [activities, activeFilter, search]);

  // Calendar Grid Computation
  const { calendarCells, currentMonthName, currentYear } = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const monthName = calendarDate.toLocaleString('default', { month: 'long' });

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const cells = [];
    const todayStr = formatDateKey(new Date());

    // Group activities by date
    const activitiesByDate = {};
    filteredActivities.forEach((act) => {
      if (!act.schedule_date) return;
      const key = String(act.schedule_date).slice(0, 10);
      if (!activitiesByDate[key]) activitiesByDate[key] = [];
      activitiesByDate[key].push(act);
    });

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const d = new Date(year, month - 1, dayNum);
      const key = formatDateKey(d);
      cells.push({
        dateObj: d,
        dayNum,
        dateKey: key,
        isCurrentMonth: false,
        isToday: key === todayStr,
        activities: activitiesByDate[key] || [],
      });
    }

    // Current month days
    for (let day = 1; day <= lastDayOfMonth; day++) {
      const d = new Date(year, month, day);
      const key = formatDateKey(d);
      cells.push({
        dateObj: d,
        dayNum: day,
        dateKey: key,
        isCurrentMonth: true,
        isToday: key === todayStr,
        activities: activitiesByDate[key] || [],
      });
    }

    // Next month padding to fill a complete 35 or 42 grid
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let day = 1; day <= remaining; day++) {
      const d = new Date(year, month + 1, day);
      const key = formatDateKey(d);
      cells.push({
        dateObj: d,
        dayNum: day,
        dateKey: key,
        isCurrentMonth: false,
        isToday: key === todayStr,
        activities: activitiesByDate[key] || [],
      });
    }

    return {
      calendarCells: cells,
      currentMonthName: monthName,
      currentYear: year,
    };
  }, [calendarDate, filteredActivities]);

  // Selected date activities
  const selectedDateActivities = useMemo(() => {
    return filteredActivities.filter((a) => {
      if (!a.schedule_date) return false;
      return String(a.schedule_date).slice(0, 10) === selectedDateKey;
    });
  }, [filteredActivities, selectedDateKey]);

  const selectedDateFormatted = useMemo(() => {
    if (!selectedDateKey) return '';
    const [y, m, d] = selectedDateKey.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }, [selectedDateKey]);

  const handlePrevMonth = () => {
    setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };
  const handleToday = () => {
    const now = new Date();
    setCalendarDate(now);
    setSelectedDateKey(formatDateKey(now));
  };

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

      {/* ── Top Bar Controls: View Toggle, Search, Add Activity ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Left: View Mode Toggle */}
        <div className="inline-flex p-1 bg-gray-100 rounded-xl border border-gray-200 self-start sm:self-auto shadow-2xs">
          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'calendar'
                ? 'bg-white text-[#1b5e20] shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <CalendarIcon size={14} className={viewMode === 'calendar' ? 'text-[#1b5e20]' : 'text-gray-400'} />
            Calendar View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'list'
                ? 'bg-white text-[#1b5e20] shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <List size={14} className={viewMode === 'list' ? 'text-[#1b5e20]' : 'text-gray-400'} />
            List View
          </button>
        </div>

        {/* Right: Search + Add */}
        <div className="flex flex-1 sm:flex-initial items-center gap-3">
          <div className="flex-1 sm:w-72 relative">
            <Search size={16} className="text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or barangay…"
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#2e7d32] focus:ring-2 focus:ring-green-100 transition bg-white"
            />
          </div>
          <button
            onClick={() => handleOpenAddForDate(selectedDateKey)}
            className="flex items-center justify-center gap-2 bg-linear-to-r from-[#1b5e20] to-[#2e7d32] hover:from-[#154a1a] hover:to-[#256427] text-white px-4 py-2 rounded-xl font-semibold text-xs sm:text-sm transition shadow-sm cursor-pointer shrink-0"
          >
            <Plus size={16} />
            <span className="hidden xs:inline">Add Activity</span>
            <span className="xs:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* ── Main Content: Calendar View or List View ── */}
      {viewMode === 'calendar' ? (
        <div className="space-y-6">
          {/* Calendar Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Calendar Header: Month Navigator */}
            <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4 bg-linear-to-r from-gray-50/80 via-white to-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-linear-to-br from-[#1b5e20] to-[#2e7d32] text-white flex items-center justify-center shadow-xs">
                  <CalendarIcon size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                    {currentMonthName} <span className="text-gray-400 font-normal">{currentYear}</span>
                  </h2>
                  <p className="text-xs text-gray-400 font-medium">
                    Showing {filteredActivities.length} {activeFilter === 'all' ? 'total' : activeFilter} activities
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToday}
                  className="px-3 py-1.5 text-xs font-bold text-[#1b5e20] bg-green-50 hover:bg-green-100 border border-green-200/60 rounded-lg transition cursor-pointer"
                >
                  Today
                </button>
                <div className="flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden shadow-2xs">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    title="Previous Month"
                    className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition cursor-pointer"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <div className="w-px h-5 bg-gray-200" />
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    title="Next Month"
                    className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition cursor-pointer"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/60 text-center">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, idx) => (
                <div
                  key={d}
                  className={`py-2.5 text-xs font-bold tracking-wider uppercase ${
                    idx === 0 || idx === 6 ? 'text-gray-400' : 'text-gray-600'
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar Grid Cells */}
            <div className="grid grid-cols-7 border-collapse divide-x divide-y divide-gray-100 bg-gray-50/20">
              {calendarCells.map((cell) => {
                const isSelected = cell.dateKey === selectedDateKey;
                const hasActivities = cell.activities.length > 0;

                return (
                  <div
                    key={cell.dateKey}
                    onClick={() => setSelectedDateKey(cell.dateKey)}
                    className={`min-h-[96px] sm:min-h-[118px] p-1.5 sm:p-2 transition-all cursor-pointer flex flex-col justify-between group relative ${
                      !cell.isCurrentMonth
                        ? 'bg-gray-50/50 text-gray-300'
                        : 'bg-white text-gray-800'
                    } ${
                      isSelected
                        ? 'ring-2 ring-[#2e7d32] ring-inset z-10 bg-green-50/20 shadow-xs'
                        : 'hover:bg-green-50/30'
                    }`}
                  >
                    {/* Date Number Header */}
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs sm:text-sm font-bold w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                          cell.isToday
                            ? 'bg-[#1b5e20] text-white font-black shadow-xs'
                            : isSelected
                            ? 'bg-[#2e7d32]/15 text-[#1b5e20] font-black'
                            : !cell.isCurrentMonth
                            ? 'text-gray-400'
                            : 'text-gray-700 group-hover:text-gray-900'
                        }`}
                      >
                        {cell.dayNum}
                      </span>

                      {/* Small counter pill if many */}
                      {hasActivities && (
                        <span className="text-[10px] font-extrabold text-[#1b5e20] bg-green-100/80 px-1.5 py-0.2 rounded-full">
                          {cell.activities.length}
                        </span>
                      )}
                    </div>

                    {/* Activity Chips (max 2 visible on grid, +X more) */}
                    <div className="space-y-1 flex-1 overflow-hidden">
                      {cell.activities.slice(0, 2).map((act) => {
                        const status = getDisplayStatus(act);
                        const isDone = status === 'done';
                        const isCancelled = status === 'cancelled';
                        return (
                          <div
                            key={act.schedule_id}
                            title={`${act.title} (${formatScheduleTime(act.schedule_time) || 'All day'}) - ${statusLabels[status] || status}`}
                            className={`text-[10px] sm:text-[11px] font-semibold px-1.5 py-0.5 rounded-md truncate border flex items-center gap-1 ${
                              isDone
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : isCancelled
                                ? 'bg-red-50 text-red-600 border-red-200 line-through opacity-70'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-2xs'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isDone ? 'bg-green-600' : isCancelled ? 'bg-red-500' : 'bg-emerald-600'
                            }`} />
                            <span className="truncate">{act.title}</span>
                          </div>
                        );
                      })}

                      {cell.activities.length > 2 && (
                        <p className="text-[10px] font-bold text-gray-500 pl-1">
                          +{cell.activities.length - 2} more
                        </p>
                      )}
                    </div>

                    {/* Quick Add icon visible on cell hover */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenAddForDate(cell.dateKey);
                      }}
                      title={`Add activity on ${cell.dateKey}`}
                      className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-md bg-white border border-gray-200 text-gray-400 hover:text-[#1b5e20] hover:border-green-300 hover:bg-green-50 shadow-2xs opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Selected Day Activities Drawer / Panel ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 bg-linear-to-r from-gray-50 via-white to-gray-50 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-green-50 text-[#1b5e20] flex items-center justify-center">
                  <CalendarIcon size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm sm:text-base">
                    Activities for {selectedDateFormatted}
                  </h3>
                  <p className="text-xs text-gray-400 font-medium">
                    {selectedDateActivities.length === 0
                      ? 'No events scheduled on this day'
                      : `${selectedDateActivities.length} event${selectedDateActivities.length > 1 ? 's' : ''} scheduled`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleOpenAddForDate(selectedDateKey)}
                className="flex items-center gap-1.5 text-xs font-bold text-[#1b5e20] bg-green-50 hover:bg-green-100 px-3.5 py-2 rounded-xl transition border border-green-200 cursor-pointer"
              >
                <Plus size={14} />
                Schedule for this Day
              </button>
            </div>

            {selectedDateActivities.length === 0 ? (
              <div className="py-12 px-6 flex flex-col items-center justify-center text-center gap-2">
                <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-300">
                  <CalendarIcon size={22} />
                </div>
                <p className="text-sm font-semibold text-gray-600">No activities on this date</p>
                <p className="text-xs text-gray-400 max-w-sm">
                  Click the button above to add an activity, feeding program, or visit for {selectedDateFormatted}.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {selectedDateActivities.map((activity) => (
                  <ActivityRow
                    key={activity.schedule_id}
                    activity={activity}
                    onCancel={(id) => updateStatus(id, 'cancelled')}
                    onComplete={(id) => updateStatus(id, 'done')}
                    onArchive={(id) => updateStatus(id, 'archived')}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── Standard List View ── */
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
          {/* Result count bar */}
          <div className="px-6 py-3 bg-gray-50/70 border-b border-gray-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {filteredActivities.length} {activeFilter === 'all' ? 'total' : activeFilter} activities
            </p>
            {search && (
              <p className="text-xs text-gray-500 font-medium">
                Matching: <span className="font-bold text-[#1b5e20]">"{search}"</span>
              </p>
            )}
          </div>

          {loading ? (
            <div className="divide-y divide-gray-100">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="p-4 sm:p-5 flex items-center justify-between gap-4 animate-pulse">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 rounded-xl bg-gray-200 shrink-0" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-gray-200 rounded w-1/3" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="h-8 bg-gray-200 rounded-lg w-20" />
                </div>
              ))}
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
      )}

      {/* ── Add Schedule Modal ── */}
      {showModal && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-9999 p-4 overflow-hidden"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

            {/* Modal header */}
            <div className="bg-linear-to-r from-[#1b5e20] to-[#2e7d32] px-6 py-5 flex items-center justify-between shrink-0">
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
              <form id="schedForm" onSubmit={handleSubmit} noValidate className="space-y-3.5">
                <FormRequiredNote />

                <div>
                  <FormLabel label="Activity Title" required />
                  <input
                    name="title"
                    placeholder="e.g. Feeding Program – Brgy. Poblacion"
                    value={form.title}
                    onChange={handleChange}
                    className={`${fieldCls} ${schedErrors.title ? 'border-[#D32F2F] ring-1 ring-[#D32F2F] focus:border-[#D32F2F]' : ''}`}
                  />
                  {schedErrors.title && <p className="text-xs text-[#D32F2F] mt-1">{schedErrors.title}</p>}
                </div>

                <div>
                  <FormLabel label="Activity Type" />
                  <select name="schedule_type" value={form.schedule_type} onChange={handleChange} className={fieldCls}>
                    <option value="feeding">Feeding</option>
                    <option value="home_visit">Home Visit</option>
                    <option value="seminar">Seminar</option>
                    <option value="checkup">Checkup</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FormLabel label="Date" required />
                    <input
                      name="schedule_date"
                      type="date"
                      value={form.schedule_date}
                      onChange={handleChange}
                      className={`${fieldCls} ${schedErrors.schedule_date ? 'border-[#D32F2F] ring-1 ring-[#D32F2F] focus:border-[#D32F2F]' : ''}`}
                    />
                    {schedErrors.schedule_date && <p className="text-xs text-[#D32F2F] mt-1">{schedErrors.schedule_date}</p>}
                  </div>
                  <div>
                    <FormLabel label="Time" />
                    <input name="schedule_time" type="time" value={form.schedule_time} onChange={handleChange} className={fieldCls} />
                  </div>
                </div>

                <div>
                  <FormLabel label="Send To" />
                  <select name="recipient_type" value={form.recipient_type} onChange={handleRecipientChange} className={fieldCls}>
                    <option value="all">📍 Whole Municipality (All Barangays)</option>
                    <option value="barangay">🏘️ Specific Barangay</option>
                    <option value="role">👥 By Role (BHW / BNS)</option>
                    <option value="user">👤 Specific User</option>
                  </select>
                </div>

                {form.recipient_type === 'barangay' && (
                  <div>
                    <FormLabel label="Barangay" required />
                    <select
                      name="barangay"
                      value={form.barangay}
                      onChange={handleChange}
                      className={`${fieldCls} ${schedErrors.barangay ? 'border-[#D32F2F] ring-1 ring-[#D32F2F] focus:border-[#D32F2F]' : ''}`}
                    >
                      <option value="">Select barangay…</option>
                      {[...new Set(users.map((u) => u.barangay).filter(Boolean))].sort().map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                    {schedErrors.barangay && <p className="text-xs text-[#D32F2F] mt-1">{schedErrors.barangay}</p>}
                  </div>
                )}

                {form.recipient_type === 'role' && (
                  <div>
                    <FormLabel label="Target Role" required />
                    <select
                      name="target_role"
                      value={form.target_role}
                      onChange={handleChange}
                      className={`${fieldCls} ${schedErrors.target_role ? 'border-[#D32F2F] ring-1 ring-[#D32F2F] focus:border-[#D32F2F]' : ''}`}
                    >
                      <option value="">Select role…</option>
                      <option value="bhw">BHW — Barangay Health Worker</option>
                      <option value="bns">BNS — Barangay Nutrition Scholar</option>
                    </select>
                    {schedErrors.target_role && <p className="text-xs text-[#D32F2F] mt-1">{schedErrors.target_role}</p>}
                  </div>
                )}

                {form.recipient_type === 'user' && (
                  <div>
                    <FormLabel label="Assigned User" required />
                    <select
                      name="assigned_to"
                      value={form.assigned_to}
                      onChange={(e) => {
                        const u = users.find((x) => String(x.user_id) === e.target.value);
                        setForm({ ...form, assigned_to: e.target.value, barangay: u?.barangay || '' });
                      }}
                      className={`${fieldCls} ${schedErrors.assigned_to ? 'border-[#D32F2F] ring-1 ring-[#D32F2F] focus:border-[#D32F2F]' : ''}`}
                    >
                      <option value="">Select user…</option>
                      {users.map((u) => (
                        <option key={u.user_id} value={u.user_id}>
                          {u.first_name} {u.last_name} ({u.role.toUpperCase()}) — {u.barangay}
                        </option>
                      ))}
                    </select>
                    {schedErrors.assigned_to && <p className="text-xs text-[#D32F2F] mt-1">{schedErrors.assigned_to}</p>}
                  </div>
                )}

                <div>
                  <FormLabel label="Venue" />
                  <input name="venue" placeholder="e.g. Barangay Hall" value={form.venue} onChange={handleChange} className={fieldCls} />
                </div>

                <div>
                  <FormLabel label="Facilitator" />
                  <input name="facilitator" placeholder="e.g. Dr. Santos" value={form.facilitator} onChange={handleChange} className={fieldCls} />
                </div>

                <div>
                  <FormLabel label="Notes" />
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
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-linear-to-r from-[#1b5e20] to-[#2e7d32] hover:from-[#154a1a] hover:to-[#256427] transition disabled:opacity-60">
                {saving ? 'Creating…' : 'Create Activity'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default Schedule;