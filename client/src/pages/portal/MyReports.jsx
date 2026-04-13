import { useState, useEffect } from "react";
import { FileText, Download, Edit2, Lock, RefreshCw, Clock, Send } from "lucide-react";
import { Link } from "react-router-dom";
import axiosInstance from "../../utils/axiosInstance";
import { getPortalStatus } from "../../services/portalService";
import Loader from "../../components/common/Loader";
import { formatDateTime, getWeekLabel } from "../../utils/formatDate";
import { REPORT_TYPES } from "../../utils/constants";
import { useToast, ToastContainer } from "../../components/common/Toast";
import { cn } from "../../utils/scoreHelpers";

const MyReports = () => {
  const { toasts, toast, removeToast } = useToast();
  const [submitted, setSubmitted] = useState([]);
  const [drafts, setDrafts]       = useState([]);
  const [arrears, setArrears]     = useState([]);
  const [portal, setPortal]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [expandedWeeks, setExpandedWeeks] = useState({});

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [{ data: rData }, pData] = await Promise.all([
        axiosInstance.get("/reports/my-reports", { params: { limit: 500 } }),
        getPortalStatus().catch(() => ({ isOpen: false })),
      ]);
      const all = rData.reports || [];
      setDrafts(all.filter((r) => r.status === "draft"));
      setSubmitted(all.filter((r) => r.status !== "draft" && !r.isLateSubmission));
      setArrears(all.filter((r) => r.status !== "draft" && r.isLateSubmission));
      setPortal(pData);
      // Auto-expand current week using portal weekReference
      if (pData?.weekReference) {
        setExpandedWeeks({ [getWeekLabel(new Date(pData.weekReference))]: true });
      }
    } catch {
      toast.error("Error", "Could not load your reports. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, []);

  const canEdit = (r) => portal?.isOpen && r.isEditable !== false;

  // Group submitted reports by week label
  const grouped = submitted.reduce((acc, r) => {
    const label = r.weekReference ? getWeekLabel(new Date(r.weekReference)) : "Unknown week";
    if (!acc[label]) acc[label] = [];
    acc[label].push(r);
    return acc;
  }, {});

  const sortedGroups = Object.entries(grouped).sort(([, a], [, b]) =>
    new Date(b[0]?.weekReference || 0) - new Date(a[0]?.weekReference || 0)
  );

  const typeLabel = (type) =>
    REPORT_TYPES.find((t) => t.value === type)?.label || type;

  const handleDownload = (r) => {
    const text = [
      `Yachal House — ${typeLabel(r.reportType)}`,
      `Week: ${r.weekReference ? getWeekLabel(new Date(r.weekReference)) : "N/A"}`,
      `Submitted: ${r.submittedAt ? formatDateTime(r.submittedAt) : "N/A"}`,
      "",
      JSON.stringify(
        r.evangelismData || r.cellData || r.fellowshipPrayerData ||
        r.briefData || r.productionData || r.departmentalData || {},
        null, 2
      ),
    ].join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `${typeLabel(r.reportType).replace(/\s+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <Loader text="Loading your reports..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="section-title">My Reports</h1>
          <p className="section-subtitle">{submitted.length} submitted · {drafts.length} draft{drafts.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={fetchReports} className="btn-ghost text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* ── DRAFTS ─────────────────────────────────────────────── */}
      {drafts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <h2 className="font-bold text-gray-900 dark:text-slate-100 text-sm">
              Drafts — not submitted yet
            </h2>
            <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full">
              {drafts.length}
            </span>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300">
            These reports are saved but not submitted. Workers must submit before Monday 2:59pm for them to count toward qualification.
          </div>
          <div className="card overflow-hidden divide-y divide-gray-100 dark:divide-slate-700">
            {drafts.map((r) => (
              <div key={r._id} className="flex items-center gap-4 p-4">
                <div className="w-9 h-9 bg-amber-50 dark:bg-amber-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                    {typeLabel(r.reportType)}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    Last saved: {r.updatedAt ? formatDateTime(r.updatedAt) : "N/A"}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="badge-warning text-xs">Draft</span>
                  {portal?.isOpen ? (
                    <Link to="/portal/submit-report" className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
                      <Send className="w-3 h-3" /> Submit now
                    </Link>
                  ) : (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Portal closed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ARREARS REPORTS ────────────────────────────────────── */}
      {arrears.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-orange-500" />
            <h2 className="font-bold text-gray-900 dark:text-slate-100 text-sm">
              Arrears Reports
            </h2>
            <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs font-bold px-2 py-0.5 rounded-full">
              {arrears.length}
            </span>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-xl p-3 text-xs text-orange-800 dark:text-orange-300">
            These are reports submitted after the portal closed. They are saved and locked permanently but do not count toward qualification.
          </div>
          <div className="card overflow-hidden divide-y divide-gray-100 dark:divide-slate-700">
            {arrears.map((r) => (
              <div key={r._id} className="flex items-center gap-4 p-4">
                <div className="w-9 h-9 bg-orange-50 dark:bg-orange-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-orange-500 dark:text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                    {typeLabel(r.reportType)}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    Submitted: {r.submittedAt ? formatDateTime(r.submittedAt) : "N/A"}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="badge-warning text-xs">Arrears</span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Locked
                  </span>
                  <button onClick={() => handleDownload(r)} className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1">
                    <Download className="w-3 h-3" /> Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SUBMITTED REPORTS ──────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <h2 className="font-bold text-gray-900 dark:text-slate-100 text-sm">Submitted Reports</h2>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-xs text-blue-800 dark:text-blue-300">
          Current week reports can be edited until Monday 2:59pm while the portal is open. All other reports are permanently locked.
        </div>

        {submitted.length === 0 ? (
          <div className="card p-14 text-center">
            <FileText className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-2">No submitted reports yet</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-5">
              Submit your weekly report before Monday 2:59pm.
            </p>
            {portal?.isOpen && (
              <Link to="/portal/submit-report" className="btn-primary text-sm">Submit report</Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {sortedGroups.map(([weekLabel, weekReports]) => {
              const isExpanded = expandedWeeks[weekLabel] !== false;
              // Check if this is the current portal window
              const isCurrent = portal?.weekReference &&
                weekReports.some((r) => {
                  const rRef = new Date(r.weekReference);
                  const pRef = new Date(portal.weekReference);
                  return rRef.getTime() === pRef.getTime();
                });

              return (
                <div key={weekLabel} className="card overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                    onClick={() => setExpandedWeeks((prev) => ({ ...prev, [weekLabel]: !isExpanded }))}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 dark:text-slate-100 text-sm">{weekLabel}</span>
                        {isCurrent && (
                          <span className="badge-success text-xs">Current week</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                        {weekReports.length} report{weekReports.length !== 1 ? "s" : ""}
                        {isCurrent && portal?.isOpen && " · Portal open until Monday 2:59pm"}
                      </p>
                    </div>
                    {isExpanded
                      ? <span className="text-gray-400 text-xs">▲</span>
                      : <span className="text-gray-400 text-xs">▼</span>}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 dark:border-slate-700 divide-y divide-gray-50 dark:divide-slate-800">
                      {weekReports.map((r) => {
                        const editable = isCurrent && canEdit(r);
                        return (
                          <div key={r._id} className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                            <div className="w-9 h-9 bg-purple-50 dark:bg-purple-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                              <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                                {typeLabel(r.reportType)}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-slate-500">
                                {r.submittedAt ? formatDateTime(r.submittedAt) : "N/A"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                              {r.isLateSubmission && <span className="badge-warning text-xs">Arrears</span>}
                              {editable ? (
                                <Link to="/portal/submit-report" className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1">
                                  <Edit2 className="w-3 h-3" /> Edit
                                </Link>
                              ) : (
                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                  <Lock className="w-3 h-3" /> Locked
                                </span>
                              )}
                              <button onClick={() => handleDownload(r)} className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1">
                                <Download className="w-3 h-3" /> Download
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyReports;