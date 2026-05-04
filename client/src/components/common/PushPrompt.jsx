import { useState } from "react";
import { Bell, X } from "lucide-react";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import { useAuth } from "../../hooks/useAuth";

const PushPrompt = () => {
  const { user } = useAuth();
  const pushEnabled = user?.notificationPreferences?.push !== false;
  const { browserSupported, permission, subscribed, subscribe } = usePushNotifications();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem("push_prompt_dismissed") === "true"
  );
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Don't show if already subscribed, denied, or dismissed
  if (
    !user ||
    !pushEnabled ||
    !browserSupported ||
    subscribed ||
    permission === "denied" ||
    dismissed ||
    done
  ) {
    return null;
  }

  const handleEnable = async () => {
    setLoading(true);
    const result = await subscribe();
    setLoading(false);
    if (result) setDone(true);
  };

  const handleDismiss = () => {
    localStorage.setItem("push_prompt_dismissed", "true");
    setDismissed(true);
  };

  return (
    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4 flex items-start gap-3">
      <div className="w-9 h-9 bg-purple-100 dark:bg-purple-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
        <Bell className="w-4 h-4 text-purple-600 dark:text-purple-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-purple-900 dark:text-purple-200">
          Enable push notifications
        </p>
        <p className="text-xs text-purple-700 dark:text-purple-400 mt-0.5 leading-relaxed">
          Get notified when the portal opens, closes, and when your roster is published. Works even when the app is closed, and you can turn it off later from My Profile.
        </p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleEnable}
            disabled={loading}
            className="btn-primary text-xs py-1.5 px-3"
          >
            {loading ? "Enabling..." : "Enable Notifications"}
          </button>
          <button
            onClick={handleDismiss}
            className="btn-ghost text-xs py-1.5 px-3"
          >
            Not now
          </button>
        </div>
      </div>
      <button onClick={handleDismiss} className="text-purple-400 hover:text-purple-600 flex-shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default PushPrompt;
