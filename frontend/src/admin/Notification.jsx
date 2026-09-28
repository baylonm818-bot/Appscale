import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axiosClient from "../api/axiosClient";
import { Calendar, UserCheck, ShieldAlert, Bell, CheckCheck, Clock, ExternalLink } from "lucide-react";

function timeAgo(dateString) {
  if (!dateString) return "Just now";
  const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDate(dateString) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const TYPE_CONFIG = {
  schedule: {
    label: "Schedule",
    color: "bg-emerald-600",
    light: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    icon: Calendar,
  },
  account: {
    label: "Account",
    color: "bg-purple-600",
    light: "bg-purple-50 text-purple-700 ring-1 ring-purple-200",
    icon: UserCheck,
  },
  system: {
    label: "System",
    color: "bg-blue-600",
    light: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    icon: ShieldAlert,
  },
};

function NotificationItem({ notif, onMarkRead }) {
  const typeKey = (notif.type || "").toLowerCase();
  const cfg = TYPE_CONFIG[typeKey] || {
    label: notif.type || "General",
    color: "bg-emerald-700",
    light: "bg-green-50 text-green-700 ring-1 ring-green-200",
    icon: Bell,
  };
  const Icon = cfg.icon;

  return (
    <div
      onClick={() => !notif.is_read && onMarkRead(notif.notification_id)}
      className={`flex gap-4 px-6 py-4.5 border-b border-gray-100 last:border-0 transition-colors ${
        !notif.is_read ? "bg-green-50/40 cursor-pointer hover:bg-green-50/70" : "hover:bg-gray-50/70"
      }`}
    >
      {/* Icon Avatar */}
      <div className={`shrink-0 w-11 h-11 rounded-2xl ${cfg.color} flex items-center justify-center text-white shadow-xs`}>
        <Icon size={20} />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <p className="text-sm font-bold text-gray-900 leading-snug">{notif.title}</p>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${cfg.light}`}>
              {cfg.label}
            </span>
          </div>
          {!notif.is_read && (
            <span
              title="Unread notification"
              className="shrink-0 w-2.5 h-2.5 rounded-full bg-emerald-600 ring-4 ring-emerald-100 mt-1"
            />
          )}
        </div>

        <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
          <Clock size={12} className="shrink-0" />
          <span>{formatDate(notif.created_at)}</span>
          <span>·</span>
          <span className="font-semibold text-emerald-700">{timeAgo(notif.created_at)}</span>
        </div>

        {notif.message && (
          <div className="mt-2.5 bg-gray-50/80 border border-gray-100 rounded-xl px-4 py-2.5 text-xs text-gray-700 leading-relaxed">
            {notif.message}
          </div>
        )}

        {/* Quick action link for schedules */}
        {typeKey === "schedule" && (
          <div className="mt-2.5 flex items-center gap-2">
            <Link
              to="/admin/schedule"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 px-3 py-1 rounded-lg transition"
            >
              <Calendar size={13} /> View in Schedule Calendar <ExternalLink size={11} />
            </Link>
          </div>
        )}

        {typeKey === "account" && (
          <div className="mt-2.5 flex items-center gap-2">
            <Link
              to="/admin/users"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-3 py-1 rounded-lg transition"
            >
              <UserCheck size={13} /> Manage Users <ExternalLink size={11} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [activeTab, setActiveTab]         = useState("all");
  const [loading, setLoading]             = useState(true);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get("/notifications");
      // Explicitly filter out any legacy referral or malnutrition notifications
      const fetched = (res.data.notifications || []).filter(
        (n) => n.type?.toLowerCase() !== "referral" && n.type?.toLowerCase() !== "malnutrition"
      );
      setNotifications(fetched);
      setUnreadCount(res.data.unreadCount || 0);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await axiosClient.patch("/notifications/read-all");
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await axiosClient.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.notification_id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const scheduleCount = notifications.filter((n) => n.type?.toLowerCase() === "schedule").length;
  const accountCount = notifications.filter((n) => ["account", "system"].includes(n.type?.toLowerCase())).length;

  const tabs = [
    { key: "all",      label: "All",               count: notifications.length },
    { key: "unread",   label: "Unread",            count: unreadCount },
    { key: "schedule", label: "Schedules",         count: scheduleCount },
    { key: "account",  label: "Accounts & System", count: accountCount },
  ];

  const filtered = notifications.filter((n) => {
    if (activeTab === "all") return true;
    if (activeTab === "unread") return !n.is_read;
    if (activeTab === "schedule") return n.type?.toLowerCase() === "schedule";
    if (activeTab === "account") return ["account", "system"].includes(n.type?.toLowerCase());
    return n.type?.toLowerCase() === activeTab;
  });

  return (
    <div className="space-y-0">
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100/80">

        {/* Green gradient header */}
        <div className="bg-gradient-to-r from-[#1b5e20] to-[#2e7d32] px-6 py-5 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Bell size={20} className="text-white" />
              <h1 className="text-lg font-bold text-white">Admin Notifications</h1>
            </div>
            <p className="text-white/80 text-xs mt-0.5">
              {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : "All notifications caught up"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-white/20 hover:bg-white/30 px-3.5 py-1.5 rounded-full transition shadow-xs cursor-pointer"
              >
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>
        </div>

        {/* Tab pills */}
        <div className="flex gap-2 px-6 py-3.5 border-b border-gray-100 overflow-x-auto bg-gray-50/60">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.key
                  ? "bg-[#2e7d32] text-white shadow-sm"
                  : "text-gray-600 hover:bg-white bg-transparent"
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    activeTab === tab.key ? "bg-white/25 text-white" : "bg-gray-200/80 text-gray-700"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="max-h-[640px] overflow-y-auto divide-y divide-gray-50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-9 h-9 rounded-full border-4 border-green-200 border-t-green-700 animate-spin" />
              <p className="text-sm font-medium text-gray-400">Loading notifications…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center shadow-xs">
                <Bell className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-sm font-bold text-gray-800">No notifications found</p>
              <p className="text-xs text-gray-400">
                {activeTab === "unread"
                  ? "You have read all your notifications!"
                  : activeTab === "schedule"
                  ? "No schedule activity updates found."
                  : "You're all caught up with your admin alerts."}
              </p>
            </div>
          ) : (
            filtered.map((notif) => (
              <NotificationItem key={notif.notification_id} notif={notif} onMarkRead={handleMarkRead} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default Notifications;