import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from 'framer-motion';
import logo from '../assets/logo.png';
import { useAuth } from '../components/AuthContext';
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { getProfileImageUrl, getUserInitials } from '../api/config';
import axiosClient from '../api/axiosClient';
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
  { name: 'Settings', path: '/admin/profile', icon: UserCircle },
];

function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(null);
  const [notificationPreview, setNotificationPreview] = useState([]);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const notificationRootRef = useRef(null);
  const profileRootRef = useRef(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await axiosClient.get('/notifications');
      const notifications = (response.data?.notifications || []);
      setUnreadNotifications(response.data?.unreadCount ?? 0);
      setNotificationPreview(notifications.slice(0, 4));
    } catch {
      setUnreadNotifications(0);
      setNotificationPreview([]);
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await axiosClient.patch('/notifications/read-all');
      await fetchUnreadCount();
      window.dispatchEvent(new CustomEvent('notifications:updated'));
    } catch {
      // ignore, user can retry if needed
    }
  }, [fetchUnreadCount]);

  // Close dropdowns on route change and listen for external updates
  useEffect(() => {
    fetchUnreadCount();

    const handleNotificationsUpdated = () => fetchUnreadCount();
    window.addEventListener('notifications:updated', handleNotificationsUpdated);
    const poll = window.setInterval(fetchUnreadCount, 15000);

    // Close menus on route change
    setIsNotificationMenuOpen(false);
    setIsProfileMenuOpen(false);

    return () => {
      window.removeEventListener('notifications:updated', handleNotificationsUpdated);
      window.clearInterval(poll);
    };
  }, [fetchUnreadCount, location.pathname]);

  // Close menus on outside click
  useEffect(() => {
    const onDocClick = (ev) => {
      const t = ev.target;
      if (notificationRootRef.current && !notificationRootRef.current.contains(t)) {
        setIsNotificationMenuOpen(false);
      }
      if (profileRootRef.current && !profileRootRef.current.contains(t)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const doLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('user');
    navigate('/login', { replace: true });
  }, [navigate]);

  const handleLogout = () => {
    setIsProfileMenuOpen(false);
    setShowLogoutConfirm(true);
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
                <span className="block truncate text-lg font-black tracking-tight text-white">AppScale</span>
                <span className="mt-1 block truncate text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100">Admin Portal</span>
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
            className="md:hidden p-1.5 rounded-xl hover:bg-green-50 text-gray-600 hover:text-green-800 transition"
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
            <div ref={notificationRootRef} className="relative">
              <button
                type="button"
                aria-label="Notifications"
                aria-expanded={isNotificationMenuOpen}
                onClick={() => {
                  setIsNotificationMenuOpen((prev) => !prev);
                  setIsProfileMenuOpen(false);
                }}
                className="relative flex h-10 w-10 items-center justify-center rounded-full text-green-800 transition hover:bg-green-50"
              >
                <Bell size={19} />
                {unreadNotifications !== null && unreadNotifications > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                  </span>
                )}
              </button>

              {isNotificationMenuOpen && (
                <div className="absolute right-0 top-12 z-50 w-80 rounded-2xl border border-gray-100 bg-white p-2 shadow-2xl shadow-black/15">
                  <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                    <p className="text-sm font-bold text-gray-900">Notifications</p>
                    {unreadNotifications !== null && unreadNotifications > 0 && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">
                        {unreadNotifications} new
                      </span>
                    )}
                  </div>

                  {unreadNotifications !== null && unreadNotifications > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="mt-1 flex w-full items-center justify-center rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-800 transition hover:bg-green-100"
                    >
                      Mark all as read
                    </button>
                  )}

                  <div className="max-h-72 space-y-1 overflow-y-auto py-1">
                    {notificationPreview.length > 0 ? (
                      notificationPreview.map((item) => (
                        <button
                          key={item.notification_id || item.id}
                          type="button"
                          onClick={() => {
                            setIsNotificationMenuOpen(false);
                            navigate('/admin/notifications');
                          }}
                          className="flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-green-50"
                        >
                          <div className={`mt-0.5 h-2.5 w-2.5 rounded-full ${item.is_read ? 'bg-gray-300' : 'bg-green-600'}`} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gray-800">{item.title || 'Notification'}</p>
                            <p className="line-clamp-2 text-xs text-gray-500">{item.message || item.details || 'You have a new update.'}</p>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-5 text-center text-sm text-gray-500">No notifications yet.</div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsNotificationMenuOpen(false);
                      navigate('/admin/notifications');
                    }}
                    className="mt-1 flex w-full items-center justify-center rounded-xl bg-green-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
                  >
                    View all
                  </button>
                </div>
              )}
            </div>

            <div ref={profileRootRef} className="relative">
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
        </div>

        <div className="app-main flex-1 overflow-auto p-6">
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.3 }} className="app-route-view"><Outlet /></motion.div>
        </div>
      </div>

      {/* ── Logout Confirmation Modal ── */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-hidden">
          <div className="bg-white rounded-2xl shadow-2xl shadow-black/20 w-full max-w-sm mx-auto my-auto p-6 max-h-[90vh] flex flex-col overflow-y-auto">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <LogOut size={18} className="text-red-600" />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-base">Log Out</p>
                <p className="text-xs text-gray-400">Admin Portal</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              Are you sure you want to log out? You will need to sign in again to access the portal.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={doLogout}
                className="px-5 py-2 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminLayout;





