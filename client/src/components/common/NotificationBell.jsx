import { useState } from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "../../hooks/useNotifications";
import { timeAgo } from "../../utils/formatDate";
import { cn } from "../../utils/scoreHelpers";

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-primary-700 text-white text-xs rounded-full flex items-center justify-center font-medium">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div className="fixed right-4 top-16 z-[70] w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 animate-slide-down">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-slate-700">
              <h3 className="font-semibold text-gray-900 dark:text-slate-100">Notifications</h3>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="text-xs text-primary-700 dark:text-primary-300 hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-center text-gray-400 dark:text-slate-500 py-8 text-sm">No notifications</p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n._id}
                    onClick={() => !n.isRead && markAsRead(n._id)}
                    className={cn(
                      "p-4 border-b border-gray-50 dark:border-slate-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors",
                      !n.isRead && "bg-primary-50 dark:bg-primary-950/30"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!n.isRead && <div className="w-2 h-2 bg-primary-700 rounded-full mt-1.5 flex-shrink-0" />}
                      <div className={cn("flex-1", n.isRead && "pl-4")}>
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{n.title}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{n.message}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;