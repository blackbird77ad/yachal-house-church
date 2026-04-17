import { useState, useEffect } from "react";
import { Clock, Unlock, Lock, History, AlertCircle, RefreshCw, Timer } from "lucide-react";
import { getPortalStatus, getPortalHistory } from "../../services/portalService";
import { overridePortal } from "../../services/adminService";
import axiosInstance from "../../utils/axiosInstance";
import { useToast, ToastContainer } from "../../components/common/Toast";
import { formatDateTime, getWeekLabel } from "../../utils/formatDate";
import Loader from "../../components/common/Loader";
import { cn } from "../../utils/scoreHelpers";

const PortalControl = () => {
  const { toasts, toast, removeToast } = useToast();
  const [portal, setPortal]   = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState(false);
  const [reason, setReason]   = useState("");
  const [customClose, setCustomClose]   = useState("");
  const [useCustomClose, setUseCustomClose] = useState(false);

  const [cleaning, setCleaning] = useState(false);
  const [fixing, setFixing]     = useState(false);

  const fetchData = async () => {
    try {
      const [p, h] = await Promise.all([
        getPortalStatus(),
        getPortalHistory(),
      ]);
      setPortal(p);
      setHistory(h.portals || []);
    } catch {
      toast.error("Error", "Could not load portal status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleFixWeeks = async () => {
    if (!window.confirm("This will correct all reports saved with the wrong system week date. Safe to run — read-only check then update. Continue?")) return;
    setFixing(true);
    try {
      const { data } = await axiosInstance.post("/admin/fix-week-references");
      toast.success("Done", data?.message || "Week references fixed.");
      await fetchData({ silent: true });
    } catch (err) {
      toast.error("Error", err.response?.data?.message || "Fix failed.");
    } finally { setFixing(false); }
  };

  const handleCleanup = async () => {
    if (!window.confirm("This will close all open portals and remove duplicate records. Continue?")) return;
    setCleaning(true);
    try {
      const { data } = await axiosInstance.post("/admin/portal-cleanup");
      toast.success("Cleaned", data.message || "Portal records cleaned.");
      await fetchData();
    } catch (err) {
      toast.error("Error", err.response?.data?.message || "Cleanup failed.");
    } finally { setCleaning(false); }
  };


  const act = async (action) => {
    if (!reason.trim()) {
      toast.warning("Reason required", "Please state why you are performing this action.");
      return;
    }
    if (action === "extend" && !customClose) {
      toast.warning("Time required", "Please select a new close date and time.");
      return;
    }
    setActing(true);
    try {
      const payload = { action, reason };
      if ((action === "open" && useCustomClose && customClose) || action === "extend") {
        payload.customCloseAt = new Date(customClose).toISOString();
      }
      await overridePortal(payload);
      const msg = {
        open:   "Portal opened. All workers have been notified.",
        close:  "Portal closed successfully.",
        extend: "Close time extended successfully.",
      }[action];
      toast.success("Done", msg);
      setReason("");
      setCustomClose("");
      setUseCustomClose(false);
      await fetchData();
    } catch (err) {
      toast.error("Error", err.response?.data?.message || "Could not update portal.");
    } finally {
      setActing(false);
    }
  };

  if (loading) return <Loader text="Loading portal status..." />;

  const isOpen = portal?.isOpen;
  const automaticWindowActive = !!portal?.isScheduledWindowOpen;
  const manualWindowActive = isOpen && !automaticWindowActive;
  const weekLabel = portal?.weekReference
    ? getWeekLabel(new Date(portal.weekReference))
    : null;

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Portal Control</h1>
          <p className="section-subtitle">Manage manual access outside the automatic Friday to Monday window</p>
        </div>
        <button onClick={fetchData} className="btn-ghost text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* ── Current status card ──────────────────────────────── */}
      <div className={cn(
        "card p-6 border-2 transition-colors",
        isOpen
          ? "border-green-300 dark:border-green-700"
          : "border-gray-200 dark:border-slate-700"
      )}>
        <div className="flex items-center gap-4 mb-5">
          <div className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center",
            isOpen
              ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
              : "bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500"
          )}>
            <Clock className="w-7 h-7" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 dark:text-slate-100 text-xl">
              Portal is {isOpen ? "OPEN" : "CLOSED"}
            </h2>
            {isOpen && portal?.timeLeft && (
              <p className="text-sm text-green-600 dark:text-green-400 mt-0.5">
                Closes in {portal.timeLeft.hours}h {portal.timeLeft.minutes}m
              </p>
            )}
            {isOpen && portal?.closesAt && (
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Scheduled close: {formatDateTime(portal.closesAt)}
              </p>
            )}
            {!isOpen && portal?.nextOpenAt && (
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                Next scheduled open: {formatDateTime(portal.nextOpenAt)}
              </p>
            )}
          </div>
          {isOpen && (
            <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
          )}
        </div>

        {weekLabel && (
          <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3 mb-5 text-sm text-gray-700 dark:text-slate-300">
            Current system week: <span className="font-semibold">{weekLabel}</span>
            {portal?.override?.overriddenBy?.fullName && (
              <span className="block text-xs text-gray-500 dark:text-slate-400 mt-1">
                Last manual action by {portal.override.overriddenBy.fullName}
                {portal.override.reason ? `: ${portal.override.reason}` : ""}
              </span>
            )}
          </div>
        )}

        {/* Automatic schedule info */}
        <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4 mb-5">
          <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Automatic Schedule
          </p>
          <div className="space-y-1.5 text-sm text-gray-700 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <Unlock className="w-4 h-4 text-green-500 flex-shrink-0" />
              Opens every Friday at midnight (Ghana time)
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-red-400 flex-shrink-0" />
              Closes every Monday at 2:59pm (Ghana time)
            </div>
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-purple-500 flex-shrink-0" />
              Qualification calculated automatically at close
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-700 p-4 mb-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                Manual portal access
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                Use this outside the automatic submission window. During Friday 12:00am to Monday 2:59pm, the portal stays open automatically.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={manualWindowActive}
              onClick={() => act(manualWindowActive ? "close" : "open")}
              disabled={acting || automaticWindowActive}
              className={cn(
                "relative inline-flex h-7 w-14 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                manualWindowActive
                  ? "bg-green-500"
                  : "bg-gray-300 dark:bg-slate-600"
              )}
            >
              <span
                className={cn(
                  "inline-block h-5 w-5 transform rounded-full bg-white transition-transform",
                  manualWindowActive ? "translate-x-8" : "translate-x-1"
                )}
              />
            </button>
          </div>

          {automaticWindowActive && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-3">
              Automatic weekly window is active. Manual close is disabled, but you can still extend the close time below.
            </p>
          )}
        </div>

        {/* ── Override controls ─────────────────────────────── */}
        <div className="space-y-4">
          <div>
            <label className="form-label">Reason for manual action <span className="text-red-400">*</span></label>
            <input
              className="input-field"
              placeholder="State the reason clearly..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {/* Custom close time — shown when opening or extending */}
          {(!isOpen || isOpen) && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-purple-600"
                  checked={useCustomClose}
                  onChange={(e) => setUseCustomClose(e.target.checked)}
                />
                <span className="text-sm text-gray-700 dark:text-slate-300">
                  {isOpen ? "Extend close time" : "Set custom close time"}
                </span>
              </label>
              {useCustomClose && (
                <div>
                  <label className="form-label">
                    {isOpen ? "New close date and time" : "Close at"}
                  </label>
                  <input
                    type="datetime-local"
                    className="input-field"
                    value={customClose}
                    onChange={(e) => setCustomClose(e.target.value)}
                  />
                  {!isOpen && (
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                      If not set, defaults to next Monday at 2:59pm.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 pt-1">
            {isOpen && useCustomClose && (
              <button
                onClick={() => act("extend")}
                disabled={acting || !customClose}
                className="btn-outline flex items-center gap-2 disabled:opacity-50"
              >
                <Timer className="w-4 h-4" />
                {acting ? "Extending..." : "Extend Close Time"}
              </button>
            )}

            {!isOpen && !automaticWindowActive && (
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Use the toggle above to open manual access outside the automatic window.
              </p>
            )}
          </div>

          {acting && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
              <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
              Processing...
            </div>
          )}

          {/* Warning for close */}
          {isOpen && !automaticWindowActive && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              Closing the portal stops all submissions immediately. Qualification will NOT run automatically — use the Qualification page to calculate manually if needed.
            </div>
          )}
        </div>
      </div>

      {/* ── Portal history ──────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <h3 className="font-bold text-gray-900 dark:text-slate-100">Portal History</h3>
          <span className="text-xs text-gray-400 dark:text-slate-500 flex-1">Most recent first</span>
          <button onClick={handleCleanup} disabled={cleaning} className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50">
            {cleaning ? "Cleaning..." : "Fix duplicates"}
          </button>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-6">
            No history yet.
          </p>
        ) : (
          <div className="space-y-3">
            {history.map((p) => (
              <div key={p._id} className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
                <div className={cn(
                  "w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0",
                  p.isOpen ? "bg-green-500" : "bg-gray-400"
                )} />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-gray-900 dark:text-slate-100">
                      {p.isOpen ? "Opened" : "Closed"}
                    </span>
                    {p.weekReference && (
                      <span className="text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-full">
                        {getWeekLabel(new Date(p.weekReference))}
                      </span>
                    )}
                    {p.isProcessed && (
                      <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                        Processed
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 text-xs text-gray-400 dark:text-slate-500">
                    <span>Opens: {formatDateTime(p.opensAt)}</span>
                    <span>Closes: {formatDateTime(p.closesAt)}</span>
                  </div>
                  {p.overriddenBy && (
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      Override by {p.overriddenBy?.fullName}: {p.overrideReason}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PortalControl;
