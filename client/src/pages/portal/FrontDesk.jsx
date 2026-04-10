import { useState, useEffect, useRef, useCallback } from "react";
import {
  Maximize2, Minimize2, UserCheck, CheckCircle,
  Search, LogOut, Shield, RefreshCw, Download, Plus,
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

const INACTIVITY_MS = 3 * 60 * 60 * 1000;

const FrontDesk = () => {
  const { user } = useAuth();
  const { toasts, toast, removeToast } = useToast();
  const isAdminLevel = ["pastor", "admin", "moderator"].includes(user?.role);

  const [step, setStep] = useState("checking");
  const [session, setSession] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [dutyWorkers, setDutyWorkers] = useState([]);
  const [maximized, setMaximized] = useState(false);
  const [stats, setStats] = useState(null);
  const [time, setTime] = useState(new Date());

  const [selfWorker, setSelfWorker] = useState(null);
  const [deputyFor, setDeputyFor] = useState(""); // name of assigned worker they are covering
  const [showDeputyForm, setShowDeputyForm] = useState(false);
  const [partnerQuery, setPartnerQuery] = useState("");
  const [partnerWorker, setPartnerWorker] = useState(null);
  const [partnerArrived, setPartnerArrived] = useState(null);
  const [authError, setAuthError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [hasPartner, setHasPartner] = useState(null);

  const [serviceType, setServiceType] = useState("sunday");
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [serviceStart, setServiceStart] = useState("");
  const [specialName, setSpecialName] = useState("");
  const [creating, setCreating] = useState(false);

  const [showForceClose, setShowForceClose] = useState(false);
  const [forceReason, setForceReason] = useState("");
  const [forceReasonOther, setForceReasonOther] = useState("");
  const [closing, setClosing] = useState(false);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [checkingIn, setCheckingIn] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState(null);
  const inputRef = useRef(null);
  const inactivityRef = useRef(null);
  const sessionRef = useRef(null); // keep session in ref for inactivity callback

  // ── Clock ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Keep sessionRef in sync ────────────────────────────────────────────
  useEffect(() => { sessionRef.current = session; }, [session]);

  // ── Auto-close handler (uses ref to avoid stale closure) ──────────────
  const doAutoClose = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) return;
    try {
      await axiosInstance.put(`/attendance/close/${s._id}`, {
        force: false, closeReason: "auto-inactivity",
      });
    } catch {}
    setSession(null);
    setAttendance([]);
    setStats(null);
    setDutyWorkers([]);
    setLastCheckIn(null);
    setStep("auth-self");
    toast.warning("Session closed", "Front desk closed due to 3 hours of inactivity.");
  }, []);

  // ── Inactivity timer ───────────────────────────────────────────────────
  const resetInactivity = useCallback(() => {
    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    inactivityRef.current = setTimeout(doAutoClose, INACTIVITY_MS);
  }, [doAutoClose]);

  useEffect(() => {
    if (step !== "active") {
      if (inactivityRef.current) clearTimeout(inactivityRef.current);
      return;
    }
    window.addEventListener("mousemove", resetInactivity);
    window.addEventListener("keydown", resetInactivity);
    window.addEventListener("touchstart", resetInactivity);
    resetInactivity(); // start timer immediately
    return () => {
      window.removeEventListener("mousemove", resetInactivity);
      window.removeEventListener("keydown", resetInactivity);
      window.removeEventListener("touchstart", resetInactivity);
      if (inactivityRef.current) clearTimeout(inactivityRef.current);
    };
  }, [step, resetInactivity]);

  // ── On mount: check active session ────────────────────────────────────
  useEffect(() => { checkSession(); }, []);

  const checkSession = async () => {
    try {
      const { data } = await axiosInstance.get("/attendance/active");
      if (data.session) {
        setSession(data.session);
        await fetchAttendance(data.session._id);
        setStep("active");
        return;
      }
      if (isAdminLevel) { setStep("auth-self"); return; }
      try {
        const { data: rd } = await axiosInstance.get("/roster/my-assignment");
        const assigned = rd.roster?.myAssignments?.some((a) => a.department === "front-desk");
        setStep(assigned ? "auth-self" : "unauthorized");
      } catch { setStep("unauthorized"); }
    } catch { setStep("unauthorized"); }
  };

  const fetchAttendance = async (sessionId) => {
    try {
      const { data } = await axiosInstance.get(`/attendance/session/${sessionId}`);
      const list = data.attendance || [];
      setAttendance(list);
      setDutyWorkers(list.filter((a) => a.isOnDuty));
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

  // ── Close session (normal + force) ────────────────────────────────────
  const resetSessionState = () => {
    setSession(null); setAttendance([]); setStats(null);
    setLastCheckIn(null); setDutyWorkers([]);
    setShowForceClose(false); setForceReason(""); setForceReasonOther("");
    setStep("auth-self");
  };

  const closeSession = async ({ force = false, reason = null } = {}) => {
    const s = sessionRef.current;
    if (!s) return;
    setClosing(true);
    try {
      await axiosInstance.put(`/attendance/close/${s._id}`, {
        force,
        closeReason: reason,
      });
      toast.success("Session closed", "Report sent to admin team.");
      resetSessionState();
    } catch (err) {
      const msg = err.response?.data?.message || "";
      // If already closed, treat as success - state just needs to reset
      if (err.response?.status === 400 && msg.toLowerCase().includes("already closed")) {
        toast.success("Session closed", "Session was already closed.");
        resetSessionState();
      } else {
        toast.error("Error", msg || "Could not close session.");
      }
    } finally { setClosing(false); }
  };

  const handleEndSession = () => {
    if (!confirm("End session? A report will be sent to the admin team.")) return;
    closeSession({ force: false, reason: "end-of-service" });
  };

  const handleForceClose = () => {
    const reason = forceReason === "other"
      ? forceReasonOther.trim()
      : forceReason;
    if (!reason) {
      toast.warning("Required", "Select or enter a reason.");
      return;
    }
    closeSession({ force: true, reason });
  };

  // ── Auth self ──────────────────────────────────────────────────────────
  const handleVerifySelf = () => {
    if (user?.workerId === "001") {
      setAuthError("Worker ID 001 cannot operate the front desk.");
      return;
    }
    setSelfWorker({ fullName: user.fullName, workerId: user.workerId, _id: user._id });
    setStep("confirm-partner");
  };

  // ── Partner search ─────────────────────────────────────────────────────
  const handlePartnerSearch = async () => {
    if (!partnerQuery.trim()) return;
    setVerifying(true); setAuthError("");
    try {
      const { data } = await axiosInstance.get(`/attendance/search?q=${partnerQuery.trim()}`);
      const w = data.workers?.[0];
      if (!w) { setAuthError("No worker found."); return; }
      if (w.workerId === "001") { setAuthError("Worker ID 001 cannot be assigned front desk duty."); return; }
      if (w.workerId === user.workerId) { setAuthError("You cannot add yourself as partner."); return; }
      setPartnerWorker(w);
    } catch { setAuthError("Could not verify. Try again."); }
    finally { setVerifying(false); }
  };

  // ── Create session ─────────────────────────────────────────────────────
  const handleCreateSession = async () => {
    if (!serviceStart) { toast.warning("Required", "Set the service start time."); return; }
    setCreating(true);
    try {
      const { data } = await axiosInstance.post("/attendance/session", {
        serviceType, serviceDate,
        serviceStartTime: `${serviceDate}T${serviceStart}`,
        specialServiceName: specialName,
        coSupervisorId: partnerWorker?._id || null,
        isDeputy: selfWorker?.isDeputy || false,
        deputyFor: selfWorker?.deputyFor || null,
      });
      const newSession = data.session;
      setSession(newSession);
      sessionRef.current = newSession;
      await fetchAttendance(newSession._id);
      setStep("active");
      toast.success("Session opened", "Front desk is now active.");
      if (partnerWorker && partnerArrived) {
        await axiosInstance.post("/attendance/check-in", {
          identifier: partnerWorker.workerId,
          sessionId: newSession._id,
          isOnDuty: true,
        });
        await fetchAttendance(newSession._id);
      }
    } catch (err) { toast.error("Error", err.response?.data?.message || "Could not open."); }
    finally { setCreating(false); }
  };

  // ── Check in ───────────────────────────────────────────────────────────
  const handleCheckIn = async (identifier) => {
    if (!sessionRef.current || !identifier?.trim()) return;
    setCheckingIn(true); setSuggestions([]); setQuery("");
    try {
      const { data } = await axiosInstance.post("/attendance/check-in", {
        identifier: identifier.trim(),
        sessionId: sessionRef.current._id,
        isOnDuty: false,
      });
      setLastCheckIn({ worker: data.worker, timing: data.timingCategory, message: data.message });
      fetchAttendance(sessionRef.current._id);
    } catch (err) {
      toast.error("Error", err.response?.data?.message || "Could not check in.");
    } finally { setCheckingIn(false); }
  };

  // ── Suggestions ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!query.trim()) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await axiosInstance.get(`/attendance/search?q=${query.trim()}`);
        const checked = attendance.map((a) => a.worker?._id);
        setSuggestions((data.workers || []).filter((w) => !checked.includes(w._id)));
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [query, attendance]);

  useEffect(() => {
    if (maximized && inputRef.current) inputRef.current.focus();
  }, [maximized]);

  const timeStr = (iso) => iso
    ? new Date(iso).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" })
    : "";

  const isDutyWorker = session && dutyWorkers.some((d) => d.worker?._id === user?._id);

  const downloadCSV = () => {
    const rows = [["#", "Name", "Worker ID", "Department", "Time", "Timing", "On Duty"]];
    attendance.forEach((a, i) => rows.push([
      i + 1, a.worker?.fullName, a.worker?.workerId,
      a.worker?.department?.replace(/-/g, " "),
      timeStr(a.checkInTime),
      TIMING_LABELS[a.timingCategory]?.label,
      a.isOnDuty ? "Yes" : "No",
    ]));
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `frontdesk-${session?.serviceType}-${serviceDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════

  if (step === "checking") return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (step === "unauthorized") return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="card p-8 w-full max-w-md text-center space-y-5">
        <Shield className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto" />
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-1">Access Restricted</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed">
            You are not assigned to front desk duty in the published roster.
          </p>
        </div>

        {!showDeputyForm ? (
          <div className="space-y-3 pt-2">
            <p className="text-xs text-gray-400 dark:text-slate-500">
              Are you covering for an assigned worker who cannot make it?
            </p>
            <button
              onClick={() => setShowDeputyForm(true)}
              className="btn-outline w-full text-sm"
            >
              Yes — I'm covering for someone
            </button>
            <p className="text-xs text-gray-400 dark:text-slate-500 pt-1">
              Otherwise please check your roster or speak with your department leader.
            </p>
          </div>
        ) : (
          <div className="space-y-4 text-left">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                This will be logged. You are taking responsibility for front desk duty on behalf of the assigned worker. The admin team will be notified.
              </p>
            </div>
            <div>
              <label className="form-label">Your name and Worker ID</label>
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl px-4 py-3">
                <p className="font-semibold text-purple-700 dark:text-purple-300 text-sm">{user?.fullName}</p>
                <p className="text-xs text-purple-500">Worker ID: {user?.workerId}</p>
              </div>
            </div>
            <div>
              <label className="form-label">
                Who are you covering for? <span className="text-red-400">*</span>
              </label>
              <input
                className="input-field"
                placeholder="Full name of the assigned worker"
                value={deputyFor}
                onChange={(e) => setDeputyFor(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                Enter the name of the worker who was assigned but cannot attend.
              </p>
            </div>
            {authError && <p className="text-sm text-red-500">{authError}</p>}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setShowDeputyForm(false); setDeputyFor(""); setAuthError(""); }}
                className="btn-ghost flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!deputyFor.trim()) { setAuthError("Please enter the name of the worker you are covering for."); return; }
                  setSelfWorker({ fullName: user.fullName, workerId: user.workerId, _id: user._id, isDeputy: true, deputyFor: deputyFor.trim() });
                  setStep("confirm-partner");
                }}
                className="btn-primary flex-1"
              >
                Continue
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (step === "auth-self") return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="card p-8 w-full max-w-sm text-center space-y-5">
        <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center mx-auto">
          <UserCheck className="w-7 h-7 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-1">Front Desk Duty</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">Confirm you are opening the front desk for today's service.</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
          <p className="font-bold text-purple-700 dark:text-purple-300">{user?.fullName}</p>
          <p className="text-xs text-purple-500 mt-0.5">Worker ID: {user?.workerId}</p>
        </div>
        {selfWorker?.isDeputy && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-left">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-0.5">Covering for:</p>
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">{selfWorker.deputyFor}</p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">Admin team will be notified of this substitution.</p>
          </div>
        )}
        {authError && <p className="text-sm text-red-500">{authError}</p>}
        <button onClick={handleVerifySelf} className="btn-primary w-full">
          Yes, I'm on duty — Continue
        </button>
        <p className="text-xs text-gray-400 dark:text-slate-500">
          If you are not assigned to front desk duty, please check your roster or speak with your department leader.
        </p>
      </div>
    </div>
  );

  if (step === "confirm-partner") return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="card p-8 w-full max-w-sm space-y-5">
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 text-center">
          <p className="text-sm font-semibold text-green-700 dark:text-green-400">{selfWorker?.fullName} — confirmed on duty</p>
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-1">Do you have a partner today?</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">Front desk can be operated by 1 or 2 workers.</p>
        </div>

        {hasPartner === null && (
          <div className="flex gap-3">
            <button onClick={() => setHasPartner(false)} className="btn-outline flex-1">No, just me</button>
            <button onClick={() => setHasPartner(true)} className="btn-primary flex-1">Yes, I have a partner</button>
          </div>
        )}

        {hasPartner === false && (
          <button onClick={() => setStep("setup")} className="btn-primary w-full">Continue — Open Solo</button>
        )}

        {hasPartner === true && (
          <div className="space-y-3">
            {!partnerWorker ? (
              <>
                <div>
                  <label className="form-label">Partner's Worker ID or Name</label>
                  <input
                    className="input-field"
                    placeholder="e.g. 042 or full name"
                    value={partnerQuery}
                    onChange={(e) => { setPartnerQuery(e.target.value); setAuthError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handlePartnerSearch()}
                    autoFocus
                  />
                </div>
                {authError && <p className="text-sm text-red-500">{authError}</p>}
                <button onClick={handlePartnerSearch} disabled={verifying || !partnerQuery.trim()} className="btn-primary w-full">
                  {verifying ? "Searching..." : "Find Partner"}
                </button>
              </>
            ) : (
              <>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-center">
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">{partnerWorker.fullName}</p>
                  <p className="text-xs text-blue-500">ID: {partnerWorker.workerId}</p>
                </div>
                <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Has {partnerWorker.fullName.split(" ")[0]} arrived yet?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPartnerArrived(false)}
                    className={cn("flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all",
                      partnerArrived === false
                        ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                        : "border-gray-100 dark:border-slate-700 text-gray-500 hover:border-amber-300"
                    )}
                  >
                    Not yet
                  </button>
                  <button
                    onClick={() => setPartnerArrived(true)}
                    className={cn("flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all",
                      partnerArrived === true
                        ? "border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                        : "border-gray-100 dark:border-slate-700 text-gray-500 hover:border-green-300"
                    )}
                  >
                    Yes, here
                  </button>
                </div>
                {partnerArrived !== null && (
                  <button onClick={() => setStep("setup")} className="btn-primary w-full">Continue to Setup</button>
                )}
                <button
                  onClick={() => { setPartnerWorker(null); setPartnerQuery(""); setPartnerArrived(null); }}
                  className="btn-ghost w-full text-sm"
                >
                  Change partner
                </button>
              </>
            )}
            <button
              onClick={() => { setHasPartner(null); setPartnerWorker(null); setPartnerQuery(""); setPartnerArrived(null); }}
              className="text-xs text-gray-400 hover:text-gray-600 w-full text-center"
            >
              Go back
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (step === "setup") return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="card p-8 w-full max-w-md space-y-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-1">Service Details</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            On duty: <strong>{selfWorker?.fullName}</strong>
            {partnerWorker ? ` and ${partnerWorker.fullName}` : ""}
          </p>
        </div>
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
            <label className="form-label">Date</label>
            <input type="date" className="input-field" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
          </div>
        </div>
        {serviceType === "special" && (
          <div>
            <label className="form-label">Special Service Name</label>
            <input className="input-field" placeholder="e.g. Easter Sunday" value={specialName} onChange={(e) => setSpecialName(e.target.value)} />
          </div>
        )}
        <div>
          <label className="form-label">Service Start Time <span className="text-red-400">*</span></label>
          <input type="time" className="input-field" value={serviceStart} onChange={(e) => setServiceStart(e.target.value)} />
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
            Session auto-closes after 3 hours of inactivity if not manually closed.
          </p>
        </div>
        <button onClick={handleCreateSession} disabled={creating || !serviceStart} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
          {creating
            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <CheckCircle className="w-4 h-4" />
          }
          {creating ? "Opening..." : "Open Front Desk"}
        </button>
      </div>
    </div>
  );

  // ── Active session ─────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="section-title">Front Desk</h1>
          <p className="section-subtitle">
            <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
              {time.toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
            {" · "}
            {session?.serviceType?.charAt(0).toUpperCase() + session?.serviceType?.slice(1)} Service
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Duty workers: normal end session */}
          {isDutyWorker && (
            <button
              onClick={handleEndSession}
              disabled={closing}
              className="btn-outline text-sm text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              {closing ? "Closing..." : "End Session"}
            </button>
          )}
          {/* Force close - visible to ALL users on this page */}
          <button
            onClick={() => setShowForceClose(true)}
            className="btn-outline text-sm text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-1.5"
          >
            <Shield className="w-4 h-4" /> Force Close
          </button>
        </div>
      </div>

      {/* Deputy warning banner */}
      {selfWorker?.isDeputy && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 flex items-start gap-2">
          <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            <strong>Deputy duty</strong> — You are covering for <strong>{selfWorker.deputyFor}</strong>. This has been logged and the admin team has been notified.
          </p>
        </div>
      )}

      {/* Duty workers badges */}
      {(dutyWorkers.length > 0 || (partnerWorker && step === "active")) && (
        <div className="flex flex-wrap gap-2">
          {dutyWorkers.map((d) => (
            <div key={d._id} className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl px-3 py-1.5">
              <div className="w-5 h-5 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center">
                {d.worker?.fullName?.charAt(0)}
              </div>
              <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">{d.worker?.fullName}</span>
              <span className="text-xs text-purple-400">On Duty</span>
            </div>
          ))}
          {partnerWorker && !dutyWorkers.some((d) => d.worker?.workerId === partnerWorker.workerId) && (
            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-1.5">
              <div className="w-5 h-5 rounded-full bg-amber-400 text-white text-xs font-bold flex items-center justify-center">
                {partnerWorker.fullName?.charAt(0)}
              </div>
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">{partnerWorker.fullName}</span>
              <span className="text-xs text-amber-400">Expected</span>
            </div>
          )}
        </div>
      )}

      {/* Stats — admin/mod/pastor only */}
      {isAdminLevel && stats && (
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

      {/* Check-in card */}
      <div className={cn(
        "card overflow-hidden transition-all duration-300",
        maximized ? "fixed inset-0 z-50 rounded-none flex flex-col" : ""
      )}>
        <div className={cn(
          "flex items-center justify-between border-b border-gray-100 dark:border-slate-700",
          maximized ? "px-6 py-4 bg-white dark:bg-slate-800" : "px-5 py-4"
        )}>
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h2 className="font-bold text-gray-900 dark:text-slate-100">Check In Worker</h2>
          </div>
          <button
            onClick={() => setMaximized(!maximized)}
            className="p-2 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
          >
            {maximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>

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
                  className={cn("absolute right-2 top-1/2 -translate-y-1/2 btn-primary", maximized ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-xs")}
                >
                  {checkingIn ? "..." : "Check In"}
                </button>
              </div>

              {suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-14 z-20 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-2xl shadow-2xl overflow-hidden">
                  {suggestions.map((w) => (
                    <button
                      key={w._id}
                      type="button"
                      onClick={() => handleCheckIn(w.workerId)}
                      className={cn("w-full flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-left", maximized ? "px-5 py-4" : "px-4 py-3")}
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

      {/* Force close modal */}
      {showForceClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4 animate-slide-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-slate-100">Force Close Session</h3>
                <p className="text-xs text-gray-400 dark:text-slate-500">A full report will be sent to the admin team.</p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Select a reason</p>
              {[
                { value: "end-of-service",   label: "End of service" },
                { value: "attendance-over",  label: "Attendance recording complete" },
                { value: "other",            label: "Other — I'll type it below" },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all",
                    forceReason === opt.value
                      ? "border-red-400 bg-red-50 dark:bg-red-900/20"
                      : "border-gray-100 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-500"
                  )}
                >
                  <input
                    type="radio"
                    name="forceReason"
                    value={opt.value}
                    checked={forceReason === opt.value}
                    onChange={(e) => setForceReason(e.target.value)}
                    className="accent-red-500 flex-shrink-0"
                  />
                  <span className="text-sm text-gray-700 dark:text-slate-300">{opt.label}</span>
                </label>
              ))}
              {forceReason === "other" && (
                <input
                  className="input-field text-sm"
                  placeholder="Describe the reason..."
                  value={forceReasonOther}
                  onChange={(e) => setForceReasonOther(e.target.value)}
                  autoFocus
                />
              )}
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setShowForceClose(false); setForceReason(""); setForceReasonOther(""); }}
                className="btn-ghost flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleForceClose}
                disabled={closing || !forceReason || (forceReason === "other" && !forceReasonOther.trim())}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {closing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                {closing ? "Closing..." : "Force Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attendance list */}
      {!maximized && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <h2 className="font-bold text-gray-900 dark:text-slate-100">
              Checked In ({attendance.length})
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => session && fetchAttendance(session._id)}
                className="p-1.5 text-gray-400 hover:text-purple-600 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              {isAdminLevel && (
                <button
                  onClick={downloadCSV}
                  className="p-1.5 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20"
                  title="Download CSV"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {attendance.length === 0 ? (
            <div className="p-10 text-center text-gray-400 dark:text-slate-500 text-sm">
              No workers checked in yet.
            </div>
          ) : isAdminLevel ? (
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
                            <p className="text-xs text-gray-400">{a.worker?.workerId}</p>
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
                        {a.isOnDuty
                          ? <span className="badge-success text-xs">On Duty</span>
                          : <span className="text-xs text-gray-300 dark:text-slate-600">—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            // Workers see name + time only
            <div className="divide-y divide-gray-50 dark:divide-slate-800 max-h-80 overflow-y-auto">
              {attendance.map((a, i) => (
                <div key={a._id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xs text-gray-300 dark:text-slate-600 w-5">{i + 1}</span>
                  <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-bold flex items-center justify-center text-xs flex-shrink-0">
                    {a.worker?.fullName?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{a.worker?.fullName}</p>
                    <p className="text-xs text-gray-400">{a.worker?.workerId}</p>
                  </div>
                  <span className="font-mono text-sm text-gray-500 dark:text-slate-400 flex-shrink-0">
                    {timeStr(a.checkInTime)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FrontDesk;