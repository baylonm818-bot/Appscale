import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { motion } from 'framer-motion';
import { Users, Baby, Heart, MapPin, Calendar, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1.0] },
  },
};

const wordContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const wordPopVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.85 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 380,
      damping: 22,
    },
  },
};

const statusColors = {
  normal: 'bg-emerald-500',
  underweight: 'bg-amber-500',
  severely_underweight: 'bg-red-600',
  stunted: 'bg-orange-500',
  severely_stunted: 'bg-red-700',
  wasted: 'bg-red-500',
  severely_wasted: 'bg-red-900',
  overweight: 'bg-blue-500',
  obese: 'bg-purple-600',
  no_assessment: 'bg-gray-400',
};

const statusLabels = {
  normal: 'Normal',
  underweight: 'Underweight',
  severely_underweight: 'Severely Underweight',
  stunted: 'Stunted',
  severely_stunted: 'Severely Stunted',
  wasted: 'Wasted',
  severely_wasted: 'Severely Wasted',
  overweight: 'Overweight',
  obese: 'Obese',
  no_assessment: 'No assessment yet',
};

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

function StatCard({ icon: Icon, label, value, sublabel, to }) {
  const content = (
    <motion.div
      variants={itemVariants}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100/80 hover:shadow-md transition-shadow duration-200 group h-full"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <div className="shrink-0 w-10 h-10 rounded-xl bg-green-50 text-[#2e7d32] flex items-center justify-center group-hover:bg-linear-to-br group-hover:from-[#1b5e20] group-hover:to-[#2e7d32] group-hover:text-white transition-all shadow-xs">
          <Icon size={18} />
        </div>
      </div>
      <p className="text-3xl font-black text-gray-800 mt-2 tracking-tight">{value ?? '—'}</p>
      <p className="text-xs font-medium text-gray-400 mt-1">{sublabel}</p>
    </motion.div>
  );

  return to ? <Link to={to} className="block h-full">{content}</Link> : content;
}

function CustomBarTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const val = payload[0].value;
    return (
      <div className="bg-gray-900/95 backdrop-blur-xs text-white px-3.5 py-2 rounded-xl text-xs shadow-xl border border-gray-800 pointer-events-none">
        <p className="font-bold text-gray-100">{label}</p>
        <p className="text-emerald-400 font-semibold mt-0.5">{val} malnutrition {val === 1 ? 'case' : 'cases'}</p>
      </div>
    );
  }
  return null;
}

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('3M');
  const rawUser = localStorage.getItem('user') || sessionStorage.getItem('user') || '{}';
  const user = JSON.parse(rawUser);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await axiosClient.get(`/dashboard/admin/stats?range=${timeRange}`);
        const data = response.data || {};
        setStats({
          totalUsers: data.totalUsers || 0,
          totalChildren: data.totalChildren || 0,
          totalMothers: data.totalMothers || 0,
          totalBarangays: data.totalBarangays || 0,
          nineCategoryTrend: data.nineCategoryTrend || {},
          malnutritionByBarangay: data.malnutritionByBarangay || [],
          malnutritionOverviewFallback: !!data.malnutritionOverviewFallback,
          upcomingActivities: data.upcomingActivities || [],
        });
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        setError('Failed to load dashboard statistics.');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [timeRange]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-36 rounded-2xl bg-gray-200 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-white p-5 shadow-sm border border-gray-100 animate-pulse flex flex-col justify-between">
              <div className="h-4 bg-gray-200 rounded w-1/2" />
              <div className="h-7 bg-gray-200 rounded w-1/3" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-72 rounded-2xl bg-white p-5 shadow-sm border border-gray-100 animate-pulse" />
          <div className="h-72 rounded-2xl bg-white p-5 shadow-sm border border-gray-100 animate-pulse" />
        </div>
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

  const trends = stats.nineCategoryTrend || {};
  const totalActiveChildren = stats.totalChildren || 1;
  const overviewData = stats.malnutritionByBarangay || [];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >

      {/* ── Welcome Banner ── */}
      <motion.div
        variants={itemVariants}
        className="relative rounded-2xl overflow-hidden shadow-sm bg-linear-to-r from-[#1b5e20] via-[#2e7d32] to-emerald-600 p-6 sm:p-8 text-white"
      >
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 text-emerald-100 backdrop-blur-xs mb-3 animate-fade-up-1">
            <CheckCircle2 size={13} /> Official Nutrition Portal
          </span>
          <motion.h1
            variants={wordContainerVariants}
            initial="hidden"
            animate="visible"
            className="text-2xl sm:text-3xl font-black tracking-tight leading-tight flex flex-wrap items-center gap-x-2"
          >
            <motion.span variants={wordPopVariants} className="inline-block">
              Welcome back,
            </motion.span>
            <motion.span
              variants={wordPopVariants}
              className="inline-block bg-white/20 px-2.5 py-0.5 rounded-xl border border-white/25 shadow-xs text-emerald-100 font-black tracking-tight"
            >
              {user.full_name || user.first_name || user.username || 'Admin'}!
            </motion.span>
          </motion.h1>
          <p className="text-emerald-100/90 text-sm mt-2.5 leading-relaxed animate-fade-up-2">
            Municipality of {user.municipality || 'Gasan'} · Real-time nutrition and health monitoring overview across all {stats.totalBarangays || 'active'} barangays.
          </p>
        </div>
      </motion.div>

      {/* ── 4 Stat Cards ── */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Health Workers"
          value={stats.totalUsers}
          sublabel="Active BHW & BNS staff"
          to="/admin/users"
        />
        <StatCard
          icon={Baby}
          label="Registered Children"
          value={stats.totalChildren}
          sublabel={`Across ${stats.totalBarangays} barangays`}
          to="/admin/masterlist"
        />
        <StatCard
          icon={Heart}
          label="Registered Mothers"
          value={stats.totalMothers}
          sublabel="Lactating & postpartum"
          to="/admin/masterlist"
        />
        <StatCard
          icon={MapPin}
          label="Monitored Barangays"
          value={stats.totalBarangays}
          sublabel="Active municipality coverage"
          to="/admin/masterlist"
        />
      </motion.div>

      {/* ── Main Graphs Section ── */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Municipal Nutrition Trend Distribution */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 mb-1">
              <h3 className="font-bold text-gray-900 text-base">Municipal Nutrition Breakdown</h3>
              <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                {stats.totalChildren} active children
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-5">Latest health & growth assessment per child (each child counted once)</p>

            <div className="space-y-3">
              {Object.entries(trends).map(([key, count]) => {
                const num = Number(count) || 0;
                const percentage = totalActiveChildren > 0 ? Math.round((num / totalActiveChildren) * 100) : 0;
                const barWidthPercent = totalActiveChildren > 0 ? (num / totalActiveChildren) * 100 : 0;

                return (
                  <div key={key} className="group">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="font-semibold text-gray-700">{statusLabels[key] || key}</span>
                      <span className="text-gray-400 font-medium">
                        <strong className="text-gray-900 font-bold">{num}</strong> ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(barWidthPercent, num > 0 ? 3 : 0)}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={`h-full rounded-full ${statusColors[key] || 'bg-green-500'}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between text-xs text-gray-400">
            <span>Aggregated from latest recorded health visits</span>
            <Link to="/admin/masterlist" className="font-semibold text-[#2e7d32] hover:underline inline-flex items-center gap-1">
              View Masterlist <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        {/* Upcoming Scheduled Activities */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 mb-1">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Upcoming Scheduled Activities</h3>
                <p className="text-xs text-gray-400 mt-0.5">Municipal & barangay health schedules</p>
              </div>
              <Link
                to="/admin/schedule"
                className="text-xs font-bold text-[#2e7d32] bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-xl transition inline-flex items-center gap-1.5"
              >
                Manage <ArrowRight size={13} />
              </Link>
            </div>

            <div className="mt-4 space-y-3 max-h-85 overflow-y-auto pr-1">
              {stats.upcomingActivities && stats.upcomingActivities.length > 0 ? (
                stats.upcomingActivities.map((act) => {
                  const d = new Date(act.schedule_date);
                  const month = d.toLocaleString('en-US', { month: 'short' });
                  const day = d.getDate();

                  return (
                    <motion.div
                      whileHover={{ x: 3 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      key={act.schedule_id}
                      className="flex items-start gap-3.5 p-3.5 rounded-xl bg-gray-50/70 border border-gray-100 hover:bg-green-50/40 hover:border-green-200 transition-all cursor-pointer"
                    >
                      <div className="w-14 h-14 rounded-xl bg-linear-to-br from-[#1b5e20] to-[#2e7d32] text-white flex flex-col items-center justify-center shrink-0 shadow-xs text-center p-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-100 leading-tight">{month}</span>
                        <span className="text-base font-black leading-tight text-white">{day}</span>
                        <span className="text-[9px] font-semibold text-emerald-200/90 leading-tight">{d.getFullYear()}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">{act.title}</p>
                          <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            {act.schedule_type?.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {act.barangay || 'All Barangays'}
                          {act.venue && ` · ${act.venue}`}
                          {act.schedule_time && ` · ${formatScheduleTime(act.schedule_time)}`}
                        </p>
                        {act.target_role && (
                          <p className="text-[10px] font-semibold text-emerald-700 mt-0.5">
                            For {act.target_role.toUpperCase()}s
                          </p>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="text-center py-10 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                  <Calendar className="mx-auto text-gray-300 mb-2" size={28} />
                  <p className="text-sm font-semibold text-gray-600">No upcoming activities scheduled</p>
                  <p className="text-xs text-gray-400 mt-0.5">Create a schedule activity to notify barangay workers.</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between text-xs text-gray-400">
            <span>Synchronized with municipal calendar</span>
            <Link to="/admin/schedule" className="font-semibold text-[#2e7d32] hover:underline inline-flex items-center gap-1">
              View Schedule <ArrowRight size={12} />
            </Link>
          </div>
        </div>

      </motion.div>

      {/* ── Malnutrition Cases by Barangay (Full Width) ── */}
      <motion.div variants={itemVariants} className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 flex flex-col justify-between">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div>
              <h3 className="font-bold text-gray-900 text-base">Malnutrition Cases by Barangay</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {stats.malnutritionOverviewFallback
                  ? 'Showing all recorded historical cases'
                  : 'Barangays with high at-risk/malnutrition records'}
              </p>
            </div>

            {/* Time range selector */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {['3M', '6M', '1Y'].map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    timeRange === range
                      ? 'bg-[#2e7d32] text-white shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            {overviewData.length > 0 ? (
              <div className="overflow-x-auto pb-2">
                <div className="h-72" style={{ minWidth: Math.max(500, overviewData.length * 75) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={overviewData} margin={{ top: 16, right: 16, left: -10, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis
                        dataKey="barangay"
                        tick={{ fontSize: 11, fill: '#4b5563', fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                        axisLine={false}
                        tickLine={false}
                        domain={[0, (dataMax) => Math.max(Math.ceil(dataMax), 4)]}
                        tickFormatter={(v) => Math.round(v)}
                      />
                      <Tooltip
                        content={<CustomBarTooltip />}
                        cursor={{ fill: 'rgba(0, 0, 0, 0.04)', radius: 6 }}
                        offset={12}
                      />
                      <Bar dataKey="cases" fill="#2e7d32" radius={[6, 6, 0, 0]} barSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-2">
                <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                  <CheckCircle2 size={24} />
                </div>
                <p className="text-sm font-semibold text-gray-600">No active malnutrition cases recorded</p>
                <p className="text-xs text-gray-400">All registered children are in normal growth status.</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between text-xs text-gray-400">
          <span>Filtered by: {timeRange === '3M' ? 'Last 3 Months' : timeRange === '6M' ? 'Last 6 Months' : 'Past Year'}</span>
          <Link to="/admin/schedule" className="font-semibold text-[#2e7d32] hover:underline inline-flex items-center gap-1">
            Plan Feeding / Visit <ArrowRight size={12} />
          </Link>
        </div>
      </motion.div>

    </motion.div>
  );
}

export default Dashboard;