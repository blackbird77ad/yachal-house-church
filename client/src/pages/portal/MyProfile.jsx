import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { getMyProfile, updateMyProfile } from "../../services/workerService";
import { changePassword } from "../../services/authService";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import Loader from "../../components/common/Loader";
import { useToast, ToastContainer } from "../../components/common/Toast";
import { formatDate } from "../../utils/formatDate";
import { User, Lock, Eye, EyeOff, Edit2, Save, X, Bell, Smartphone } from "lucide-react";

const getNotificationPreferences = (preferences = {}) => {
  const normalized = {
    inApp: preferences?.inApp !== false,
    popup: preferences?.popup !== false,
    push: preferences?.push !== false,
  };

  if (!normalized.inApp) {
    normalized.popup = false;
  }

  return normalized;
};

const MyProfile = () => {
  const { user, updateUser } = useAuth();
  const { browserSupported, permission, subscribed, subscribe, unsubscribe } =
    usePushNotifications();
  const { toasts, toast, removeToast } = useToast();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "" });
  const [saving, setSaving] = useState(false);

  const [pwForm, setPwForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [prefSaving, setPrefSaving] = useState("");

  useEffect(() => {
    getMyProfile()
      .then(({ worker }) => {
        setProfile(worker);
        setForm({
          fullName: worker.fullName || "",
          phone: worker.phone || "",
        });
      })
      .catch(() => toast.error("Error", "Could not load profile."))
      .finally(() => setLoading(false));
  }, [toast]);

  const notificationPreferences = getNotificationPreferences(
    profile?.notificationPreferences
  );

  const saveNotificationPreferences = async (nextPreferences, successMessage) => {
    const { worker } = await updateMyProfile({
      notificationPreferences: nextPreferences,
    });

    updateUser(worker);
    setProfile(worker);
    toast.success("Updated", successMessage);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setForm({
      fullName: profile?.fullName || "",
      phone: profile?.phone || "",
    });
  };

  const handleSave = async () => {
    if (!form.fullName.trim()) {
      toast.error("Required", "Full name cannot be empty.");
      return;
    }

    setSaving(true);
    try {
      const { worker } = await updateMyProfile({
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
      });

      updateUser(worker);
      setProfile(worker);
      setEditMode(false);
      toast.success("Updated", "Your profile has been updated.");
    } catch (err) {
      toast.error("Error", err.response?.data?.message || "Could not update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error("Mismatch", "New passwords do not match.");
      return;
    }

    if (pwForm.newPassword.length < 6) {
      toast.error("Too short", "Password must be at least 6 characters.");
      return;
    }

    if (pwForm.currentPassword === pwForm.newPassword) {
      toast.error("Invalid", "New password must be different from current password.");
      return;
    }

    setPwLoading(true);
    try {
      await changePassword({
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });

      toast.success("Password changed", "Your password has been updated successfully.");
      setPwForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setShowCurrentPw(false);
      setShowNewPw(false);
      setShowConfirmPw(false);
    } catch (err) {
      toast.error("Error", err.response?.data?.message || "Could not change password.");
    } finally {
      setPwLoading(false);
    }
  };

  const handlePreferenceToggle = async (key) => {
    const currentPreferences = getNotificationPreferences(
      profile?.notificationPreferences
    );
    let nextPreferences = {
      ...currentPreferences,
      [key]: !currentPreferences[key],
    };

    if (key === "inApp" && !nextPreferences.inApp) {
      nextPreferences = { ...nextPreferences, popup: false };
    }

    if (key === "popup" && !currentPreferences.inApp && !currentPreferences.popup) {
      toast.error("Turn on in-app first", "Enable in-app notifications before popup alerts.");
      return;
    }

    setPrefSaving(key);

    try {
      if (key === "push") {
        if (nextPreferences.push) {
          if (!browserSupported) {
            toast.error(
              "Not supported",
              "This browser does not support push notifications."
            );
            return;
          }

          if (permission === "denied") {
            toast.error(
              "Blocked by browser",
              "Allow notifications in your browser settings, then try again."
            );
            return;
          }

          const enabled = subscribed || (await subscribe());
          if (!enabled) {
            toast.error(
              "Not enabled",
              "Push notifications were not enabled. Check your browser prompt and try again."
            );
            return;
          }

          localStorage.removeItem("push_prompt_dismissed");
        } else {
          await unsubscribe();
        }
      }

      await saveNotificationPreferences(
        nextPreferences,
        key === "inApp"
          ? nextPreferences.inApp
            ? "In-app notifications are on."
            : "In-app notifications are off."
          : key === "popup"
            ? nextPreferences.popup
              ? "Popup alerts are on."
              : "Popup alerts are off."
            : nextPreferences.push
              ? "Push notifications are on."
              : "Push notifications are off."
      );
    } catch (err) {
      toast.error(
        "Error",
        err.response?.data?.message || "Could not update notification settings."
      );
    } finally {
      setPrefSaving("");
    }
  };

  if (loading) return <Loader text="Loading profile..." />;

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div>
        <h1 className="section-title">My Profile</h1>
        <p className="section-subtitle">Manage your account details, notifications, and password</p>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h2 className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <User className="w-4 h-4 text-purple-600" /> Personal Details
          </h2>

          {!editMode ? (
            <button
              onClick={() => setEditMode(true)}
              className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleCancelEdit}
                className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-slate-700">
          <div className="w-16 h-16 rounded-full bg-purple-600 text-white text-2xl font-bold flex items-center justify-center flex-shrink-0">
            {user?.fullName?.charAt(0)?.toUpperCase() || "U"}
          </div>

          <div>
            <p className="font-bold text-gray-900 dark:text-slate-100 text-lg">
              {profile?.fullName}
            </p>
            <p className="text-sm text-gray-500 dark:text-slate-400 capitalize">
              {profile?.role} - {profile?.department?.replace(/-/g, " ")}
            </p>

            {profile?.workerId && (
              <div className="inline-flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 px-3 py-1 rounded-lg mt-2">
                <span className="text-xs text-purple-600 dark:text-purple-400">
                  Worker ID
                </span>
                <span className="font-bold text-purple-700 dark:text-purple-300 tracking-widest">
                  {profile.workerId}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="form-label">Full Name</label>
            {editMode ? (
              <input
                className="input-field"
                value={form.fullName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, fullName: e.target.value }))
                }
              />
            ) : (
              <p className="text-sm text-gray-900 dark:text-slate-100 py-2">
                {profile?.fullName}
              </p>
            )}
          </div>

          <div>
            <label className="form-label">Email</label>
            <p className="text-sm text-gray-900 dark:text-slate-100 py-2">
              {profile?.email}
            </p>
          </div>

          <div>
            <label className="form-label">Phone</label>
            {editMode ? (
              <input
                className="input-field"
                placeholder="+233 XXX XXX XXX"
                value={form.phone}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, phone: e.target.value }))
                }
              />
            ) : (
              <p className="text-sm text-gray-900 dark:text-slate-100 py-2">
                {profile?.phone || "Not set"}
              </p>
            )}
          </div>

          <div>
            <label className="form-label">Department</label>
            <p className="text-sm text-gray-900 dark:text-slate-100 py-2 capitalize">
              {profile?.department?.replace(/-/g, " ") || "Unassigned"}
            </p>
          </div>

          <div>
            <label className="form-label">Account Status</label>
            <span
              className={`mt-2 inline-block ${
                profile?.status === "approved" ? "badge-success" : "badge-warning"
              }`}
            >
              {profile?.status}
            </span>
          </div>

          <div>
            <label className="form-label">Member Since</label>
            <p className="text-sm text-gray-900 dark:text-slate-100 py-2">
              {formatDate(profile?.createdAt)}
            </p>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2 mb-2">
          <Bell className="w-4 h-4 text-purple-600" /> Notification Settings
        </h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
          Choose how the system should reach you. Push notifications still need browser permission the first time you enable them.
        </p>

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
            <div className="min-w-0">
              <p className="font-medium text-gray-900 dark:text-slate-100">
                In-app notifications
              </p>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Show new alerts in your notification bell inside the app.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handlePreferenceToggle("inApp")}
              disabled={prefSaving === "inApp"}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                notificationPreferences.inApp
                  ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800"
                  : "bg-gray-50 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
              }`}
            >
              {prefSaving === "inApp"
                ? "Saving..."
                : notificationPreferences.inApp
                  ? "On"
                  : "Off"}
            </button>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
            <div className="min-w-0">
              <p className="font-medium text-gray-900 dark:text-slate-100">
                Popup alerts
              </p>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Show quick popup alerts on screen when new notifications arrive while you are signed in.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handlePreferenceToggle("popup")}
              disabled={prefSaving === "popup" || !notificationPreferences.inApp}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                notificationPreferences.popup
                  ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800"
                  : "bg-gray-50 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
              } ${!notificationPreferences.inApp ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              {prefSaving === "popup"
                ? "Saving..."
                : notificationPreferences.popup
                  ? "On"
                  : "Off"}
            </button>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
            <div className="min-w-0">
              <p className="font-medium text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-purple-500" /> Push notifications
              </p>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Send alerts to this browser even when the app is closed.
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
                Browser support: {browserSupported ? "Available" : "Not supported"} • Permission: {permission} • Subscription: {subscribed ? "Active" : "Inactive"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handlePreferenceToggle("push")}
              disabled={prefSaving === "push"}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                notificationPreferences.push
                  ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800"
                  : "bg-gray-50 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
              }`}
            >
              {prefSaving === "push"
                ? "Saving..."
                : notificationPreferences.push
                  ? "On"
                  : "Off"}
            </button>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2 mb-6">
          <Lock className="w-4 h-4 text-purple-600" /> Change Password
        </h2>

        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
          <div>
            <label className="form-label">Current Password</label>
            <div className="relative">
              <input
                type={showCurrentPw ? "text" : "password"}
                className="input-field pr-10"
                placeholder="Your current password"
                value={pwForm.currentPassword}
                onChange={(e) =>
                  setPwForm((prev) => ({ ...prev, currentPassword: e.target.value }))
                }
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPw((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="form-label">New Password</label>
            <div className="relative">
              <input
                type={showNewPw ? "text" : "password"}
                className="input-field pr-10"
                placeholder="At least 6 characters"
                value={pwForm.newPassword}
                onChange={(e) =>
                  setPwForm((prev) => ({ ...prev, newPassword: e.target.value }))
                }
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPw((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="form-label">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirmPw ? "text" : "password"}
                className="input-field pr-10"
                placeholder="Repeat new password"
                value={pwForm.confirmPassword}
                onChange={(e) =>
                  setPwForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                }
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPw((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={pwLoading}
            className="btn-primary flex items-center gap-2"
          >
            <Lock className="w-4 h-4" />
            {pwLoading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default MyProfile;
