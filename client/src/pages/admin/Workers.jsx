import { useState, useEffect } from "react";
import {
  Search, UserCheck, UserX, ChevronRight, UserPlus,
  Download, Eye, EyeOff, Copy, CheckCircle, RefreshCw, Mail,
} from "lucide-react";
import { Link } from "react-router-dom";
import { getAllWorkers } from "../../services/workerService";
import {
  approveWorker, suspendWorker, reinstateWorker,
  adminCreateWorker, adminBulkCreateWorkers,
} from "../../services/authService";
import Loader from "../../components/common/Loader";
import Modal from "../../components/common/Modal";
import { useToast, ToastContainer } from "../../components/common/Toast";
import { formatDate } from "../../utils/formatDate";
import { DEPARTMENTS } from "../../utils/constants";

const ROLES = [
  { value: "worker", label: "Worker" },
  { value: "moderator", label: "Moderator" },
  { value: "admin", label: "Admin" },
];

const Workers = () => {
  const { toasts, toast, removeToast } = useToast();

  // ── Table state ───────────────────────────────────────────────
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // ── Single add state ──────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdWorker, setCreatedWorker] = useState(null);
  const [showPw, setShowPw] = useState(false);
  const [copied, setCopied] = useState("");
  const [createForm, setCreateForm] = useState({
    fullName: "", email: "", phone: "",
    department: "unassigned", role: "worker",
    password: "", confirmPassword: "",
  });

  // ── Bulk add state ────────────────────────────────────────────
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkCreating, setBulkCreating] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [pastedEmails, setPastedEmails] = useState("");
  const [bulkPhone, setBulkPhone] = useState("");
  const [bulkDept, setBulkDept] = useState("unassigned");
  const [bulkRole, setBulkRole] = useState("worker");
  const [bulkPassword, setBulkPassword] = useState("");
  const [bulkConfirmPassword, setBulkConfirmPassword] = useState("");
  const [showBulkPw, setShowBulkPw] = useState(false);

  // Derived: valid emails from textarea
  const parsedEmails = pastedEmails
    .split(/[\n,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

  // ── Fetch workers ─────────────────────────────────────────────
  const fetchWorkers = async () => {
    setLoading(true);
    try {
      const params = statusFilter !== "all" ? { status: statusFilter } : {};
      const { workers: data } = await getAllWorkers(params);
      setWorkers(data || []);
    } catch {
      toast.error("Error", "Could not load workers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWorkers(); }, [statusFilter]);

  // ── Actions ───────────────────────────────────────────────────
  const handleApprove = async (id) => {
    try { await approveWorker(id); toast.success("Approved", "Worker approved and ID assigned."); fetchWorkers(); }
    catch (err) { toast.error("Error", err.response?.data?.message || "Could not approve."); }
  };

  const handleSuspend = async (id) => {
    if (!confirm("Suspend this worker?")) return;
    try { await suspendWorker(id); toast.success("Suspended", "Worker suspended."); fetchWorkers(); }
    catch { toast.error("Error", "Could not suspend."); }
  };

  const handleReinstate = async (id) => {
    try { await reinstateWorker(id); toast.success("Reinstated", "Worker reinstated."); fetchWorkers(); }
    catch { toast.error("Error", "Could not reinstate."); }
  };

  // ── Single create ─────────────────────────────────────────────
  const handleCreate = async () => {
    if (!createForm.fullName || !createForm.email) { toast.warning("Required", "Full name and email are required."); return; }
    if (!createForm.password || createForm.password.length < 6) { toast.warning("Too short", "Password must be at least 6 characters."); return; }
    if (createForm.password !== createForm.confirmPassword) { toast.warning("Mismatch", "Passwords do not match."); return; }
    setCreating(true);
    try {
      const { worker } = await adminCreateWorker({
        fullName: createForm.fullName,
        email: createForm.email,
        phone: createForm.phone,
        department: createForm.department,
        role: createForm.role,
        password: createForm.password,
      });
      setCreatedWorker({ ...worker, password: createForm.password });
      fetchWorkers();
    } catch (err) {
      toast.error("Error", err.response?.data?.message || "Could not create worker.");
    } finally {
      setCreating(false);
    }
  };

  // ── Bulk create ───────────────────────────────────────────────
  const handleBulkCreate = async () => {
    if (parsedEmails.length === 0) { toast.warning("No emails", "Paste at least one valid email address."); return; }
    if (!bulkPassword || bulkPassword.length < 6) { toast.warning("Password required", "Password must be at least 6 characters."); return; }
    if (bulkPassword !== bulkConfirmPassword) { toast.warning("Mismatch", "Passwords do not match."); return; }

    setBulkCreating(true);
    try {
      const payload = parsedEmails.map((email) => ({
        fullName: email.split("@")[0]
          .replace(/[._\-+]/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
          .trim(),
        email,
        phone: bulkPhone,
        department: bulkDept,
        role: bulkRole,
        password: bulkPassword,
        mustChangePassword: true,
      }));
      const { results } = await adminBulkCreateWorkers({ workers: payload });
      setBulkResult({ ...results, password: bulkPassword });
      fetchWorkers();
    } catch (err) {
      toast.error("Error", err.response?.data?.message || "Bulk create failed.");
    } finally {
      setBulkCreating(false);
    }
  };

  const resetBulkForm = () => {
    setPastedEmails("");
    setBulkPhone("");
    setBulkDept("unassigned");
    setBulkRole("worker");
    setBulkPassword("");
    setBulkConfirmPassword("");
    setBulkResult(null);
  };

  // ── Credential helpers ────────────────────────────────────────
  const copyText = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  };

  const downloadSingle = (w) => {
    const text = [
      "YACHAL HOUSE - LOGIN CREDENTIALS",
      "=".repeat(36),
      `Name:      ${w.fullName}`,
      `Email:     ${w.email}`,
      `Password:  ${w.password}`,
      `Worker ID: ${w.workerId}`,
      `Role:      ${w.role}`,
      "",
      "Login: https://yachal-house-church.pages.dev/login",
      "You will be asked to change your password on first login.",
    ].join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `credentials-${w.fullName.replace(/\s+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadBulk = (created, password) => {
    const rows = [["Full Name", "Email", "Password", "Worker ID", "Department", "Role", "Login URL"]];
    created.forEach((w) => rows.push([
      w.fullName, w.email, password, w.workerId,
      (w.department || "").replace(/-/g, " "),
      w.role || "worker",
      "https://yachalhousegh.com/login",
    ]));
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bulk-credentials-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Filtered list ─────────────────────────────────────────────
  const filtered = workers.filter((w) =>
    w.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    w.email?.toLowerCase().includes(search.toLowerCase()) ||
    w.workerId?.includes(search)
  );

  const statusBadge = (status) => {
    if (status === "approved") return <span className="badge-success">Approved</span>;
    if (status === "pending") return <span className="badge-warning">Pending</span>;
    return <span className="badge-danger">Suspended</span>;
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="section-title">Workers</h1>
          <p className="section-subtitle">{workers.length} total workers</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { resetBulkForm(); setShowBulkModal(true); }}
            className="btn-outline flex items-center gap-2 text-sm"
          >
            <Mail className="w-4 h-4" /> Bulk Add
          </button>
          <button
            onClick={() => {
              setCreatedWorker(null);
              setCreateForm({ fullName: "", email: "", phone: "", department: "unassigned", role: "worker", password: "", confirmPassword: "" });
              setShowCreateModal(true);
            }}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <UserPlus className="w-4 h-4" /> Add Worker
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input-field pl-9"
            placeholder="Search by name, email or worker ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input-field sm:w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="suspended">Suspended</option>
        </select>
        <button onClick={fetchWorkers} className="btn-ghost flex items-center gap-1.5 text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {loading ? <Loader /> : (
        <div className="table-container">
          <table className="w-full">
            <thead>
              <tr>
                {["Worker", "ID", "Department", "Role", "Status", "Joined", "Actions"].map((h) => (
                  <th key={h} className="table-header whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-cell text-center text-gray-400 py-12">No workers found.</td>
                </tr>
              ) : filtered.map((w) => (
                <tr key={w._id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {w.fullName?.charAt(0) || "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-slate-100 text-sm truncate">{w.fullName}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{w.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className="font-mono font-bold text-purple-700 dark:text-purple-400">{w.workerId || "N/A"}</span>
                  </td>
                  <td className="table-cell capitalize text-xs">{w.department?.replace(/-/g, " ") || "Unassigned"}</td>
                  <td className="table-cell capitalize text-xs">{w.role}</td>
                  <td className="table-cell">{statusBadge(w.status)}</td>
                  <td className="table-cell text-xs">{formatDate(w.createdAt)}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      {w.status === "pending" && (
                        <button onClick={() => handleApprove(w._id)} className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg" title="Approve">
                          <UserCheck className="w-4 h-4" />
                        </button>
                      )}
                      {w.status === "approved" && (
                        <button onClick={() => handleSuspend(w._id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Suspend">
                          <UserX className="w-4 h-4" />
                        </button>
                      )}
                      {w.status === "suspended" && (
                        <button onClick={() => handleReinstate(w._id)} className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg" title="Reinstate">
                          <UserCheck className="w-4 h-4" />
                        </button>
                      )}
                      <Link
                        to={`/admin/workers/${w._id}`}
                        className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Single Add Modal ─────────────────────────────────── */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); setCreatedWorker(null); }}
        title={createdWorker ? "Worker Created" : "Add Worker"}
      >
        {!createdWorker ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Worker ID is assigned automatically. Worker must change their password on first login.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Full Name</label>
                <input className="input-field" placeholder="Full name" value={createForm.fullName} onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input type="email" className="input-field" placeholder="Email address" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Phone (optional)</label>
                <input className="input-field" placeholder="+233 XXX XXX XXX" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Department</label>
                <select className="input-field" value={createForm.department} onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}>
                  {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Role</label>
                <select className="input-field" value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}>
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-gray-100 dark:border-slate-700">
              <div>
                <label className="form-label">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    className="input-field pr-10"
                    placeholder="Min 6 characters"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="form-label">Confirm Password</label>
                <input type="password" className="input-field" placeholder="Repeat password" value={createForm.confirmPassword} onChange={(e) => setCreateForm({ ...createForm, confirmPassword: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-slate-700">
              <button onClick={() => setShowCreateModal(false)} className="btn-ghost">Cancel</button>
              <button onClick={handleCreate} disabled={creating} className="btn-primary flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                {creating ? "Creating..." : "Create Worker"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <p className="text-sm text-green-800 dark:text-green-300 font-medium">Worker created. Copy or download credentials below.</p>
            </div>
            <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-5 space-y-3">
              {[
                { label: "Worker ID", value: createdWorker.workerId },
                { label: "Full Name", value: createdWorker.fullName },
                { label: "Email", value: createdWorker.email },
                { label: "Password", value: createdWorker.password },
                { label: "Login URL", value: "https://yachalhousegh.com/login" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 dark:text-slate-500">{label}</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{value}</p>
                  </div>
                  <button onClick={() => copyText(value, label)} className="p-1.5 text-gray-400 hover:text-purple-600 rounded-lg flex-shrink-0">
                    {copied === label ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300">
              Worker will be asked to change their password on first login. Share credentials securely.
            </div>
            <div className="flex gap-3">
              <button onClick={() => downloadSingle(createdWorker)} className="btn-primary flex items-center gap-2 flex-1 justify-center">
                <Download className="w-4 h-4" /> Download Credentials
              </button>
              <button onClick={() => { setShowCreateModal(false); setCreatedWorker(null); }} className="btn-ghost flex-1">Done</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Bulk Add Modal ───────────────────────────────────── */}
      <Modal
        isOpen={showBulkModal}
        onClose={() => { setShowBulkModal(false); resetBulkForm(); }}
        title={bulkResult ? "Bulk Creation Complete" : "Add Workers"}
        size="lg"
      >
        {!bulkResult ? (
          <div className="space-y-5">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Worker IDs are assigned automatically. All workers must change their password on first login.
            </p>

            <div>
              <label className="form-label">
                Emails{" "}
                <span className="text-gray-400 dark:text-slate-500 font-normal text-xs">
                  (paste multiple at once, one per line or comma separated)
                </span>
              </label>
              <textarea
                className="input-field font-mono text-sm resize-none"
                rows={5}
                placeholder={"john@example.com\nmary@example.com, kwame@gmail.com\nabena@church.org"}
                value={pastedEmails}
                onChange={(e) => setPastedEmails(e.target.value)}
              />
              {parsedEmails.length > 0 && (
                <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-1.5">
                  {parsedEmails.length} valid email{parsedEmails.length !== 1 ? "s" : ""} detected
                </p>
              )}
            </div>

            <div>
              <label className="form-label">Phone <span className="text-gray-400 dark:text-slate-500 font-normal text-xs">(optional, applies to all)</span></label>
              <input className="input-field" placeholder="+233 XXX XXX XXX" value={bulkPhone} onChange={(e) => setBulkPhone(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Department</label>
                <select className="input-field" value={bulkDept} onChange={(e) => setBulkDept(e.target.value)}>
                  {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Role</label>
                <select className="input-field" value={bulkRole} onChange={(e) => setBulkRole(e.target.value)}>
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-gray-100 dark:border-slate-700">
              <div>
                <label className="form-label">Password</label>
                <div className="relative">
                  <input
                    type={showBulkPw ? "text" : "password"}
                    className="input-field pr-10"
                    placeholder="Min 6 characters"
                    value={bulkPassword}
                    onChange={(e) => setBulkPassword(e.target.value)}
                  />
                  <button type="button" onClick={() => setShowBulkPw(!showBulkPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showBulkPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="form-label">Confirm Password</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Repeat password"
                  value={bulkConfirmPassword}
                  onChange={(e) => setBulkConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-slate-700">
              <button onClick={() => { setShowBulkModal(false); resetBulkForm(); }} className="btn-ghost">Cancel</button>
              <button
                onClick={handleBulkCreate}
                disabled={bulkCreating || parsedEmails.length === 0}
                className="btn-primary flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                {bulkCreating
                  ? "Creating..."
                  : `Create ${parsedEmails.length} Worker${parsedEmails.length !== 1 ? "s" : ""}`
                }
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-5 text-center">
                <p className="text-3xl font-bold text-green-700 dark:text-green-400">{bulkResult.created.length}</p>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">Accounts created</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-5 text-center">
                <p className="text-3xl font-bold text-amber-700 dark:text-amber-400">{bulkResult.skipped.length}</p>
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">Skipped (already exists)</p>
              </div>
            </div>
            {bulkResult.created.length > 0 && (
              <div className="max-h-56 overflow-y-auto space-y-2">
                {bulkResult.created.map((w) => (
                  <div key={w.email} className="flex items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{w.fullName}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{w.email}</p>
                    </div>
                    <span className="font-mono font-bold text-purple-700 dark:text-purple-400 text-sm flex-shrink-0">{w.workerId}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300">
              Download the CSV below. It contains each worker's name, email, password and Worker ID. All workers must change their password on first login.
            </div>
            <div className="flex gap-3">
              {bulkResult.created.length > 0 && (
                <button
                  onClick={() => downloadBulk(bulkResult.created, bulkResult.password)}
                  className="btn-primary flex items-center gap-2 flex-1 justify-center"
                >
                  <Download className="w-4 h-4" /> Download Credentials CSV
                </button>
              )}
              <button onClick={() => { setShowBulkModal(false); resetBulkForm(); }} className="btn-ghost flex-1">Done</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Workers;