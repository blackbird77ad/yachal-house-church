import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Printer,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import Loader from "../../components/common/Loader";
import Pagination from "../../components/common/Pagination";
import { ToastContainer, useToast } from "../../components/common/Toast";
import { getWorkerReportAnalysis } from "../../services/reportService";
import { DEPARTMENTS, getReportTypeLabel } from "../../utils/constants";
import { formatDateTime } from "../../utils/formatDate";
import { cn } from "../../utils/scoreHelpers";

const PRINT_AREA_ID = "worker-analysis-print-area";
const PER_PAGE_OPTIONS = [10, 20, 50];

const REPORT_TYPES = [
  "evangelism",
  "cell",
  "production",
  "fellowship-prayer",
  "brief",
  "departmental",
  "custom",
];

const TYPE_LABELS = {
  evangelism: "Evangelism & Follow-up",
  cell: "Cell",
  production: "Production",
  "fellowship-prayer": "Fellowship Prayer",
  brief: "Brief",
  departmental: "Departmental",
  custom: "Custom / Others",
};

const SORT_OPTIONS = [
  { value: "totalSubmitted", label: "Total submitted" },
  { value: "fullName", label: "Worker name" },
  { value: "workerId", label: "Worker ID" },
  { value: "department", label: "Department" },
  { value: "latestSubmittedAt", label: "Latest submission" },
  { value: "onTimeSubmitted", label: "On-time reports" },
  { value: "arrearsSubmitted", label: "Arrears reports" },
  ...REPORT_TYPES.map((type) => ({
    value: type,
    label: TYPE_LABELS[type] || getReportTypeLabel(type),
  })),
];

const PRINT_STYLE = `
.worker-analysis-print-shell {
  display: none;
}

@media print {
  body * {
    visibility: hidden !important;
  }

  #${PRINT_AREA_ID},
  #${PRINT_AREA_ID} * {
    visibility: visible !important;
  }

  #${PRINT_AREA_ID} {
    position: absolute !important;
    inset: 0 auto auto 0 !important;
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
    color: #111827 !important;
    box-shadow: none !important;
  }

  .no-print {
    display: none !important;
  }

  .worker-analysis-print-shell {
    display: block !important;
  }

  @page {
    size: A4 portrait;
    margin: 14mm 12mm;
  }
}
`;

const formatDepartment = (department = "") =>
  department ? department.replace(/-/g, " ") : "Unassigned";

const formatDateLabel = (date) => (date ? formatDateTime(date) : "No submitted reports");

const buildPrintTitle = (entry) =>
  `Worker Analysis - ${entry?.worker?.fullName || "Worker"}`;

const WorkerAnalysis = () => {
  const { toasts, toast, removeToast } = useToast();
  const [analysis, setAnalysis] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [reportType, setReportType] = useState("");
  const [timing, setTiming] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("totalSubmitted");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const hasLoadedRef = useRef(false);

  const fetchAnalysis = useCallback(async (silent = false) => {
    const useFullLoader = !hasLoadedRef.current && !silent;

    if (useFullLoader) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const data = await getWorkerReportAnalysis({
        search,
        department,
        reportType,
        timing,
        dateFrom,
        dateTo,
        sortBy,
        sortDir,
        page,
        limit,
      });

      const nextAnalysis = data.analysis || [];
      setAnalysis(nextAnalysis);
      setTotals(data.totals || null);
      setTotal(data.total || 0);
      setTotalPages(Math.max(1, data.totalPages || 1));

      setSelectedWorker((current) => {
        if (!current) return nextAnalysis[0] || null;
        return (
          nextAnalysis.find((entry) => entry.worker?._id === current.worker?._id) ||
          nextAnalysis[0] ||
          null
        );
      });
    } catch {
      toast.error("Error", "Could not load worker analysis.");
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    dateFrom,
    dateTo,
    department,
    limit,
    page,
    reportType,
    search,
    sortBy,
    sortDir,
    timing,
    toast,
  ]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 350);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, department, limit, reportType, search, sortBy, sortDir, timing]);

  useEffect(() => {
    setPage((current) => Math.min(Math.max(1, current), totalPages));
  }, [totalPages]);

  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setDepartment("");
    setReportType("");
    setTiming("");
    setDateFrom("");
    setDateTo("");
    setSortBy("totalSubmitted");
    setSortDir("desc");
    setLimit(20);
    setPage(1);
  };

  const printWorker = (entry = selectedWorker) => {
    if (!entry) return;
    setSelectedWorker(entry);

    const previousTitle = document.title;
    document.title = buildPrintTitle(entry);

    const restoreTitle = () => {
      document.title = previousTitle;
      window.removeEventListener("afterprint", restoreTitle);
    };

    window.addEventListener("afterprint", restoreTitle);
    window.setTimeout(() => {
      window.print();
      window.setTimeout(restoreTitle, 1000);
    }, 80);
  };

  const summaryCards = useMemo(
    () => [
      { label: "Workers", value: totals?.totalWorkers || 0, color: "text-purple-700 dark:text-purple-300" },
      { label: "Submitted", value: totals?.totalSubmitted || 0, color: "text-blue-700 dark:text-blue-300" },
      { label: "On Time", value: totals?.onTimeSubmitted || 0, color: "text-green-700 dark:text-green-300" },
      { label: "Arrears", value: totals?.arrearsSubmitted || 0, color: "text-amber-700 dark:text-amber-300" },
    ],
    [totals]
  );

  if (loading) return <Loader text="Loading worker analysis..." />;

  return (
    <div className="space-y-5 animate-fade-in">
      <style>{PRINT_STYLE}</style>
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="no-print flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="section-title">Worker Analysis</h1>
          <p className="section-subtitle">
            Submitted report totals by worker, report type, timing, and period
          </p>
        </div>

        <button
          onClick={() => fetchAnalysis(true)}
          disabled={refreshing}
          className="btn-outline text-sm flex items-center gap-1.5 w-fit"
        >
          <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          Refresh
        </button>
      </div>

      <div className="no-print grid grid-cols-2 xl:grid-cols-4 gap-3">
        {summaryCards.map((card) => (
          <div key={card.label} className="card p-3 sm:p-4">
            <p className={cn("text-xl sm:text-2xl font-bold", card.color)}>
              {card.value}
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              {card.label}
            </p>
          </div>
        ))}
      </div>

      <div className="no-print card p-3 sm:p-4 space-y-3">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(220px,1.4fr)_repeat(4,minmax(130px,1fr))] gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input-field pl-10 pr-10"
              placeholder="Search by worker, ID, email, department..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            {searchInput && (
              <button
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <select
            className="input-field"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
          >
            <option value="">All departments</option>
            {DEPARTMENTS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <select
            className="input-field"
            value={reportType}
            onChange={(event) => setReportType(event.target.value)}
          >
            <option value="">All report types</option>
            {REPORT_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type] || getReportTypeLabel(type)}
              </option>
            ))}
          </select>

          <select
            className="input-field"
            value={timing}
            onChange={(event) => setTiming(event.target.value)}
          >
            <option value="">All timing</option>
            <option value="on-time">On time</option>
            <option value="arrears">Arrears</option>
          </select>

          <select
            className="input-field"
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
          >
            {PER_PAGE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} per page
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.1fr_120px_auto] gap-3">
          <div>
            <label className="form-label">From week</label>
            <input
              type="date"
              className="input-field"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </div>
          <div>
            <label className="form-label">To week</label>
            <input
              type="date"
              className="input-field"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </div>
          <div>
            <label className="form-label">Sort by</label>
            <select
              className="input-field"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              {SORT_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Direction</label>
            <button
              type="button"
              onClick={() => setSortDir((current) => (current === "asc" ? "desc" : "asc"))}
              className="input-field flex items-center justify-center gap-2"
            >
              {sortDir === "asc" ? (
                <ArrowUpAZ className="w-4 h-4" />
              ) : (
                <ArrowDownAZ className="w-4 h-4" />
              )}
              {sortDir === "asc" ? "Asc" : "Desc"}
            </button>
          </div>
          <div className="flex items-end">
            <button onClick={resetFilters} className="btn-ghost text-sm w-full">
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="no-print grid grid-cols-1 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] gap-4">
        <div className="card overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-slate-100">
                Workers
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-500">
                {total} worker{total === 1 ? "" : "s"} found
              </p>
            </div>
            {refreshing && (
              <div className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-300">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Updating
              </div>
            )}
          </div>

          {analysis.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400 dark:text-slate-500">
              No workers match this analysis.
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-slate-700">
              {analysis.map((entry) => {
                const selected = selectedWorker?.worker?._id === entry.worker?._id;
                return (
                  <button
                    key={entry.worker?._id}
                    onClick={() => {
                      setSelectedWorker(entry);
                      setMobileDetailOpen(true);
                    }}
                    className={cn(
                      "w-full p-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/50",
                      selected && "bg-purple-50 dark:bg-purple-900/20"
                    )}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-bold text-sm flex items-center justify-center flex-shrink-0">
                          {entry.worker?.fullName?.charAt(0) || "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-gray-900 dark:text-slate-100 truncate">
                            {entry.worker?.fullName || "Unknown worker"}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                            ID: {entry.worker?.workerId || "ID pending"} - {formatDepartment(entry.worker?.department)}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 lg:w-64">
                        <span className="rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-1 text-xs font-semibold">
                          Total {entry.totalSubmitted || 0}
                        </span>
                        <span className="rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-2 py-1 text-xs font-semibold">
                          On {entry.onTimeSubmitted || 0}
                        </span>
                        <span className="rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-2 py-1 text-xs font-semibold">
                          Arr {entry.arrearsSubmitted || 0}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="px-3 sm:px-4">
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={total}
              perPage={limit}
              label="workers"
              onPage={(nextPage) => setPage(Math.min(Math.max(1, nextPage), totalPages))}
            />
          </div>
        </div>

        <div className="hidden xl:block">
          <WorkerAnalysisDetail
            entry={selectedWorker}
            onPrint={() => printWorker(selectedWorker)}
          />
        </div>
      </div>

      <MobileWorkerAnalysisSheet
        entry={mobileDetailOpen ? selectedWorker : null}
        onClose={() => setMobileDetailOpen(false)}
        onPrint={() => printWorker(selectedWorker)}
      />

      <div className="worker-analysis-print-shell">
        <WorkerAnalysisPrint entry={selectedWorker} />
      </div>
    </div>
  );
};

const WorkerAnalysisDetail = ({ entry, onPrint, className = "" }) => {
  if (!entry) {
    return (
      <div className={cn("card p-6 text-center text-sm text-gray-400 dark:text-slate-500", className)}>
        Select a worker to view printable analysis.
      </div>
    );
  }

  return (
    <div className={cn("card p-4 space-y-4 h-fit xl:sticky xl:top-20", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">
            {entry.worker?.fullName}
          </p>
          <p className="text-xs text-gray-400 dark:text-slate-500">
            {entry.worker?.workerId || "ID pending"} - {formatDepartment(entry.worker?.department)}
          </p>
        </div>
        <button onClick={onPrint} className="btn-outline text-sm flex items-center gap-1.5">
          <Printer className="w-4 h-4" />
          Print
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Total", value: entry.totalSubmitted || 0, className: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300" },
          { label: "On Time", value: entry.onTimeSubmitted || 0, className: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300" },
          { label: "Arrears", value: entry.arrearsSubmitted || 0, className: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300" },
        ].map((item) => (
          <div key={item.label} className={cn("rounded-lg p-2", item.className)}>
            <p className="text-[10px] uppercase font-semibold">{item.label}</p>
            <p className="text-lg font-bold">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {REPORT_TYPES.map((type) => (
          <div
            key={type}
            className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 dark:bg-slate-800 px-3 py-2"
          >
            <span className="text-xs text-gray-500 dark:text-slate-400">
              {TYPE_LABELS[type] || getReportTypeLabel(type)}
            </span>
            <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
              {entry.typeCounts?.[type] || 0}
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-gray-100 dark:border-slate-700 p-3 text-xs text-gray-500 dark:text-slate-400 space-y-1">
        <p>First submitted: {formatDateLabel(entry.firstSubmittedAt)}</p>
        <p>Latest submitted: {formatDateLabel(entry.latestSubmittedAt)}</p>
      </div>
    </div>
  );
};

const MobileWorkerAnalysisSheet = ({ entry, onClose, onPrint }) => {
  if (!entry) return null;

  return (
    <div className="fixed inset-0 z-50 xl:hidden">
      <button
        type="button"
        aria-label="Close worker analysis"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
      />

      <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-white dark:bg-slate-900 shadow-2xl p-4 animate-slide-up">
        <div className="flex items-center justify-between gap-3 pb-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-600 dark:text-purple-300">
              Worker Analysis
            </p>
            <p className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">
              {entry.worker?.fullName || "Selected worker"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <WorkerAnalysisDetail
          entry={entry}
          onPrint={onPrint}
          className="p-0 shadow-none border-0 bg-transparent dark:bg-transparent"
        />
      </div>
    </div>
  );
};

const WorkerAnalysisPrint = ({ entry }) => {
  if (!entry) return null;

  return (
    <div
      id={PRINT_AREA_ID}
      style={{
        background: "#ffffff",
        color: "#111827",
        fontFamily: "Arial, Helvetica, sans-serif",
        padding: 24,
      }}
    >
      <div style={{ borderBottom: "1px solid #cbd5e1", paddingBottom: 12, marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20 }}>
          <div>
            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>
              Yachal House Church
            </div>
            <h1 style={{ fontSize: 22, margin: "4px 0", color: "#111827" }}>
              Worker Report Analysis
            </h1>
            <div style={{ fontSize: 12, color: "#475569" }}>
              {entry.worker?.fullName} - {entry.worker?.workerId || "ID pending"}
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 11, color: "#475569" }}>
            <div>{formatDepartment(entry.worker?.department)}</div>
            <div>Generated {new Date().toLocaleDateString("en-GH")}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 18 }}>
        {[
          ["Total Submitted", entry.totalSubmitted || 0],
          ["On-Time Reports", entry.onTimeSubmitted || 0],
          ["Arrears Reports", entry.arrearsSubmitted || 0],
        ].map(([label, value]) => (
          <div key={label} style={{ border: "1px solid #dbe3ee", borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase" }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr style={{ background: "#f1f5f9" }}>
            <th style={{ textAlign: "left", border: "1px solid #cbd5e1", padding: 8 }}>Report Type</th>
            <th style={{ textAlign: "right", border: "1px solid #cbd5e1", padding: 8 }}>Submitted</th>
          </tr>
        </thead>
        <tbody>
          {REPORT_TYPES.map((type) => (
            <tr key={type}>
              <td style={{ border: "1px solid #e5e7eb", padding: 8 }}>
                {TYPE_LABELS[type] || getReportTypeLabel(type)}
              </td>
              <td style={{ border: "1px solid #e5e7eb", padding: 8, textAlign: "right", fontWeight: 700 }}>
                {entry.typeCounts?.[type] || 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 18, fontSize: 11, color: "#475569" }}>
        <p>First submitted: {formatDateLabel(entry.firstSubmittedAt)}</p>
        <p>Latest submitted: {formatDateLabel(entry.latestSubmittedAt)}</p>
      </div>
    </div>
  );
};

export default WorkerAnalysis;
