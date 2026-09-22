import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { Users, Home, Bell } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import HeaderBanner from '../components/ui/HeaderBanner';
import { StatCard } from '../components/ui/SharedCards';

const statusColors = {
    normal: 'bg-green-500',
    underweight: 'bg-yellow-500',
    severly_underweight: 'bg-red-700',
    stunted: 'bg-orange-500',
    wasted: 'bg-orange-600',
    overweight: 'bg-amber-500',
    severly_stunted: 'bg-red-600',
    severly_wasted: 'bg-red-800',
    obese: 'bg-red-500',
};

const statusLabels = {
    normal: 'Normal',
    underweight: 'Underweight',
    severly_underweight: 'Severely Underweight',
    stunted: 'Stunted',
    wasted: 'Wasted',
    overweight: 'Overweight',
    severly_stunted: 'Severely Stunted',
    severly_wasted: 'Severely Wasted',
    obese: 'Obese',
};

function Dashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timeRange, setTimeRange] = useState('3M');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => {
        const fetchMalnutrionData = async () => {
            try {
                const response = await axiosClient.get(`/dashboard/admin/stats?range=${timeRange}`);
                // tolerate missing fields from backend
                const data = response.data || {};
                setStats({
                    totalUsers: data.totalUsers || 0,
                    totalChildren: data.totalChildren || 0,
                    totalMothers: data.totalMothers || 0,
                    totalBarangays: data.totalBarangays || 0,
                    nutritionTrends: data.nutritionTrends || {},
                    nineCategoryTrend: data.nineCategoryTrend || {},
                    malnutritionByBarangay: data.malnutritionByBarangay || [],
                    malnutritionOverviewFallback: !!data.malnutritionOverviewFallback,
                    upcomingActivities: data.upcomingActivities || [],
                });
            } catch (err) {
                console.error('Dashboard fetch error:', err && (err.response && err.response.data) ? err.response.data : err.message);
                setError('Failed to load dashboard stats. Please try again later.');
            } finally {
                setLoading(false);
            }
        };
        fetchMalnutrionData();
    }, [timeRange]);

    if (loading) {
        return <p className="text-center text-gray-500">Loading...</p>;
    }

    if (error) {
        return <p className="text-center text-red-500">{error}</p>;
    }

    const maxTrend = Math.max(...Object.values(stats.nineCategoryTrend), 1);
    const overviewData = (stats.malnutritionByBarangay || []).slice(0, 5);

    return (
        <div className="space-y-6">

            {/* Welcome Banner - soft gradient */}
            <HeaderBanner title={`Hello, ${user.full_name || 'Admin'}!`} subtitle="Municipal Nutrition Overview" location={''} />

            {/* Stat Cards + Nutrition Trend */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <StatCard icon={Users} label="Total Users" value={stats.totalUsers} sublabel="BNS and BHW" iconBg="bg-green-600" />
                    <StatCard icon={Users} label="Total Children" value={stats.totalChildren} sublabel={`${stats.totalBarangays} barangays`} iconBg="bg-emerald-500" />
                    <StatCard icon={Users} label="Total Mothers" value={stats.totalMothers} sublabel="Lactating Mothers" iconBg="bg-pink-500" />
                    <StatCard icon={Home} label="Total Barangays" value={stats.totalBarangays} sublabel="Active Monitoring" iconBg="bg-lime-600" />
                </div>

                <div className="motion-chart-card bg-white rounded-2xl shadow-sm p-6">
                    <h3 className="font-semibold text-gray-800">Municipal Nutrition Trend</h3>
                    <p className="text-xs text-gray-400 mb-4">Based on latest nutrition records</p>
                    <div className="space-y-3">
                        {Object.entries(stats.nineCategoryTrend).map(([key, count]) => (
                            <div key={key} className="flex items-center gap-3">
                                    <span className="text-xs text-gray-500 w-28 shrink-0 wrap-break-word leading-tight">{statusLabels[key]}</span>
                                <div className="flex-1 bg-gray-100 rounded-full h-2 min-w-0">
                                    <div
                                        className={`h-2 rounded-full ${statusColors[key]} transition-all`}
                                        style={{ width: `${(count / maxTrend) * 100}% `}}
                                    />
                                </div>
                                <span className="text-xs text-gray-700 w-4 text-right font-medium shrink-0">{count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Malnutrition Overview + Upcoming Activities */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Malnutrition Overview Chart */}
                <div className="motion-chart-card bg-white rounded-2xl shadow-sm p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="font-semibold text-gray-800">Malnutrition Overview</h3>
                            <p className="text-xs text-gray-400">
                                {stats.malnutritionOverviewFallback
                                    ? 'No records in selected period; showing latest available cases'
                                    : 'Top barangay with the highest malnutrition cases'}
                            </p>
                        </div>
                        <div className="flex gap-1 bg-gray-100 rounded-full p-1">
                            {['3M', '6M', '1Y'].map((range) => (
                                <button
                                    key={range}
                                    onClick={() => setTimeRange(range)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                                        timeRange === range
                                            ? 'bg-green-600 text-white shadow-sm'
                                            : 'text-gray-500 hover:bg-gray-200'
                                    }`}
                                >
                                    {range === '3M' ? '3M' : range === '6M' ? '6M' : '1Y'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {overviewData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={overviewData} margin={{ top: 10, right: 8, left: -12, bottom: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="barangay" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} interval={0} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={28} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="cases" fill="#16a34a" radius={[8, 8, 0, 0]} barSize={28} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-55 text-gray-400 text-sm">
                            No malnutrition cases recorded.
                        </div>
                    )}
                </div>

                {/* Upcoming Activities */}
                <div className="motion-chart-card bg-white rounded-2xl shadow-sm p-6">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-semibold text-gray-800">Upcoming Activities</h3>
                        <a href="/admin/schedule" className="text-sm text-green-600 font-medium hover:underline">
                            View All &gt;
                        </a>
                    </div>

                    <div className="space-y-1">
                        {stats.upcomingActivities && stats.upcomingActivities.length > 0 ? (
                            stats.upcomingActivities.map((activity) => {
                                const date = new Date(activity.schedule_date);
                                return (
                                        <div key={activity.schedule_id} className="flex items-center gap-3 p-3 rounded-xl bg-green-50/45 border border-green-100/70 hover:bg-green-50 transition">
                                        <div className="w-11 h-11 rounded-xl bg-green-50 flex flex-col items-center justify-center text-green-700 shrink-0">
                                            <span className="text-[10px] font-semibold uppercase leading-none">
                                                {date.toLocaleString('en-US', { month: 'short' })}
                                            </span>
                                            <span className="text-lg font-bold leading-none mt-1">{date.getDate()}</span>
                                        </div>
                                            <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-800 wrap-break-word leading-snug">{activity.title}</p>
                                            <p className="text-xs text-gray-400 wrap-break-word">
                                                {activity.barangay}{activity.venue ? ` · ${activity.venue}` : ''}
                                                {activity.schedule_time ? ` · ${activity.schedule_time}` : ''}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-center text-gray-400 text-sm py-8">
                                No upcoming activities scheduled.
                            </p>
                        )}
                    </div>
                </div>

            </div>

        </div>
    );
}

export default Dashboard;