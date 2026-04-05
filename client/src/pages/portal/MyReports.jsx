import { useState, useEffect } from "react";
import { FileText, Download, Edit2, Lock, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { getMyReports } from "../../services/reportService";
import { getPortalStatus } from "../../services/portalService";
import Loader from "../../components/common/Loader";
import { formatDate, formatDateTime, getWeekLabel, getWeekReference } from "../../utils/formatDate";
import { REPORT_TYPES } from "../../utils/constants";
import { useToast, ToastContainer } from "../../components/common/Toast";

const thisMonday = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const lastMonday = () => {
  const m = thisMonday();
  m.setDate(m.getDate() - 7);
  return m;
};

const MyReports = () => {
  const { toasts, toast, removeToast } = useToast();
  const [reports, setReports] = useState([]);
  const [portal, setPortal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedWeeks, setExpandedWeeks] = useState({});

  useEffect(() => {
    Promise.all([
      getMyReports({ status: "submitted" }),
      getPortalStatus().catch(() => ({ isOpen: false })),
    ]).then(([{ reports: r }, p]) => {
      setReports(r || []);
      setPortal(p);
      // Auto-expand current week
      const thisWeekLabel = getWeekLabel(getWeekReference());
      setExpandedWeeks({ [thisWeekLabel]: true });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const isCurrentWeekReport = (r) => {
    if (r.isLateSubmission) return false;
    const rMonday = new Date(r.weekReference);
    rMonday.setHours(0, 0, 0, 0);
    return rMonday.getTime() === thisMonday().getTime();
  };

  const isLastWeekReport = (r) => {
    if (r.isLateSubmission) return false;
    const rMonday = new Date(r.weekReference);
    rMonday.setHours(0, 0, 0, 0);
    return rMonday.getTime() === lastMonday().getTime();
  };

  const canEdit = (r) => isCurrentWeekReport(r) && portal?.isOpen && r.isEditable !== false;

  // Group by week label
  const grouped = reports.reduce((acc, r) => {
    const label = r.weekReference ? getWeekLabel(r.weekReference) : "Unknown week";
    if (!acc[label]) acc[label] = [];
    acc[label].push(r);
    return acc;
  }, {});

  // Sort groups: current week first, then most recent
  const sortedGroups = Object.entries(grouped).sort(([, a], [, b]) => {
    const dateA = new Date(a[0].weekReference || 0);
    const dateB = new Date(b[0].weekReference || 0);
    return dateB - dateA;
  });

  const typeLabel = (type) => REPORT_TYPES.find((t) => t.value === type)?.label || type;

  const handleDownload = (r) => {
    const type = typeLabel(r.reportType);
    const week = getWeekLabel(r.weekReference);
    const content = [
      `Report: ${type}`,
      `Week: ${week}`,
      `Submitted: ${r.submittedAt ? formatDateTime(r.submittedAt) : "N/A"}`,
      `Type: ${r.isLateSubmission ? "Arrears" : "Current week"}`,
      "",
      "Data:",
      JSON.stringify(
        r.evangelismData || r.cellData || r.fellowshipPrayerData ||
        r.briefData || r.productionData || r.departmentalData || {},
        null, 2
      )
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type.replace(/\s+/g, "-")}-${formatDate(r.weekReference)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <Loader text="Loading your reports..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div>
        <h1 className="section-title">My Reports</h1>
        <p className="section-subtitle">{reports.length} submitted report{reports.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300">
        Current week reports can be edited until Monday 2:59pm while the portal is open. Previous week and arrears reports are permanently locked after submission.
      </div>

      {reports.length === 0 ? (
        <div className="card p-14 text-center">
          <FileText className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-2">No reports yet</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-5">Your submitted reports will appear here grouped by week.</p>
          <Link to="/portal/submit-report" className="btn-primary text-sm">Submit your first report</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedGroups.map(([weekLabel, weekReports]) => {
            const isThisWeek = weekReports.some(isCurrentWeekReport);
            const isLastWeek = weekReports.some(isLastWeekReport);
            const isExpanded = expandedWeeks[weekLabel] !== false;

            let weekTag = null;
            if (isThisWeek) weekTag = <span className="badge-success text-xs">Current week</span>;
            else if (isLastWeek) weekTag = <span className="badge-info text-xs">Last week</span>;
            else weekTag = <span className="text-xs text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">Past</span>;

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
                      {weekTag}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                      {weekReports.length} report{weekReports.length !== 1 ? "s" : ""}
                      {isThisWeek && portal?.isOpen && " - Editable until Monday 2:59pm"}
                      {isThisWeek && !portal?.isOpen && " - Portal closed, reports locked"}
                    </p>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
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
                            <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{typeLabel(r.reportType)}</p>
                            <p className="text-xs text-gray-400 dark:text-slate-500">
                              Submitted: {r.submittedAt ? formatDateTime(r.submittedAt) : "N/A"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {r.isLateSubmission && <span className="badge-warning text-xs">Arrears</span>}
                            {editable ? (
                              <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                <Edit2 className="w-3 h-3" /> Editable
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1">
                                <Lock className="w-3 h-3" /> Locked
                              </span>
                            )}
                            {editable && (
                              <Link
                                to="/portal/submit-report"
                                className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1"
                              >
                                <Edit2 className="w-3 h-3" /> Edit
                              </Link>
                            )}
                            <button
                              onClick={() => handleDownload(r)}
                              className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1"
                            >
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
  );
};

export default MyReports;