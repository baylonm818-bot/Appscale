import { useState } from "react";
import { motion } from 'framer-motion';
import logo from '../assets/logo.png';
import { useAuth } from '../components/AuthContext';
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { getProfileImageUrl, getUserInitials } from '../api/config';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
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
  { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'User Management', path: '/admin/users', icon: Users },
  { name: 'Master List', path: '/admin/masterlist', icon: ClipboardList },
  { name: 'Schedule', path: '/admin/schedule', icon: Calendar },
  { name: 'Notifications', path: '/admin/notifications', icon: Bell },
  { name: 'Settings', path: '/admin/profile', icon: UserCircle },
];

function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  const pageTitles = {
    '/admin/dashboard': (
      <div className="mb-1 px-4">
        <h2 className="text-xl font-bold text-gray-800">Municipal Dashboard</h2>
        <p className="text-xs text-gray-400">Real-time municipal nutrition and health overview</p>
      </div>
    ),
    '/admin/users': (
      <div className="mb-1 px-4">
        <h2 className="text-xl font-bold text-gray-800">User Management</h2>
        <p className="text-xs text-gray-400">Manage BHW and BNS accounts across all barangays</p>
      </div>
    ),
    '/admin/masterlist': (
      <div className="mb-1 px-4">
        <h2 className="text-xl font-bold text-gray-800">Masterlist Registry</h2>
        <p className="text-xs text-gray-400">Complete registry of registered children and mothers</p>
      </div>
    ),
    '/admin/schedule': (
      <div className="mb-1 px-4">
        <h2 className="text-xl font-bold text-gray-800">Schedule Management</h2>
        <p className="text-xs text-gray-400">Plan and track health activities across municipality</p>
      </div>
    ),
    '/admin/notifications': (
      <div className="mb-1 px-4">
        <h2 className="text-xl font-bold text-gray-800">Notifications</h2>
        <p className="text-xs text-gray-400">View recent alerts, updates, and system messages</p>
      </div>
    ),
    '/admin/profile': (
      <div className="mb-1 px-4">
        <h2 className="text-xl font-bold text-gray-800">Settings & Profile</h2>
        <p className="text-xs text-gray-400">Manage account information, security, and preferences</p>
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
                <span className="mt-1 block truncate text-[10px] font-bold uppercase tracking-[0.16em] text-green-600">Admin Portal</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1 text-center whitespace-nowrap">
              <div className="rounded-2xl bg-white p-1.5 shadow-lg shadow-black/15 ring-2 ring-white/20">
                <img src={logo} alt="AppScale logo" className="h-7 w-7 rounded-lg object-contain" />
              </div>
              <span className="text-[8px] font-black uppercase tracking-[0.18em] text-white">AppScale</span>
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
                key={item.name}
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
                    src={getProfileImageUrl(user.profile_picture)}
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
                  <p className="truncate text-sm font-bold text-gray-900">{user?.full_name || user?.username || "Admin"}</p>
                  <p className="truncate text-xs text-gray-400">{user?.email || "Administrator account"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    navigate('/admin/profile');
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

        <div className="app-main flex-1 overflow-auto p-6">
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.3 }} className="app-route-view"><Outlet /></motion.div>
        </div>
      </div>
    </div>
  );
}

export default AdminLayout;





