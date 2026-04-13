import { useState, useEffect } from "react";
import { FileText, Download, Edit2, Lock, ChevronDown, ChevronUp, Calendar, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import axiosInstance from "../../utils/axiosInstance";
import { getPortalStatus } from "../../services/portalService";
import Loader from "../../components/common/Loader";
import { formatDate, formatDateTime, getWeekLabel, getWeekReference } from "../../utils/formatDate";
import { REPORT_TYPES } from "../../utils/constants";
import { useToast, ToastContainer } from "../../components/common/Toast";

const thisMonday = () => {
  const d = new Date();
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const MyReports = () => {
  const { toasts, toast, removeToast } = useToast();
  const [reports, setReports]         = useState([]);
  const [portal, setPortal]           = useState(null);
  const [loading, setLoading]         = useState(true);
  const [expandedWeeks, setExpandedWeeks] = useState({});

  const fetchReports = async () => {
    setLoading(true);
    try {
      // Call API directly with axiosInstance - no status filter, high limit
      const [{ data: rData }, pData] = await Promise.all([
        axiosInstance.get("/reports/my-reports", { params: { limit: 500 } }),
        getPortalStatus().catch(() => ({ isOpen: false })),
      ]);

      const allReports = rData.reports || [];
      setReports(allReports);
      setPortal(pData);

      // Auto-expand current week
      const thisWeekLabel = getWeekLabel(getWeekReference());
      setExpandedWeeks({ [thisWeekLabel]: true });
    } catch (err) {
      toast.error("Error", "Could not load your reports. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, []);

  const monday = thisMonday();

  const isCurrentWeekReport = (r) => {
    if (r.isLateSubmission) return false;
    const rMonday = new Date(r.weekReference);
    rMonday.setHours(0, 0, 0, 0);
    return rMonday.getTime() === monday.getTime();
  };

  const canEdit = (r) =>
    isCurrentWeekReport(r) && portal?.isOpen && r.isEditable !== false && r.status !== "draft";

  // Group all reports by week label
  const grouped = reports.reduce((acc, r) => {
    const label = r.weekReference ? getWeekLabel(r.weekReference) : "Unknown week";
    if (!acc[label]) acc[label] = [];
    acc[label].push(r);
    return acc;
  }, {});

  const sortedGroups = Object.entries(grouped).sort(([, a], [, b]) =>
    new Date(b[0]?.weekReference || 0) - new Date(a[0]?.weekReference || 0)
  );

  const typeLabel = (type) =>
    REPORT_TYPES.find((t) => t.value === type)?.label || type;

  const statusBadge = (r) => {
    if (r.status === "draft") return <span className="badge-warning text-xs">Draft</span>;
    if (r.isLateSubmission)  return <span className="badge-danger text-xs">Arrears</span>;
    return <span className="badge-success text-xs">Submitted</span>;
  };

  const handleDownload = (r) => {
    const type    = typeLabel(r.reportType);
    const week    = getWeekLabel(r.weekReference);
    const payload = JSON.stringify(
      r.evangelismData || r.cellData || r.fellowshipPrayerData ||
      r.briefData || r.productionData || r.departmentalData || {},
      null, 2
    );
    const text = [
      `Yachal House — ${type}`,
      `Week: ${week}`,
      `Status: ${r.status}`,
      `Submitted: ${r.submittedAt ? formatDateTime(r.submittedAt) : "Draft"}`,
      "",
      "Data:",
      payload,
    ].join("\n");

    const blob = new Blob([text], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${type.replace(/\s+/g, "-")}-${formatDate(r.weekReference)}.txt`;
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
          <p className="section-subtitle">{reports.length} report{reports.length !== 1 ? "s" : ""} found</p>
        </div>
        <button onClick={fetchReports} className="btn-ghost text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300">
        Current week reports can be edited until Monday 2:59pm while the portal is open.
        Previous week and arrears reports are permanently locked after submission.
      </div>

      {reports.length === 0 ? (
        <div className="card p-14 text-center">
          <FileText className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-2">No reports yet</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-5">
            Your submitted reports will appear here grouped by week.
          </p>
          <Link to="/portal/submit-report" className="btn-primary text-sm">
            Submit your first report
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedGroups.map(([weekLabel, weekReports]) => {
            const hasCurrent = weekReports.some(isCurrentWeekReport);
            const isExpanded = expandedWeeks[weekLabel] !== false;

            return (
              <div key={weekLabel} className="card overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 p-5 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                  onClick={() => setExpandedWeeks((prev) => ({ ...prev, [weekLabel]: !isExpanded }))}
                >
                  <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 dark:text-slate-100 text-sm">{weekLabel}</span>
                      {hasCurrent && <span className="badge-success text-xs">Current week</span>}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                      {weekReports.length} report{weekReports.length !== 1 ? "s" : ""}
                      {hasCurrent && portal?.isOpen && " · Editable until Monday 2:59pm"}
                    </p>
                  </div>
                  {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-slate-700 divide-y divide-gray-50 dark:divide-slate-800">
                    {weekReports.map((r) => {
                      const editable = canEdit(r);
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
                              {r.submittedAt ? formatDateTime(r.submittedAt) : "Draft — not submitted"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                            {statusBadge(r)}
                            {editable ? (
                              <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                <Edit2 className="w-3 h-3" /> Editable
                              </span>
                            ) : r.status !== "draft" ? (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Lock className="w-3 h-3" /> Locked
                              </span>
                            ) : null}
                            {editable && (
                              <Link
                                to="/portal/submit-report"
                                className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1"
                              >
                                <Edit2 className="w-3 h-3" /> Edit
                              </Link>
                            )}
                            {r.status !== "draft" && (
                              <button
                                onClick={() => handleDownload(r)}
                                className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1"
                              >
                                <Download className="w-3 h-3" /> Download
                              </button>
                            )}
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
  );
};

export default MyReports;