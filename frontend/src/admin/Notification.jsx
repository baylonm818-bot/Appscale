import { useState, useEffect } from "react";
import axiosClient from "../api/axiosClient";

function timeAgo(dateString) {
  const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

const TYPE_CONFIG = {
  referral:     { label: "Referral",     color: "bg-blue-500",    light: "bg-blue-50 text-blue-700"    },
  malnutrition: { label: "Malnutrition", color: "bg-red-500",     light: "bg-red-50 text-red-700"      },
  schedule:     { label: "Schedule",     color: "bg-emerald-500", light: "bg-emerald-50 text-emerald-700" },
};

function NotificationItem({ notif, onMarkRead }) {
  const cfg = TYPE_CONFIG[notif.type?.toLowerCase()] || { color: "bg-green-600", light: "bg-green-50 text-green-700" };
  const initial = (notif.type?.[0] || "N").toUpperCase();

  return (
    <div
      onClick={() => !notif.is_read && onMarkRead(notif.notification_id)}
      className={`flex gap-4 px-6 py-4 border-b border-gray-50 last:border-0 transition-colors
        ${!notif.is_read ? "bg-green-50/50 cursor-pointer hover:bg-green-50" : "hover:bg-gray-50/60"}`}
    >
      {/* Avatar */}
      <div className={`shrink-0 w-10 h-10 rounded-full ${cfg.color} flex items-center justify-center text-white text-sm font-bold shadow-sm`}>
        {initial}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-800 leading-snug">{notif.title}</p>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${cfg.light}`}>
              {notif.type || "General"}
            </span>
          </div>
          {!notif.is_read && (
            <span className="shrink-0 w-2.5 h-2.5 rounded-full bg-green-500 mt-1 ring-2 ring-white" />
          )}
        </div>

        <div className="flex items-center gap-3 mt-1">
          <p className="text-xs text-gray-400">{formatDate(notif.created_at)}</p>
          <span className="text-gray-200">·</span>
          <p className="text-xs font-medium text-green-600">{timeAgo(notif.created_at)}</p>
        </div>

        {notif.message && (
          <div className="mt-2 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm text-gray-600 leading-relaxed">
            {notif.message}
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
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, []);

  const handleMarkAllRead = async () => {
    try { await axiosClient.patch("/notifications/read-all"); fetchNotifications(); }
    catch (err) { console.error(err); }
  };

  const handleMarkRead = async (id) => {
    try { await axiosClient.patch(`/notifications/${id}/read`); fetchNotifications(); }
    catch (err) { console.error(err); }
  };

  const tabs = [
    { key: "all",          label: "All",         count: notifications.length },
    { key: "unread",       label: "Unread",       count: unreadCount },
    { key: "referral",     label: "Referrals"     },
    { key: "malnutrition", label: "Malnutrition"  },
    { key: "schedule",     label: "Schedule"      },
  ];

  const filtered = notifications.filter((n) => {
    if (activeTab === "all")    return true;
    if (activeTab === "unread") return !n.is_read;
    return n.type?.toLowerCase() === activeTab;
  });

  return (
    <div className="space-y-0">
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">

        {/* Green gradient header */}
        <div className="bg-gradient-to-r from-[#1b5e20] to-[#2e7d32] px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Notifications</h1>
            <p className="text-white/70 text-xs mt-0.5">
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full transition"
            >
              ✓✓ Mark all read
            </button>
          )}
        </div>

        {/* Tab pills */}
        <div className="flex gap-1.5 px-6 py-3 border-b border-gray-100 overflow-x-auto bg-gray-50/50">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all
                ${activeTab === tab.key
                  ? "bg-[#2e7d32] text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-100"
                }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold
                  ${activeTab === tab.key ? "bg-white/25 text-white" : "bg-gray-200 text-gray-600"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="max-h-[600px] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 rounded-full border-4 border-green-200 border-t-green-600 animate-spin" />
              <p className="text-sm text-gray-400">Loading notifications…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-500">No notifications</p>
              <p className="text-xs text-gray-400">You're all caught up!</p>
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