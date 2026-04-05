import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { getMyProfile, updateMyProfile } from "../../services/workerService";
import { changePassword } from "../../services/authService";
import Loader from "../../components/common/Loader";
import { useToast, ToastContainer } from "../../components/common/Toast";
import { formatDate } from "../../utils/formatDate";
import { User, Lock, Eye, EyeOff, Edit2, Save, X } from "lucide-react";

const MyProfile = () => {
  const { user, updateUser } = useAuth();
  const { toasts, toast, removeToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showPw, setShowPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    getMyProfile()
      .then(({ worker }) => {
        setProfile(worker);
        setForm({ fullName: worker.fullName, phone: worker.phone || "" });
      })
      .catch(() => toast.error("Error", "Could not load profile."))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { worker } = await updateMyProfile(form);
      updateUser(worker);
      setProfile(worker);
      setEditMode(false);
      toast.success("Updated", "Your profile has been updated.");
    } catch { toast.error("Error", "Could not update profile."); }
    finally { setSaving(false); }
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
    setPwLoading(true);
    try {
      await changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      toast.success("Password changed", "Your password has been updated successfully.");
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      toast.error("Error", err.response?.data?.message || "Could not change password.");
    } finally { setPwLoading(false); }
  };

  if (loading) return <Loader text="Loading profile..." />;

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div>
        <h1 className="section-title">My Profile</h1>
        <p className="section-subtitle">Manage your account details and password</p>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <User className="w-4 h-4 text-purple-600" /> Personal Details
          </h2>
          {!editMode
            ? <button onClick={() => setEditMode(true)} className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1.5"><Edit2 className="w-3.5 h-3.5" /> Edit</button>
            : <div className="flex gap-2">
                <button onClick={() => setEditMode(false)} className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1"><X className="w-3.5 h-3.5" /> Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"><Save className="w-3.5 h-3.5" />{saving ? "Saving..." : "Save"}</button>
              </div>
          }
        </div>

        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-slate-700">
          <div className="w-16 h-16 rounded-full bg-purple-600 text-white text-2xl font-bold flex items-center justify-center flex-shrink-0">
            {user?.fullName?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-gray-900 dark:text-slate-100 text-lg">{profile?.fullName}</p>
            <p className="text-sm text-gray-500 dark:text-slate-400 capitalize">{profile?.role} - {profile?.department?.replace(/-/g, " ")}</p>
            {profile?.workerId && (
              <div className="inline-flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 px-3 py-1 rounded-lg mt-2">
                <span className="text-xs text-purple-600 dark:text-purple-400">Worker ID</span>
                <span className="font-bold text-purple-700 dark:text-purple-300 tracking-widest">{profile.workerId}</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="form-label">Full Name</label>
            {editMode
              ? <input className="input-field" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              : <p className="text-sm text-gray-900 dark:text-slate-100 py-2">{profile?.fullName}</p>
            }
          </div>
          <div>
            <label className="form-label">Email</label>
            <p className="text-sm text-gray-900 dark:text-slate-100 py-2">{profile?.email}</p>
          </div>
          <div>
            <label className="form-label">Phone</label>
            {editMode
              ? <input className="input-field" placeholder="+233 XXX XXX XXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              : <p className="text-sm text-gray-900 dark:text-slate-100 py-2">{profile?.phone || "Not set"}</p>
            }
          </div>
          <div>
            <label className="form-label">Department</label>
            <p className="text-sm text-gray-900 dark:text-slate-100 py-2 capitalize">{profile?.department?.replace(/-/g, " ") || "Unassigned"}</p>
          </div>
          <div>
            <label className="form-label">Account Status</label>
            <span className={`mt-2 inline-block ${profile?.status === "approved" ? "badge-success" : "badge-warning"}`}>
              {profile?.status}
            </span>
          </div>
          <div>
            <label className="form-label">Member Since</label>
            <p className="text-sm text-gray-900 dark:text-slate-100 py-2">{formatDate(profile?.createdAt)}</p>
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
                type={showPw ? "text" : "password"}
                className="input-field pr-10"
                placeholder="Your current password"
                value={pwForm.currentPassword}
                onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                required
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="form-label">New Password</label>
            <input type="password" className="input-field" placeholder="At least 6 characters" value={pwForm.newPassword} onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} required />
          </div>
          <div>
            <label className="form-label">Confirm New Password</label>
            <input type="password" className="input-field" placeholder="Repeat new password" value={pwForm.confirmPassword} onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })} required />
          </div>
          <button type="submit" disabled={pwLoading} className="btn-primary flex items-center gap-2">
            <Lock className="w-4 h-4" />{pwLoading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default MyProfile;