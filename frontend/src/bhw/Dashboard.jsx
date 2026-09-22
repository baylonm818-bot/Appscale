import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { Users, AlertCircle, CheckCircle, Ruler, Triangle, List, MapPin, CalendarDays, ArrowRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import HeaderBanner from '../components/ui/HeaderBanner';
import { StatCard, StatusItem, QuickLink } from '../components/ui/SharedCards';

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
        setStats(statsResponse.data);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        setActivities((scheduleResponse.data || [])
          .filter((activity) => activity.status === 'pending' && new Date(activity.schedule_date) >= today)
          .sort((first, second) => new Date(first.schedule_date) - new Date(second.schedule_date))
          .slice(0, 3));
      } catch (err) {
        setError('Failed to load dashboard.');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [user.barangay, user.user_id]);

  const formatActivityDate = (date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (loading) return <p className="text-gray-500">Loading dashboard...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div className="space-y-6">
      <HeaderBanner title={`Hello, ${user.first_name || user.username || 'BNS'}!`} subtitle="BNS Health Monitoring" location={user.barangay} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard icon={Users} label="Total Children" value={stats.totalChildren} sublabel="Registered" accent="border-green-500" />
        <StatCard icon={Users} label="Total Mothers" value={stats.totalMothers} sublabel="Lactating Mothers" accent="border-emerald-500" />
        <StatCard icon={AlertCircle} label="At-Risk Children" value={stats.atRiskChildren} sublabel="Need attention" accent="border-amber-500" />
        <StatCard icon={AlertCircle} label="At-Risk Mothers" value={stats.atRiskMothers} sublabel="Need attention" accent="border-red-500" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="motion-chart-card rounded-xl p-5 shadow-sm lg:col-span-2" style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold" style={{ color: 'var(--ink)' }}>Nutrition Status</h3>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Latest recorded status of children</p>
            </div>
            <Link to="/bhw/need-attention" className="flex items-center gap-1 text-xs font-semibold text-green-700 hover:text-green-900">View attention list <ArrowRight size={14} /></Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatusItem icon={CheckCircle} label="Normal" value={stats.normal} tone="text-green-600 bg-green-50" />
            <StatusItem icon={Ruler} label="Stunted" value={stats.stunted} tone="text-orange-600 bg-orange-50" />
            <StatusItem icon={Triangle} label="Wasted" value={stats.wasted} tone="text-red-600 bg-red-50" />
            <StatusItem icon={List} label="Underweight" value={stats.underweight} tone="text-amber-600 bg-amber-50" />
          </div>
        </div>

        <div className="motion-chart-card rounded-xl p-5 shadow-sm" style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}>
          <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold" style={{ color: 'var(--ink)' }}>Upcoming Activities</h3><CalendarDays size={18} className="text-green-600" /></div>
          {activities.length === 0 ? <p className="py-5 text-sm" style={{ color: 'var(--muted)' }}>No upcoming activities.</p> : (
            <div className="space-y-3">
              {activities.map((activity) => (
                <div key={activity.schedule_id} className="flex items-start gap-3 border-b pb-3 last:border-0 last:pb-0" style={{ borderColor: 'var(--line)' }}>
                  <div className="min-w-12 rounded-lg bg-green-50 px-2 py-1 text-center text-xs font-semibold text-green-700">{formatActivityDate(activity.schedule_date)}</div>
                  <div className="min-w-0"><p className="truncate text-sm font-medium" style={{ color: 'var(--ink)' }}>{activity.title || 'Health activity'}</p><p className="text-xs capitalize" style={{ color: 'var(--muted)' }}>{activity.schedule_type?.replace('_', ' ') || 'Scheduled activity'}</p></div>
                </div>
              ))}
            </div>
          )}
          <Link to="/bhw/schedule" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-green-700 hover:text-green-900">Open schedule <ArrowRight size={14} /></Link>
        </div>
      </div>

      <div className="motion-chart-card rounded-xl p-5 shadow-sm" style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}>
          <h3 className="font-semibold" style={{ color: 'var(--ink)' }}>Monthly Monitoring Trend</h3>
          <p className="mb-4 text-xs" style={{ color: 'var(--muted)' }}>{user.barangay} · 6 months overview</p>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={stats.monthlyMonitoring || []} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #dcfce7' }} />
              <Line type="monotone" dataKey="monitored" name="Monitored" stroke="#16a34a" strokeWidth={3} dot={{ r: 4, fill: '#16a34a' }} />
              <Line type="monotone" dataKey="atRisk" name="At Risk" stroke="#f97316" strokeWidth={3} dot={{ r: 4, fill: '#f97316' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickLink to="/bhw/need-attention" icon={AlertCircle} label="Need Attention" tone="bg-red-500" />
        <QuickLink to="/bhw/referrals" icon={Users} label="Referrals" tone="bg-lime-600" />
        <QuickLink to="/bhw/medical-records" icon={List} label="Records" tone="bg-teal-600" />
        <QuickLink to="/bhw/schedule" icon={CalendarDays} label="Schedule" tone="bg-green-600" />
      </div>
    </div>
  );
}

export default Dashboard;