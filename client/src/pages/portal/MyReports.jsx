import { useState, useEffect } from "react";
import { FileText, Eye, Edit2, Lock, RefreshCw, Clock, Send, ChevronDown, ChevronUp } from "lucide-react";
import { Link } from "react-router-dom";
import axiosInstance from "../../utils/axiosInstance";
import { getPortalStatus } from "../../services/portalService";
import Loader from "../../components/common/Loader";
import { formatDateTime, getWeekLabel } from "../../utils/formatDate";
import { REPORT_TYPES } from "../../utils/constants";
import { useToast, ToastContainer } from "../../components/common/Toast";
import { cn } from "../../utils/scoreHelpers";

const PERIODS = [
  { label: "This week",     value: "this-week"  },
  { label: "Last week",     value: "last-week"  },
  { label: "This month",    value: "this-month" },
  { label: "Last month",    value: "last-month" },
  { label: "Last 3 months", value: "3-months"   },
  { label: "All time",      value: "all"        },
  { label: "Custom",        value: "custom"     },
];

const MyReports = () => {
  const { toasts, toast, removeToast } = useToast();
  const [all, setAll]         = useState([]);
  const [portal, setPortal]   = useState(null);
  const [loading, setLoading] = useState(true);

  // UI state
  const [selectedType, setSelectedType] = useState(null); // null = overview, string = drill down
  const [period, setPeriod]             = useState("this-week");
  const [customFrom, setCustomFrom]     = useState("");
  const [customTo, setCustomTo]         = useState("");
  const [expandedWeeks, setExpandedWeeks] = useState({});

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [{ data: rData }, pData] = await Promise.all([
        axiosInstance.get("/reports/my-reports", { params: { limit: 500 } }),
        getPortalStatus().catch(() => ({ isOpen: false })),
      ]);
      setAll(rData.reports || []);
      setPortal(pData);
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

  const typeLabel = (type) => REPORT_TYPES.find((t) => t.value === type)?.label || type;
  const canEdit   = (r) => portal?.isOpen && r.isEditable !== false && !r.isLateSubmission;

  // ── Filter by period ─────────────────────────────────────────
  const filterByPeriod = (reports) => {
    if (period === "all") return reports;

    const now     = new Date();
    const pRef    = portal?.weekReference ? new Date(portal.weekReference) : null;
    const pRefPrev = pRef ? new Date(new Date(pRef).setDate(new Date(pRef).getDate() - 7)) : null;

    const matchWeekRef = (r, ref) => {
      if (!ref) return false;
      const rRef = new Date(r.weekReference);
      rRef.setHours(0, 0, 0, 0);
      const target = new Date(ref);
      target.setHours(0, 0, 0, 0);
      // Also catch legacy wrong weekReference by checking createdAt in range
      const rangeStart = new Date(target); rangeStart.setDate(target.getDate() - 7);
      const rangeEnd   = new Date(target); rangeEnd.setDate(target.getDate() + 1);
      return rRef.getTime() === target.getTime() ||
        (rRef >= rangeStart && rRef < target && new Date(r.createdAt) >= rangeStart && new Date(r.createdAt) <= rangeEnd);
    };

    if (period === "this-week") return reports.filter((r) => matchWeekRef(r, pRef));
    if (period === "last-week") return reports.filter((r) => matchWeekRef(r, pRefPrev));

    let from = null, to = null;
    if (period === "this-month") from = new Date(now.getFullYear(), now.getMonth(), 1);
    if (period === "last-month") { from = new Date(now.getFullYear(), now.getMonth() - 1, 1); to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59); }
    if (period === "3-months")   from = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    if (period === "custom") {
      from = customFrom ? new Date(customFrom) : null;
      to   = customTo   ? new Date(customTo + "T23:59:59") : null;
    }

    return reports.filter((r) => {
      const ref = new Date(r.weekReference);
      if (from && ref < from) return false;
      if (to   && ref > to)   return false;
      return true;
    });
  };

  const drafts  = all.filter((r) => r.status === "draft");
  const submitted = all.filter((r) => r.status !== "draft");
  const filtered  = filterByPeriod(submitted);

  // ── Group by report type ─────────────────────────────────────
  const byType = REPORT_TYPES.reduce((acc, t) => {
    acc[t.value] = filtered.filter((r) => r.reportType === t.value);
    return acc;
  }, {});

  // ── Group selected type by week ──────────────────────────────
  const typeReports = selectedType ? filtered.filter((r) => r.reportType === selectedType) : [];

  const groupedByWeek = typeReports.reduce((acc, r) => {
    const label = r.weekReference ? getWeekLabel(new Date(r.weekReference)) : "Unknown week";
    if (!acc[label]) acc[label] = { label, reports: [], weekReference: r.weekReference };
    acc[label].reports.push(r);
    return acc;
  }, {});

  const sortedWeekGroups = Object.values(groupedByWeek).sort(
    (a, b) => new Date(b.weekReference) - new Date(a.weekReference)
  );

  const currentWeekLabel = portal?.weekReference ? getWeekLabel(new Date(portal.weekReference)) : null;

  if (loading) return <Loader text="Loading your reports..." />;

  return (
    <div className="space-y-5 animate-fade-in">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="section-title">My Reports</h1>
          <p className="section-subtitle">
            {submitted.length} submitted · {drafts.length} draft{drafts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={fetchReports} className="btn-ghost text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* ── Drafts ─────────────────────────────────────────────── */}
      {drafts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <h2 className="font-bold text-gray-900 dark:text-slate-100 text-sm">Drafts — not submitted yet</h2>
            <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full">
              {drafts.length}
            </span>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300">
            Saved but not submitted. Submit before Monday 2:59pm to count toward qualification.
          </div>
          <div className="card overflow-hidden divide-y divide-gray-100 dark:divide-slate-700">
            {drafts.map((r) => (
              <div key={r._id} className="flex items-center gap-4 p-4">
                <div className="w-9 h-9 bg-amber-50 dark:bg-amber-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{typeLabel(r.reportType)}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">Last saved: {r.updatedAt ? formatDateTime(r.updatedAt) : "N/A"}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="badge-warning text-xs">Draft</span>
                  {portal?.isOpen ? (
                    <Link to="/portal/submit-report" className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
                      <Send className="w-3 h-3" /> Submit now
                    </Link>
                  ) : (
                    <span className="text-xs text-gray-400 flex items-center gap-1"><Lock className="w-3 h-3" /> Portal closed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Period filter ───────────────────────────────────────── */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <button key={p.value} onClick={() => { setPeriod(p.value); setSelectedType(null); }}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all",
                period === p.value
                  ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                  : "border-gray-200 dark:border-slate-600 text-gray-500 hover:border-purple-200")}>
              {p.label}
            </button>
          ))}
        </div>
        {period === "custom" && (
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1">
              <label className="form-label">From</label>
              <input type="date" className="input-field" value={customFrom} onChange={(e) => { setCustomFrom(e.target.value); setSelectedType(null); }} />
            </div>
            <div className="flex-1">
              <label className="form-label">To</label>
              <input type="date" className="input-field" value={customTo} onChange={(e) => { setCustomTo(e.target.value); setSelectedType(null); }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Overview: report type cards ─────────────────────────── */}
      {!selectedType && (
        <>
          {filtered.length === 0 ? (
            <div className="card p-12 text-center">
              <FileText className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-2">No reports for this period</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">Try a different period or submit a report.</p>
              {portal?.isOpen && <Link to="/portal/submit-report" className="btn-primary text-sm mt-4 inline-block">Submit report</Link>}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {REPORT_TYPES.filter((t) => byType[t.value]?.length > 0).map((t) => {
                const reports = byType[t.value];
                const hasArrears  = reports.some((r) => r.isLateSubmission);
                const hasCurrent  = reports.some((r) => !r.isLateSubmission);
                const latestDate  = reports.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0]?.submittedAt;
                return (
                  <button key={t.value} onClick={() => setSelectedType(t.value)}
                    className="card p-5 text-left hover:shadow-md hover:border-purple-200 dark:hover:border-purple-700 transition-all border-2 border-transparent group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/30 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/50 transition-colors">
                        <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm font-bold px-2.5 py-1 rounded-full">
                        {reports.length}
                      </span>
                    </div>
                    <p className="font-bold text-gray-900 dark:text-slate-100 mt-3 mb-1">{t.label}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">
                      Last submitted: {latestDate ? formatDateTime(latestDate) : "N/A"}
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {hasCurrent  && <span className="badge-success text-xs">Current</span>}
                      {hasArrears  && <span className="badge-warning text-xs">Arrears</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Drilled down: reports for selected type ─────────────── */}
      {selectedType && (
        <div className="space-y-4">
          {/* Back + type header */}
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedType(null)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              ←
            </button>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-slate-100">{typeLabel(selectedType)}</h2>
              <p className="text-xs text-gray-400 dark:text-slate-500">{typeReports.length} report{typeReports.length !== 1 ? "s" : ""}</p>
            </div>
          </div>

          {typeReports.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="text-sm text-gray-400">No {typeLabel(selectedType)} reports for this period.</p>
            </div>
          ) : (
            sortedWeekGroups.map(({ label: wkLabel, reports: wkReports, weekReference: wkRef }) => {
              const isExpanded = expandedWeeks[wkLabel] !== false;
              const isCurrent  = currentWeekLabel && wkLabel === currentWeekLabel;
              return (
                <div key={wkLabel} className="card overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                    onClick={() => setExpandedWeeks((prev) => ({ ...prev, [wkLabel]: !isExpanded }))}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 dark:text-slate-100 text-sm">{wkLabel}</span>
                        {isCurrent && <span className="badge-success text-xs">Current week</span>}
                      </div>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                        {wkReports.length} report{wkReports.length !== 1 ? "s" : ""}
                        {isCurrent && portal?.isOpen && " · Portal open until Monday 2:59pm"}
                      </p>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 dark:border-slate-700 divide-y divide-gray-50 dark:divide-slate-800">
                      {wkReports.map((r) => {
                        const editable = isCurrent && canEdit(r);
                        return (
                          <div key={r._id} className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                            <div className="w-9 h-9 bg-purple-50 dark:bg-purple-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                              <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                                {r.isLateSubmission ? "Arrears" : "Current"}
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
                              <Link to={`/portal/my-reports/${r._id}`} className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1">
                                <Eye className="w-3 h-3" /> View
                              </Link>
                            </div>
                          </div>
                        );
                      })}
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
};

export default MyReports;