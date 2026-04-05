import { useState, useEffect, useRef, useCallback } from "react";
import { Search, UserCheck, Clock, CheckCircle, Maximize2, Minimize2, X, LogOut, AlertCircle } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import axiosInstance from "../../utils/axiosInstance";
import { useToast, ToastContainer } from "../../components/common/Toast";
import { cn } from "../../utils/scoreHelpers";

const fmt = (d) => d ? new Date(d).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit", hour12: true }) : "";
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-GH", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";

const SESSION_TIMEOUT_MS = 3 * 60 * 60 * 1000;

const FrontDesk = () => {
  const { user } = useAuth();
  const { toasts, toast, removeToast } = useToast();
  const [fullscreen, setFullscreen] = useState(false);
  const [session, setSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [setupMode, setSetupMode] = useState(false);
  const [checkInId, setCheckInId] = useState("");
  const [searchName, setSearchName] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [timeoutWarning, setTimeoutWarning] = useState(false);
  const [sessionClosed, setSessionClosed] = useState(false);
  const [setupForm, setSetupForm] = useState({
    serviceType: "sunday", specialServiceName: "",
    serviceDate: new Date().toISOString().split("T")[0],
    serviceStartTime: "08:30", estimatedEndTime: "11:00",
    coWorkerId: "",
  });
  const [settingUp, setSettingUp] = useState(false);
  const checkInRef = useRef(null);
  const timeoutRef = useRef(null);
  const warningRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => { fetchActiveSession(); }, []);
  useEffect(() => { if (session) { fetchAttendance(); startTimeoutWatcher(); } return () => { clearTimeout(timeoutRef.current); clearTimeout(warningRef.current); }; }, [session]);

  const startTimeoutWatcher = useCallback(() => {
    clearTimeout(timeoutRef.current);
    clearTimeout(warningRef.current);
    if (!session) return;

    const sessionStart = new Date(session.serviceStartTime).getTime();
    const closeAt = sessionStart + SESSION_TIMEOUT_MS;
    const warnAt = closeAt - (15 * 60 * 1000);
    const now = Date.now();

    if (now >= closeAt) { handleAutoClose(); return; }

    if (now < warnAt) {
      warningRef.current = setTimeout(() => setTimeoutWarning(true), warnAt - now);
    } else {
      setTimeoutWarning(true);
    }
    timeoutRef.current = setTimeout(() => handleAutoClose(), closeAt - now);
  }, [session]);

  const handleAutoClose = async () => {
    if (!session?._id) return;
    try {
      await axiosInstance.put(`/attendance/session/${session._id}/close`);
      setSessionClosed(true);
      setSession(null);
    } catch {}
  };

  const fetchActiveSession = async () => {
    try {
      const { data } = await axiosInstance.get("/attendance/active-session");
      setSession(data.session);
      if (!data.session) setSetupMode(true);
    } catch {} finally { setSessionLoading(false); }
  };

  const fetchAttendance = async () => {
    if (!session?._id) return;
    try {
      const { data } = await axiosInstance.get(`/attendance/session/${session._id}`);
      setAttendance(data.attendance || []);
    } catch {}
  };

  const handleSetupSession = async () => {
    setSettingUp(true);
    try {
      const { data } = await axiosInstance.post("/attendance/session", {
        ...setupForm,
        serviceStartTime: `${setupForm.serviceDate}T${setupForm.serviceStartTime}:00`,
        estimatedEndTime: `${setupForm.serviceDate}T${setupForm.estimatedEndTime}:00`,
      });
      setSession(data.session);
      setSetupMode(false);
      toast.success("Session opened", `Front desk session started.`);
      setTimeout(() => checkInRef.current?.focus(), 100);
    } catch (err) { toast.error("Error", err.response?.data?.message || "Could not start session."); }
    finally { setSettingUp(false); }
  };

  const handleCheckIn = async (workerId) => {
    const id = workerId || checkInId.trim();
    if (!id) { toast.warning("Required", "Enter a Worker ID."); return; }
    if (!session?._id) { toast.error("No session", "No active front desk session."); return; }
    try {
      const { data } = await axiosInstance.post("/attendance/check-in", { workerId: id, sessionId: session._id });
      setLastCheckIn({ worker: data.worker, time: new Date() });
      setCheckInId("");
      setSearchName("");
      setSearchResults([]);
      fetchAttendance();
      setTimeout(() => setLastCheckIn(null), 5000);
      checkInRef.current?.focus();
    } catch (err) {
      toast.error("Check-in failed", err.response?.data?.message || "Could not check in.");
    }
  };

  const handleSearch = async (name) => {
    setSearchName(name);
    if (name.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { data } = await axiosInstance.get(`/workers/search?name=${encodeURIComponent(name)}`);
      setSearchResults(data.workers || []);
    } catch {} finally { setSearching(false); }
  };

  const toggleFullscreen = () => setFullscreen(!fullscreen);

  if (sessionLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (sessionClosed) return (
    <div className={cn("flex items-center justify-center bg-slate-900 text-white", fullscreen ? "fixed inset-0 z-50" : "min-h-screen")}>
      <div className="text-center px-4">
        <div className="w-20 h-20 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <X className="w-10 h-10 text-red-400" />
        </div>
        <h2 className="text-2xl font-bold mb-3">Session Closed</h2>
        <p className="text-gray-400 mb-6">This front desk session has been closed after 3 hours of service. A new session can be opened for the next service.</p>
        <button onClick={() => { setSessionClosed(false); setSetupMode(true); }} className="btn-primary">Open New Session</button>
      </div>
    </div>
  );

  if (setupMode) return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <img src="/yahal.png" alt="Yachal House" className="h-16 w-auto mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Front Desk Setup</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">Set up the check-in session for today's service</p>
          <div className="mt-3 inline-flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 px-4 py-2 rounded-xl">
            <span className="text-xs text-purple-600 dark:text-purple-400">Duty Worker</span>
            <span className="font-bold text-purple-700 dark:text-purple-300">{user?.fullName}</span>
            {user?.workerId && <span className="font-mono text-xs text-purple-500">ID: {user.workerId}</span>}
          </div>
        </div>
        <div className="card p-8 space-y-5">
          <div>
            <label className="form-label">Service Type</label>
            <select className="input-field" value={setupForm.serviceType} onChange={(e) => setSetupForm({ ...setupForm, serviceType: e.target.value })}>
              <option value="tuesday">Tuesday Service</option>
              <option value="sunday">Sunday Service</option>
              <option value="special">Special Service</option>
            </select>
          </div>
          {setupForm.serviceType === "special" && (
            <div>
              <label className="form-label">Special Service Name</label>
              <input className="input-field" placeholder="e.g. Workers Convention" value={setupForm.specialServiceName} onChange={(e) => setSetupForm({ ...setupForm, specialServiceName: e.target.value })} />
            </div>
          )}
          <div><label className="form-label">Service Date</label><input type="date" className="input-field" value={setupForm.serviceDate} onChange={(e) => setSetupForm({ ...setupForm, serviceDate: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="form-label">Service Start Time</label><input type="time" className="input-field" value={setupForm.serviceStartTime} onChange={(e) => setSetupForm({ ...setupForm, serviceStartTime: e.target.value })} /></div>
            <div><label className="form-label">Estimated End Time</label><input type="time" className="input-field" value={setupForm.estimatedEndTime} onChange={(e) => setSetupForm({ ...setupForm, estimatedEndTime: e.target.value })} /></div>
          </div>
          <div>
            <label className="form-label">Co-worker ID (optional)</label>
            <input className="input-field" placeholder="Worker ID of your co-worker" value={setupForm.coWorkerId} onChange={(e) => setSetupForm({ ...setupForm, coWorkerId: e.target.value })} />
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-400">
            This session will automatically close 3 hours after the service start time. All worker reporting times will be recorded.
          </div>
          <button onClick={handleSetupSession} disabled={settingUp} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
            {settingUp ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Open Check-in Session"}
          </button>
        </div>
      </div>
    </div>
  );

  const wrapClass = fullscreen
    ? "fixed inset-0 z-50 bg-slate-950 text-white overflow-auto"
    : "min-h-screen bg-gray-50 dark:bg-slate-900";

  return (
    <div className={wrapClass}>
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className={cn("sticky top-0 z-30 border-b px-4 py-3 flex items-center justify-between", fullscreen ? "bg-slate-900 border-slate-700" : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800")}>
        <div className="flex items-center gap-3">
          <img src="/yahal.png" alt="Yachal House" className="h-9 w-auto" />
          <div>
            <p className={cn("font-bold text-sm capitalize", fullscreen ? "text-white" : "text-gray-900 dark:text-slate-100")}>
              {session?.specialServiceName || `${session?.serviceType} Service`} - {fmtDate(session?.serviceDate)}
            </p>
            <p className={cn("text-xs", fullscreen ? "text-slate-400" : "text-gray-400 dark:text-slate-500")}>
              {attendance.length} checked in - Session closes {fmt(new Date(new Date(session?.serviceStartTime).getTime() + SESSION_TIMEOUT_MS))}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className={cn("text-xs font-medium", fullscreen ? "text-green-400" : "text-green-600 dark:text-green-400")}>Live</span>
          </div>
          <button onClick={toggleFullscreen} className={cn("p-2 rounded-lg transition-colors", fullscreen ? "text-slate-400 hover:text-white hover:bg-slate-700" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700")}>
            {fullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {timeoutWarning && (
        <div className="bg-amber-600 text-white px-4 py-3 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">Session closes in 15 minutes. 3 hours have passed since service start time.</p>
        </div>
      )}

      <div className={cn("max-w-3xl mx-auto px-4 py-8 space-y-6", fullscreen && "max-w-4xl")}>

        {lastCheckIn && (
          <div className={cn("rounded-2xl p-5 flex items-center gap-4 animate-slide-up border", fullscreen ? "bg-green-900/30 border-green-700" : "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700")}>
            <div className={cn("w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0", fullscreen ? "bg-green-800 text-green-200" : "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300")}>
              {lastCheckIn.worker?.fullName?.charAt(0)}
            </div>
            <div className="flex-1">
              <p className={cn("font-bold text-xl", fullscreen ? "text-green-200" : "text-green-800 dark:text-green-200")}>{lastCheckIn.worker?.fullName}</p>
              <p className={cn("text-sm", fullscreen ? "text-green-400" : "text-green-600 dark:text-green-400")}>Checked in at {fmt(lastCheckIn.time)}</p>
              {lastCheckIn.worker?.department && <p className={cn("text-xs mt-0.5 capitalize", fullscreen ? "text-green-500" : "text-green-500")}>{lastCheckIn.worker.department?.replace(/-/g, " ")}</p>}
            </div>
            <CheckCircle className={cn("w-10 h-10 flex-shrink-0", fullscreen ? "text-green-400" : "text-green-500")} />
          </div>
        )}

        <div className={cn("rounded-2xl p-6", fullscreen ? "bg-slate-800 border border-slate-700" : "card")}>
          <h2 className={cn("font-bold mb-5 flex items-center gap-2", fullscreen ? "text-white text-lg" : "text-gray-900 dark:text-slate-100")}>
            <UserCheck className="w-5 h-5 text-purple-400" />Check In by Worker ID
          </h2>
          <div className="flex gap-3">
            <input
              ref={checkInRef}
              className={cn("flex-1 font-bold tracking-widest text-center rounded-xl border px-4 py-4 text-2xl outline-none transition-colors", fullscreen ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-purple-500" : "input-field text-2xl py-4")}
              placeholder="Type ID here"
              value={checkInId}
              onChange={(e) => setCheckInId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCheckIn()}
              autoComplete="off"
              autoFocus
            />
            <button onClick={() => handleCheckIn()} className="btn-primary px-6 text-base py-4">Check In</button>
          </div>
          <p className={cn("text-xs mt-2 text-center", fullscreen ? "text-slate-500" : "text-gray-400 dark:text-slate-500")}>Press Enter or click Check In after typing the Worker ID</p>
        </div>

        <div className={cn("rounded-2xl p-6", fullscreen ? "bg-slate-800 border border-slate-700" : "card")}>
          <h2 className={cn("font-bold mb-5 flex items-center gap-2", fullscreen ? "text-white text-lg" : "text-gray-900 dark:text-slate-100")}>
            <Search className="w-5 h-5 text-green-500" />Search by Name
          </h2>
          <div className="relative">
            <input
              className={cn("w-full rounded-xl border px-4 py-3 outline-none transition-colors", fullscreen ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-purple-500" : "input-field")}
              placeholder="Start typing worker name..."
              value={searchName}
              onChange={(e) => handleSearch(e.target.value)}
            />
            {searching && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />}
          </div>
          {searchResults.length > 0 && (
            <div className="mt-3 space-y-2">
              {searchResults.map((w) => (
                <div key={w._id} className={cn("flex items-center gap-3 p-3 rounded-xl transition-colors", fullscreen ? "bg-slate-700 hover:bg-slate-600" : "bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700")}>
                  <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-bold flex items-center justify-center text-sm flex-shrink-0">{w.fullName?.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("font-semibold text-sm truncate", fullscreen ? "text-white" : "text-gray-900 dark:text-slate-100")}>{w.fullName}</p>
                    <p className={cn("text-xs", fullscreen ? "text-slate-400" : "text-gray-400 dark:text-slate-500")}>ID: {w.workerId}</p>
                  </div>
                  <button onClick={() => handleCheckIn(w.workerId)} className="btn-primary text-xs py-1.5 px-3 flex-shrink-0">Check In</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {attendance.length > 0 && (
          <div className={cn("rounded-2xl p-6", fullscreen ? "bg-slate-800 border border-slate-700" : "card")}>
            <h2 className={cn("font-bold mb-4 flex items-center gap-2", fullscreen ? "text-white text-lg" : "text-gray-900 dark:text-slate-100")}>
              <Clock className="w-5 h-5 text-blue-500" />Checked In ({attendance.length})
            </h2>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {attendance.map((a) => (
                <div key={a._id} className={cn("flex items-center gap-3 p-3 rounded-xl border", a.isLate
                  ? fullscreen ? "border-amber-700 bg-amber-900/20" : "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10"
                  : fullscreen ? "border-slate-700 bg-slate-700/50" : "border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800")}>
                  <div className={cn("w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs flex-shrink-0", fullscreen ? "bg-slate-600 text-white" : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400")}>
                    {a.worker?.fullName?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium truncate", fullscreen ? "text-white" : "text-gray-900 dark:text-slate-100")}>{a.worker?.fullName}</p>
                    <p className={cn("text-xs", fullscreen ? "text-slate-400" : "text-gray-400 dark:text-slate-500")}>ID: {a.worker?.workerId}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={cn("text-xs font-semibold", fullscreen ? "text-white" : "text-gray-700 dark:text-slate-300")}>{fmt(a.checkInTime)}</p>
                    {a.isLate && <span className={cn("text-xs", fullscreen ? "text-amber-400" : "text-amber-600 dark:text-amber-400")}>Late</span>}
                    {a.isOnDuty && <p className={cn("text-xs", fullscreen ? "text-purple-400" : "text-purple-600 dark:text-purple-400")}>On Duty</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FrontDesk;