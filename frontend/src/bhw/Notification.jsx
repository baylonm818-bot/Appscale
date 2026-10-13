import { useState } from "react";
import { Link } from "react-router-dom";
import axiosClient from "../api/axiosClient";
import { useQuery } from '@tanstack/react-query';
import { Bell, Calendar, UserCheck, AlertCircle, FileText, CheckCheck, Clock, ExternalLink, ArrowRight } from "lucide-react";

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

function cleanNotificationMessage(rawMessage) {
  if (!rawMessage) return "";
  let msg = rawMessage.replace(/\s*\(Status:\s*[^)]+\)/gi, '');
  if (msg.includes(' ay Completed') || msg.includes('Referral ni ')) {
    msg = msg.replace(/Referral ni (.*?) ay Completed\./gi, 'Referral completed for $1.');
    msg = msg.replace(/Referral ni (.*?) ay (.*?)\./gi, 'Referral for $1 is now $2.');
  }
  return msg;
}

const TYPE_CONFIG = {
  referral: {
    label: "Referral",
    color: "bg-blue-600",
    light: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    icon: FileText,
  },
  malnutrition: {
    label: "Malnutrition Alert",
    color: "bg-rose-600",
    light: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    icon: AlertCircle,
  },
  alert: {
    label: "Clinical Alert",
    color: "bg-amber-600",
    light: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    icon: AlertCircle,
  },
  schedule: {
    label: "Schedule",
    color: "bg-emerald-600",
    light: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    icon: Calendar,
  },
  visit: {
    label: "Health Visit",
    color: "bg-teal-600",
    light: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",
    icon: UserCheck,
  },
};

function NotificationItem({ notif, onMarkRead }) {
  const typeKey = (notif.type || '').toLowerCase();
  const cfg = TYPE_CONFIG[typeKey] || {
    label: notif.type ? notif.type.charAt(0).toUpperCase() + notif.type.slice(1) : 'Notice',
    color: 'bg-emerald-700',
    light: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    icon: Bell,
  };
  const Icon = cfg.icon;
  const message = cleanNotificationMessage(notif.message);

  return (
    <div
      onClick={() => !notif.is_read && onMarkRead(notif.notification_id)}
      className={`group flex gap-4 px-6 py-4.5 border-b border-gray-100 last:border-0 transition-all ${
        !notif.is_read
          ? 'bg-green-50/40 cursor-pointer hover:bg-green-50/70'
          : 'hover:bg-gray-50/70'
      }`}
    >
      <div className={`shrink-0 w-11 h-11 rounded-2xl ${cfg.color} flex items-center justify-center text-white shadow-xs`}>
        <Icon size={20} />
      </div>

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

        {message && (
          <div className="mt-2.5 bg-gray-50/80 border border-gray-100 rounded-xl px-4 py-2.5 text-xs text-gray-700 leading-relaxed font-normal">
            {message}
          </div>
        )}

        {/* Action shortcuts */}
        {typeKey === 'referral' && (
          <div className="mt-2.5 flex items-center gap-2">
            <Link
              to="/bhw/referrals"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-lg transition"
            >
              <FileText size={13} /> View Referrals <ArrowRight size={11} />
            </Link>
          </div>
        )}

        {typeKey === 'schedule' && (
          <div className="mt-2.5 flex items-center gap-2">
            <Link
              to="/bhw/schedule"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 px-3 py-1 rounded-lg transition"
            >
              <Calendar size={13} /> View in Schedule <ExternalLink size={11} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function Notifications() {
  const [activeTab, setActiveTab] = useState('all');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await axiosClient.get('/bhw/notifications');
      return res.data;
    },
    staleTime: 1000 * 20,
    gcTime: 1000 * 60 * 2,
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  const handleMarkAllRead = async () => {
    try {
      await axiosClient.patch('/bhw/notifications/read-all');
      await refetch();
      window.dispatchEvent(new CustomEvent('notifications:updated'));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await axiosClient.patch(`/bhw/notifications/${id}/read`);
      await refetch();
      window.dispatchEvent(new CustomEvent('notifications:updated'));
    } catch (err) {
      console.error(err);
    }
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
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">

        {/* Green gradient header */}
        <div className="bg-linear-to-r from-[#1b5e20] to-[#2e7d32] px-6 py-5 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Bell size={20} className="text-white" />
              <h1 className="text-lg font-bold text-white">Barangay Notifications</h1>
            </div>
            <p className="text-white/80 text-xs mt-0.5">
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Loading…
                </span>
              ) : (
                (unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'All notifications caught up')
              )}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-white/20 hover:bg-white/30 px-3.5 py-1.5 rounded-full transition shadow-xs cursor-pointer"
            >
              <CheckCheck size={14} /> Mark all read
            </button>
          )}
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
                  ? 'bg-[#2e7d32] text-white shadow-xs'
                  : 'text-gray-600 hover:bg-white bg-transparent'
              }`}
            >
              <span>{tab.label}</span>
              {!isLoading && tab.count !== undefined && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${activeTab === tab.key ? 'bg-white/25 text-white' : 'bg-gray-200/80 text-gray-700'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="max-h-160 overflow-y-auto divide-y divide-gray-50">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse flex gap-4 items-center px-4 py-3">
                  <div className="w-10 h-10 rounded-2xl bg-gray-200 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-gray-200 rounded w-2/5" />
                    <div className="h-3 bg-gray-200 rounded w-4/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center shadow-xs">
                <Bell className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-sm font-bold text-gray-800">No notifications found</p>
              <p className="text-xs text-gray-400">
                {activeTab === 'unread'
                  ? 'You have read all your notifications!'
                  : activeTab === 'schedule'
                  ? 'No schedule activity updates found.'
                  : "You're all caught up with your barangay alerts."}
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