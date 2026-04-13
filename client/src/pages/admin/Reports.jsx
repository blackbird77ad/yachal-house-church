import { useState, useEffect } from "react";
import { Search, Eye, FileText, AlertCircle, ChevronDown, ChevronUp, Calendar, Download, LayoutGrid, List, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { getAllReports } from "../../services/reportService";
import { getPortalStatus } from "../../services/portalService";
import { getAllWorkers } from "../../services/workerService";
import Loader from "../../components/common/Loader";
import Pagination from "../../components/common/Pagination";
import { formatDate, formatDateTime, getWeekLabel, getWeekReference } from "../../utils/formatDate";
import { REPORT_TYPES } from "../../utils/constants";
import { useToast, ToastContainer } from "../../components/common/Toast";
import { cn } from "../../utils/scoreHelpers";

const PERIODS = [
  { label: "This week", value: "this-week" },
  { label: "Last week", value: "last-week" },
  { label: "This month", value: "this-month" },
  { label: "Last month", value: "last-month" },
  { label: "Last 3 months", value: "3-months" },
  { label: "Last 6 months", value: "6-months" },
  { label: "This year", value: "this-year" },
  { label: "Last year", value: "last-year" },
  { label: "All time", value: "all" },
  { label: "Custom", value: "custom" },
];

// Get Monday of any given date — matches weekReference stored on reports
const getMonday = (date = new Date()) => {
  const d   = new Date(date);
  const day = d.getDay(); // JS: 0=Sun, 1=Mon
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getPeriodDates = (period, portalData = null) => {
  const now         = new Date();
  // weekReference on reports = the CLOSING Monday of the portal window
  // (portal opens Friday, closes Monday 2:59pm — weekReference = that Monday)
  const thisMonday  = getMonday(now);           // current portal window Monday
  const lastMonday  = new Date(thisMonday);
  lastMonday.setDate(lastMonday.getDate() - 7); // previous portal window Monday
  const lastMondayEnd = new Date(lastMonday);
  lastMondayEnd.setDate(lastMondayEnd.getDate() + 6);
  lastMondayEnd.setHours(23, 59, 59, 999);
  const thisMondayEnd = new Date(thisMonday);
  thisMondayEnd.setDate(thisMondayEnd.getDate() + 6);
  thisMondayEnd.setHours(23, 59, 59, 999);

  switch (period) {
    // Current portal window: weekReference = thisMonday
    case "this-week":  return { from: thisMonday, to: thisMondayEnd };
    // Previous portal window: weekReference = lastMonday
    case "last-week":  return { from: lastMonday, to: lastMondayEnd };
    case "this-month": return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: null };
    case "last-month": return {
      from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      to:   new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
    };
    case "3-months":   return { from: new Date(now.getFullYear(), now.getMonth() - 3, 1), to: null };
    case "6-months":   return { from: new Date(now.getFullYear(), now.getMonth() - 6, 1), to: null };
    case "this-year":  return { from: new Date(now.getFullYear(), 0, 1), to: null };
    case "last-year":  return {
      from: new Date(now.getFullYear() - 1, 0, 1),
      to:   new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59),
    };
    default:           return { from: null, to: null };
  }
};

const Reports = () => {
  const { toasts, toast, removeToast } = useToast();
  const [reports, setReports] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalReports, setTotalReports] = useState(0);
  const PER_PAGE = 20;
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("submitted");
  const [lateFilter, setLateFilter] = useState("all");
  const [workerFilter, setWorkerFilter] = useState("all");
  const [period, setPeriod] = useState("this-week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [viewMode, setViewMode] = useState("grouped"); // "grouped" | "table" | "grid"
  const [expandedWeeks, setExpandedWeeks] = useState({});
  const [portalData, setPortalData] = useState(null);

  // Fetch portal status on mount — the source of truth for current week
  useEffect(() => {
    getPortalStatus()
      .then((p) => { if (p) setPortalData(p); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    getAllWorkers({ status: "approved" }).then(({ workers: w }) => setWorkers(w || [])).catch(() => {});
  }, []);

  const fetchReports = async (pg = page) => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (typeFilter !== "all") params.reportType = typeFilter;
      if (statusFilter !== "all") params.status = statusFilter;
      if (lateFilter === "late") params.isLateSubmission = true;
      if (lateFilter === "current") params.isLateSubmission = false;
      if (workerFilter !== "all") params.workerId = workerFilter;

      if (period !== "all" && period !== "custom") {
        const { from, to } = getPeriodDates(period, portalData);
        if (from) params.dateFrom = from.toISOString();
        if (to)   params.dateTo   = to.toISOString();
      } else if (period === "custom") {
        if (customFrom) params.dateFrom = new Date(customFrom).toISOString();
        if (customTo) params.dateTo = new Date(customTo + "T23:59:59").toISOString();
      }

      const data = await getAllReports(params);
      setReports(data.reports || []);
      setTotalPages(data.totalPages || 1);
      setTotalReports(data.total || (data.reports || []).length);

      if (data.reports?.length > 0) {
        const firstWeek = getWeekLabel(new Date(data.reports[0].weekReference));
        setExpandedWeeks({ [firstWeek]: true });
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Could not load reports.";
      setError(msg);
      toast.error("Error", msg);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (period !== "custom") fetchReports();
  }, [typeFilter, statusFilter, lateFilter, workerFilter, period]);

  const filtered = reports.filter((r) => {
    const name = r.submittedBy?.fullName?.toLowerCase() || "";
    const id = r.submittedBy?.workerId || "";
    const q = search.toLowerCase();
    return !q || name.includes(q) || id.includes(q);
  });

  const typeLabel = (type) => REPORT_TYPES.find((t) => t.value === type)?.label || type;

  const grouped = filtered.reduce((acc, r) => {
    const label = r.weekReference ? getWeekLabel(r.weekReference) : "Unknown week";
    if (!acc[label]) acc[label] = [];
    acc[label].push(r);
    return acc;
  }, {});

  const sortedGroups = Object.entries(grouped).sort(([, a], [, b]) =>
    new Date(b[0].weekReference || 0) - new Date(a[0].weekReference || 0)
  );

  const downloadCSV = (reportsToExport = filtered) => {
    const rows = [["Worker", "Worker ID", "Department", "Report Type", "Week", "Submitted At", "Type", "Status"]];
    reportsToExport.forEach((r) => {
      rows.push([
        r.submittedBy?.fullName || "",
        r.submittedBy?.workerId || "",
        r.submittedBy?.department?.replace(/-/g, " ") || "",
        typeLabel(r.reportType),
        r.weekReference ? getWeekLabel(r.weekReference) : "",
        r.submittedAt ? formatDateTime(r.submittedAt) : "",
        r.isLateSubmission ? "Arrears" : "Current",
        r.status,
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reports-${period}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded", `${reportsToExport.length} reports exported.`);
  };

  const ReportCard = ({ r }) => (
    <div className="card p-4 flex flex-col gap-3 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-bold flex items-center justify-center text-sm flex-shrink-0">
            {r.submittedBy?.fullName?.charAt(0) || "?"}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-gray-900 dark:text-slate-100 truncate">{r.submittedBy?.fullName}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">ID: {r.submittedBy?.workerId}</p>
          </div>
        </div>
        <Link to={`/admin/reports/${r._id}`} className="p-1.5 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg flex-shrink-0">
          <Eye className="w-4 h-4" />
        </Link>
      </div>
      <div className="text-xs text-gray-700 dark:text-slate-300 font-medium">{typeLabel(r.reportType)}</div>
      <div className="flex items-center gap-2 flex-wrap">
        {r.isLateSubmission ? <span className="badge-warning text-xs">Arrears</span> : <span className="badge-info text-xs">Current</span>}
        {r.status === "submitted" ? <span className="badge-success text-xs">Submitted</span> : <span className="badge-warning text-xs">Draft</span>}
      </div>
      <p className="text-xs text-gray-400 dark:text-slate-500">{r.submittedAt ? formatDateTime(r.submittedAt) : "Not submitted"}</p>
    </div>
  );

  const ReportRow = ({ r }) => (
    <tr className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
      <td className="table-cell">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-bold flex items-center justify-center text-xs flex-shrink-0">
            {r.submittedBy?.fullName?.charAt(0) || "?"}
          </div>
          <div>
            <p className="font-medium text-sm text-gray-900 dark:text-slate-100">{r.submittedBy?.fullName || "Unknown"}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">ID: {r.submittedBy?.workerId || "N/A"}</p>
          </div>
        </div>
      </td>
      <td className="table-cell text-sm">{typeLabel(r.reportType)}</td>
      <td className="table-cell text-xs text-gray-500 dark:text-slate-400 hidden md:table-cell">{r.weekReference ? getWeekLabel(r.weekReference) : "N/A"}</td>
      <td className="table-cell text-xs text-gray-500 dark:text-slate-400 hidden lg:table-cell">{r.submittedAt ? formatDateTime(r.submittedAt) : "N/A"}</td>
      <td className="table-cell hidden sm:table-cell">{r.isLateSubmission ? <span className="badge-warning">Arrears</span> : <span className="badge-info">Current</span>}</td>
      <td className="table-cell hidden sm:table-cell">{r.status === "submitted" ? <span className="badge-success">Submitted</span> : <span className="badge-warning">Draft</span>}</td>
      <td className="table-cell">
        <Link to={`/admin/reports/${r._id}`} className="p-1.5 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg inline-flex">
          <Eye className="w-4 h-4" />
        </Link>
      </td>
    </tr>
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="section-title">Reports</h1>
          <p className="section-subtitle">{filtered.length} report{filtered.length !== 1 ? "s" : ""} - {PERIODS.find((p) => p.value === period)?.label}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => downloadCSV()} disabled={filtered.length === 0} className="btn-outline text-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <div className="flex border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
            {[
              { mode: "grouped", icon: <List className="w-4 h-4" />, title: "Grouped by week" },
              { mode: "table", icon: <Users className="w-4 h-4" />, title: "Table view" },
              { mode: "grid", icon: <LayoutGrid className="w-4 h-4" />, title: "Grid view" },
            ].map(({ mode, icon, title }) => (
              <button
                key={mode}
                title={title}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "px-3 py-2 transition-colors",
                  viewMode === mode
                    ? "bg-purple-600 text-white"
                    : "text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700"
                )}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input-field pl-9" placeholder="Search by worker name or ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input-field sm:w-48" value={workerFilter} onChange={(e) => setWorkerFilter(e.target.value)}>
            <option value="all">All Workers</option>
            {workers.map((w) => <option key={w._id} value={w._id}>{w.fullName} ({w.workerId})</option>)}
          </select>
          <select className="input-field sm:w-44" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All Report Types</option>
            {REPORT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <select className="input-field sm:w-36" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="submitted">Submitted</option>
            <option value="draft">Drafts</option>
          </select>
          <select className="input-field sm:w-44" value={lateFilter} onChange={(e) => setLateFilter(e.target.value)}>
            <option value="all">Current and Arrears</option>
            <option value="current">Current week only</option>
            <option value="late">Arrears only</option>
          </select>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                "px-3 py-2 rounded-xl text-xs font-medium border-2 transition-all",
                period === p.value
                  ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400"
                  : "border-gray-100 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:border-purple-200"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === "custom" && (
          <div className="flex flex-col sm:flex-row gap-3 items-end pt-1">
            <div className="flex-1">
              <label className="form-label">From</label>
              <input type="date" className="input-field" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="form-label">To</label>
              <input type="date" className="input-field" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
            <button onClick={fetchReports} className="btn-primary px-6 whitespace-nowrap">Search</button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</p>
          <button onClick={fetchReports} className="btn-outline text-xs py-1.5">Retry</button>
        </div>
      )}

      {loading ? (
        <Loader text="Loading reports..." />
      ) : filtered.length === 0 ? (
        <div className="card p-14 text-center">
          <FileText className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-2">No reports found</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400">Try a different period or adjust the filters.</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((r) => <ReportCard key={r._id} r={r} />)}
        </div>
      ) : viewMode === "table" ? (
        <div className="table-container">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Worker</th>
                <th className="table-header">Report Type</th>
                <th className="table-header hidden md:table-cell">Week</th>
                <th className="table-header hidden lg:table-cell">Submitted At</th>
                <th className="table-header hidden sm:table-cell">Type</th>
                <th className="table-header hidden sm:table-cell">Status</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody>{filtered.map((r) => <ReportRow key={r._id} r={r} />)}</tbody>
          </table>
        </div>
      ) : (
        // Grouped view
        <div className="space-y-4">
          {sortedGroups.map(([weekLabel, weekReports]) => (
            <div key={weekLabel} className="card overflow-hidden">
              <div
                className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                onClick={() => setExpandedWeeks((prev) => ({ ...prev, [weekLabel]: !prev[weekLabel] }))}
              >
                <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-gray-900 dark:text-slate-100 text-sm">{weekLabel}</span>
                  <span className="ml-3 text-xs text-gray-400 dark:text-slate-500">{weekReports.length} report{weekReports.length !== 1 ? "s" : ""}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); downloadCSV(weekReports); }}
                  className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg mr-1"
                  title="Download this week's reports"
                >
                  <Download className="w-4 h-4" />
                </button>
                {expandedWeeks[weekLabel] ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
              {expandedWeeks[weekLabel] && (
                <div className="border-t border-gray-100 dark:border-slate-700">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="table-header">Worker</th>
                        <th className="table-header">Report Type</th>
                        <th className="table-header hidden sm:table-cell">Submitted</th>
                        <th className="table-header hidden sm:table-cell">Type</th>
                        <th className="table-header hidden md:table-cell">Status</th>
                        <th className="table-header"></th>
                      </tr>
                    </thead>
                    <tbody>{weekReports.map((r) => <ReportRow key={r._id} r={r} />)}</tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Reports;