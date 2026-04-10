import { useState, useEffect, useRef } from "react";
import {
  Clock, UserCheck, Users, AlertCircle, CheckCircle, X,
  Play, Square, Search, ChevronDown, ChevronUp, Calendar,
  Timer, TrendingUp, Shield, Download, RefreshCw
} from "lucide-react";
import axiosInstance from "../../utils/axiosInstance";
import { useAuth } from "../../hooks/useAuth";
import { useToast, ToastContainer } from "../../components/common/Toast";
import Loader from "../../components/common/Loader";
import { cn } from "../../utils/scoreHelpers";

const SERVICE_TYPES = [
  { value: "sunday",  label: "Sunday Service" },
  { value: "tuesday", label: "Tuesday Service" },
  { value: "special", label: "Special Service" },
];

const TIMING_LABELS = {
  "early-60plus": { label: "60+ min early", color: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800" },
  "early-30to60": { label: "30-60 min early", color: "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" },
  "early-15to30": { label: "15-30 min early", color: "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" },
  "early-0to15":  { label: "0-15 min early", color: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800" },
  "late":          { label: "Late", color: "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" },
};

const TimingBadge = ({ category }) => {
  const t = TIMING_LABELS[category] || TIMING_LABELS["early-0to15"];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${t.color}`}>
      {t.label}
    </span>
  );
};

const StatCard = ({ icon, label, value, sub, color }) => (
  <div className="card p-4 flex items-center gap-3">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-xl font-bold text-gray-900 dark:text-slate-100 leading-none">{value}</p>
      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">{label}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
  </div>
);

export default function FrontDesk() {
  const { user } = useAuth();
  const { toasts, toast, removeToast } = useToast();

  // Session state
  const [session, setSession] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [closing, setClosing] = useState(false);

  // Check-in state
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [checkingIn, setCheckingIn] = useState(false);
  const [lastCheckedIn, setLastCheckedIn] = useState(null);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  // New session form
  const [showNewSession, setShowNewSession] = useState(false);
  const [form, setForm] = useState({
    serviceType: "sunday",
    specialServiceName: "",
    serviceDate: new Date().toISOString().split("T")[0],
    serviceStartTime: "08:30",
  });

  // History state
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedSession, setExpandedSession] = useState(null);

  // Clock
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-close countdown
  const timeUntilClose = session?.autoCloseTime
    ? Math.max(0, new Date(session.autoCloseTime) - now)
    : null;
  const closeMinutes = timeUntilClose !== null ? Math.floor(timeUntilClose / 60000) : null;
  const closeHours = closeMinutes !== null ? Math.floor(closeMinutes / 60) : null;
  const closeRemMins = closeMinutes !== null ? closeMinutes % 60 : null;

  const fetchActive = async () => {
    try {
      const { data } = await axiosInstance.get("/attendance/active");
      setSession(data.session);
      if (data.session) {
        fetchAttendance(data.session._id);
      }
    } catch { toast.error("Error", "Could not load session."); }
    finally { setLoading(false); }
  };

  const fetchAttendance = async (sessionId) => {
    try {
      const { data } = await axiosInstance.get(`/attendance/session/${sessionId}`);
      setAttendance(data.attendance || []);
    } catch {}
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await axiosInstance.get("/attendance/history?limit=20");
      setHistory(data.sessions || []);
    } catch { toast.error("Error", "Could not load history."); }
    finally { setHistoryLoading(false); }
  };

  useEffect(() => {
    fetchActive();
  }, []);

  useEffect(() => {
    if (showHistory && history.length === 0) fetchHistory();
  }, [showHistory]);

  // Auto-refresh attendance every 15 seconds
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => fetchAttendance(session._id), 15000);
    return () => clearInterval(interval);
  }, [session]);

  // Search with debounce
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await axiosInstance.get(`/attendance/search?q=${encodeURIComponent(query)}`);
        setSuggestions(data.workers || []);
      } catch {}
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleOpenSession = async () => {
    setSessionLoading(true);
    try {
      const startDateTime = new Date(`${form.serviceDate}T${form.serviceStartTime}:00`);
      await axiosInstance.post("/attendance/session", {
        serviceType: form.serviceType,
        specialServiceName: form.specialServiceName,
        serviceDate: form.serviceDate,
        serviceStartTime: startDateTime.toISOString(),
      });
      toast.success("Session opened", "Front desk is now live. Workers can check in.");
      setShowNewSession(false);
      fetchActive();
    } catch (err) {
      toast.error("Error", err.response?.data?.message || "Could not open session.");
    } finally { setSessionLoading(false); }
  };

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
      setLastCheckedIn({ name: worker.fullName, time: new Date(), category: data.timingCategory });
      toast.success("Checked in", data.message);
      fetchAttendance(session._id);
    } catch (err) {
      toast.error("Already checked in", err.response?.data?.message || "Could not check in.");
    } finally {
      setCheckingIn(false);
      searchRef.current?.focus();
    }
  };

  const handleManualCheckIn = async () => {
    if (!query.trim() || !session) return;
    setCheckingIn(true);
    try {
      const { data } = await axiosInstance.post("/attendance/check-in", {
        identifier: query.trim(),
        sessionId: session._id,
        isOnDuty: false,
      });
      setLastCheckedIn({ name: data.worker.fullName, time: new Date(), category: data.timingCategory });
      toast.success("Checked in", data.message);
      setQuery("");
      setSuggestions([]);
      fetchAttendance(session._id);
    } catch (err) {
      toast.error("Error", err.response?.data?.message || "Worker not found.");
    } finally {
      setCheckingIn(false);
      searchRef.current?.focus();
    }
  };

  const handleClose = async () => {
    if (!confirm("Close this front desk session? Stats will be computed and sent to admin team.")) return;
    setClosing(true);
    try {
      await axiosInstance.put(`/attendance/close/${session._id}`);
      toast.success("Session closed", "Report sent to admin, mod and pastor.");
      setSession(null);
      setAttendance([]);
      setLastCheckedIn(null);
      fetchHistory();
      setShowHistory(true);
    } catch (err) {
      toast.error("Error", err.response?.data?.message || "Could not close session.");
    } finally { setClosing(false); }
  };

  const downloadCSV = () => {
    const rows = [["#", "Name", "Worker ID", "Department", "Check-in Time", "Timing", "On Duty"]];
    attendance.forEach((a, i) => {
      rows.push([
        i + 1,
        a.worker?.fullName,
        a.worker?.workerId,
        a.worker?.department?.replace(/-/g, " "),
        new Date(a.checkInTime).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" }),
        TIMING_LABELS[a.timingCategory]?.label || a.timingCategory,
        a.isOnDuty ? "Yes" : "No",
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${session?.serviceType}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Stats from current attendance
  const stats = {
    total: attendance.length,
    early60: attendance.filter((a) => a.timingCategory === "early-60plus").length,
    early30: attendance.filter((a) => a.timingCategory === "early-30to60").length,
    early15: attendance.filter((a) => a.timingCategory === "early-15to30").length,
    early0:  attendance.filter((a) => a.timingCategory === "early-0to15").length,
    late:    attendance.filter((a) => a.timingCategory === "late").length,
    onDuty:  attendance.filter((a) => a.isOnDuty).length,
  };

  if (loading) return <Loader text="Loading front desk..." />;

  return (
    <div className="space-y-5 animate-fade-in">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="section-title">Front Desk</h1>
          <p className="section-subtitle">
            {now.toLocaleDateString("en-GH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {" · "}
            {now.toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="btn-ghost text-sm flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            {showHistory ? "Hide History" : "View History"}
          </button>
          {!session && (
            <button
              onClick={() => setShowNewSession(true)}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <Play className="w-4 h-4" /> Open Session
            </button>
          )}
          {session && (
            <button
              onClick={handleClose}
              disabled={closing}
              className="btn-danger text-sm flex items-center gap-2"
            >
              <Square className="w-4 h-4" />
              {closing ? "Closing..." : "Close Session"}
            </button>
          )}
        </div>
      </div>

      {/* Open session form */}
      {showNewSession && !session && (
        <div className="card p-5 border-2 border-purple-200 dark:border-purple-800">
          <h2 className="font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Play className="w-4 h-4 text-purple-600" /> Open Front Desk Session
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="form-label">Service Type</label>
              <select className="input-field" value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value })}>
                {SERVICE_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            {form.serviceType === "special" && (
              <div>
                <label className="form-label">Service Name</label>
                <input className="input-field" placeholder="e.g. Easter Sunday" value={form.specialServiceName} onChange={(e) => setForm({ ...form, specialServiceName: e.target.value })} />
              </div>
            )}
            <div>
              <label className="form-label">Service Date</label>
              <input type="date" className="input-field" value={form.serviceDate} onChange={(e) => setForm({ ...form, serviceDate: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Service Start Time</label>
              <input type="time" className="input-field" value={form.serviceStartTime} onChange={(e) => setForm({ ...form, serviceStartTime: e.target.value })} />
            </div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-xs text-blue-800 dark:text-blue-300 mb-4">
            You will be auto checked in as the session supervisor. Session auto-closes 4 hours after service start time.
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowNewSession(false)} className="btn-ghost">Cancel</button>
            <button onClick={handleOpenSession} disabled={sessionLoading} className="btn-primary flex items-center gap-2">
              <Play className="w-4 h-4" />
              {sessionLoading ? "Opening..." : "Open Front Desk"}
            </button>
          </div>
        </div>
      )}

      {/* No active session */}
      {!session && !showNewSession && (
        <div className="card p-12 text-center">
          <Shield className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-2">No active session</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-5">
            Open a front desk session before service starts to begin recording worker check-ins.
          </p>
          <button onClick={() => setShowNewSession(true)} className="btn-primary mx-auto flex items-center gap-2">
            <Play className="w-4 h-4" /> Open Session
          </button>
        </div>
      )}

      {/* Active session */}
      {session && (
        <>
          {/* Session info bar */}
          <div className="card p-4">
            <div className="flex flex-wrap items-center gap-4 justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                <div>
                  <p className="font-bold text-gray-900 dark:text-slate-100 capitalize">
                    {session.serviceType === "special" && session.specialServiceName
                      ? session.specialServiceName
                      : `${session.serviceType.charAt(0).toUpperCase() + session.serviceType.slice(1)} Service`}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    Supervisor: {session.primarySupervisor?.fullName} · {session.primarySupervisor?.workerId}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="text-center">
                  <p className="text-xs text-gray-400 dark:text-slate-500">Service starts</p>
                  <p className="font-semibold text-gray-900 dark:text-slate-100">
                    {new Date(session.serviceStartTime).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {closeHours !== null && (
                  <div className={`text-center px-3 py-1.5 rounded-lg ${closeMinutes < 30 ? "bg-red-50 dark:bg-red-900/20" : "bg-gray-50 dark:bg-slate-800"}`}>
                    <p className="text-xs text-gray-400 dark:text-slate-500">Auto-closes in</p>
                    <p className={`font-bold ${closeMinutes < 30 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-slate-100"}`}>
                      {closeHours}h {closeRemMins}m
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Last checked in flash */}
          {lastCheckedIn && (
            <div className={cn(
              "rounded-xl border px-5 py-3 flex items-center gap-3 transition-all",
              lastCheckedIn.category === "late"
                ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
            )}>
              <CheckCircle className={cn("w-5 h-5 flex-shrink-0", lastCheckedIn.category === "late" ? "text-red-500" : "text-green-500")} />
              <div className="flex-1">
                <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm">{lastCheckedIn.name} checked in</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  {new Date(lastCheckedIn.time).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </p>
              </div>
              <TimingBadge category={lastCheckedIn.category} />
              <button onClick={() => setLastCheckedIn(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Check-in input */}
          <div className="card p-5">
            <h2 className="font-bold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-purple-600" /> Check In Worker
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchRef}
                className="input-field pl-9 pr-24 text-base"
                placeholder="Type worker name or ID..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleManualCheckIn(); }}
                autoFocus
                autoComplete="off"
              />
              <button
                onClick={handleManualCheckIn}
                disabled={!query.trim() || checkingIn}
                className="absolute right-2 top-1/2 -translate-y-1/2 btn-primary text-xs py-1.5 px-3 disabled:opacity-40"
              >
                {checkingIn ? "..." : "Check In"}
              </button>
            </div>

            {/* Suggestions dropdown */}
            {suggestions.length > 0 && (
              <div className="mt-2 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-lg">
                {suggestions.map((w) => {
                  const alreadyIn = attendance.some((a) => a.worker?._id === w._id || a.worker?.workerId === w.workerId);
                  return (
                    <button
                      key={w._id}
                      onClick={() => !alreadyIn && handleCheckIn(w)}
                      disabled={alreadyIn}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-gray-50 dark:border-slate-800 last:border-0",
                        alreadyIn
                          ? "bg-green-50 dark:bg-green-900/10 cursor-not-allowed"
                          : "hover:bg-gray-50 dark:hover:bg-slate-800"
                      )}
                    >
                      <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-bold flex items-center justify-center text-sm flex-shrink-0">
                        {w.fullName?.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{w.fullName}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{w.workerId} · {w.department?.replace(/-/g, " ")}</p>
                      </div>
                      {alreadyIn
                        ? <span className="text-xs text-green-600 dark:text-green-400 font-medium flex-shrink-0">Already in</span>
                        : <UserCheck className="w-4 h-4 text-gray-300 dark:text-slate-600 flex-shrink-0" />
                      }
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
              Press Enter or click Check In to confirm. Type worker name or numeric ID.
            </p>
          </div>

          {/* Live stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <StatCard icon={<Users className="w-5 h-5" />} label="Total" value={stats.total} color="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" />
            <StatCard icon={<Timer className="w-5 h-5" />} label="60+ min early" value={stats.early60} color="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" />
            <StatCard icon={<Timer className="w-5 h-5" />} label="30-60 min" value={stats.early30} color="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" />
            <StatCard icon={<Timer className="w-5 h-5" />} label="15-30 min" value={stats.early15} color="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" />
            <StatCard icon={<Timer className="w-5 h-5" />} label="0-15 min" value={stats.early0} color="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" />
            <StatCard icon={<AlertCircle className="w-5 h-5" />} label="Late" value={stats.late} color="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" />
            <StatCard icon={<Shield className="w-5 h-5" />} label="On Duty" value={stats.onDuty} color="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" />
          </div>

          {/* Attendance list */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
              <h2 className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-600" />
                Checked In ({attendance.length})
              </h2>
              <div className="flex gap-2">
                <button onClick={() => fetchAttendance(session._id)} className="btn-ghost text-xs py-1.5 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
                <button onClick={downloadCSV} disabled={attendance.length === 0} className="btn-outline text-xs py-1.5 flex items-center gap-1.5">
                  <Download className="w-3 h-3" /> CSV
                </button>
              </div>
            </div>

            {attendance.length === 0 ? (
              <div className="p-10 text-center text-gray-400 dark:text-slate-500 text-sm">
                No check-ins yet. Workers will appear here as they arrive.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">#</th>
                      <th className="table-header">Worker</th>
                      <th className="table-header hidden sm:table-cell">Department</th>
                      <th className="table-header">Time</th>
                      <th className="table-header hidden md:table-cell">Timing</th>
                      <th className="table-header hidden lg:table-cell">On Duty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((a, i) => (
                      <tr key={a._id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="table-cell text-gray-400 dark:text-slate-500 text-xs">{i + 1}</td>
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
                        <td className="table-cell hidden sm:table-cell text-xs capitalize text-gray-500 dark:text-slate-400">
                          {a.worker?.department?.replace(/-/g, " ")}
                        </td>
                        <td className="table-cell text-sm font-mono text-gray-900 dark:text-slate-100 whitespace-nowrap">
                          {new Date(a.checkInTime).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="table-cell hidden md:table-cell">
                          <TimingBadge category={a.timingCategory} />
                        </td>
                        <td className="table-cell hidden lg:table-cell">
                          {a.isOnDuty
                            ? <span className="badge-success text-xs">On Duty</span>
                            : <span className="text-xs text-gray-300 dark:text-slate-600">-</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* History */}
      {showHistory && (
        <div className="space-y-3">
          <h2 className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-purple-600" /> Past Sessions
          </h2>

          {historyLoading ? <Loader text="Loading history..." /> : (
            history.length === 0 ? (
              <div className="card p-8 text-center text-gray-400 dark:text-slate-500 text-sm">No past sessions found.</div>
            ) : history.map((s) => {
              const isExpanded = expandedSession === s._id;
              const dateStr = new Date(s.serviceDate).toLocaleDateString("en-GH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
              const serviceLabel = s.serviceType === "special" && s.specialServiceName ? s.specialServiceName : `${s.serviceType.charAt(0).toUpperCase() + s.serviceType.slice(1)} Service`;

              return (
                <div key={s._id} className="card overflow-hidden">
                  <button
                    className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                    onClick={() => setExpandedSession(isExpanded ? null : s._id)}
                  >
                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm">{serviceLabel}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">{dateStr} · Supervisor: {s.primarySupervisor?.fullName}</p>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{s.stats?.totalCheckedIn || 0}</span>
                        <span className="flex items-center gap-1 text-red-500"><AlertCircle className="w-3 h-3" />{s.stats?.late || 0} late</span>
                      </div>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", s.isOpen ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400")}>
                        {s.isOpen ? "Open" : s.closedBy === "auto" ? "Auto-closed" : "Closed"}
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>

                  {isExpanded && s.stats && (
                    <div className="border-t border-gray-100 dark:border-slate-700 p-4 bg-gray-50 dark:bg-slate-800/30">
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-3">
                        {[
                          { label: "Total", value: s.stats.totalCheckedIn, color: "text-purple-600 dark:text-purple-400" },
                          { label: "60+ min", value: s.stats.early60Plus, color: "text-emerald-600 dark:text-emerald-400" },
                          { label: "30-60 min", value: s.stats.early30to60, color: "text-green-600 dark:text-green-400" },
                          { label: "15-30 min", value: s.stats.early15to30, color: "text-blue-600 dark:text-blue-400" },
                          { label: "0-15 min", value: s.stats.early0to15, color: "text-amber-600 dark:text-amber-400" },
                          { label: "Late", value: s.stats.late, color: "text-red-600 dark:text-red-400" },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="text-center bg-white dark:bg-slate-800 rounded-xl p-2.5 border border-gray-100 dark:border-slate-700">
                            <p className={`text-lg font-bold ${color}`}>{value}</p>
                            <p className="text-xs text-gray-400 dark:text-slate-500">{label}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-slate-500">
                        <span>Started: {new Date(s.serviceStartTime).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" })}</span>
                        {s.closedAt && <span>Closed: {new Date(s.closedAt).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" })}</span>}
                        {s.closedBy === "auto" && <span className="text-amber-600 dark:text-amber-400">Auto-closed after 4 hours</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}