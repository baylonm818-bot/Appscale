import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Wifi, CheckCircle2 } from 'lucide-react';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout';
import BHWLayout from './components/BhwLayout';

// Lazy-loaded routes for optimal bundle chunking and faster initial paint
const DownloadApp = lazy(() => import('./pages/DownloadApp'));
const Dashboard = lazy(() => import('./admin/Dashboard'));
const UserManagement = lazy(() => import('./admin/UserManagement'));
const Masterlist = lazy(() => import('./admin/MasterList'));
const Schedule = lazy(() => import('./admin/Schedule'));
const Notifications = lazy(() => import('./admin/Notification'));
const Profile = lazy(() => import('./admin/Profile'));

const BHWDashboard = lazy(() => import('./bhw/Dashboard'));
const BHWSchedule = lazy(() => import('./bhw/Schedule'));
const BHWNeedAttention = lazy(() => import('./bhw/NeedAttention'));
const BHWReferrals = lazy(() => import('./bhw/Referrals'));
const BHWMedicalRecords = lazy(() => import('./bhw/MedicalRecords'));
const BHWNotifications = lazy(() => import('./bhw/Notification'));
const BHWProfile = lazy(() => import('./bhw/Profile'));

function RouteLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px] w-full">
      <div className="flex flex-col items-center gap-3">
        <svg
          className="w-9 h-9 appscale-spinner text-emerald-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3.5"
          />
          <path
            className="opacity-85"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <p className="text-xs font-semibold text-slate-500 tracking-wide">Loading module...</p>
      </div>
    </div>
  );
}

function AutoSyncNotification() {
  const [showSyncBanner, setShowSyncBanner] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setShowSyncBanner(true);
      const timer = setTimeout(() => setShowSyncBanner(false), 5000);
      return () => clearTimeout(timer);
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  if (!showSyncBanner) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-emerald-900 text-white px-5 py-3 rounded-2xl shadow-2xl animate-bounce border border-emerald-700">
      <div className="p-2 rounded-xl bg-emerald-700/60">
        <Wifi size={18} className="text-emerald-300" />
      </div>
      <div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 size={14} className="text-emerald-400" />
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-200">System Online</p>
        </div>
        <p className="text-xs text-white font-semibold">Data automatically synchronized</p>
      </div>
    </div>
  );
}

function App() {
  localStorage.removeItem('appscale-theme');
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.classList.remove('dark');

  return (
    <BrowserRouter>
      <AutoSyncNotification />
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/download" element={<DownloadApp />} />

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="masterlist" element={<Masterlist />} />
            <Route path="schedule" element={<Schedule />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          <Route
            path="/bhw"
            element={
              <ProtectedRoute allowedRoles={['bhw', 'bns']}>
                <BHWLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<BHWDashboard />} />
            <Route path="need-attention" element={<BHWNeedAttention />} />
            <Route path="referrals" element={<BHWReferrals />} />
            <Route path="medical-records" element={<BHWMedicalRecords />} />
            <Route path="schedule" element={<BHWSchedule />} />
            <Route path="notifications" element={<BHWNotifications />} />
            <Route path="profile" element={<BHWProfile />} />
          </Route>

          {/* Top-level route redirects for consistency */}
          <Route path="/notifications" element={<Navigate to="/admin/notifications" replace />} />

          {/* Catch-all unknown routes: redirect to login / dashboard */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
