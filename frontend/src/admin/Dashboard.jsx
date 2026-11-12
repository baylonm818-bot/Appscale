import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { motion } from 'framer-motion';
import { Users, Baby, Heart, MapPin, Calendar, ArrowRight, AlertTriangle, CheckCircle2, Utensils } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { CountUp, ShimmerSkeleton, staggerContainer } from '../components/ui/motion';

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
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100/80 hover:shadow-md transition-shadow duration-200 group h-full"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <div className="shrink-0 w-10 h-10 rounded-xl bg-green-50 text-[#2e7d32] flex items-center justify-center group-hover:bg-linear-to-br group-hover:from-[#1b5e20] group-hover:to-[#2e7d32] group-hover:text-white transition-all shadow-xs">
          <Icon size={18} />
        </div>
      </div>
      <p className="text-3xl font-black text-gray-800 mt-2 tracking-tight">
        {typeof value === 'number' ? <CountUp value={value} /> : (value ?? '—')}
      </p>
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
  const [feedingStats, setFeedingStats] = useState(null);  // Step 10
  const [yearStats, setYearStats] = useState(null);         // Step 10
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear()); // Step 10
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('3M');
  const [feedingChildTab, setFeedingChildTab] = useState('all');
  const rawUser = localStorage.getItem('user') || sessionStorage.getItem('user') || '{}';
  const user = JSON.parse(rawUser);

  const displayedFeedingChildren = useMemo(() => {
    if (!feedingStats) return [];
    if (feedingChildTab === 'normal') {
      return feedingStats.recovered_children || [];
    }
    if (feedingChildTab === 'not_normal') {
      return feedingStats.still_malnourished_children || [];
    }
    return feedingStats.all_feeding_children || [];
  }, [feedingStats, feedingChildTab]);

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const [statsRes, feedingRes] = await Promise.all([
          axiosClient.get(`/dashboard/admin/stats?range=${timeRange}`).catch((e) => {
            console.warn('Admin stats error:', e);
            return null;
          }),
          axiosClient.get('/dashboard/admin/feeding-stats').catch((e) => {
            console.warn('Feeding stats error:', e);
            return null;
          }),
        ]);

        if (!isMounted) return;

        if (statsRes && statsRes.data) {
          const data = statsRes.data || {};
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
        } else {
          setError('Failed to load dashboard statistics.');
        }

        if (feedingRes && feedingRes.data) {
          setFeedingStats(feedingRes.data);
        }
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        if (isMounted) setError('Failed to load dashboard statistics.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchStats();
    return () => { isMounted = false; };
  }, [timeRange]);

  // Step 10: fetch per-year nutrition view when selectedYear changes
  useEffect(() => {
    let isMounted = true;
    axiosClient.get(`/dashboard/admin/nutrition-by-year?year=${selectedYear}`)
      .then((res) => {
        if (isMounted) setYearStats(res.data || null);
      })
      .catch(() => {
        if (isMounted) setYearStats(null);
      });
    return () => { isMounted = false; };
  }, [selectedYear]);


  if (loading) {
    return (
      <div className="space-y-6">
        <ShimmerSkeleton className="h-36 rounded-2xl w-full" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-white p-5 shadow-sm border border-gray-100 flex flex-col justify-between">
              <ShimmerSkeleton className="h-4 w-1/2 rounded-md" />
              <ShimmerSkeleton className="h-8 w-1/3 rounded-lg" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ShimmerSkeleton className="lg:col-span-2 h-72 rounded-2xl" />
          <ShimmerSkeleton className="h-72 rounded-2xl" />
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
            className="text-2xl sm:text-3xl font-black tracking-tight leading-tight"
          >
            <motion.span variants={wordPopVariants} className="inline-block mr-2 text-white">
              Welcome back,
            </motion.span>
            <motion.span variants={wordPopVariants} className="inline-block text-white">
              {user.full_name || user.first_name || user.username || 'Admin'}!
            </motion.span>
          </motion.h1>
          <p className="text-emerald-100/80 text-sm mt-1.5 leading-relaxed animate-fade-up-2">
            Municipality of {user.municipality || 'Gasan'} · Real-time nutrition and health monitoring overview across all {stats.totalBarangays || 'active'} barangays.
          </p>
        </div>
      </motion.div>

      {/* ── 4 Stat Cards ── */}
      <motion.div variants={staggerContainer(0.08, 0.05)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <CountUp value={stats.totalChildren} /> active children
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
                        <strong className="text-gray-900 font-bold"><CountUp value={num} /></strong> (<CountUp value={percentage} />%)
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
                      <Bar
                        dataKey="cases"
                        fill="#2e7d32"
                        radius={[6, 6, 0, 0]}
                        barSize={36}
                        isAnimationActive={true}
                        animationDuration={900}
                        animationEasing="ease-out"
                      />
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

      {/* ── Step 10: Enhanced Feeding Program Overview ── */}
      {feedingStats && (
        <motion.div variants={itemVariants} className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Utensils size={16} />
                </div>
                <h3 className="font-bold text-gray-900 text-base">Feeding Program Overview</h3>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Comprehensive tracking of children enrolled, recovery outcomes, and barangay performance
              </p>
            </div>
            <div className="flex items-center gap-1.5 self-start sm:self-auto bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Feeding Program Data
            </div>
          </div>

          {/* Top 4 Key Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Total Enrolled */}
            <div className="rounded-2xl bg-emerald-50/70 border border-emerald-100 p-4 text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800">Total in Feeding</span>
                <span className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <Baby size={16} />
                </span>
              </div>
              <p className="text-3xl font-black text-emerald-800 mt-2">
                <CountUp value={feedingStats.enrolled || 0} />
              </p>
              <p className="text-[11px] text-emerald-600 font-medium mt-1">Beneficiaries undergoing feeding</p>
            </div>

            {/* 2. Reached Normal (Recovered) */}
            <div className="rounded-2xl bg-blue-50/70 border border-blue-100 p-4 text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-800">Naging Normal</span>
                <span className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
                  <CheckCircle2 size={16} />
                </span>
              </div>
              <p className="text-3xl font-black text-blue-800 mt-2">
                <CountUp value={feedingStats.reached_normal_in_feeding || 0} />
              </p>
              <p className="text-[11px] text-blue-600 font-medium mt-1">
                {feedingStats.enrolled > 0
                  ? `${Math.round(((feedingStats.reached_normal_in_feeding || 0) / feedingStats.enrolled) * 100)}% recovery rate`
                  : 'Achieved normal status'}
              </p>
            </div>

            {/* 3. Still in Intervention (Not Normal) */}
            <div className="rounded-2xl bg-amber-50/70 border border-amber-100 p-4 text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900">Hindi Pa Normal</span>
                <span className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                  <AlertTriangle size={16} />
                </span>
              </div>
              <p className="text-3xl font-black text-amber-800 mt-2">
                <CountUp value={feedingStats.still_malnourished || 0} />
              </p>
              <p className="text-[11px] text-amber-700 font-medium mt-1">
                {feedingStats.sam_count || 0} SAM • {feedingStats.mam_count || 0} MAM
              </p>
            </div>

            {/* 4. Total Attendance Sessions */}
            <div className="rounded-2xl bg-purple-50/70 border border-purple-100 p-4 text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-900">Feeding Logs</span>
                <span className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
                  <Utensils size={16} />
                </span>
              </div>
              <p className="text-3xl font-black text-purple-800 mt-2">
                <CountUp value={feedingStats.total_attendance || 0} />
              </p>
              <p className="text-[11px] text-purple-600 font-medium mt-1">Total meal attendances logged</p>
            </div>
          </div>

          {/* Visual Outcome Progress Bar */}
          <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-gray-700">
              <span>Overall Feeding Outcome Breakdown</span>
              <span className="text-emerald-700">
                {feedingStats.enrolled > 0
                  ? `${Math.round(((feedingStats.reached_normal_in_feeding || 0) / feedingStats.enrolled) * 100)}% Normalized`
                  : '0%'}
              </span>
            </div>
            {/* Multi-segment Bar */}
            <div className="w-full h-3 rounded-full bg-gray-200 overflow-hidden flex">
              <div
                style={{ width: `${feedingStats.enrolled > 0 ? ((feedingStats.reached_normal_in_feeding || 0) / feedingStats.enrolled) * 100 : 0}%` }}
                className="bg-emerald-500 transition-all duration-500"
                title={`Normal: ${feedingStats.reached_normal_in_feeding || 0}`}
              />
              <div
                style={{ width: `${feedingStats.enrolled > 0 ? ((feedingStats.mam_count || 0) / feedingStats.enrolled) * 100 : 0}%` }}
                className="bg-amber-400 transition-all duration-500"
                title={`MAM: ${feedingStats.mam_count || 0}`}
              />
              <div
                style={{ width: `${feedingStats.enrolled > 0 ? ((feedingStats.sam_count || 0) / feedingStats.enrolled) * 100 : 0}%` }}
                className="bg-red-500 transition-all duration-500"
                title={`SAM: ${feedingStats.sam_count || 0}`}
              />
              <div
                style={{ width: `${feedingStats.enrolled > 0 ? ((feedingStats.overweight_obese_count || 0) / feedingStats.enrolled) * 100 : 0}%` }}
                className="bg-purple-400 transition-all duration-500"
                title={`Overweight / Obese: ${feedingStats.overweight_obese_count || 0}`}
              />
            </div>
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-medium pt-1 text-gray-600">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Normal ({feedingStats.reached_normal_in_feeding || 0})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                <span>MAM ({feedingStats.mam_count || 0})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                <span>SAM ({feedingStats.sam_count || 0})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shrink-0" />
                <span>Overweight / Obese ({feedingStats.overweight_obese_count || 0})</span>
              </div>
            </div>
          </div>

          {/* Barangay Ranking Table (Alin ang may mas maraming bata sa feeding) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                <MapPin size={15} className="text-emerald-700" />
                Barangay Feeding Distribution & Performance
              </h4>
              <span className="text-xs text-gray-400 font-medium">Ranked by enrolled beneficiaries</span>
            </div>

            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Barangay</th>
                    <th className="px-3 py-2.5 text-center">Nasa Feeding</th>
                    <th className="px-3 py-2.5 text-center text-emerald-700 bg-emerald-50/50">Naging Normal</th>
                    <th className="px-3 py-2.5 text-center text-amber-700 bg-amber-50/50">Hindi Pa Normal</th>
                    <th className="px-3 py-2.5 text-center text-red-700 bg-red-50/50">Kritikal (SAM)</th>
                    <th className="px-4 py-2.5 text-right">Attendance Logs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {feedingStats.barangay_ranking && feedingStats.barangay_ranking.length > 0 ? (
                    feedingStats.barangay_ranking.map((row, idx) => (
                      <tr key={row.barangay} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-4 py-2.5 font-bold text-gray-900 flex items-center gap-1.5">
                          {idx === 0 && <span className="text-amber-500 font-black">🥇</span>}
                          {idx === 1 && <span className="text-gray-400 font-black">🥈</span>}
                          {idx === 2 && <span className="text-amber-700 font-black">🥉</span>}
                          Barangay {row.barangay}
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold text-gray-800">
                          <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100">
                            {row.enrolled}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold text-emerald-700 bg-emerald-50/30">
                          {row.reached_normal}
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold text-amber-700 bg-amber-50/30">
                          {row.not_normal}
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold text-red-600 bg-red-50/30">
                          {row.sam_count > 0 ? (
                            <span className="inline-block px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">
                              {row.sam_count}
                            </span>
                          ) : (
                            <span className="text-gray-300">0</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-gray-600">
                          {row.attendance_total} logs
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                        No feeding records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Drilldown List of Children (Alin ang mga naging normal vs hindi naging normal) */}
          <div className="pt-2 border-t border-gray-100 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-gray-800 text-sm">
                  Beneficiary Breakdown (Naging Normal vs. Hindi Pa Normal)
                </h4>
                <p className="text-xs text-gray-400">View specific children and their current nutritional progress</p>
              </div>

              {/* Tab Selector */}
              <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setFeedingChildTab('all')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    feedingChildTab === 'all'
                      ? 'bg-white text-gray-800 shadow-2xs font-bold'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Lahat ({feedingStats.enrolled || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setFeedingChildTab('normal')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    feedingChildTab === 'normal'
                      ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Naging Normal ({feedingStats.reached_normal_in_feeding || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setFeedingChildTab('not_normal')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    feedingChildTab === 'not_normal'
                      ? 'bg-amber-600 text-white shadow-2xs font-bold'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Kailangan Pa ng Tulong ({feedingStats.still_malnourished || 0})
                </button>
              </div>
            </div>

            {/* List Table of Children */}
            <div className="rounded-xl border border-gray-200 overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Pangalan ng Bata</th>
                    <th className="px-3 py-2.5 text-left">Barangay</th>
                    <th className="px-3 py-2.5 text-center">Unang Status</th>
                    <th className="px-3 py-2.5 text-center">Kasalukuyang Status</th>
                    <th className="px-3 py-2.5 text-center">Timbang & Taas</th>
                    <th className="px-4 py-2.5 text-right">Attendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayedFeedingChildren.length > 0 ? (
                    displayedFeedingChildren.map((c) => {
                      const isNorm = String(c.latest_status || '').toLowerCase() === 'normal';
                      const isSAM = String(c.latest_status || '').toLowerCase() === 'sam';
                      return (
                        <tr key={c.child_id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="px-4 py-2.5 font-bold text-gray-900">{c.full_name}</td>
                          <td className="px-3 py-2.5 font-medium text-gray-600">Brgy. {c.barangay}</td>
                          <td className="px-3 py-2.5 text-center font-medium text-gray-500">
                            <span className="uppercase px-2 py-0.5 rounded bg-gray-100 text-[10px] font-bold">
                              {c.initial_status || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span
                              className={`uppercase px-2 py-0.5 rounded text-[10px] font-bold ${
                                isNorm
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isSAM
                                  ? 'bg-red-100 text-red-700 animate-pulse'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {c.latest_status || 'Ongoing'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center font-medium text-gray-700">
                            {c.latest_weight ? `${c.latest_weight} kg` : '—'} / {c.latest_height ? `${c.latest_height} cm` : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-gray-600">
                            {c.attendance_count || 0} times
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                        Walang batang tumutugma sa napiling kategorya.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Step 10: Per-Year Nutritional Status Chart ── */}
      <motion.div variants={itemVariants} className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="font-bold text-gray-900 text-base">Nutritional Status by Year</h3>
            <p className="text-xs text-gray-400 mt-0.5">Monthly breakdown of nutrition records for the selected year</p>
          </div>
          {/* Year picker */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="text-xs font-semibold border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 text-gray-700 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((yr) => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>
        </div>
        {yearStats && Array.isArray(yearStats.months) ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={yearStats.months.map((m) => ({
              name: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m.month - 1],
              Normal: m.normal,
              MAM: m.mam,
              SAM: m.sam,
              Underweight: m.underweight,
              Stunted: m.stunted,
            }))} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10 }} />
              <Bar dataKey="Normal" fill="#10b981" radius={[4,4,0,0]} />
              <Bar dataKey="MAM" fill="#f59e0b" radius={[4,4,0,0]} />
              <Bar dataKey="SAM" fill="#ef4444" radius={[4,4,0,0]} />
              <Bar dataKey="Underweight" fill="#f97316" radius={[4,4,0,0]} />
              <Bar dataKey="Stunted" fill="#8b5cf6" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">Loading chart…</div>
        )}
        <div className="flex flex-wrap gap-3 mt-4 text-[11px] font-medium text-gray-500">
          {[['Normal','#10b981'],['MAM','#f59e0b'],['SAM','#ef4444'],['Underweight','#f97316'],['Stunted','#8b5cf6']].map(([label, color]) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: color }} />
              {label}
            </span>
          ))}
        </div>
      </motion.div>

    </motion.div>
  );
}

export default Dashboard;