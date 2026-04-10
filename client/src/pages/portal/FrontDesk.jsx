import { useState, useEffect, useRef, useCallback } from "react";
import {
  Maximize2, Minimize2, UserCheck, Clock, Users,
  CheckCircle, Search, LogOut, Shield, AlertCircle,
  RefreshCw, Download, ChevronDown, ChevronUp
} from "lucide-react";
import axiosInstance from "../../utils/axiosInstance";
import { useAuth } from "../../hooks/useAuth";
import { useToast, ToastContainer } from "../../components/common/Toast";
import { cn } from "../../utils/scoreHelpers";

const TIMING_LABELS = {
  "early-60plus": { label: "60+ min early",  cls: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200" },
  "early-30to60": { label: "30-60 min early", cls: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200" },
  "early-15to30": { label: "15-30 min early", cls: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200" },
  "early-0to15":  { label: "0-15 min early",  cls: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200" },
  "late":         { label: "Late",             cls: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200" },
};

// ── Steps ────────────────────────────────────────────────────────────────────
// "checking"      - loading, checking active session & role
// "unauthorized"  - not admin/mod/pastor and not in roster for front-desk
// "auth-1"        - first person: enter Worker ID to confirm assignment
// "auth-2"        - second person: enter their Worker ID
// "setup"         - admin/mod/pastor sets service start/end time (first open)
// "active"        - session open, full view or maximized check-in
// "force-close"   - admin/mod/pastor can force close

const INACTIVITY_MS = 3 * 60 * 60 * 1000; // 3 hours

const FrontDesk = () => {
  const { user } = useAuth();
  const { toasts, toast, removeToast } = useToast();
  const isAdminLevel = ["pastor", "admin", "moderator"].includes(user?.role);

  // ── Core state ─────────────────────────────────────────────────────────────
  const [step, setStep]       = useState("checking");
  const [session, setSession] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [dutyWorkers, setDutyWorkers] = useState([]); // the 2 on-duty workers
  const [maximized, setMaximized] = useState(false);

  // Auth step state
  const [auth1Id, setAuth1Id]   = useState("");
  const [auth1Worker, setAuth1Worker] = useState(null);
  const [auth2Id, setAuth2Id]   = useState("");
  const [auth2Worker, setAuth2Worker] = useState(null);
  const [authError, setAuthError] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Setup state
  const [serviceType, setServiceType]   = useState("sunday");
  const [serviceDate, setServiceDate]   = useState(new Date().toISOString().split("T")[0]);
  const [serviceStart, setServiceStart] = useState("");
  const [serviceEnd, setServiceEnd]     = useState("");
  const [specialName, setSpecialName]   = useState("");
  const [creating, setCreating]         = useState(false);

  // Check-in state
  const [query, setQuery]           = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [checkingIn, setCheckingIn] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState(null);
  const inputRef = useRef(null);

  // Stats
  const [stats, setStats] = useState(null);
  const [time, setTime]   = useState(new Date());

  // Inactivity timer
  const inactivityRef = useRef(null);

  // ── Clock ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Reset inactivity timer ─────────────────────────────────────────────────
  const resetInactivity = useCallback(() => {
    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    if (step === "active" && !isAdminLevel) {
      inactivityRef.current = setTimeout(() => {
        handleAutoClose();
      }, INACTIVITY_MS);
    }
  }, [step, isAdminLevel]);

  useEffect(() => {
    window.addEventListener("mousemove", resetInactivity);
    window.addEventListener("keypress", resetInactivity);
    resetInactivity();
    return () => {
      window.removeEventListener("mousemove", resetInactivity);
      window.removeEventListener("keypress", resetInactivity);
      if (inactivityRef.current) clearTimeout(inactivityRef.current);
    };
  }, [resetInactivity]);

  // ── On mount: check active session ────────────────────────────────────────
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const { data } = await axiosInstance.get("/attendance/active");
      if (data.session) {
        setSession(data.session);
        await fetchAttendance(data.session._id);
        setStep("active");
      } else {
        // No active session - check authorization
        if (isAdminLevel) {
          setStep("auth-1"); // admin can open but still must confirm 2 duty workers
        } else {
          // Check if worker is assigned to front-desk in latest roster
          try {
            const { data: rosterData } = await axiosInstance.get("/roster/my-assignment");
            const assignedToFrontDesk = rosterData.roster?.myAssignments?.some(
              (a) => a.department === "front-desk"
            );
            if (assignedToFrontDesk) {
              setStep("auth-1");
            } else {
              setStep("unauthorized");
            }
          } catch {
            setStep("unauthorized");
          }
        }
      }
    } catch {
      setStep("unauthorized");
    }
  };

  const fetchAttendance = async (sessionId) => {
    try {
      const { data } = await axiosInstance.get(`/attendance/session/${sessionId}`);
      const list = data.attendance || [];
      setAttendance(list);
      computeStats(list);
      setDutyWorkers(list.filter((a) => a.isOnDuty));
    } catch {}
  };

  const computeStats = (list) => {
    setStats({
      total:    list.length,
      early60:  list.filter((a) => a.timingCategory === "early-60plus").length,
      early30:  list.filter((a) => a.timingCategory === "early-30to60").length,
      early15:  list.filter((a) => a.timingCategory === "early-15to30").length,
      early0:   list.filter((a) => a.timingCategory === "early-0to15").length,
      late:     list.filter((a) => a.timingCategory === "late").length,
      onDuty:   list.filter((a) => a.isOnDuty).length,
    });
  };

  // ── Auth step 1: verify first duty worker ────────────────────────────────
  const handleAuth1 = async () => {
    if (!auth1Id.trim()) return;
    setVerifying(true);
    setAuthError("");
    try {
      const { data } = await axiosInstance.get(`/attendance/search?q=${auth1Id.trim()}`);
      const worker = data.workers?.[0];
      if (!worker) { setAuthError("No worker found with that ID."); return; }
      if (worker.workerId === "001") { setAuthError("Worker ID 001 cannot open the front desk."); return; }
      setAuth1Worker(worker);
      setStep("auth-2");
    } catch { setAuthError("Could not verify ID. Try again."); }
    finally { setVerifying(false); }
  };

  // ── Auth step 2: verify second duty worker ───────────────────────────────
  const handleAuth2 = async () => {
    if (!auth2Id.trim()) return;
    if (auth2Id.trim() === auth1Id.trim()) { setAuthError("Both duty workers must be different people."); return; }
    setVerifying(true);
    setAuthError("");
    try {
      const { data } = await axiosInstance.get(`/attendance/search?q=${auth2Id.trim()}`);
      const worker = data.workers?.[0];
      if (!worker) { setAuthError("No worker found with that ID."); return; }
      if (worker.workerId === "001") { setAuthError("Worker ID 001 cannot be assigned front desk duty."); return; }
      setAuth2Worker(worker);
      setStep("setup");
    } catch { setAuthError("Could not verify ID. Try again."); }
    finally { setVerifying(false); }
  };

  // ── Create session ────────────────────────────────────────────────────────
  const handleCreateSession = async () => {
    if (!serviceStart) { toast.warning("Required", "Set the service start time."); return; }
    setCreating(true);
    try {
      const { data } = await axiosInstance.post("/attendance/session", {
        serviceType, serviceDate, serviceStartTime: `${serviceDate}T${serviceStart}`,
        specialServiceName: specialName,
        coSupervisorId: auth2Worker?._id,
        dutyWorkerIds: [auth1Worker?._id, auth2Worker?._id].filter(Boolean),
        serviceEndTime: serviceEnd ? `${serviceDate}T${serviceEnd}` : null,
      });
      setSession(data.session);
      // Auto check in both duty workers
      await fetchAttendance(data.session._id);
      setStep("active");
      toast.success("Session opened", "Front desk is now active.");
    } catch (err) { toast.error("Error", err.response?.data?.message || "Could not open session."); }
    finally { setCreating(false); }
  };

  // ── Check in a worker ─────────────────────────────────────────────────────
  const handleCheckIn = async (identifier) => {
    if (!session || !identifier?.trim()) return;
    setCheckingIn(true);
    setSuggestions([]);
    setQuery("");
    try {
      const { data } = await axiosInstance.post("/attendance/check-in", {
        identifier: identifier.trim(),
        sessionId: session._id,
        isOnDuty: false,
      });
      setLastCheckIn({ worker: data.worker, timing: data.timingCategory, message: data.message });
      fetchAttendance(session._id);
    } catch (err) {
      toast.error("Error", err.response?.data?.message || "Could not check in.");
    } finally { setCheckingIn(false); }
  };

  // ── Close session ─────────────────────────────────────────────────────────
  const handleClose = async (force = false) => {
    if (!session) return;
    const msg = force ? "Force close this session? Report will be sent to admin team." : "Close this session? Report will be sent to admin team.";
    if (!confirm(msg)) return;
    try {
      await axiosInstance.put(`/attendance/close/${session._id}`);
      toast.success("Session closed", "Report sent to admin team.");
      setSession(null); setAttendance([]); setStats(null);
      setLastCheckIn(null); setStep("auth-1"); setDutyWorkers([]);
    } catch (err) { toast.error("Error", err.response?.data?.message || "Could not close session."); }
  };

  const handleAutoClose = async () => {
    if (!session) return;
    try {
      await axiosInstance.put(`/attendance/close/${session._id}`);
      setSession(null); setAttendance([]); setStats(null);
      setStep("auth-1"); setDutyWorkers([]);
    } catch {}
  };

  // ── Search suggestions ────────────────────────────────────────────────────
  useEffect(() => {
    if (!query.trim() || query.length < 1) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await axiosInstance.get(`/attendance/search?q=${query.trim()}`);
        const checkedIds = attendance.map((a) => a.worker?._id);
        setSuggestions((data.workers || []).filter((w) => !checkedIds.includes(w._id)));
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [query, attendance]);

  // Focus input when maximized
  useEffect(() => {
    if (maximized && inputRef.current) inputRef.current.focus();
  }, [maximized]);

  const timeStr = (iso) => iso ? new Date(iso).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" }) : "N/A";
  const isDutyWorker = session && dutyWorkers.some((d) => d.worker?._id === user?._id);
  const canClose = isAdminLevel || isDutyWorker;

  // ── CSV export ────────────────────────────────────────────────────────────
  const downloadCSV = () => {
    const rows = [["#", "Name", "Worker ID", "Department", "Time", "Timing", "On Duty"]];
    attendance.forEach((a, i) => rows.push([
      i + 1, a.worker?.fullName, a.worker?.workerId,
      a.worker?.department?.replace(/-/g, " "),
      timeStr(a.checkInTime),
      TIMING_LABELS[a.timingCategory]?.label, a.isOnDuty ? "Yes" : "No",
    ]));
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `frontdesk-${session?.serviceType}-${session?.serviceDate?.split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Unauthorized ──────────────────────────────────────────────────────────
  if (step === "unauthorized") return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="card p-10 text-center max-w-md">
        <Shield className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">Access Restricted</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed">
          The Front Desk is only accessible to workers assigned to front desk duty in the published roster, or to admin, moderator and pastor. Please check your duty roster or contact your leader.
        </p>
      </div>
    </div>
  );

  // ── Auth step 1 ───────────────────────────────────────────────────────────
  if (step === "auth-1") return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="card p-8 w-full max-w-sm text-center">
        <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <UserCheck className="w-7 h-7 text-purple-600 dark:text-purple-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-1">Front Desk Duty</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 leading-relaxed">
          Only 2 workers are allowed on front desk duty. Enter your Worker ID to confirm you are assigned to this role.
        </p>
        <div className="space-y-3">
          <div>
            <label className="form-label text-left block">First Duty Worker - Worker ID</label>
            <input
              className="input-field text-center text-lg font-mono tracking-widest"
              placeholder="e.g. 042"
              value={auth1Id}
              onChange={(e) => { setAuth1Id(e.target.value); setAuthError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleAuth1()}
              autoFocus
            />
          </div>
          {authError && <p className="text-sm text-red-500">{authError}</p>}
          <button onClick={handleAuth1} disabled={verifying || !auth1Id.trim()} className="btn-primary w-full">
            {verifying ? "Verifying..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Auth step 2 ───────────────────────────────────────────────────────────
  if (step === "auth-2") return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="card p-8 w-full max-w-sm text-center">
        <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-7 h-7 text-green-600 dark:text-green-400" />
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 mb-5">
          <p className="text-sm font-semibold text-green-700 dark:text-green-400">{auth1Worker?.fullName} confirmed</p>
          <p className="text-xs text-green-600 dark:text-green-400">ID: {auth1Worker?.workerId}</p>
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-1">Second Duty Worker</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 leading-relaxed">
          A second worker must be confirmed. Enter the second duty worker's Worker ID.
        </p>
        <div className="space-y-3">
          <div>
            <label className="form-label text-left block">Second Duty Worker - Worker ID</label>
            <input
              className="input-field text-center text-lg font-mono tracking-widest"
              placeholder="e.g. 078"
              value={auth2Id}
              onChange={(e) => { setAuth2Id(e.target.value); setAuthError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleAuth2()}
              autoFocus
            />
          </div>
          {authError && <p className="text-sm text-red-500">{authError}</p>}
          <button onClick={handleAuth2} disabled={verifying || !auth2Id.trim()} className="btn-primary w-full">
            {verifying ? "Verifying..." : "Confirm"}
          </button>
          <button onClick={() => { setStep("auth-1"); setAuth1Worker(null); setAuth1Id(""); }} className="btn-ghost w-full text-sm">Back</button>
        </div>
      </div>
    </div>
  );

  // ── Setup ─────────────────────────────────────────────────────────────────
  if (step === "setup") return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="card p-8 w-full max-w-md">
        <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-1">Set Up Service</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-5">
          Duty workers confirmed: <strong>{auth1Worker?.fullName}</strong> and <strong>{auth2Worker?.fullName}</strong>. Set the service details to open the front desk.
        </p>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Service Type</label>
              <select className="input-field" value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
                <option value="sunday">Sunday Service</option>
                <option value="tuesday">Tuesday Service</option>
                <option value="special">Special Service</option>
              </select>
            </div>
            <div>
              <label className="form-label">Service Date</label>
              <input type="date" className="input-field" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
            </div>
          </div>
          {serviceType === "special" && (
            <div>
              <label className="form-label">Special Service Name</label>
              <input className="input-field" placeholder="e.g. Easter Sunday" value={specialName} onChange={(e) => setSpecialName(e.target.value)} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Start Time <span className="text-red-400">*</span></label>
              <input type="time" className="input-field" value={serviceStart} onChange={(e) => setServiceStart(e.target.value)} />
            </div>
            <div>
              <label className="form-label">End Time <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="time" className="input-field" value={serviceEnd} onChange={(e) => setServiceEnd(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-slate-500">If no end time is set, the session auto-closes after 3 hours of inactivity.</p>
          <button onClick={handleCreateSession} disabled={creating || !serviceStart} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
            {creating ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {creating ? "Opening..." : "Open Front Desk"}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Checking ──────────────────────────────────────────────────────────────
  if (step === "checking") return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // ── Active session ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="section-title">Front Desk</h1>
          <p className="section-subtitle font-mono font-bold text-purple-600 dark:text-purple-400">
            {time.toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            {" · "}
            <span className="font-normal text-gray-400 dark:text-slate-500 font-sans">
              {session?.serviceType?.charAt(0).toUpperCase() + session?.serviceType?.slice(1)} Service
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canClose && (
            <button onClick={() => handleClose(false)} className="btn-outline text-sm text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-1.5">
              <LogOut className="w-4 h-4" /> Close Session
            </button>
          )}
          {isAdminLevel && !canClose && (
            <button onClick={() => handleClose(true)} className="btn-outline text-sm text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 flex items-center gap-1.5">
              <Shield className="w-4 h-4" /> Force Close
            </button>
          )}
        </div>
      </div>

      {/* Duty workers badge */}
      {dutyWorkers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {dutyWorkers.map((d) => (
            <div key={d._id} className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl px-3 py-1.5">
              <div className="w-5 h-5 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center">
                {d.worker?.fullName?.charAt(0)}
              </div>
              <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">{d.worker?.fullName}</span>
              <span className="text-xs text-purple-500 dark:text-purple-500">On Duty</span>
            </div>
          ))}
        </div>
      )}

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
          {[
            { label: "Total",     value: stats.total,   color: "text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20" },
            { label: "60+ early", value: stats.early60, color: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" },
            { label: "30-60 min", value: stats.early30, color: "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" },
            { label: "15-30 min", value: stats.early15, color: "text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20" },
            { label: "0-15 min",  value: stats.early0,  color: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20" },
            { label: "Late",      value: stats.late,    color: "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20" },
            { label: "On Duty",   value: stats.onDuty,  color: "text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700" },
          ].map((s) => (
            <div key={s.label} className={cn("rounded-xl p-2.5 text-center", s.color)}>
              <p className="text-xl font-bold leading-none">{s.value}</p>
              <p className="text-xs mt-0.5 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Check-in section with maximize */}
      <div className={cn(
        "card overflow-hidden transition-all duration-300",
        maximized ? "fixed inset-0 z-50 rounded-none flex flex-col" : ""
      )}>
        {/* Check-in header */}
        <div className={cn(
          "flex items-center justify-between border-b border-gray-100 dark:border-slate-700",
          maximized ? "px-6 py-4 bg-white dark:bg-slate-800" : "px-5 py-4"
        )}>
          <div className="flex items-center gap-3">
            <UserCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <div>
              <h2 className="font-bold text-gray-900 dark:text-slate-100">Check In Worker</h2>
              {maximized && (
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                  Type Worker ID or name · Press Enter or click Check In
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setMaximized(!maximized)}
            className="p-2 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
            title={maximized ? "Minimize" : "Maximize check-in screen"}
          >
            {maximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>

        {/* Check-in input */}
        <div className={cn(
          "relative",
          maximized ? "flex-1 flex flex-col items-center justify-center px-6 py-8 bg-gray-50 dark:bg-slate-900" : "p-5"
        )}>
          {maximized && lastCheckIn && (
            <div className={cn("mb-6 px-5 py-4 rounded-2xl border text-center w-full max-w-md", TIMING_LABELS[lastCheckIn.timing]?.cls)}>
              <p className="text-lg font-bold">{lastCheckIn.worker?.fullName}</p>
              <p className="text-sm">{lastCheckIn.message}</p>
            </div>
          )}

          <div className={cn("relative", maximized ? "w-full max-w-md" : "")}>
            <form onSubmit={(e) => { e.preventDefault(); if (query.trim()) handleCheckIn(query); }}>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  ref={inputRef}
                  className={cn("input-field pl-12 pr-28", maximized ? "text-xl py-4 rounded-2xl" : "")}
                  placeholder="Worker ID or name..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoComplete="off"
                  autoFocus={maximized}
                />
                <button
                  type="submit"
                  disabled={checkingIn || !query.trim()}
                  className={cn(
                    "absolute right-2 top-1/2 -translate-y-1/2 btn-primary",
                    maximized ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-xs"
                  )}
                >
                  {checkingIn ? "..." : "Check In"}
                </button>
              </div>

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-14 z-20 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-2xl shadow-2xl overflow-hidden">
                  {suggestions.map((w) => (
                    <button
                      key={w._id}
                      type="button"
                      onClick={() => { handleCheckIn(w.workerId); }}
                      className={cn(
                        "w-full flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-left",
                        maximized ? "px-5 py-4" : "px-4 py-3"
                      )}
                    >
                      <div className={cn("rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-bold flex items-center justify-center flex-shrink-0", maximized ? "w-10 h-10 text-base" : "w-8 h-8 text-sm")}>
                        {w.fullName?.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("font-medium text-gray-900 dark:text-slate-100 truncate", maximized ? "text-base" : "text-sm")}>{w.fullName}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{w.workerId} · {w.department?.replace(/-/g, " ")}</p>
                      </div>
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </form>

            {!maximized && lastCheckIn && (
              <div className={cn("mt-3 p-3 rounded-xl border text-sm", TIMING_LABELS[lastCheckIn.timing]?.cls)}>
                {lastCheckIn.message}
              </div>
            )}

            {maximized && (
              <p className="text-center text-xs text-gray-400 dark:text-slate-500 mt-4">
                Press <kbd className="bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs">Enter</kbd> or click Check In to confirm
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Attendance list - only shown when NOT maximized */}
      {!maximized && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <h2 className="font-bold text-gray-900 dark:text-slate-100">Checked In ({attendance.length})</h2>
            <div className="flex gap-2">
              <button onClick={() => fetchAttendance(session._id)} className="p-1.5 text-gray-400 hover:text-purple-600 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20" title="Refresh">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button onClick={downloadCSV} className="p-1.5 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20" title="Download CSV">
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          {attendance.length === 0 ? (
            <div className="p-10 text-center text-gray-400 dark:text-slate-500 text-sm">No workers checked in yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    {["#", "Worker", "Department", "Time", "Timing", "On Duty"].map((h) => (
                      <th key={h} className="table-header whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((a, i) => (
                    <tr key={a._id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                      <td className="table-cell text-xs text-gray-400">{i + 1}</td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-bold flex items-center justify-center text-xs flex-shrink-0">
                            {a.worker?.fullName?.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{a.worker?.fullName}</p>
                            <p className="text-xs text-gray-400 dark:text-slate-500">{a.worker?.workerId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell text-xs capitalize">{a.worker?.department?.replace(/-/g, " ")}</td>
                      <td className="table-cell font-mono text-sm">{timeStr(a.checkInTime)}</td>
                      <td className="table-cell">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", TIMING_LABELS[a.timingCategory]?.cls)}>
                          {TIMING_LABELS[a.timingCategory]?.label}
                        </span>
                      </td>
                      <td className="table-cell">
                        {a.isOnDuty ? (
                          <span className="badge-success text-xs">On Duty</span>
                        ) : (
                          <span className="text-xs text-gray-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FrontDesk;