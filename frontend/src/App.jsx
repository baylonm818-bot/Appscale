import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate} from 'react-router-dom';
import { Wifi, CheckCircle2 } from 'lucide-react';
import Login from './pages/Login';
import DownloadApp from './pages/DownloadApp';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout';
import Dashboard from './admin/Dashboard';
import UserManagement from './admin/UserManagement';
import Masterlist from './admin/MasterList';
import Schedule from './admin/Schedule';
import Notifications from './admin/Notification';
import Profile from './admin/Profile';

import BHWLayout from './components/BhwLayout';
import BHWDashboard from './bhw/Dashboard';
import BHWSchedule from './bhw/Schedule';
import BHWNeedAttention from './bhw/NeedAttention';
import BHWReferrals from './bhw/Referrals';
import BHWMedicalRecords from './bhw/MedicalRecords';
import BHWNotifications from './bhw/Notification';
import BHWProfile from './bhw/Profile';

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

  return(
    <BrowserRouter>
      <AutoSyncNotification />
      <Routes>
        <Route path ="/" element ={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/download" element={<DownloadApp />} />

        <Route path="/admin" element ={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="masterlist" element={<Masterlist/>} />
          <Route path="schedule" element={<Schedule/>} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Profile/>} />
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
          <Route path="need-attention" element={<BHWNeedAttention/>} />
          <Route path="referrals" element={<BHWReferrals/>} />
          <Route path="medical-records" element={<BHWMedicalRecords/>} />
          <Route path="schedule" element={<BHWSchedule/>} />
          <Route path="notifications" element={<BHWNotifications/>} />
          <Route path="profile" element={<BHWProfile/>} />
        </Route>
               
        {/* Catch-all unknown routes: redirect to login / dashboard */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
