import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import axiosInstance from "../utils/axiosInstance";
import { useAuth } from "./AuthContext";
import { Toast } from "../components/common/Toast";

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const popupEnabled =
    user?.notificationPreferences?.popup !== false &&
    user?.notificationPreferences?.inApp !== false;

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [popupToasts, setPopupToasts] = useState([]);

  const pollingRef = useRef(null);
  const mountedRef = useRef(true);
  const initializedRef = useRef(false);
  const knownNotificationIdsRef = useRef(new Set());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!popupEnabled && mountedRef.current) {
      setPopupToasts([]);
    }
  }, [popupEnabled]);

  const clearNotificationState = useCallback(() => {
    if (!mountedRef.current) return;
    setNotifications([]);
    setUnreadCount(0);
    setLoading(false);
    setPopupToasts([]);
    initializedRef.current = false;
    knownNotificationIdsRef.current = new Set();
  }, []);

  const removePopupToast = useCallback((id) => {
    if (!mountedRef.current) return;
    setPopupToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const getToastType = useCallback((notificationType) => {
    if (notificationType === "portal-open" || notificationType === "roster-published") {
      return "success";
    }
    if (notificationType === "portal-closing-soon") {
      return "warning";
    }
    if (notificationType === "portal-closed") {
      return "error";
    }
    return "info";
  }, []);

  const buildPopupToastEntries = useCallback(
    (notificationsToShow, existingToastIds = new Set()) => {
      const nextToasts = [];

      notificationsToShow.slice(0, 3).forEach((notification) => {
        const toastId = `notification-${notification._id}`;
        if (existingToastIds.has(toastId)) return;

        nextToasts.push({
          id: toastId,
          type: getToastType(notification.type),
          title: notification.title,
          message: notification.message,
          duration: 6000,
        });
      });

      return nextToasts;
    },
    [getToastType]
  );

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      if (mountedRef.current) setLoading(true);

      const { data } = await axiosInstance.get("/notifications", {
        params: { limit: 20 },
      });

      if (!mountedRef.current) return;

      const nextNotifications = data?.notifications || [];
      const nextUnreadCount = data?.unreadCount || 0;

      if (initializedRef.current) {
        const knownIds = knownNotificationIdsRef.current;
        const newUnreadNotifications = nextNotifications.filter(
          (notification) => !notification.isRead && !knownIds.has(notification._id)
        );

        if (popupEnabled && newUnreadNotifications.length > 0) {
          setPopupToasts((prev) => {
            const existingIds = new Set(prev.map((toast) => toast.id));
            return [
              ...prev,
              ...buildPopupToastEntries(newUnreadNotifications, existingIds),
            ];
          });
        }
      } else {
        const recentUnreadNotifications = nextNotifications.filter((notification) => {
          if (notification.isRead) return false;

          const createdAtMs = new Date(notification.createdAt).getTime();
          if (!createdAtMs) return false;

          return Date.now() - createdAtMs <= 72 * 60 * 60 * 1000;
        });

        if (popupEnabled && recentUnreadNotifications.length > 0) {
          setPopupToasts((prev) => {
            const existingIds = new Set(prev.map((toast) => toast.id));
            return [
              ...prev,
              ...buildPopupToastEntries(recentUnreadNotifications, existingIds),
            ];
          });
        }

        initializedRef.current = true;
      }

      knownNotificationIdsRef.current = new Set(
        nextNotifications.map((notification) => notification._id)
      );

      setNotifications(nextNotifications);
      setUnreadCount(nextUnreadCount);
    } catch {
      // fail silently
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [buildPopupToastEntries, popupEnabled, user]);

  const markAsRead = useCallback(async (notificationId) => {
    try {
      await axiosInstance.put(`/notifications/${notificationId}/read`);

      if (!mountedRef.current) return;

      setNotifications((prev) =>
        prev.map((n) =>
          n._id === notificationId ? { ...n, isRead: true } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // fail silently
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await axiosInstance.put("/notifications/read-all");

      if (!mountedRef.current) return;

      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // fail silently
    }
  }, []);

  const deleteNotification = useCallback(async (notificationId) => {
    try {
      await axiosInstance.delete(`/notifications/${notificationId}`);

      if (!mountedRef.current) return;

      setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
    } catch {
      // fail silently
    }
  }, []);

  useEffect(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    if (!user) {
      clearNotificationState();
      return;
    }

    fetchNotifications();

    const refreshNotifications = () => {
      fetchNotifications();
    };

    pollingRef.current = setInterval(() => {
      fetchNotifications();
    }, 30000);

    window.addEventListener("focus", refreshNotifications);
    document.addEventListener("visibilitychange", refreshNotifications);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      window.removeEventListener("focus", refreshNotifications);
      document.removeEventListener("visibilitychange", refreshNotifications);
    };
  }, [user, fetchNotifications, clearNotificationState]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
      }}
    >
      {children}
      {popupToasts.length > 0 && (
        <div className="fixed top-20 right-4 z-[80] flex flex-col gap-2">
          {popupToasts.map((toast) => (
            <Toast key={toast.id} {...toast} onClose={removePopupToast} />
          ))}
        </div>
      )}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
};

export default NotificationContext;
