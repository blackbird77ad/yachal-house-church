import { Bell, CheckCheck, Trash2, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../hooks/useNotifications";
import { timeAgo } from "../../utils/formatDate";
import { cn } from "../../utils/scoreHelpers";
import Loader from "../../components/common/Loader";

const typeColors = {
  "portal-open": "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  "portal-closing-soon": "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  "portal-closed": "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  "account-approved": "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  "roster-published": "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
  "qualification-result": "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  general: "bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300",
};

const Notifications = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification } = useNotifications();

  const handleClick = (n) => {
    if (!n.isRead) markAsRead(n._id);
    if (n.link) navigate(n.link);
  };

  if (loading) return <Loader text="Loading notifications..." />;

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Notifications</h1>
          <p className="section-subtitle">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllAsRead} className="btn-outline text-sm flex items-center gap-2">
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="card p-16 text-center">
          <Bell className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-2">No notifications yet</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400">You will receive alerts here for portal updates, roster assignments and more.</p>
        </div>
      ) : (
        <div className="card divide-y divide-gray-100 dark:divide-slate-700">
          {notifications.map((n) => (
            <div
              key={n._id}
              className={cn(
                "flex items-start gap-4 p-5 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors group",
                !n.isRead && "bg-purple-50/50 dark:bg-purple-900/10"
              )}
              onClick={() => handleClick(n)}
            >
              {!n.isRead && <div className="w-2 h-2 bg-purple-600 rounded-full flex-shrink-0 mt-2" />}
              <div className={cn("flex-1 min-w-0", n.isRead && "pl-6")}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className={cn("text-sm font-semibold", n.isRead ? "text-gray-700 dark:text-slate-300" : "text-gray-900 dark:text-slate-100")}>
                    {n.title}
                  </p>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full flex-shrink-0", typeColors[n.type] || typeColors.general)}>
                    {n.type?.replace(/-/g, " ")}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-2">{n.message}</p>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 dark:text-slate-500">{timeAgo(n.createdAt)}</span>
                  {n.link && <ExternalLink className="w-3 h-3 text-gray-400 dark:text-slate-500" />}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteNotification(n._id); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;