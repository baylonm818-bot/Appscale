import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axiosClient from '../api/axiosClient';
import { Calendar, Clock, CheckCircle2, Archive, Search, X, ChevronLeft, ChevronRight, Plus, Sparkles, ArrowRight } from 'lucide-react';
import FormLabel, { FormRequiredNote } from '../components/ui/FormLabel';

const statusLabels = { pending: 'Scheduled', done: 'Completed', cancelled: 'Cancelled', archived: 'Archived', missed: 'Missed' };

const safeParseDate = (dateVal) => {
  if (!dateVal) return null;
  const str = String(dateVal).trim();
  const dateOnly = str.slice(0, 10);
  const parts = dateOnly.split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};

const isUpcoming = (activity) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = safeParseDate(activity.schedule_date);
  return activity.status === 'pending' && d !== null && d >= today;
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

function ActivityRow({ activity, isNext, onComplete, onArchive }) {
  const date = safeParseDate(activity.schedule_date) || new Date();
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();
  const year = date.getFullYear();
  const status = getDisplayStatus(activity);

  return (
    <div className={`flex flex-col gap-3 px-6 py-4 transition-all border-b border-gray-100 last:border-0 sm:flex-row sm:items-center sm:gap-5 ${
      isNext
        ? 'bg-amber-50/70 hover:bg-amber-50/90 border-l-4 border-l-amber-500 shadow-2xs'
        : 'hover:bg-green-50/30'
    }`}>
      <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl text-white shrink-0 shadow-xs text-center ${
        isNext
          ? 'bg-linear-to-br from-amber-600 to-amber-500 ring-2 ring-amber-300'
          : 'bg-linear-to-br from-[#1b5e20] to-[#2e7d32]'
      }`}>
        <span className="text-[9px] font-bold uppercase tracking-wider opacity-90">{month} {year}</span>
        <span className="text-base font-black leading-none">{day}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {isNext && (
            <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-[11px] font-extrabold px-2.5 py-0.5 rounded-full shadow-xs animate-pulse">
              <Sparkles size={11} className="fill-white" />
              NEXT UPCOMING
            </span>
          )}
          <h3 className={`font-bold text-sm ${isNext ? 'text-amber-950 font-extrabold' : 'text-gray-900'}`}>{activity.title}</h3>
          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize">
            {activity.schedule_type?.replace('_', ' ')}
          </span>
          <StatusBadge status={status} />
        </div>
        <p className="text-xs text-gray-500 mt-1 wrap-break-word">
          {activity.barangay || 'Barangay Activity'}
          {activity.venue && ` · ${activity.venue}`}
          {activity.facilitator && ` · ${activity.facilitator}`}
          {activity.schedule_time && ` · ${formatScheduleTime(activity.schedule_time)}`}
        </p>
      </div>

      <div className="flex gap-2 shrink-0">
        {(activity.status === 'cancelled' || activity.status === 'done') && (
          <button
            onClick={() => onArchive(activity.schedule_id)}
            className="px-3 py-1.5 text-xs font-semibold border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition cursor-pointer"
          >
            Archive
          </button>
        )}
        {activity.status === 'pending' && !isMissed(activity) && (
          <button
            onClick={() => onComplete(activity.schedule_id)}
            className="px-3.5 py-1.5 text-xs font-bold border border-green-300 bg-green-50 text-green-800 rounded-xl hover:bg-green-100 transition shadow-xs cursor-pointer"
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
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [schedErrors, setSchedErrors] = useState({});
  const user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');

  // Calendar State
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(() => formatDateKey(new Date()));

  const fetchActivities = async () => {
    try {
      const response = await axiosClient.get('/bhw/schedule', {
        params: { barangay: user.barangay, user_id: user.user_id, role: user.role },
      });
      setActivities(response.data || []);
    } catch {
      setError('Failed to load schedule.');
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

  const filteredActivities = useMemo(() => {
    return activities.filter((a) => {
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
  }, [activities, activeFilter, search]);

  // Compute the single NEXT upcoming pending schedule for BHW
  const nextUpcomingActivity = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = activities.filter((a) => {
      if (a.status !== 'pending' || !a.schedule_date) return false;
      const d = safeParseDate(a.schedule_date);
      return d !== null && d >= today;
    });

    if (upcoming.length === 0) return null;

    // Sort by date ascending, then time ascending
    upcoming.sort((a, b) => {
      const da = safeParseDate(a.schedule_date) || new Date(0);
      const db = safeParseDate(b.schedule_date) || new Date(0);
      const timeDiff = da.getTime() - db.getTime();
      if (timeDiff !== 0) return timeDiff;

      const timeA = String(a.schedule_time || '00:00');
      const timeB = String(b.schedule_time || '00:00');
      return timeA.localeCompare(timeB);
    });

    return upcoming[0];
  }, [activities]);

  // Calendar Grid Computation
  const { calendarCells, currentMonthName, currentYear } = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const monthName = calendarDate.toLocaleString('default', { month: 'long' });

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const cells = [];
    const todayStr = formatDateKey(new Date());

    const activitiesByDate = {};
    filteredActivities.forEach((act) => {
      if (!act.schedule_date) return;
      const key = String(act.schedule_date).slice(0, 10);
      if (!activitiesByDate[key]) activitiesByDate[key] = [];
      activitiesByDate[key].push(act);
    });

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

    for (let dayNum = 1; dayNum <= lastDayOfMonth; dayNum++) {
      const d = new Date(year, month, dayNum);
      const key = formatDateKey(d);
      cells.push({
        dateObj: d,
        dayNum,
        dateKey: key,
        isCurrentMonth: true,
        isToday: key === todayStr,
        activities: activitiesByDate[key] || [],
      });
    }

    const remaining = (7 - (cells.length % 7)) % 7;
    for (let dayNum = 1; dayNum <= remaining; dayNum++) {
      const d = new Date(year, month + 1, dayNum);
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

    return {
      calendarCells: cells,
      currentMonthName: monthName,
      currentYear: year,
    };
  }, [calendarDate, filteredActivities]);

  const selectedDateActivities = useMemo(() => {
    return filteredActivities.filter((a) => {
      if (!a.schedule_date) return false;
      return String(a.schedule_date).slice(0, 10) === selectedDateKey;
    });
  }, [filteredActivities, selectedDateKey]);

  const selectedDateFormatted = useMemo(() => {
    if (!selectedDateKey) return '';
    const dateObj = safeParseDate(selectedDateKey);
    if (!dateObj) return selectedDateKey;
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

  const handleJumpToNextUpcoming = () => {
    if (!nextUpcomingActivity) return;
    const targetDate = safeParseDate(nextUpcomingActivity.schedule_date) || new Date();
    setCalendarDate(new Date(targetDate.getFullYear(), targetDate.getMonth(), 1));
    setSelectedDateKey(formatDateKey(targetDate));
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border-2 border-red-200 text-red-800 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
          <p className="text-sm font-semibold">{error}</p>
          <button
            type="button"
            onClick={fetchActivities}
            className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
          >
            Try Again
          </button>
        </div>
      )}

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

      {/* ── Next Upcoming Schedule Highlight Banner ── */}
      {nextUpcomingActivity && (
        <div className="bg-linear-to-r from-amber-500 via-amber-600 to-emerald-700 rounded-2xl p-4 sm:p-5 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-amber-400/40">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 shadow-inner">
              <Sparkles size={24} className="text-amber-200 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-amber-400 text-amber-950 font-black text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-full shadow-2xs">
                  NEXT SCHEDULED EVENT
                </span>
                <span className="text-amber-100 text-xs font-semibold">
                  {(safeParseDate(nextUpcomingActivity.schedule_date) || new Date()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {nextUpcomingActivity.schedule_time && ` · ${formatScheduleTime(nextUpcomingActivity.schedule_time)}`}
                </span>
              </div>
              <h3 className="text-lg font-black tracking-tight mt-0.5 text-white">
                {nextUpcomingActivity.title}
              </h3>
              <p className="text-xs text-amber-100/90 font-medium">
                {nextUpcomingActivity.barangay || 'Barangay Activity'}
                {nextUpcomingActivity.venue && ` · ${nextUpcomingActivity.venue}`}
                {nextUpcomingActivity.facilitator && ` · ${nextUpcomingActivity.facilitator}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleJumpToNextUpcoming}
            className="self-start sm:self-auto flex items-center gap-2 bg-white text-gray-900 hover:bg-amber-50 hover:text-amber-900 px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer shrink-0"
          >
            <span>View in Calendar</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* ── Top Bar Controls: Search + Add Activity ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="flex-1 sm:max-w-md relative">
          <Search size={16} className="text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search activity by title or venue…"
            className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2e7d32] focus:ring-2 focus:ring-green-100 transition bg-white text-gray-800 placeholder-gray-400 font-medium"
          />
        </div>

        {/* Add Activity */}
        <button
          type="button"
          onClick={() => handleOpenAddForDate(selectedDateKey)}
          className="flex items-center justify-center gap-2 bg-linear-to-r from-[#1b5e20] to-[#2e7d32] hover:from-[#154a1a] hover:to-[#256427] text-white px-5 py-2.5 rounded-xl font-bold text-sm transition shadow-sm shrink-0 cursor-pointer"
        >
          <Plus size={18} />
          <span>Add Activity</span>
        </button>
      </div>

      {/* ── Main Interactive Calendar View ── */}
      <div className="space-y-6">
        {/* Calendar Grid Container with crisp border-2 */}
        <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 overflow-hidden">
          {/* Header: Month Navigator */}
          <div className="px-6 py-4 border-b-2 border-gray-200 flex flex-wrap items-center justify-between gap-4 bg-linear-to-r from-gray-50 via-white to-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-linear-to-br from-[#1b5e20] to-[#2e7d32] text-white flex items-center justify-center shadow-sm">
                <Calendar size={22} />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight">
                  {currentMonthName} <span className="text-[#2e7d32] font-black">{currentYear}</span>
                </h2>
                <p className="text-xs text-gray-500 font-semibold mt-0.5">
                  {filteredActivities.length} {activeFilter === 'all' ? 'total' : activeFilter} activities in {user.barangay || 'Barangay'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleToday}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#1b5e20] hover:bg-[#154a1a] rounded-lg transition shadow-xs cursor-pointer"
              >
                Today
              </button>
              <div className="flex items-center border-2 border-gray-200 rounded-lg bg-white overflow-hidden shadow-2xs">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  title="Previous Month"
                  className="p-1.5 text-gray-700 hover:text-black hover:bg-gray-100 transition cursor-pointer"
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="w-0.5 h-6 bg-gray-200" />
                <button
                  type="button"
                  onClick={handleNextMonth}
                  title="Next Month"
                  className="p-1.5 text-gray-700 hover:text-black hover:bg-gray-100 transition cursor-pointer"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* Weekday headers - Clear, bold headers with borders */}
          <div className="grid grid-cols-7 border-b-2 border-gray-200 bg-gray-100/90 text-center">
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, idx) => (
              <div
                key={d}
                className={`py-3 text-xs font-black tracking-wider uppercase border-r-2 border-gray-200 last:border-r-0 ${
                  idx === 0 ? 'text-red-600 bg-red-50/40' : idx === 6 ? 'text-blue-600 bg-blue-50/40' : 'text-gray-700'
                }`}
              >
                <span className="hidden md:inline">{d}</span>
                <span className="md:hidden">{d.slice(0, 3)}</span>
              </div>
            ))}
          </div>

          {/* Calendar Grid Cells with distinct line separators */}
          <div className="grid grid-cols-7 border-collapse border-b-2 border-gray-200 bg-gray-200 gap-[1.5px]">
            {calendarCells.map((cell) => {
              const isSelected = cell.dateKey === selectedDateKey;
              const hasActivities = cell.activities.length > 0;
              const hasNextUpcoming = nextUpcomingActivity && cell.activities.some((a) => a.schedule_id === nextUpcomingActivity.schedule_id);

              return (
                <div
                  key={cell.dateKey}
                  onClick={() => setSelectedDateKey(cell.dateKey)}
                  className={`min-h-[105px] sm:min-h-[130px] p-2 sm:p-2.5 transition-all cursor-pointer flex flex-col justify-between group relative ${
                    !cell.isCurrentMonth
                      ? 'bg-gray-50 text-gray-400 opacity-60'
                      : hasNextUpcoming
                      ? 'bg-amber-50/60 text-gray-900 ring-2 ring-amber-400 ring-inset'
                      : 'bg-white text-gray-900'
                  } ${
                    isSelected
                      ? 'ring-3 ring-[#1b5e20] ring-inset z-10 bg-green-50/40 shadow-sm'
                      : 'hover:bg-green-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-xs sm:text-sm font-black w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                          cell.isToday
                            ? 'bg-[#1b5e20] text-white shadow-md ring-2 ring-green-300'
                            : isSelected
                            ? 'bg-[#2e7d32] text-white shadow-xs'
                            : hasNextUpcoming
                            ? 'bg-amber-500 text-white shadow-xs font-black'
                            : !cell.isCurrentMonth
                            ? 'text-gray-400'
                            : 'text-gray-800 group-hover:text-green-900 group-hover:bg-green-100'
                        }`}
                      >
                        {cell.dayNum}
                      </span>
                      {hasNextUpcoming && (
                        <span className="hidden xl:inline text-[9px] font-black bg-amber-500 text-white px-1.5 py-0.2 rounded uppercase tracking-wider animate-pulse">
                          Next
                        </span>
                      )}
                    </div>

                    {hasActivities && (
                      <span className="text-[11px] font-black text-[#1b5e20] bg-green-100 border border-green-300 px-2 py-0.5 rounded-full shadow-2xs">
                        {cell.activities.length}
                      </span>
                    )}
                  </div>

                  {/* Activity chips */}
                  <div className="space-y-1.5 flex-1 overflow-hidden">
                    {cell.activities.slice(0, 2).map((act) => {
                      const status = getDisplayStatus(act);
                      const isDone = status === 'done';
                      const isCancelled = status === 'cancelled';
                      const isNext = nextUpcomingActivity && act.schedule_id === nextUpcomingActivity.schedule_id;

                      return (
                        <div
                          key={act.schedule_id}
                          title={`${act.title} (${formatScheduleTime(act.schedule_time) || 'All day'}) - ${isNext ? 'NEXT UPCOMING' : (statusLabels[status] || status)}`}
                          className={`text-[11px] font-bold px-2 py-1 rounded-lg truncate border-2 flex items-center gap-1.5 transition ${
                            isNext
                              ? 'bg-amber-400 text-amber-950 border-amber-500 shadow-md ring-2 ring-amber-300/80'
                              : isDone
                              ? 'bg-green-100 text-green-900 border-green-300'
                              : isCancelled
                              ? 'bg-red-100 text-red-800 border-red-300 line-through opacity-80'
                              : 'bg-emerald-50 text-[#1b5e20] border-emerald-300 shadow-xs'
                          }`}
                        >
                          {isNext ? (
                            <Sparkles size={11} className="text-amber-950 shrink-0 fill-amber-950 animate-spin-slow" />
                          ) : (
                            <span className={`w-2 h-2 rounded-full shrink-0 ${
                              isDone ? 'bg-green-600' : isCancelled ? 'bg-red-600' : 'bg-emerald-600 ring-2 ring-emerald-200'
                            }`} />
                          )}
                          <span className="truncate">{act.title}</span>
                        </div>
                      );
                    })}

                    {cell.activities.length > 2 && (
                      <p className="text-[11px] font-extrabold text-[#2e7d32] pl-1">
                        +{cell.activities.length - 2} more events
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenAddForDate(cell.dateKey);
                    }}
                    title={`Add activity on ${cell.dateKey}`}
                    className="absolute bottom-2 right-2 w-6 h-6 rounded-lg bg-white border-2 border-green-600 text-[#1b5e20] hover:bg-[#1b5e20] hover:text-white shadow-sm opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center cursor-pointer"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Date Detail Drawer */}
        <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-linear-to-r from-gray-50 via-white to-gray-50 border-b-2 border-gray-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 border border-green-300 text-[#1b5e20] flex items-center justify-center shadow-xs">
                <Calendar size={20} />
              </div>
              <div>
                <h3 className="font-black text-gray-900 text-base">
                  Activities for {selectedDateFormatted}
                </h3>
                <p className="text-xs text-gray-500 font-semibold">
                  {selectedDateActivities.length === 0
                    ? 'No events scheduled on this day'
                    : `${selectedDateActivities.length} event${selectedDateActivities.length > 1 ? 's' : ''} scheduled`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleOpenAddForDate(selectedDateKey)}
              className="flex items-center gap-1.5 text-xs font-bold text-[#1b5e20] bg-green-50 hover:bg-green-100 px-4 py-2 rounded-xl transition border-2 border-green-300 shadow-2xs cursor-pointer"
            >
              <Plus size={15} />
              Schedule for this Day
            </button>
          </div>

          {selectedDateActivities.length === 0 ? (
            <div className="py-14 px-6 flex flex-col items-center justify-center text-center gap-2">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400">
                <Calendar size={26} />
              </div>
              <p className="text-sm font-bold text-gray-700">No activities on this date</p>
              <p className="text-xs text-gray-500 max-w-sm">
                Click "+ Schedule for this Day" to add an immunization, weighing, or visit for {selectedDateFormatted}.
              </p>
            </div>
          ) : (
            <div className="divide-y-2 divide-gray-100">
              {selectedDateActivities.map((activity) => (
                <ActivityRow
                  key={activity.schedule_id}
                  activity={activity}
                  isNext={nextUpcomingActivity && activity.schedule_id === nextUpcomingActivity.schedule_id}
                  onComplete={(id) => updateStatus(id, 'done')}
                  onArchive={(id) => updateStatus(id, 'archived')}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Centered Add Schedule Modal Popup ── */}
      {showModal && createPortal(
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-9999 p-4 overflow-hidden animate-in fade-in duration-200"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col transform transition-all scale-100">
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
              <form id="bhwSchedForm" onSubmit={handleSubmit} noValidate className="space-y-4">
                <FormRequiredNote />

                <div>
                  <FormLabel label="Activity Title" required />
                  <input
                    name="title"
                    type="text"
                    placeholder="e.g. Supplemental Feeding Session"
                    value={form.title}
                    onChange={(e) => {
                      setForm({ ...form, title: e.target.value });
                      if (schedErrors.title) setSchedErrors((prev) => ({ ...prev, title: '' }));
                    }}
                    className={`w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none transition ${
                      schedErrors.title ? 'border-[#D32F2F] ring-1 ring-[#D32F2F] focus:border-[#D32F2F]' : 'border-gray-200 focus:border-[#2e7d32] focus:ring-2 focus:ring-green-100'
                    }`}
                  />
                  {schedErrors.title && <p className="text-xs text-[#D32F2F] mt-1">{schedErrors.title}</p>}
                </div>

                <div>
                  <FormLabel label="Activity Type" />
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
                    <FormLabel label="Date" required />
                    <input
                      name="schedule_date"
                      type="date"
                      value={form.schedule_date}
                      onChange={(e) => {
                        setForm({ ...form, schedule_date: e.target.value });
                        if (schedErrors.schedule_date) setSchedErrors((prev) => ({ ...prev, schedule_date: '' }));
                      }}
                      className={`w-full border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none transition ${
                        schedErrors.schedule_date ? 'border-[#D32F2F] ring-1 ring-[#D32F2F] focus:border-[#D32F2F]' : 'border-gray-200 focus:border-[#2e7d32]'
                      }`}
                    />
                    {schedErrors.schedule_date && <p className="text-xs text-[#D32F2F] mt-1">{schedErrors.schedule_date}</p>}
                  </div>
                  <div>
                    <FormLabel label="Time" />
                    <input
                      name="schedule_time"
                      type="time"
                      value={form.schedule_time}
                      onChange={(e) => setForm({ ...form, schedule_time: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#2e7d32]"
                    />
                  </div>
                </div>

                <div>
                  <FormLabel label="Venue / Location" />
                  <input
                    name="venue"
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
        </div>,
        document.body
      )}

    </div>
  );
}

export default Schedule;