import { useState, useEffect, useRef } from "react";
import {
  Users, Clock, CheckCircle, AlertCircle, Search,
  Plus, LogOut, Info, Shield, UserCheck, Lock
} from "lucide-react";
import axiosInstance from "../../utils/axiosInstance";
import { useAuth } from "../../hooks/useAuth";
import { useToast, ToastContainer } from "../../components/common/Toast";
import { cn } from "../../utils/scoreHelpers";

const SERVICE_TYPES = [
  { value: "sunday",  label: "Sunday Service" },
  { value: "tuesday", label: "Tuesday Service" },
  { value: "special", label: "Special Service" },
];

const TIMING_LABELS = {
  "early-60plus": { label: "60+ mins early", cls: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" },
  "early-30to60": { label: "30-60 mins early", cls: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800" },
  "early-15to30": { label: "15-30 mins early", cls: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800" },
  "early-0to15":  { label: "0-15 mins early",  cls: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800" },
  "late":         { label: "Late",              cls: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800" },
};

const FrontDesk = () => {
  const { user } = useAuth();
  const { toasts, toast, removeToast } = useToast();

  // ── State ──────────────────────────────────────────────────
  const [step, setStep] = useState("checking"); // checking | gated | verify-duty | open-form | active
  const [session, setSession] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [stats, setStats] = useState(null);
  const [time, setTime] = useState(new Date());
  const [creating, setCreating] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const inputRef = useRef(null);

  // Roster assignment verification
  const [rosterAssignment, setRosterAssignment] = useState(null); // null | {assigned: bool}
  const [leaderName, setLeaderName] = useState("");
  const [partners, setPartners] = useState([]); // [{name, workerId, present}]
  const [partnerQuery, setPartnerQuery] = useState("");
  const [partnerSuggestions, setPartnerSuggestions] = useState([]);

  // Create session form
  const [createForm, setCreateForm] = useState({
    serviceType: "sunday",
    specialServiceName: "",
    serviceDate: new Date().toISOString().split("T")[0],
    serviceStartTime: "",
    serviceLocation: "",
  });

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── On mount: check active session and roster assignment ──
  useEffect(() => { checkStatus(); }, []);

  const checkStatus = async () => {
    setStep("checking");
    try {
      const { data } = await axiosInstance.get("/attendance/active");
      if (data.session) {
        setSession(data.session);
        await fetchAttendance(data.session._id);
        setStep("active");
      } else {
        // No active session - check if user is assigned to front desk in latest roster
        await checkRosterAssignment();
      }
    } catch {
      await checkRosterAssignment();
    }
  };

  const checkRosterAssignment = async () => {
    try {
      const { data } = await axiosInstance.get("/roster/my-assignment");
      const myAssignments = data.roster?.myAssignments || [];
      const isFrontDesk = myAssignments.some((a) => a.department === "front-desk");
      if (isFrontDesk) {
        setRosterAssignment({ assigned: true, isCoordinator: myAssignments.find((a) => a.department === "front-desk")?.isCoordinator });
        setStep("verify-duty");
      } else {
        setRosterAssignment({ assigned: false });
        setStep("gated");
      }
    } catch {
      setRosterAssignment({ assigned: false });
      setStep("gated");
    }
  };

  const fetchAttendance = async (sessionId) => {
    try {
      const { data } = await axiosInstance.get(`/attendance/session/${sessionId}`);
      const list = data.attendance || [];
      setAttendance(list);
      setStats({
        total:   list.length,
        early60: list.filter((a) => a.timingCategory === "early-60plus").length,
        early30: list.filter((a) => a.timingCategory === "early-30to60").length,
        early15: list.filter((a) => a.timingCategory === "early-15to30").length,
        early0:  list.filter((a) => a.timingCategory === "early-0to15").length,
        late:    list.filter((a) => a.timingCategory === "late").length,
        onDuty:  list.filter((a) => a.isOnDuty).length,
      });
    } catch {}
  };

  // ── Search suggestions for check-in ──────────────────────
  useEffect(() => {
    if (!query.trim()) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await axiosInstance.get(`/attendance/search?q=${query.trim()}`);
        // Exclude already checked in
        const checkedIds = attendance.map((a) => a.worker?._id);
        setSuggestions((data.workers || []).filter((w) => !checkedIds.includes(w._id)));
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [query, attendance]);

  // Partner search
  useEffect(() => {
    if (!partnerQuery.trim()) { setPartnerSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await axiosInstance.get(`/attendance/search?q=${partnerQuery.trim()}`);
        setPartnerSuggestions(data.workers || []);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [partnerQuery]);

  // ── Create session ────────────────────────────────────────
  const handleCreateSession = async () => {
    if (!createForm.serviceStartTime) { toast.warning("Required", "Set the service start time."); return; }
    if (!leaderName.trim()) { toast.warning("Required", "Enter the name of the leader who assigned you."); return; }
    setCreating(true);
    try {
      const { data } = await axiosInstance.post("/attendance/session", {
        ...createForm,
        partners: partners.map((p) => ({ workerId: p.workerId, fullName: p.name, present: p.present })),
        assignedByLeader: leaderName,
      });
      setSession(data.session);
      await fetchAttendance(data.session._id);
      setStep("active");
      toast.success("Front desk open", "Session started. Check in workers below.");
    } catch (err) {
      toast.error("Error", err.response?.data?.message || "Could not open session.");
    } finally { setCreating(false); }
  };

  // ── Check in worker ───────────────────────────────────────
  const handleCheckIn = async (worker) => {
    if (!session) return;
    setCheckingIn(true);
    setQuery("");
    setSuggestions([]);
    try {
      const { data } = await axiosInstance.post("/attendance/check-in", {
        identifier: worker.workerId,
        sessionId: session._id,
        isOnDuty: false,
      });
      setLastCheckIn({ worker: data.worker, timing: data.timingCategory, message: data.message });
      await fetchAttendance(session._id);
      toast.success("Checked in", data.message);
      inputRef.current?.focus();
    } catch (err) {
      toast.error("Error", err.response?.data?.message || "Could not check in.");
    } finally { setCheckingIn(false); }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim() || !session) return;
    setCheckingIn(true);
    try {
      const { data } = await axiosInstance.post("/attendance/check-in", {
        identifier: query.trim(),
        sessionId: session._id,
        isOnDuty: false,
      });
      setLastCheckIn({ worker: data.worker, timing: data.timingCategory, message: data.message });
      setQuery("");
      setSuggestions([]);
      await fetchAttendance(session._id);
      toast.success("Checked in", data.message);
    } catch (err) {
      toast.error("Error", err.response?.data?.message || "Could not check in.");
    } finally { setCheckingIn(false); }
  };

  const handleCloseSession = async () => {
    if (!confirm("Close this session? A report will be sent to the admin team.")) return;
    try {
      await axiosInstance.put(`/attendance/close/${session._id}`);
      toast.success("Closed", "Session closed. Report sent to admin, mod and pastor.");
      setSession(null);
      setAttendance([]);
      setStats(null);
      setLastCheckIn(null);
      setStep("gated");
    } catch (err) { toast.error("Error", err.response?.data?.message || "Could not close."); }
  };

  const addPartner = (w) => {
    if (partners.find((p) => p.workerId === w.workerId)) return;
    setPartners([...partners, { name: w.fullName, workerId: w.workerId, present: true }]);
    setPartnerQuery("");
    setPartnerSuggestions([]);
  };

  const timeStr = (iso) => new Date(iso).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" });
  const serviceLabel = session ? SERVICE_TYPES.find((s) => s.value === session.serviceType)?.label || session.serviceType : "";

  // ── Renders ────────────────────────────────────────────────
  if (step === "checking") {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (step === "gated") {
    return (
      <div className="max-w-md mx-auto mt-10">
        <div className="card p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-3">Access Restricted</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed">
            You are not assigned to the front desk for the upcoming service. Only workers assigned in the published duty roster can open and manage the front desk.
          </p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-4 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
            If you believe this is an error, contact your admin or check your roster assignment under <strong>My Roster</strong>.
          </p>
        </div>
      </div>
    );
  }

  if (step === "verify-duty") {
    return (
      <div className="max-w-lg mx-auto mt-6 space-y-5">
        <ToastContainer toasts={toasts} onClose={removeToast} />
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-slate-100">Front Desk Duty Confirmed</h2>
              <p className="text-xs text-gray-400 dark:text-slate-500">You are assigned to front desk{rosterAssignment?.isCoordinator ? " (Coordinator)" : ""}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="form-label">Who assigned you to front desk duty? <span className="text-red-400">*</span></label>
              <input
                className="input-field"
                placeholder="Enter leader/supervisor name"
                value={leaderName}
                onChange={(e) => setLeaderName(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label">Partner(s) on duty with you (optional)</label>
              <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">Add your duty partners and mark if they are already present.</p>
              <div className="relative">
                <input
                  className="input-field"
                  placeholder="Search partner by name or ID..."
                  value={partnerQuery}
                  onChange={(e) => setPartnerQuery(e.target.value)}
                />
                {partnerSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-11 z-20 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-xl overflow-hidden">
                    {partnerSuggestions.map((w) => (
                      <button key={w._id} type="button" onClick={() => addPartner(w)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700 text-left">
                        <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 font-bold flex items-center justify-center text-xs">{w.fullName?.charAt(0)}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{w.fullName}</p>
                          <p className="text-xs text-gray-400">{w.workerId}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {partners.length > 0 && (
                <div className="mt-3 space-y-2">
                  {partners.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
                      <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 font-bold flex items-center justify-center text-xs">{p.name?.charAt(0)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.workerId}</p>
                      </div>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input type="checkbox" className="w-3.5 h-3.5 accent-purple-600" checked={p.present}
                          onChange={(e) => setPartners(partners.map((pt, idx) => idx === i ? { ...pt, present: e.target.checked } : pt))} />
                        Present
                      </label>
                      <button onClick={() => setPartners(partners.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 dark:border-slate-700 space-y-3">
              <h3 className="font-semibold text-gray-900 dark:text-slate-100 text-sm">Service Details</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Service Type</label>
                  <select className="input-field" value={createForm.serviceType} onChange={(e) => setCreateForm({ ...createForm, serviceType: e.target.value })}>
                    {SERVICE_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Service Date</label>
                  <input type="date" className="input-field" value={createForm.serviceDate} onChange={(e) => setCreateForm({ ...createForm, serviceDate: e.target.value })} />
                </div>
              </div>
              {createForm.serviceType === "special" && (
                <div>
                  <label className="form-label">Special Service Name</label>
                  <input className="input-field" placeholder="e.g. Easter Sunday, Anniversary" value={createForm.specialServiceName} onChange={(e) => setCreateForm({ ...createForm, specialServiceName: e.target.value })} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Service Start Time</label>
                  <input type="time" className="input-field" value={createForm.serviceStartTime} onChange={(e) => setCreateForm({ ...createForm, serviceStartTime: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Location (optional)</label>
                  <input className="input-field" placeholder="e.g. Main Auditorium" value={createForm.serviceLocation} onChange={(e) => setCreateForm({ ...createForm, serviceLocation: e.target.value })} />
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-500">Session auto-closes 4 hours after service start time.</p>
            </div>

            <button onClick={handleCreateSession} disabled={creating || !leaderName.trim()} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
              {creating ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <UserCheck className="w-4 h-4" />}
              {creating ? "Opening..." : "Open Front Desk"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Active session ──────────────────────────────────────────
  return (
    <div className="space-y-4 animate-fade-in">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="section-title">Front Desk — {serviceLabel}</h1>
          <p className="section-subtitle font-mono">
            {time.toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            {" · "}
            {new Date(session?.serviceDate).toLocaleDateString("en-GH", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <button onClick={handleCloseSession} className="btn-outline text-sm flex items-center gap-2 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0">
          <LogOut className="w-4 h-4" /> Close Session
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { label: "Total",     value: stats.total,   cls: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400" },
            { label: "60+ early", value: stats.early60, cls: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400" },
            { label: "30-60 min", value: stats.early30, cls: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400" },
            { label: "15-30 min", value: stats.early15, cls: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400" },
            { label: "0-15 min",  value: stats.early0,  cls: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400" },
            { label: "Late",      value: stats.late,    cls: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400" },
          ].map((s) => (
            <div key={s.label} className={cn("rounded-xl p-3 text-center", s.cls)}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Check-in form */}
      <div className="card p-5">
        <h2 className="font-bold text-gray-900 dark:text-slate-100 mb-3">Check In Worker</h2>
        <form onSubmit={handleManualSubmit} className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              className="input-field pl-9 pr-24 text-base"
              placeholder="Type Worker ID or name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              autoFocus
            />
            <button type="submit" disabled={checkingIn || !query.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 btn-primary text-xs py-1.5 px-3 whitespace-nowrap">
              {checkingIn ? "..." : "Check In"}
            </button>
          </div>

          {suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-12 z-20 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-xl overflow-hidden">
              {suggestions.map((w) => (
                <button key={w._id} type="button" onClick={() => handleCheckIn(w)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700 text-left transition-colors">
                  <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 font-bold flex items-center justify-center text-sm flex-shrink-0">{w.fullName?.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{w.fullName}</p>
                    <p className="text-xs text-gray-400">{w.workerId} · {w.department?.replace(/-/g, " ")}</p>
                  </div>
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </form>

        {lastCheckIn && (
          <div className={cn("mt-3 p-3 rounded-xl border text-sm font-medium", TIMING_LABELS[lastCheckIn.timing]?.cls)}>
            {lastCheckIn.message}
          </div>
        )}
      </div>

      {/* Lock notice */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-center gap-3 text-xs text-amber-800 dark:text-amber-300">
        <Lock className="w-4 h-4 flex-shrink-0" />
        Check-in times are permanent. No editing or deletion is allowed after a worker has been checked in.
      </div>

      {/* Attendance list */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <h2 className="font-bold text-gray-900 dark:text-slate-100">Checked In ({attendance.length})</h2>
          <button onClick={() => fetchAttendance(session._id)} className="text-xs text-purple-600 dark:text-purple-400 hover:underline">Refresh</button>
        </div>
        {attendance.length === 0 ? (
          <div className="p-10 text-center text-gray-400 dark:text-slate-500 text-sm">No workers checked in yet.</div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-slate-800 max-h-[60vh] overflow-y-auto">
            {attendance.map((a, i) => (
              <div key={a._id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800/30">
                <span className="text-xs text-gray-300 dark:text-slate-600 w-6 text-right flex-shrink-0">{i + 1}</span>
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-bold flex items-center justify-center text-xs flex-shrink-0">
                  {a.worker?.fullName?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{a.worker?.fullName}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{a.worker?.workerId} · {a.worker?.department?.replace(/-/g, " ")}</p>
                </div>
                <div className="text-right flex-shrink-0 space-y-1">
                  <p className="text-sm font-mono font-bold text-gray-700 dark:text-slate-300">{timeStr(a.checkInTime)}</p>
                  <span className={cn("text-xs px-1.5 py-0.5 rounded-full border", TIMING_LABELS[a.timingCategory]?.cls)}>
                    {TIMING_LABELS[a.timingCategory]?.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3 text-sm text-blue-700 dark:text-blue-400">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>Session auto-closes at <strong>{session?.autoCloseTime ? timeStr(session.autoCloseTime) : "N/A"}</strong> (4 hours after service start). Report sent automatically to admin, mod and pastor.</p>
      </div>
    </div>
  );
};

export default FrontDesk;