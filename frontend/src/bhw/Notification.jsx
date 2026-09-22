import { useState, useEffect } from "react";
import axiosClient from "../api/axiosClient";

function timeAgo(dateString) {
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
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  });
}

function NotificationItem({ notif, onMarkRead }) {
  return (
    <div
      className={`flex gap-3 p-4 border-b border-gray-100 last:border-0 ${
        !notif.is_read ? "bg-green-50/40" : ""
      }`}
      onClick={() => !notif.is_read && onMarkRead(notif.notification_id)}
    >
      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 text-green-700 font-bold text-sm">
        {notif.type?.[0]?.toUpperCase() || "N"}
      </div>

      <div className="flex-1 min-w-0 cursor-pointer">
        <div className="flex justify-between items-start">
          <p className="text-sm font-semibold text-gray-800">{notif.title}</p>
          {!notif.is_read && (
            <span className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
          )}
        </div>

        <div className="flex justify-between items-center mt-1">
          <p className="text-xs text-gray-400">{formatDate(notif.created_at)}</p>
          <p className="text-xs text-gray-400">{timeAgo(notif.created_at)}</p>
        </div>

        {notif.message && (
          <div className="bg-gray-50 rounded-lg p-3 mt-2 text-sm text-gray-600">
            {notif.message}
          </div>
        )}
      </div>
    </div>
  );
}

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/notifications');
      const data = res.data;
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
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
      await axiosClient.patch('/notifications/read-all');
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await axiosClient.patch(`/notifications/${id}/read`);
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  // ✅ Client-side filtering (backend doesn't support filter param)
  const filteredNotifications = notifications.filter((n)=> {
    if (activeTab === "all") return true;
    if (activeTab === "unread") return !n.is_read;
    return n.type?.toLowerCase() === activeTab;
  });

  const tabs = [
    { key: "all", label: "All", count: notifications.length },
    { key: "unread", label: "Unread", count: unreadCount },
    { key: "referral", label: "Referrals" },
    { key: "malnutrition", label: "Malnutrition" },
    { key: "schedule", label: "Schedule" },
  ];

  return (
    <div className="w-full flex justify-center px-4 py-1">
      <div className="w-full bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="flex justify-between items-center px-6 py-5 border-b border-gray-100">
          <h1 className="text-xl font-bold text-gray-900">Your Notifications</h1>
          <button
            onClick={handleMarkAllRead}
            className="text-sm text-green-600 font-semibold hover:underline"
          >
            ✓✓ Mark all as read
          </button>
        </div>

        <div className="flex gap-2 px-6 py-4 border-b border-gray-100 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                activeTab === tab.key
                  ? "bg-green-600 text-white"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`text-xs px-1.5 rounded-full ${
                  activeTab === tab.key ? "bg-white/20" : "bg-gray-100"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="max-h-[500px] overflow-y-auto">
          {loading ? (
            <p className="text-center text-gray-400 py-10 text-sm">Loading...</p>
          ) : filteredNotifications.length === 0 ? (
            <p className="text-center text-gray-400 py-10 text-sm">No notifications found.</p>
          ) : (
            filteredNotifications.map((notif) => (
              <NotificationItem
                key={notif.notification_id}
                notif={notif}
                onMarkRead={handleMarkRead}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default Notifications;