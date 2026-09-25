import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { Users, AlertCircle, CheckCircle, Ruler, Triangle, List, CalendarDays, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

function StatCard({ icon: Icon, label, value, sublabel, to, accent }) {
  const content = (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-xs ${
          accent === 'red' ? 'bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white' :
          accent === 'amber' ? 'bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white' :
          'bg-green-50 text-[#2e7d32] group-hover:bg-linear-to-br group-hover:from-[#1b5e20] group-hover:to-[#2e7d32] group-hover:text-white'
        }`}>
          <Icon size={18} />
        </div>
      </div>
      <p className="text-3xl font-black text-gray-800 mt-2 tracking-tight">{value ?? 0}</p>
      <p className="text-xs font-medium text-gray-400 mt-1">{sublabel}</p>
    </div>
  );

  return to ? <Link to={to} className="block">{content}</Link> : content;
}

function StatusPill({ label, count, tone, icon: Icon }) {
  return (
    <div className={`flex items-center gap-3 p-3.5 rounded-xl border transition ${tone}`}>
      <div className="shrink-0 p-2 rounded-lg bg-white shadow-xs">
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider opacity-80">{label}</p>
        <p className="text-xl font-black mt-0.5 leading-none">{count}</p>
      </div>
    </div>
  );
}

function CustomLineTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-900 text-white px-3.5 py-2 rounded-xl text-xs shadow-xl">
        <p className="font-bold">{label}</p>
        <p className="text-emerald-400 mt-0.5">Monitored: {payload[0]?.value || 0}</p>
        {payload[1] && <p className="text-amber-400">At-Risk: {payload[1]?.value || 0}</p>}
      </div>
    );
  }
  return null;
}

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [statsResponse, scheduleResponse] = await Promise.all([
          axiosClient.get('/bhw/stats', { params: { barangay: user.barangay } }),
          axiosClient.get('/bhw/schedule', { params: { barangay: user.barangay, user_id: user.user_id } }),
        ]);
        setStats(statsResponse.data || {});
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        setActivities((scheduleResponse.data || [])
          .filter((activity) => activity.status === 'pending' && new Date(activity.schedule_date) >= today)
          .sort((a, b) => new Date(a.schedule_date) - new Date(b.schedule_date))
          .slice(0, 4));
      } catch (err) {
        setError('Failed to load dashboard.');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [user.barangay, user.user_id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-10 h-10 rounded-full border-4 border-green-200 border-t-green-600 animate-spin" />
        <p className="text-sm font-medium text-gray-400">Loading barangay dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-700">
        <AlertTriangle className="mx-auto mb-2 text-red-500" size={24} />
        <p className="font-semibold">{error}</p>
      </div>
    );
  }

  const s = stats || {};

  return (
    <div className="space-y-6">

      {/* ── Welcome Banner ── */}
      <div className="relative rounded-2xl overflow-hidden shadow-sm bg-gradient-to-r from-[#1b5e20] via-[#2e7d32] to-emerald-600 p-6 sm:p-8 text-white">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 text-emerald-100 backdrop-blur-xs mb-3">
            <CheckCircle2 size={13} /> {user.role ? user.role.toUpperCase() : 'BHW'} Monitoring Portal
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
            Hello, {user.first_name || user.username || 'Health Worker'}!
          </h1>
          <p className="text-emerald-100/80 text-sm mt-1.5 leading-relaxed">
            Barangay {user.barangay || 'Assignment'} · Child health, growth records, and malnutrition intervention monitoring.
          </p>
        </div>
      </div>

      {/* ── 4 Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Children"
          value={s.totalChildren}
          sublabel="Registered in Barangay"
          to="/bhw/medical-records"
        />
        <StatCard
          icon={Users}
          label="Total Mothers"
          value={s.totalMothers}
          sublabel="Lactating & postpartum"
          to="/bhw/medical-records"
        />
        <StatCard
          icon={AlertCircle}
          label="At-Risk Children"
          value={s.atRiskChildren}
          sublabel="Need attention & follow-up"
          to="/bhw/need-attention"
          accent="amber"
        />
        <StatCard
          icon={AlertCircle}
          label="At-Risk Mothers"
          value={s.atRiskMothers}
          sublabel="Low BMI / Underweight"
          to="/bhw/need-attention"
          accent="red"
        />
      </div>

      {/* ── Nutrition Status + Upcoming Activities ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Nutrition Status Grid */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-gray-900 text-base">Children Nutrition Status</h3>
              <Link
                to="/bhw/need-attention"
                className="text-xs font-bold text-[#2e7d32] hover:underline inline-flex items-center gap-1"
              >
                View Attention List <ArrowRight size={13} />
              </Link>
            </div>
            <p className="text-xs text-gray-400 mb-5">Latest recorded health assessments in {user.barangay}</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatusPill
                icon={CheckCircle}
                label="Normal"
                count={s.normal || 0}
                tone="bg-emerald-50 text-emerald-800 border-emerald-100"
              />
              <StatusPill
                icon={Ruler}
                label="Stunted"
                count={s.stunted || 0}
                tone="bg-orange-50 text-orange-800 border-orange-100"
              />
              <StatusPill
                icon={Triangle}
                label="Wasted"
                count={s.wasted || 0}
                tone="bg-red-50 text-red-800 border-red-100"
              />
              <StatusPill
                icon={List}
                label="Underweight"
                count={s.underweight || 0}
                tone="bg-amber-50 text-amber-800 border-amber-100"
              />
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between text-xs text-gray-400">
            <span>Regular assessments help detect malnutrition early.</span>
            <Link to="/bhw/medical-records" className="font-semibold text-[#2e7d32] hover:underline">
              Browse Records →
            </Link>
          </div>
        </div>

        {/* Upcoming Activities */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900 text-base">Upcoming Schedule</h3>
              <CalendarDays size={18} className="text-[#2e7d32]" />
            </div>

            {activities.length === 0 ? (
              <div className="text-center py-8">
                <CalendarDays className="mx-auto text-gray-300 mb-1.5" size={24} />
                <p className="text-xs text-gray-400">No upcoming activities scheduled.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {activities.map((act) => {
                  const d = new Date(act.schedule_date);
                  const month = d.toLocaleString('en-US', { month: 'short' });
                  const day = d.getDate();

                  return (
                    <div
                      key={act.schedule_id}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50/70 border border-gray-100 hover:bg-green-50/40 transition"
                    >
                      <div className="w-10 h-10 rounded-xl bg-linear-to-br from-[#1b5e20] to-[#2e7d32] text-white flex flex-col items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold uppercase opacity-80">{month}</span>
                        <span className="text-sm font-black leading-none">{day}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-gray-800 truncate">{act.title}</p>
                        <p className="text-[11px] text-gray-400 capitalize truncate">
                          {act.schedule_type?.replace('_', ' ')} {act.venue && `· ${act.venue}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Link
            to="/bhw/schedule"
            className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between text-xs font-semibold text-[#2e7d32] hover:underline"
          >
            <span>Open Schedule Calendar</span>
            <ArrowRight size={13} />
          </Link>
        </div>

      </div>

      {/* ── Monthly Monitoring Trend Line Chart ── */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-900 text-base">Monthly Health Visits & Monitoring</h3>
            <p className="text-xs text-gray-400 mt-0.5">Children recorded in {user.barangay || 'Barangay'} over the past 6 months</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-[#2e7d32]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2e7d32]" /> Monitored
            </span>
            <span className="flex items-center gap-1.5 text-amber-600">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> At-Risk
            </span>
          </div>
        </div>

        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={s.monthlyMonitoring || []} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 500 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomLineTooltip />} />
              <Line type="monotone" dataKey="monitored" name="Monitored" stroke="#2e7d32" strokeWidth={3} dot={{ r: 4, fill: '#2e7d32' }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="atRisk" name="At Risk" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3, fill: '#f59e0b' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Quick Action Tiles ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { to: '/bhw/need-attention', label: 'Need Attention', icon: AlertCircle, count: s.atRiskChildren, desc: 'High priority cases', color: 'from-amber-500 to-orange-600' },
          { to: '/bhw/referrals',      label: 'Referrals',      icon: Users,       count: null, desc: 'Doctor & RHU referrals', color: 'from-emerald-600 to-teal-700' },
          { to: '/bhw/medical-records',label: 'Medical Records',icon: List,        count: s.totalChildren, desc: 'Complete health log', color: 'from-[#1b5e20] to-[#2e7d32]' },
          { to: '/bhw/schedule',       label: 'Schedule',       icon: CalendarDays,count: activities.length, desc: 'Activities & visits', color: 'from-green-600 to-emerald-700' },
        ].map(({ to, label, icon: Icon, count, desc, color }) => (
          <Link
            key={to}
            to={to}
            className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            <div className={`w-10 h-10 rounded-xl bg-linear-to-br ${color} text-white flex items-center justify-center mb-3 shadow-xs group-hover:scale-105 transition`}>
              <Icon size={18} />
            </div>
            <p className="font-bold text-gray-900 text-sm group-hover:text-[#2e7d32] transition">{label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
          </Link>
        ))}
      </div>

    </div>
  );
}

export default Dashboard;