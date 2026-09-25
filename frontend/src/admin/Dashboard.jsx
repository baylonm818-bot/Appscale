import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { Users, Baby, Heart, MapPin, Calendar, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

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
};

function StatCard({ icon: Icon, label, value, sublabel, to }) {
  const content = (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100/80 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <div className="shrink-0 w-10 h-10 rounded-xl bg-green-50 text-[#2e7d32] flex items-center justify-center group-hover:bg-linear-to-br group-hover:from-[#1b5e20] group-hover:to-[#2e7d32] group-hover:text-white transition-all shadow-xs">
          <Icon size={18} />
        </div>
      </div>
      <p className="text-3xl font-black text-gray-800 mt-2 tracking-tight">{value ?? '—'}</p>
      <p className="text-xs font-medium text-gray-400 mt-1">{sublabel}</p>
    </div>
  );

  return to ? <Link to={to} className="block">{content}</Link> : content;
}

function CustomBarTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-900 text-white px-3.5 py-2 rounded-xl text-xs shadow-xl">
        <p className="font-bold">{label}</p>
        <p className="text-emerald-300 mt-0.5">{payload[0].value} malnutrition {payload[0].value === 1 ? 'case' : 'cases'}</p>
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
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-10 h-10 rounded-full border-4 border-green-200 border-t-green-600 animate-spin" />
        <p className="text-sm font-medium text-gray-400">Loading dashboard data…</p>
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
  const totalEvaluated = Object.values(trends).reduce((sum, n) => sum + (Number(n) || 0), 0) || 1;
  const maxTrend = Math.max(...Object.values(trends).map(Number), 1);
  const overviewData = (stats.malnutritionByBarangay || []).slice(0, 6);

  return (
    <div className="space-y-6">

      {/* ── Welcome Banner ── */}
      <div className="relative rounded-2xl overflow-hidden shadow-sm bg-gradient-to-r from-[#1b5e20] via-[#2e7d32] to-emerald-600 p-6 sm:p-8 text-white">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 text-emerald-100 backdrop-blur-xs mb-3">
            <CheckCircle2 size={13} /> Official Nutrition Portal
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
            Welcome back, {user.full_name || user.first_name || user.username || 'Admin'}!
          </h1>
          <p className="text-emerald-100/80 text-sm mt-1.5 leading-relaxed">
            Municipality of {user.municipality || 'Gasan'} · Real-time nutrition and health monitoring overview across all {stats.totalBarangays || 'active'} barangays.
          </p>
        </div>
      </div>

      {/* ── 4 Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
      </div>

      {/* ── Main Graphs Section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Municipal Nutrition Trend Distribution */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 mb-1">
              <h3 className="font-bold text-gray-900 text-base">Municipal Nutrition Breakdown</h3>
              <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                {stats.totalChildren} active children
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-5">Latest health & growth assessment per child</p>

            <div className="space-y-3">
              {Object.entries(trends).map(([key, count]) => {
                const num = Number(count) || 0;
                const percentage = totalEvaluated > 0 ? Math.round((num / totalEvaluated) * 100) : 0;
                const widthPercent = (num / maxTrend) * 100;

                return (
                  <div key={key} className="group">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="font-semibold text-gray-700">{statusLabels[key] || key}</span>
                      <span className="text-gray-400 font-medium">
                        <strong className="text-gray-900 font-bold">{num}</strong> ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${statusColors[key] || 'bg-green-500'}`}
                        style={{ width: `${Math.max(widthPercent, num > 0 ? 4 : 0)}%` }}
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

        {/* Malnutrition Overview by Barangay */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
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
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={overviewData} margin={{ top: 12, right: 12, left: -20, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis
                        dataKey="barangay"
                        tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 500 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<CustomBarTooltip />} />
                      <Bar dataKey="cases" fill="#2e7d32" radius={[6, 6, 0, 0]} barSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
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
        </div>

      </div>

      {/* ── Upcoming Scheduled Activities ── */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-900 text-base">Upcoming Scheduled Activities</h3>
            <p className="text-xs text-gray-400 mt-0.5">Municipal & barangay health schedules</p>
          </div>
          <Link
            to="/admin/schedule"
            className="text-xs font-bold text-[#2e7d32] bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-xl transition inline-flex items-center gap-1.5"
          >
            Manage Schedule <ArrowRight size={13} />
          </Link>
        </div>

        {stats.upcomingActivities && stats.upcomingActivities.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.upcomingActivities.map((act) => {
              const d = new Date(act.schedule_date);
              const month = d.toLocaleString('en-US', { month: 'short' });
              const day = d.getDate();

              return (
                <div
                  key={act.schedule_id}
                  className="flex items-start gap-3.5 p-4 rounded-xl bg-gray-50/70 border border-gray-100 hover:bg-green-50/40 hover:border-green-200 transition-all"
                >
                  <div className="w-12 h-12 rounded-xl bg-linear-to-br from-[#1b5e20] to-[#2e7d32] text-white flex flex-col items-center justify-center shrink-0 shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{month}</span>
                    <span className="text-lg font-black leading-none">{day}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-bold text-gray-900 truncate">{act.title}</p>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {act.schedule_type?.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {act.barangay || 'All Barangays'} {act.venue && `· ${act.venue}`}
                    </p>
                    {act.target_role && (
                      <p className="text-[11px] font-semibold text-emerald-700 mt-0.5">
                        For {act.target_role.toUpperCase()}s
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
            <Calendar className="mx-auto text-gray-300 mb-2" size={28} />
            <p className="text-sm font-semibold text-gray-600">No upcoming activities scheduled</p>
            <p className="text-xs text-gray-400 mt-0.5">Create a schedule activity to notify barangay workers.</p>
          </div>
        )}
      </div>

    </div>
  );
}

export default Dashboard;