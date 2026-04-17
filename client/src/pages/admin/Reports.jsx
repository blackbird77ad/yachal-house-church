import { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Eye,
  FileText,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Calendar,
  Download,
  LayoutGrid,
  List,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { getAllReports } from "../../services/reportService";
import { getPortalStatus } from "../../services/portalService";
import { getAllWorkers } from "../../services/workerService";
import Loader from "../../components/common/Loader";
import { formatDateTime, getWeekLabel, getWeekReference, getPreviousWeekReference } from "../../utils/formatDate";
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

const PER_PAGE = 20;

const getPeriodDates = (period) => {
  const now = new Date();

  // Always compute from the system week rule: Mon 3pm boundary
  // This is independent of any portal record — it is the source of truth
  const currentRef = getWeekReference();       // closing Monday of CURRENT system week
  const prevRef = getPreviousWeekReference();  // closing Monday of PREVIOUS system week

  switch (period) {
    case "this-week":
      return { dateFrom: currentRef.toISOString(), exactWeekRef: "true" };

    case "last-week":
      return { dateFrom: prevRef.toISOString(), exactWeekRef: "true" };

    case "this-month":
      return {
        dateFrom: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      };

    case "last-month":
      return {
        dateFrom: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
        dateTo: new Date(
          now.getFullYear(),
          now.getMonth(),
          0,
          23,
          59,
          59,
          999
        ).toISOString(),
      };

    case "3-months":
      return {
        dateFrom: new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString(),
      };

    case "6-months":
      return {
        dateFrom: new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString(),
      };

    case "this-year":
      return {
        dateFrom: new Date(now.getFullYear(), 0, 1).toISOString(),
      };

    case "last-year":
      return {
        dateFrom: new Date(now.getFullYear() - 1, 0, 1).toISOString(),
        dateTo: new Date(
          now.getFullYear() - 1,
          11,
          31,
          23,
          59,
          59,
          999
        ).toISOString(),
      };

    default:
      return {};
  }
};

const typeLabel = (type) =>
  REPORT_TYPES.find((t) => t.value === type)?.label || type;

const Reports = () => {
  const { toasts, toast, removeToast } = useToast();

  const [reports, setReports] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [portalWeekReference, setPortalWeekReference] = useState(null);

  const [loadingBoot, setLoadingBoot] = useState(true);
  const [loadingReports, setLoadingReports] = useState(true);

  const [error, setError] = useState("");
  const [totalReports, setTotalReports] = useState(0);

  const [submissionTab, setSubmissionTab] = useState("submitted");
  const [weekTab, setWeekTab] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [period, setPeriod] = useState("this-week");
  const [workerFilter, setWorkerFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [viewMode, setViewMode] = useState("grouped");
  const [expandedWeeks, setExpandedWeeks] = useState({});

  const lastFetchKeyRef = useRef("");

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        const [portalRes, workerRes] = await Promise.all([
          getPortalStatus().catch(() => null),
          getAllWorkers({ status: "approved", limit: 500 }).catch(() => ({
            workers: [],
          })),
        ]);

        if (cancelled) return;

        setPortalWeekReference(portalRes?.weekReference || null);
        setWorkers(workerRes?.workers || []);
      } finally {
        if (!cancelled) setLoadingBoot(false);
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const buildParams = () => {
    const params = {
      page: 1,
      limit: PER_PAGE,
    };

    if (submissionTab !== "all") {
      params.status = submissionTab;
    }

    if (weekTab === "current") {
      params.isLateSubmission = "false";
    } else if (weekTab === "arrears") {
      params.isLateSubmission = "true";
    }

    if (typeFilter !== "all") {
      params.reportType = typeFilter;
    }

    if (workerFilter !== "all") {
      params.workerId = workerFilter;
    }

    if (period !== "all" && period !== "custom") {
      Object.assign(params, getPeriodDates(period));
    } else if (period === "custom") {
      if (customFrom) params.dateFrom = new Date(customFrom).toISOString();
      if (customTo) {
        params.dateTo = new Date(`${customTo}T23:59:59.999`).toISOString();
      }
    }

    return params;
  };

  const fetchReportsNow = async ({ force = false } = {}) => {
    if (loadingBoot) return;

    const params = buildParams();
    const fetchKey = JSON.stringify(params);

    if (!force && fetchKey === lastFetchKeyRef.current) return;
    lastFetchKeyRef.current = fetchKey;

    setLoadingReports(true);
    setError("");

    try {
      const data = await getAllReports(params);
      const nextReports = data?.reports || [];

      setReports(nextReports);
      setTotalReports(data?.total || 0);

      if (nextReports.length > 0) {
        const firstWeekLabel = nextReports[0]?.weekReference
          ? getWeekLabel(new Date(nextReports[0].weekReference))
          : "Unknown week";
        setExpandedWeeks({ [firstWeekLabel]: true });
      } else {
        setExpandedWeeks({});
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Could not load reports.";
      setError(msg);
      toast.error("Error", msg);
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    if (loadingBoot) return;
    if (period === "custom") return;
    fetchReportsNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loadingBoot,
    submissionTab,
    weekTab,
    typeFilter,
    workerFilter,
    period,
    portalWeekReference,
  ]);

  const runCustomSearch = async () => {
    await fetchReportsNow({ force: true });
  };

  const retryLoad = async () => {
    lastFetchKeyRef.current = "";
    await fetchReportsNow({ force: true });
  };

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        r.submittedBy?.fullName?.toLowerCase().includes(q) ||
        r.submittedBy?.workerId?.toLowerCase().includes(q)
      );
    });
  }, [reports, search]);

  const grouped = useMemo(() => {
    return filtered.reduce((acc, r) => {
      const label = r.weekReference
        ? getWeekLabel(new Date(r.weekReference))
        : "Unknown week";
      if (!acc[label]) acc[label] = [];
      acc[label].push(r);
      return acc;
    }, {});
  }, [filtered]);

  const sortedGroups = useMemo(() => {
    return Object.entries(grouped).sort((a, b) => {
      const aRef = a[1]?.[0]?.weekReference
        ? new Date(a[1][0].weekReference).getTime()
        : 0;
      const bRef = b[1]?.[0]?.weekReference
        ? new Date(b[1][0].weekReference).getTime()
        : 0;
      return bRef - aRef;
    });
  }, [grouped]);

  const downloadCSV = (rows = filtered) => {
    const header = [[
      "Worker",
      "Worker ID",
      "Report Type",
      "Week",
      "Submitted At",
      "Classification",
      "Status",
    ]];

    const data = rows.map((r) => [
      r.submittedBy?.fullName || "",
      r.submittedBy?.workerId || "",
      typeLabel(r.reportType),
      r.weekReference ? getWeekLabel(new Date(r.weekReference)) : "",
      r.submittedAt ? formatDateTime(r.submittedAt) : "",
      r.isLateSubmission ? "Arrears" : "Current",
      r.status,
    ]);

    const csv = [...header, ...data]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `reports-${new Date().toISOString().split("T")[0]}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded", `${rows.length} reports exported.`);
  };

  const TabBtn = ({ value, current, onChange, label }) => (
    <button
      onClick={() => onChange(value)}
      className={cn(
        "px-4 py-2 rounded-lg text-sm font-medium transition-all border-2",
        current === value
          ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
          : "border-gray-200 dark:border-slate-600 text-gray-500 hover:border-purple-200"
      )}
    >
      {label}
    </button>
  );

  const ReportRow = ({ r }) => (
    <tr className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
      <td className="table-cell">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-bold flex items-center justify-center text-xs flex-shrink-0">
            {r.submittedBy?.fullName?.charAt(0) || "?"}
          </div>
          <div>
            <p className="font-medium text-sm text-gray-900 dark:text-slate-100">
              {r.submittedBy?.fullName || "Unknown"}
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500">
              ID: {r.submittedBy?.workerId || "N/A"}
            </p>
          </div>
        </div>
      </td>

      <td className="table-cell text-sm">{typeLabel(r.reportType)}</td>

      <td className="table-cell text-xs text-gray-500 dark:text-slate-400 hidden md:table-cell">
        {r.weekReference ? getWeekLabel(new Date(r.weekReference)) : "N/A"}
      </td>

      <td className="table-cell text-xs text-gray-500 dark:text-slate-400 hidden lg:table-cell">
        {r.submittedAt ? formatDateTime(r.submittedAt) : "Draft"}
      </td>

      <td className="table-cell">
        <div className="flex items-center gap-2 flex-wrap">
          {r.isLateSubmission ? (
            <span className="badge-warning text-xs">Arrears</span>
          ) : (
            <span className="badge-success text-xs">Current</span>
          )}

          <Link
            to={`/admin/reports/${r._id}`}
            className="p-1.5 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg inline-flex"
          >
            <Eye className="w-4 h-4" />
          </Link>
        </div>
      </td>
    </tr>
  );

  const currentWeekLabel = portalWeekReference
    ? getWeekLabel(new Date(portalWeekReference))
    : "This week";

  return (
    <div className="space-y-4 animate-fade-in">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="section-title">Reports</h1>
          <p className="section-subtitle text-xs text-gray-400 dark:text-slate-500">
            {currentWeekLabel}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadCSV()}
            disabled={filtered.length === 0}
            className="btn-outline text-sm flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>

          <div className="flex border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
            {[
              { mode: "grouped", icon: <List className="w-4 h-4" />, title: "Grouped" },
              { mode: "table", icon: <Users className="w-4 h-4" />, title: "Table" },
              { mode: "grid", icon: <LayoutGrid className="w-4 h-4" />, title: "Grid" },
            ].map(({ mode, icon, title }) => (
              <button
                key={mode}
                title={title}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "px-3 py-2 transition-colors",
                  viewMode === mode
                    ? "bg-purple-600 text-white"
                    : "text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700"
                )}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-4 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 dark:text-slate-500 w-16">
            Status
          </span>
          <TabBtn value="submitted" current={submissionTab} onChange={setSubmissionTab} label="Submitted" />
          <TabBtn value="draft" current={submissionTab} onChange={setSubmissionTab} label="Drafts" />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 dark:text-slate-500 w-16">
            Type
          </span>
          <TabBtn value="all" current={weekTab} onChange={setWeekTab} label="All" />
          <TabBtn value="current" current={weekTab} onChange={setWeekTab} label="Current week reports" />
          <TabBtn value="arrears" current={weekTab} onChange={setWeekTab} label="Arrears" />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 dark:text-slate-500 w-16">
            Form
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setTypeFilter("all")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all",
                typeFilter === "all"
                  ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                  : "border-gray-200 dark:border-slate-600 text-gray-500 hover:border-purple-200"
              )}
            >
              All types
            </button>

            {REPORT_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setTypeFilter(t.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all",
                  typeFilter === t.value
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                    : "border-gray-200 dark:border-slate-600 text-gray-500 hover:border-purple-200"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 dark:text-slate-500 w-16">
            Period
          </span>
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all",
                  period === p.value
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                    : "border-gray-200 dark:border-slate-600 text-gray-500 hover:border-purple-200"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {period === "custom" && (
          <div className="flex flex-col sm:flex-row gap-3 items-end pt-1">
            <div className="flex-1">
              <label className="form-label">From</label>
              <input
                type="date"
                className="input-field"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </div>

            <div className="flex-1">
              <label className="form-label">To</label>
              <input
                type="date"
                className="input-field"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>

            <button onClick={runCustomSearch} className="btn-primary px-6 whitespace-nowrap">
              Search
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-1 border-t border-gray-100 dark:border-slate-700">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input-field pl-9"
              placeholder="Search by worker name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="input-field sm:w-52"
            value={workerFilter}
            onChange={(e) => setWorkerFilter(e.target.value)}
          >
            <option value="all">All Workers</option>
            {workers.map((w) => (
              <option key={w._id} value={w._id}>
                {w.fullName} ({w.workerId})
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</p>
          <button onClick={retryLoad} className="btn-outline text-xs py-1.5">
            Retry
          </button>
        </div>
      )}

      {!loadingBoot && !loadingReports && !error && (
        <p className="text-xs text-gray-400 dark:text-slate-500 px-1">
          {totalReports} report{totalReports !== 1 ? "s" : ""} found
        </p>
      )}

      {loadingBoot || loadingReports ? (
        <Loader text="Loading reports..." />
      ) : filtered.length === 0 ? (
        <div className="card p-14 text-center">
          <FileText className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-2">
            No reports found
          </h3>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Try a different period or filter.
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => (
            <div key={r._id} className="card p-4 space-y-3 hover:shadow-md transition-all">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-bold flex items-center justify-center text-sm">
                    {r.submittedBy?.fullName?.charAt(0) || "?"}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900 dark:text-slate-100">
                      {r.submittedBy?.fullName}
                    </p>
                    <p className="text-xs text-gray-400">ID: {r.submittedBy?.workerId}</p>
                  </div>
                </div>

                <Link
                  to={`/admin/reports/${r._id}`}
                  className="p-1.5 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg"
                >
                  <Eye className="w-4 h-4" />
                </Link>
              </div>

              <p className="text-xs font-medium text-gray-700 dark:text-slate-300">
                {typeLabel(r.reportType)}
              </p>

              <p className="text-xs text-gray-400">
                {r.submittedAt ? formatDateTime(r.submittedAt) : "Draft"}
              </p>
            </div>
          ))}
        </div>
      ) : viewMode === "table" ? (
        <div className="table-container">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Worker</th>
                <th className="table-header">Report Type</th>
                <th className="table-header hidden md:table-cell">Week</th>
                <th className="table-header hidden lg:table-cell">Submitted</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <ReportRow key={r._id} r={r} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedGroups.map(([label, weekReports]) => (
            <div key={label} className="card overflow-hidden">
              <div
                className="flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                onClick={() =>
                  setExpandedWeeks((prev) => ({
                    ...prev,
                    [label]: !prev[label],
                  }))
                }
              >
                <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />

                <div className="flex-1 min-w-0">
                  <span className="font-bold text-gray-900 dark:text-slate-100 text-sm">
                    {label}
                  </span>
                  <span className="ml-3 text-xs text-gray-400">
                    {weekReports.length} report{weekReports.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadCSV(weekReports);
                  }}
                  className="p-1.5 text-gray-400 hover:text-purple-600 rounded-lg mr-1"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>

                {expandedWeeks[label] ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </div>

              {expandedWeeks[label] && (
                <div className="border-t border-gray-100 dark:border-slate-700">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="table-header">Worker</th>
                        <th className="table-header">Report Type</th>
                        <th className="table-header hidden md:table-cell">Week</th>
                        <th className="table-header hidden lg:table-cell">Submitted</th>
                        <th className="table-header"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {weekReports.map((r) => (
                        <ReportRow key={r._id} r={r} />
                      ))}
                    </tbody>
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