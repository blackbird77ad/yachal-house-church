import { useState } from "react";
import { Lock, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { changePassword } from "../services/authService";
import { useAuth } from "../hooks/useAuth";

const MustChangePassword = () => {
  const { updateUser, logout } = useAuth();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.newPassword.length < 6) { setError("New password must be at least 6 characters."); return; }
    if (form.newPassword !== form.confirmPassword) { setError("Passwords do not match."); return; }
    if (form.newPassword === form.currentPassword) { setError("New password must be different from your current password."); return; }
    setLoading(true);
    try {
      await changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      updateUser({ mustChangePassword: false });
    } catch (err) {
      setError(err.response?.data?.message || "Could not change password.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/yahal.png" alt="Yachal House" className="h-14 w-auto mx-auto mb-4" />
        </div>

        <div className="card p-8">
          <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Password change required</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                Your account was set up by an administrator. You must change your password before you can access the portal. Use the password provided to you as your current password.
              </p>
            </div>
          </div>

          <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-5">Set Your New Password</h2>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 text-sm mb-5">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">Current Password (as given by admin)</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  className="input-field pr-10"
                  placeholder="Enter the password you were given"
                  value={form.currentPassword}
                  onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                  required
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="form-label">New Password</label>
              <input type="password" className="input-field" placeholder="At least 6 characters" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} required />
            </div>
            <div>
              <label className="form-label">Confirm New Password</label>
              <input type="password" className="input-field" placeholder="Repeat new password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
              <Lock className="w-4 h-4" />
              {loading ? "Updating..." : "Set New Password and Continue"}
            </button>
          </form>

          <button onClick={logout} className="w-full text-center text-sm text-gray-400 dark:text-slate-500 hover:text-red-500 mt-4">
            Sign out
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-slate-500 mt-6">
          Forgot your admin-given password? Contact your admin or moderator directly.
        </p>
      </div>
    </div>
  );
};

export default MustChangePassword;