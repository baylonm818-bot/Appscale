import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import logo from '../assets/logo.png';
import { API_ORIGIN, getProfileImageUrl, getUserInitials } from '../api/config';
import { useAuth } from './AuthContext';
import {
  LayoutDashboard,
  AlertCircle,
  Users,
  FileText,
  Calendar,
  Bell,
  UserCircle,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
} from 'lucide-react';

const menuItems = [
  { name: 'Dashboard', path: '/bhw/dashboard', icon: LayoutDashboard },
  { name: 'Need Attention', path: '/bhw/need-attention', icon: AlertCircle },
  { name: 'Referrals Received', path: '/bhw/referrals', icon: Users },
  { name: 'Medical Records', path: '/bhw/medical-records', icon: FileText },
  { name: 'Schedule', path: '/bhw/schedule', icon: Calendar },
  { name: 'Notification', path: '/bhw/notifications', icon: Bell },
  { name: 'My Profile', path: '/bhw/profile', icon: UserCircle },
];

function BHWLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser } = useAuth();
  const user = authUser || JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
  const [profileImageSrc, setProfileImageSrc] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setProfileImageSrc(null);
    const pic = user?.profile_picture;
    if (!pic || typeof pic !== 'string') return;
    const trimmed = pic.trim();
    if (!trimmed) return;
    if (/^(data:|https?:)?\/\//i.test(trimmed)) return;

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return;

    const url = `${API_ORIGIN}/api/profile/${user.user_id}/picture/data`;
    (async () => {
      try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const j = await res.json();
        if (!cancelled && j?.profile_picture) setProfileImageSrc(j.profile_picture);
      } catch {}
    })();

    return () => { cancelled = true; };
  }, [user?.profile_picture, user?.user_id]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('user');
    navigate('/login');
  };

  const pageTitles = {
    '/bhw/dashboard': (
      <div className="mb-1 px-4">
        <h2 className="text-xl font-bold text-gray-800">Health Worker Dashboard</h2>
        <p className="text-xs text-gray-400">{user.barangay ? `${user.barangay} Barangay Health & Nutrition` : 'Community Health Monitoring'}</p>
      </div>
    ),
    '/bhw/need-attention': (
      <div className="mb-1 px-4">
        <h2 className="text-xl font-bold text-gray-800">Need Attention</h2>
        <p className="text-xs text-gray-400">Children flagged for malnutrition or overdue health follow-ups</p>
      </div>
    ),
    '/bhw/referrals': (
      <div className="mb-1 px-4">
        <h2 className="text-xl font-bold text-gray-800">Referrals Management</h2>
        <p className="text-xs text-gray-400">Community health cases and doctor/RHU referrals</p>
      </div>
    ),
    '/bhw/medical-records': (
      <div className="mb-1 px-4">
        <h2 className="text-xl font-bold text-gray-800">Medical Records</h2>
        <p className="text-xs text-gray-400">Health history, growth assessments, and service records</p>
      </div>
    ),
    '/bhw/schedule': (
      <div className="mb-1 px-4">
        <h2 className="text-xl font-bold text-gray-800">Schedule & Activities</h2>
        <p className="text-xs text-gray-400">Feeding, home visits, checkups, and seminars</p>
      </div>
    ),
    '/bhw/notifications': (
      <div className="mb-1 px-4">
        <h2 className="text-xl font-bold text-gray-800">Notifications</h2>
        <p className="text-xs text-gray-400">View recent health alerts and assignment reminders</p>
      </div>
    ),
    '/bhw/profile': (
      <div className="mb-1 px-4">
        <h2 className="text-xl font-bold text-gray-800">My Profile & Settings</h2>
        <p className="text-xs text-gray-400">Manage account information and security</p>
      </div>
    ),
  };

  const currentTitle = pageTitles[location.pathname] || '';

  return (
    <div className="app-shell flex h-screen overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className={`app-sidebar border-r border-gray-200 ${isSidebarOpen ? 'w-64 mobile-open' : 'w-18'} text-gray-900 flex flex-col h-screen transition-all duration-300 shrink-0`}>
        {/* Brand Header */}
        <div className={`app-sidebar-header flex items-center p-4 border-b ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
          {isSidebarOpen ? (
            <div className="flex min-w-0 items-center gap-3">
              <div className="rounded-2xl bg-white p-1.5 shadow-lg shadow-black/15 ring-2 ring-white/20 shrink-0">
                <img src={logo} alt="AppScale logo" className="h-8 w-8 rounded-lg object-contain" />
              </div>
              <div className="min-w-0 leading-none">
                <span className="block truncate text-lg font-black tracking-tight text-gray-900">AppScale</span>
                <span className="mt-1 block truncate text-[10px] font-bold uppercase tracking-[0.16em] text-green-600">
                  {user.role ? `${user.role.toUpperCase()} Portal` : 'Health Portal'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1 text-center whitespace-nowrap">
              <div className="rounded-2xl bg-white p-1.5 shadow-lg shadow-black/15 ring-2 ring-white/20">
                <img src={logo} alt="AppScale logo" className="h-7 w-7 rounded-lg object-contain" />
              </div>
              <span className="text-[8px] font-black uppercase tracking-[0.18em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]">AppScale</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 rounded-xl hover:bg-green-50 text-gray-600 hover:text-green-800 transition"
          >
            {isSidebarOpen ? <X size={18} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => {
                  if (window.innerWidth < 768) setIsSidebarOpen(false);
                }}
                className={`app-sidebar-link ${isActive ? 'is-active' : ''} flex items-center gap-3 px-3.5 py-2.5 mx-2.5 rounded-xl text-sm transition-all duration-150 ${
                  !isSidebarOpen ? 'justify-center mx-1.5 px-2' : ''
                }`}
                title={!isSidebarOpen ? item.name : undefined}
              >
                <Icon size={19} className="shrink-0" />
                {isSidebarOpen && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer Logout */}
        <div className="app-sidebar-footer app-sidebar-header border-t p-2.5">
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 px-3.5 py-2.5 w-full rounded-xl transition-all duration-150 text-sm text-red-200/85 hover:text-green-800 hover:bg-red-500/20 ${
              !isSidebarOpen ? 'justify-center px-2' : ''
            }`}
            title={!isSidebarOpen ? 'Logout' : undefined}
          >
            <LogOut size={18} className="shrink-0" />
            {isSidebarOpen && <span className="font-semibold truncate">Logout</span>}
          </button>
        </div>
      </aside>

      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="mobile-sidebar-backdrop"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ── Main Content Area ── */}
      <div className="app-content-shell flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="app-topbar relative z-40 px-3 py-2.5 flex justify-between items-center gap-3">
          <div className="min-w-0 flex items-center gap-2">
            {!isSidebarOpen && (
              <button
                type="button"
                aria-label="Open sidebar"
                className="md:hidden p-2 rounded-xl text-green-800 hover:bg-green-50"
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu size={20} />
              </button>
            )}
            {currentTitle}
          </div>

          <div className="relative flex items-center gap-3">


            <button
              type="button"
              aria-label="Open profile menu"
              aria-expanded={isProfileMenuOpen}
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex items-center gap-2 rounded-full p-1 pr-2 transition hover:bg-green-50"
            >
              <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-linear-to-br from-[#1b5e20] to-[#2e7d32] text-sm font-bold text-gray-900 shadow-sm ring-2 ring-green-100">
                {user?.profile_picture ? (
                  <img
                    src={profileImageSrc || getProfileImageUrl(user.profile_picture)}
                    alt="Profile"
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      const container = event.currentTarget.parentElement;
                      if (!container) return;
                      event.currentTarget.style.display = 'none';
                      container.textContent = getUserInitials(user);
                    }}
                  />
                ) : (
                  getUserInitials(user)
                )}
              </span>
            </button>

            {isProfileMenuOpen && (
              <div className="absolute right-0 top-14 z-100 w-56 rounded-2xl border border-gray-100 bg-white p-2 shadow-2xl shadow-black/15">
                <div className="border-b border-gray-100 px-3 py-2">
                  <p className="truncate text-sm font-bold text-gray-900">{user?.full_name || user?.username || "Health Worker"}</p>
                  <p className="truncate text-xs text-gray-400">{user?.email || "Health Worker account"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    navigate('/bhw/profile');
                  }}
                  className="mt-1 flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-green-50 hover:text-green-800 transition"
                >
                  View profile
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50 transition"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>

        <main className="app-main flex-1 overflow-y-auto p-6" style={{ background: 'var(--canvas)' }}>
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.3 }} className="app-route-view"><Outlet /></motion.div>
        </main>
      </div>
    </div>
  );
}

export default BHWLayout;



