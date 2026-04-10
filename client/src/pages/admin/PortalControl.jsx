import { useState, useEffect } from "react";
import { Clock, Unlock, Lock, History, Calendar, AlertCircle } from "lucide-react";
import { getPortalStatus, getPortalHistory } from "../../services/portalService";
import { overridePortal } from "../../services/adminService";
import { useToast, ToastContainer } from "../../components/common/Toast";
import { formatDateTime } from "../../utils/formatDate";
import Loader from "../../components/common/Loader";
import Pagination from "../../components/common/Pagination";
import ServiceTimesManager from "./ServiceTimesManager";

const PortalControl = () => {
  const { toasts, toast, removeToast } = useToast();
  const [portal, setPortal] = useState(null);
  const [history, setHistory] = useState([]);
  const [histPage, setHistPage] = useState(1);
  const HIST_PER_PAGE = 10;
  const pagedHistory = history.slice((histPage-1)*HIST_PER_PAGE, histPage*HIST_PER_PAGE);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");
  const [acting, setActing] = useState(false);
  const [customClose, setCustomClose] = useState("");
  const [useCustomClose, setUseCustomClose] = useState(false);

  const fetchData = async () => {
    try {
      const [p, h] = await Promise.all([getPortalStatus(), getPortalHistory()]);
      setPortal(p);
      setHistory(h.portals || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleOverride = async (action) => {
    if (!reason.trim()) {
      toast.warning("Reason required", "Please provide a reason for this action.");
      return;
    }
    setActing(true);
    try {
      const payload = { action, reason };
      if (action === "open" && useCustomClose && customClose) {
        payload.customCloseAt = new Date(customClose).toISOString();
      }
      await overridePortal(payload);
      toast.success(
        action === "open" ? "Portal opened" : "Portal closed",
        action === "open"
          ? "Portal is now open. Workers will be notified."
          : "Portal is now closed. Processing will begin."
      );
      setReason("");
      setCustomClose("");
      setUseCustomClose(false);
      fetchData();
    } catch (err) {
      toast.error("Error", err.response?.data?.message || "Could not update portal.");
    } finally { setActing(false); }
  };

  if (loading) return <Loader text="Loading portal status..." />;

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <div>
        <h1 className="section-title">Portal Control</h1>
        <p className="section-subtitle">Manage the report submission window</p>
      </div>

      <div className={`card p-6 border-2 ${portal?.isOpen ? "border-green-300 dark:border-green-700" : "border-gray-200 dark:border-slate-700"}`}>
        <div className="flex items-center gap-4 mb-6">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${portal?.isOpen ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" : "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400"}`}>
            <Clock className="w-7 h-7" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-slate-100 text-xl">
              Portal is {portal?.isOpen ? "OPEN" : "CLOSED"}
            </h2>
            {portal?.isOpen && portal?.timeLeft && (
              <p className="text-sm text-green-600 dark:text-green-400 mt-0.5">
                Closes in {portal.timeLeft.hours}h {portal.timeLeft.minutes}m
              </p>
            )}
            {portal?.isOpen && portal?.closesAt && (
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Scheduled close: {formatDateTime(portal.closesAt)}
              </p>
            )}
            {!portal?.isOpen && portal?.nextOpenAt && (
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                Next scheduled open: {formatDateTime(portal.nextOpenAt)}
              </p>
            )}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4 mb-6">
          <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">Automatic Schedule</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-gray-700 dark:text-slate-300">
              <Unlock className="w-4 h-4 text-green-600" />
              Opens: Every Friday at midnight
            </div>
            <div className="flex items-center gap-2 text-gray-700 dark:text-slate-300">
              <Lock className="w-4 h-4 text-red-500" />
              Closes: Every Monday at 2:59pm
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">All times are Ghana time (Africa/Accra)</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="form-label">Reason for Manual Override</label>
            <input
              className="input-field"
              placeholder="State why you are manually opening or closing the portal..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {!portal?.isOpen && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-purple-600"
                  checked={useCustomClose}
                  onChange={(e) => setUseCustomClose(e.target.checked)}
                />
                <span className="text-sm text-gray-700 dark:text-slate-300">Set a custom close date and time</span>
              </label>
              {useCustomClose && (
                <div>
                  <label className="form-label">Close at</label>
                  <input
                    type="datetime-local"
                    className="input-field"
                    value={customClose}
                    onChange={(e) => setCustomClose(e.target.value)}
                  />
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                    If not set, defaults to next Monday at 2:59pm.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => handleOverride("open")}
              disabled={acting || portal?.isOpen}
              className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Unlock className="w-4 h-4" />
              Open Portal Now
            </button>
            <button
              onClick={() => handleOverride("close")}
              disabled={acting || !portal?.isOpen}
              className="btn-danger flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Lock className="w-4 h-4" />
              Close Portal Now
            </button>
          </div>

          {acting && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
              <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
              Processing...
            </div>
          )}
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2 mb-5">
          <History className="w-4 h-4 text-purple-600" />
          Override History
        </h3>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-6">No override history yet.</p>
        ) : (
          <div className="space-y-3">
            {pagedHistory.map((p) => (
              <div key={p._id} className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
                <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${p.isOpen ? "bg-green-500" : "bg-red-400"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm text-gray-900 dark:text-slate-100">
                      {p.isOpen ? "Opened" : "Closed"}
                    </p>
                    <span className="text-xs text-gray-400 dark:text-slate-500">{formatDateTime(p.updatedAt || p.opensAt)}</span>
                  </div>
                  {p.overriddenBy && (
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                      By {p.overriddenBy?.fullName}: {p.overrideReason}
                    </p>
                  )}
                  <div className="flex gap-3 mt-1 text-xs text-gray-400 dark:text-slate-500">
                    <span>Opens: {formatDateTime(p.opensAt)}</span>
                    <span>Closes: {formatDateTime(p.closesAt)}</span>
                  </div>
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