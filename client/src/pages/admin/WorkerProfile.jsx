import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, UserCheck, UserX, Edit2, Save, X, Key, CheckCircle, XCircle } from "lucide-react";
import { getWorkerById, updateWorker, getWorkerMetrics } from "../../services/workerService";
import { approveWorker, suspendWorker, reinstateWorker } from "../../services/authService";
import axiosInstance from "../../utils/axiosInstance";
import ScoreBadge from "../../components/common/ScoreBadge";
import Loader from "../../components/common/Loader";
import { useToast, ToastContainer } from "../../components/common/Toast";
import { getCriteriaStatus } from "../../utils/scoreHelpers";
import { formatDate, getWeekLabel } from "../../utils/formatDate";
import { DEPARTMENTS } from "../../utils/constants";

const WorkerProfile = () => {
  const { workerId } = useParams();
  const { toasts, toast, removeToast } = useToast();
  const [worker, setWorker] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const [wRes, mRes] = await Promise.all([
        getWorkerById(workerId),
        getWorkerMetrics(workerId).catch(() => ({ metrics: [] })),
      ]);
      setWorker(wRes.worker);
      setForm({
        fullName: wRes.worker.fullName,
        phone: wRes.worker.phone || "",
        department: wRes.worker.department || "unassigned",
        role: wRes.worker.role,
        isRotating: wRes.worker.isRotating || false,
      });
      setMetrics(mRes.metrics?.slice(0, 4) || []);
    } catch {
      toast.error("Error", "Could not load worker.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [workerId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { worker: w } = await updateWorker(workerId, form);
      setWorker(w);
      setEditing(false);
      toast.success("Updated", "Worker profile updated.");
    } catch {
      toast.error("Error", "Could not update.");
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    try {
      await approveWorker(worker._id);
      toast.success("Approved", "Worker approved and ID assigned.");
      fetchData();
    } catch (err) {
      toast.error("Error", err.response?.data?.message || "Could not approve.");
    }
  };

  const handleSuspend = async () => {
    if (!confirm("Suspend this worker?")) return;
    try {
      await suspendWorker(worker._id);
      toast.success("Suspended", "Worker suspended.");
      fetchData();
    } catch {
      toast.error("Error", "Could not suspend.");
    }
  };

  const handleReinstate = async () => {
    try {
      await reinstateWorker(worker._id);
      toast.success("Reinstated", "Worker reinstated.");
      fetchData();
    } catch {
      toast.error("Error", "Could not reinstate.");
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset this worker's password? A temporary password will be emailed to them.")) return;
    try {
      await axiosInstance.put(`/auth/reset-password/${worker._id}`);
      toast.success("Password reset", `New credentials sent to ${worker.email}.`);
    } catch {
      toast.error("Error", "Could not reset password.");
    }
  };

  if (loading) return <Loader text="Loading worker profile..." />;
  if (!worker) return <div className="card p-8 text-center text-gray-400">Worker not found.</div>;

  const latestMetric = metrics[0];
  const criteria = getCriteriaStatus(latestMetric?.qualificationBreakdown);

  return (
    <div className="space-y-6 animate-fade-in">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Link
          to="/admin/workers"
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors w-fit"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="section-title truncate">{worker.fullName}</h1>
          <p className="section-subtitle capitalize">{worker.role} - {worker.department?.replace(/-/g, " ")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {worker.status === "pending" && (
            <button onClick={handleApprove} className="btn-secondary flex items-center gap-2 text-sm">
              <UserCheck className="w-4 h-4" /> Approve
            </button>
          )}
          {worker.status === "approved" && (
            <>
              <button onClick={handleReset} className="btn-outline flex items-center gap-2 text-sm">
                <Key className="w-4 h-4" /> Reset Password
              </button>
              <button onClick={handleSuspend} className="btn-danger flex items-center gap-2 text-sm">
                <UserX className="w-4 h-4" /> Suspend
              </button>
            </>
          )}
          {worker.status === "suspended" && (
            <button onClick={handleReinstate} className="btn-secondary flex items-center gap-2 text-sm">
              <UserCheck className="w-4 h-4" /> Reinstate
            </button>
          )}
          {!editing ? (
            <button onClick={() => setEditing(true)} className="btn-outline flex items-center gap-2 text-sm">
              <Edit2 className="w-4 h-4" /> Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="btn-ghost text-sm flex items-center gap-1">
                <X className="w-4 h-4" /> Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-primary text-sm flex items-center gap-1">
                <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-2xl font-bold flex items-center justify-center mx-auto mb-4">
            {worker.fullName?.charAt(0)}
          </div>
          {worker.workerId && (
            <div className="inline-flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 px-4 py-2 rounded-xl mb-4">
              <span className="text-xs text-purple-600 dark:text-purple-400">Worker ID</span>
              <span className="font-bold text-purple-700 dark:text-purple-300 tracking-widest text-lg">{worker.workerId}</span>
            </div>
          )}
          <div className="mb-3">
            <ScoreBadge score={worker.score || 0} isQualified={worker.isQualified} />
          </div>
          <div>
            {worker.status === "approved" && <span className="badge-success">Approved</span>}
            {worker.status === "pending" && <span className="badge-warning">Pending</span>}
            {worker.status === "suspended" && <span className="badge-danger">Suspended</span>}
          </div>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-3">Member since {formatDate(worker.createdAt)}</p>
        </div>

        <div className="card p-6 lg:col-span-2">
          <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-5">Profile Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Full Name</label>
              {editing
                ? <input className="input-field" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
                : <p className="text-sm text-gray-900 dark:text-slate-100 py-2">{worker.fullName}</p>
              }
            </div>
            <div>
              <label className="form-label">Email</label>
              <p className="text-sm text-gray-900 dark:text-slate-100 py-2">{worker.email}</p>
            </div>
            <div>
              <label className="form-label">Phone</label>
              {editing
                ? <input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                : <p className="text-sm text-gray-900 dark:text-slate-100 py-2">{worker.phone || "Not set"}</p>
              }
            </div>
            <div>
              <label className="form-label">Department</label>
              {editing
                ? <select className="input-field" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                    {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                : <p className="text-sm text-gray-900 dark:text-slate-100 py-2 capitalize">{worker.department?.replace(/-/g, " ") || "Unassigned"}</p>
              }
            </div>
            <div>
              <label className="form-label">Role</label>
              {editing
                ? <select className="input-field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    <option value="worker">Worker</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                  </select>
                : <p className="text-sm text-gray-900 dark:text-slate-100 py-2 capitalize">{worker.role}</p>
              }
            </div>
            <div>
              <label className="form-label">Rotating</label>
              {editing
                ? <label className="flex items-center gap-2 cursor-pointer py-2">
                    <input type="checkbox" className="w-4 h-4 accent-purple-600" checked={form.isRotating} onChange={(e) => setForm({ ...form, isRotating: e.target.checked })} />
                    <span className="text-sm text-gray-700 dark:text-slate-300">Worker rotates departments</span>
                  </label>
                : <p className="text-sm text-gray-900 dark:text-slate-100 py-2">{worker.isRotating ? "Yes" : "No"}</p>
              }
            </div>
          </div>
        </div>
      </div>

      {latestMetric && (
        <div className="card p-6">
          <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-1">Current Week Qualification</h3>
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-5">{getWeekLabel(latestMetric.weekReference)}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {criteria.map((c) => (
              <div key={c.key} className={`flex items-center gap-3 p-3 rounded-xl border ${c.passed ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20" : "border-gray-100 dark:border-slate-700"}`}>
                {c.passed
                  ? <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  : <XCircle className="w-5 h-5 text-gray-300 dark:text-slate-600 flex-shrink-0" />
                }
                <p className="text-xs text-gray-700 dark:text-slate-300">{c.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkerProfile;