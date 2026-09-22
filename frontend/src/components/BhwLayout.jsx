import { useState, useEffect } from 'react';
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
  const [theme, setTheme] = useState(() => localStorage.getItem('appscale-theme') || 'light');
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser } = useAuth();
  const user = authUser || JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
  const [profileImageSrc, setProfileImageSrc] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('appscale-theme', theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    setProfileImageSrc(null);
    const pic = user?.profile_picture;
    if (!pic || typeof pic !== 'string') return;
    const trimmed = pic.trim();
    if (!trimmed) return;
    // If already a data URL or absolute URL, no need to fetch fallback
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
      } catch (e) {
        // ignore and fall back to direct URL
      }
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
      <aside className={`app-sidebar ${isSidebarOpen ? 'w-64 mobile-open' : 'w-16'} text-white flex flex-col h-screen transition-all duration-300 shrink-0`}>
        <div className={`app-sidebar-header flex items-center p-4 border-b ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
          {isSidebarOpen ? (
              <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-2xl bg-white/95 p-1 shadow-lg shadow-black/10 ring-2 ring-white/20">
                  <img src={logo} alt="AppScale logo" className="h-10 w-10 rounded-xl object-contain" />
                </div>
                <div className="min-w-0 leading-none">
                  <span className="block truncate text-lg font-black tracking-tight text-white">AppScale</span>
                  <span className="mt-1 block truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100/75">Health system</span>
                </div>
            </div>
          ) : null}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        

        <nav className="flex-1 overflow-y-auto py-2">
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
                className={`app-sidebar-link ${isActive ? 'is-active font-semibold' : ''} flex items-center gap-3 px-4 py-2 mx-2 rounded-lg mb-0.5 transition-colors duration-150 text-sm`}
              >
                <Icon size={18} />
                {isSidebarOpen && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="app-sidebar-footer app-sidebar-header border-t p-2">
          <button
            onClick={handleLogout}
            className="app-sidebar-link flex items-center gap-3 px-4 py-2 mx-2 w-[calc(100%-1rem)] rounded-lg transition-colors duration-150 text-sm"
          >
            <LogOut size={18} />
            {isSidebarOpen && <span>Logout</span>}
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

      <div className="app-content-shell flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="app-topbar relative z-40 px-2 py-2 flex justify-between items-center gap-3">
          <div className="min-w-0 flex items-center gap-2">
            {!isSidebarOpen && (
              <button
                type="button"
                aria-label="Open sidebar"
                className="md:hidden p-2 rounded-lg text-green-800 hover:bg-green-50"
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu size={20} />
              </button>
            )}
            {currentTitle}
          </div>

          <div className="relative flex items-center gap-2">
            <button
              type="button"
              aria-label="Toggle color theme"
              onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              className="theme-toggle"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              type="button"
              aria-label="Open profile menu"
              aria-expanded={isProfileMenuOpen}
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex items-center gap-2 rounded-full p-1 pr-2 transition hover:bg-green-50"
            >
              <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-green-600 text-sm font-bold text-white shadow-sm ring-1 ring-green-100">
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
              <div className="absolute right-0 top-14 z-100 w-56 rounded-2xl border border-white/10 bg-[#111827] p-2 shadow-2xl shadow-black/30">
                <div className="border-b border-white/10 px-3 py-2">
                  <p className="truncate text-sm font-bold text-white">{user?.full_name || user?.username || "BHW User"}</p>
                  <p className="truncate text-xs text-slate-300">{user?.email || "BHW account"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    navigate('/bhw/profile');
                  }}
                  className="mt-1 flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-200 hover:bg-white/10 hover:text-white"
                >
                  View profile
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
        
        <main className="app-main flex-1 overflow-y-auto p-6" style={{ background: 'var(--canvas)' }}>
          <div key={location.pathname} className="app-route-view">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default BHWLayout;