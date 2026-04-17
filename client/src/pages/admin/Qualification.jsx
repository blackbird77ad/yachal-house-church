import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  FileX,
  History,
  Play,
  RefreshCw,
  Trophy,
  Users,
  XCircle,
} from "lucide-react";
import {
  getAllMetrics,
  getAllWorkersStatus,
  triggerManualProcessing,
} from "../../services/metricsService";
import { getPortalStatus } from "../../services/portalService";
import Loader from "../../components/common/Loader";
import Pagination from "../../components/common/Pagination";
import { ToastContainer, useToast } from "../../components/common/Toast";
import { formatDate, getWeekLabel } from "../../utils/formatDate";
import { cn, getCriteriaStatus } from "../../utils/scoreHelpers";

const HISTORY_PERIODS = [
  { label: "Last 4 weeks", value: "4-weeks" },
  { label: "Last 3 months", value: "3-months" },
  { label: "Last 6 months", value: "6-months" },
  { label: "Full year", value: "year" },
  { label: "Custom", value: "custom" },
];

const PER_PAGE = 15;

const getHistoryDates = (period) => {
  const now = new Date();

  switch (period) {
    case "4-weeks":
      return { from: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000) };
    case "3-months":
      return { from: new Date(now.getFullYear(), now.getMonth() - 3, 1) };
    case "6-months":
      return { from: new Date(now.getFullYear(), now.getMonth() - 6, 1) };
    case "year":
      return { from: new Date(now.getFullYear(), 0, 1) };
    default:
      return { from: null };
  }
};

const formatDepartment = (department = "") =>
  department ? department.replace(/-/g, " ") : "Unassigned";

const Qualification = () => {
  const { toasts, toast, removeToast } = useToast();
  const [tab, setTab] = useState("current");
  const [weekRef, setWeekRef] = useState(new Date());

  const [ranking, setRanking] = useState([]);
  const [qualified, setQualified] = useState([]);
  const [almostQualified, setAlmostQualified] = useState([]);
  const [noSubmission, setNoSubmission] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [resultTab, setResultTab] = useState("ranking");
  const [copied, setCopied] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const dropdownRef = useRef(null);

  const [rankPage, setRankPage] = useState(1);
  const [qualPage, setQualPage] = useState(1);
  const [almostPage, setAlmostPage] = useState(1);
  const [noSubPage, setNoSubPage] = useState(1);

  const [historyPeriod, setHistoryPeriod] = useState("4-weeks");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedHistoryWeek, setExpandedHistoryWeek] = useState(null);

  useEffect(() => {
    getPortalStatus()
      .then((data) => {
        if (data?.weekReference) {
          setWeekRef(new Date(data.weekReference));
        }
      })
      .catch(() => {});
  }, []);

  const fetchCurrent = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const data = await getAllWorkersStatus();
      setRanking(data.ranking || []);
      setQualified(data.qualified || []);
      setAlmostQualified(data.almostQualified || data.disqualified || []);
      setNoSubmission(data.noSubmission || []);
      setSummary(data.summary || null);
    } catch {
      toast.error("Error", "Could not load qualification data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);

    try {
      let from;
      let to;

      if (historyPeriod !== "custom") {
        from = getHistoryDates(historyPeriod).from;
      } else {
        from = customFrom ? new Date(customFrom) : null;
        to = customTo ? new Date(`${customTo}T23:59:59`) : null;
      }

      const params = { isLateSubmission: false };
      if (from) params.dateFrom = from.toISOString();
      if (to) params.dateTo = to.toISOString();

      const { metrics } = await getAllMetrics(params);
      const grouped = (metrics || []).reduce((acc, metric) => {
        const label = getWeekLabel(metric.weekReference);

        if (!acc[label]) {
          acc[label] = {
            weekReference: metric.weekReference,
            qualified: [],
            almostQualified: [],
          };
        }

        if (metric.isQualified) {
          acc[label].qualified.push(metric);
        } else {
          acc[label].almostQualified.push(metric);
        }

        return acc;
      }, {});

      setHistoryData(
        Object.values(grouped).sort(
          (a, b) => new Date(b.weekReference) - new Date(a.weekReference)
        )
      );
    } catch {
      toast.error("Error", "Could not load qualification history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrent();
    const interval = setInterval(() => fetchCurrent(true), 90000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (tab === "history" && historyPeriod !== "custom") {
      fetchHistory();
    }
  }, [tab, historyPeriod]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDownload(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleProcessNow = async () => {
    setProcessing(true);

    try {
      await triggerManualProcessing({ weekReference: weekRef.toISOString() });
      toast.success("Done", "Qualification calculated for all workers.");
      await fetchCurrent(true);
    } catch (error) {
      toast.error(
        "Error",
        error.response?.data?.message || "Could not process qualification."
      );
    } finally {
      setProcessing(false);
    }
  };

  const generateWhatsApp = (
    rankingList = ranking,
    qualifiedList = qualified,
    almostList = almostQualified,
    noSubmissionList = noSubmission,
    weekLabel = getWeekLabel(weekRef)
  ) => {
    let text = `*Yahal House Qualification - ${weekLabel}*\n\n`;

    text += `*LIVE RANKING (${rankingList.length})*\n`;
    rankingList.forEach((item, index) => {
      const status = !item.submittedReport
        ? "No report"
        : item.isQualified
        ? "Qualified"
        : "Almost qualified";
      text += `${index + 1}. ${item.worker?.fullName} (${item.worker?.workerId || "ID pending"}) - ${item.totalScore || 0} pts - ${status}\n`;
    });

    text += `\n*QUALIFIED (${qualifiedList.length})*\n`;
    qualifiedList.forEach((item, index) => {
      text += `${index + 1}. ${item.worker?.fullName} (${item.worker?.workerId || "ID pending"})\n`;
    });

    text += `\n*ALMOST QUALIFIED (${almostList.length})*\n`;
    almostList.forEach((item, index) => {
      text += `${index + 1}. ${item.worker?.fullName} (${item.worker?.workerId || "ID pending"}) - ${item.totalScore || 0} pts\n`;
    });

    if (noSubmissionList.length > 0) {
      text += `\n*NO REPORT (${noSubmissionList.length})*\n`;
      noSubmissionList.forEach((item, index) => {
        text += `${index + 1}. ${item.worker?.fullName} (${item.worker?.workerId || "ID pending"})\n`;
      });
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    toast.success("Copied", "WhatsApp text copied.");
  };

  const downloadCSV = (
    type,
    rankingList = ranking,
    qualifiedList = qualified,
    almostList = almostQualified,
    noSubmissionList = noSubmission,
    filename = "qualification"
  ) => {
    const rows = [
      ["Rank", "Name", "Worker ID", "Department", "Score", "Status"],
    ];

    const pushRows = (list, fallbackStatus, startRank = 0) => {
      list.forEach((item, index) => {
        rows.push([
          startRank + index + 1,
          item.worker?.fullName || "",
          item.worker?.workerId || "ID pending",
          formatDepartment(item.worker?.department),
          item.totalScore || 0,
          !item.submittedReport
            ? "No report"
            : item.isQualified
            ? "Qualified"
            : fallbackStatus,
        ]);
      });
    };

    if (type === "all" || type === "ranking") {
      pushRows(rankingList, "Almost qualified");
    } else if (type === "qualified") {
      pushRows(qualifiedList, "Qualified");
    } else if (type === "almost-qualified") {
      pushRows(almostList, "Almost qualified");
    } else if (type === "no-submission") {
      pushRows(noSubmissionList, "No report");
    }

    const csv = rows
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setShowDownload(false);
  };

  const WorkerRow = ({ item, index, view }) => {
    const worker = item.worker;
    const noSub = view === "no-submission" || item.submittedReport === false;
    const isExpanded = expandedId === worker?._id;
    const criteria = noSub
      ? []
      : getCriteriaStatus(item.qualificationBreakdown, item.scoreBreakdown);

    return (
      <div className="card overflow-hidden">
        <div
          className={cn(
            "flex items-center gap-3 p-4 transition-colors",
            !noSub && "cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50"
          )}
          onClick={() => {
            if (!noSub) {
              setExpandedId(isExpanded ? null : worker?._id);
            }
          }}
        >
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
              index === 0
                ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                : index === 1
                ? "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
                : index === 2
                ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
                : "bg-gray-50 dark:bg-slate-800 text-gray-400"
            )}
          >
            {index + 1}
          </div>

          <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-bold flex items-center justify-center text-sm flex-shrink-0">
            {worker?.fullName?.charAt(0) || "?"}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 dark:text-slate-100 truncate text-sm">
              {worker?.fullName}
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500">
              ID: {worker?.workerId || "ID pending"} - {formatDepartment(worker?.department)}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {noSub ? (
              <span className="badge-warning text-xs flex items-center gap-1">
                <Clock className="w-3 h-3" />
                No report
              </span>
            ) : (
              <div className="text-right">
                <p className="font-bold text-gray-900 dark:text-slate-100 text-sm">
                  {item.totalScore || 0} pts
                </p>
                <span
                  className={cn(
                    "text-xs px-2 py-1 rounded-full font-semibold",
                    item.isQualified
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                  )}
                >
                  {item.isQualified ? "Qualified" : "Almost qualified"}
                </span>
              </div>
            )}

            {!noSub &&
              (isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ))}
          </div>
        </div>

        {isExpanded && !noSub && (
          <div className="border-t border-gray-100 dark:border-slate-700 p-4 bg-gray-50 dark:bg-slate-800/40 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                {
                  label: "Score",
                  value: `${item.totalScore || 0} pts`,
                  color:
                    "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400",
                },
                {
                  label: "Souls",
                  value: item.qualifyingSouls || 0,
                  color:
                    "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400",
                },
                {
                  label: "Attendees",
                  value: item.churchAttendeeCount || 0,
                  color:
                    "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
                },
                {
                  label: "Fellowship",
                  value: `${item.fellowshipHours || 0} hr`,
                  color:
                    "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
                },
              ].map((stat) => (
                <div key={stat.label} className={cn("rounded-xl px-3 py-2", stat.color)}>
                  <p className="text-[11px] uppercase tracking-wide opacity-80">
                    {stat.label}
                  </p>
                  <p className="text-lg font-bold">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {criteria.map((criterion) => (
                <div
                  key={criterion.key}
                  className={cn(
                    "rounded-xl border p-3 text-xs",
                    criterion.passed
                      ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20"
                      : "border-red-100 dark:border-red-900 bg-red-50 dark:bg-red-900/10"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {criterion.passed ? (
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 dark:text-slate-100">
                        {criterion.label}
                      </p>
                      <p className="text-gray-500 dark:text-slate-400 mt-1">
                        {criterion.score}/{criterion.weight} pts
                      </p>
                      {!criterion.passed && criterion.reason && (
                        <p className="text-red-500 dark:text-red-400 mt-1">
                          {criterion.reason}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {item.missingCriteria?.length > 0 && (
              <p className="text-xs text-red-500 dark:text-red-400 font-medium">
                Missing: {item.missingCriteria.join(", ")}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  const totalWorkers =
    summary?.totalWorkers ||
    ranking.length ||
    qualified.length + almostQualified.length + noSubmission.length;

  const currentTabs = [
    {
      key: "ranking",
      label: `Ranking (${ranking.length})`,
      list: ranking,
      page: rankPage,
      setPage: setRankPage,
      emptyText: "No ranking available yet for this week.",
    },
    {
      key: "qualified",
      label: `Qualified (${qualified.length})`,
      list: qualified,
      page: qualPage,
      setPage: setQualPage,
      emptyText: "No workers have qualified yet.",
    },
    {
      key: "almost-qualified",
      label: `Almost Qualified (${almostQualified.length})`,
      list: almostQualified,
      page: almostPage,
      setPage: setAlmostPage,
      emptyText: "No workers are currently in the almost-qualified list.",
    },
    {
      key: "no-submission",
      label: `No Report (${noSubmission.length})`,
      list: noSubmission,
      page: noSubPage,
      setPage: setNoSubPage,
      emptyText: "Every approved worker has submitted a report.",
    },
  ];

  const activeTab =
    currentTabs.find((item) => item.key === resultTab) || currentTabs[0];
  const pagedWorkers = activeTab.list.slice(
    (activeTab.page - 1) * PER_PAGE,
    activeTab.page * PER_PAGE
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="section-title">Qualification</h1>
          <p className="section-subtitle">
            {tab === "current"
              ? `${getWeekLabel(weekRef)} - ${totalWorkers} approved workers`
              : "Historical qualification records"}
          </p>
        </div>

        {tab === "current" && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleProcessNow}
              disabled={processing}
              className="btn-primary text-sm flex items-center gap-1.5"
            >
              <Play className={cn("w-4 h-4", processing && "animate-spin")} />
              {processing ? "Calculating..." : "Calculate Now"}
            </button>

            <button
              onClick={() => fetchCurrent(true)}
              disabled={refreshing}
              className="btn-ghost text-sm flex items-center gap-1.5"
            >
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
              Refresh
            </button>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDownload((prev) => !prev)}
                className="btn-outline text-sm flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                Export
              </button>

              {showDownload && (
                <div className="fixed right-4 z-[70] mt-1 w-52 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 py-1">
                  {[
                    { label: "Live ranking", action: () => downloadCSV("ranking") },
                    { label: "All workers", action: () => downloadCSV("all") },
                    {
                      label: "Qualified only",
                      action: () => downloadCSV("qualified"),
                    },
                    {
                      label: "Almost qualified",
                      action: () => downloadCSV("almost-qualified"),
                    },
                    {
                      label: "No report",
                      action: () => downloadCSV("no-submission"),
                    },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={item.action}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => generateWhatsApp()}
              className="btn-outline text-sm flex items-center gap-1.5"
            >
              <Copy className="w-4 h-4" />
              {copied ? "Copied!" : "WhatsApp"}
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
        {[
          {
            key: "current",
            label: "Current Week",
            icon: <Trophy className="w-4 h-4" />,
          },
          {
            key: "history",
            label: "History",
            icon: <History className="w-4 h-4" />,
          },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              tab === item.key
                ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm"
                : "text-gray-500 dark:text-slate-400"
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {tab === "current" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Total Workers",
                value: totalWorkers,
                color:
                  "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
                icon: <Users className="w-5 h-5" />,
              },
              {
                label: "Qualified",
                value: qualified.length,
                color:
                  "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
                icon: <Trophy className="w-5 h-5" />,
              },
              {
                label: "Almost Qualified",
                value: almostQualified.length,
                color:
                  "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
                icon: <AlertCircle className="w-5 h-5" />,
              },
              {
                label: "No Report",
                value: noSubmission.length,
                color:
                  "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
                icon: <FileX className="w-5 h-5" />,
              },
            ].map((stat) => (
              <div key={stat.label} className="card p-4">
                <div
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center mb-2",
                    stat.color
                  )}
                >
                  {stat.icon}
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                  {stat.value}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          {totalWorkers > 0 && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                  Qualification Rate
                </p>
                <p className="text-sm font-bold text-purple-700 dark:text-purple-400">
                  {Math.round((qualified.length / totalWorkers) * 100)}%
                  <span className="text-xs text-gray-400 font-normal ml-1">
                    ({qualified.length}/{totalWorkers})
                  </span>
                </p>
              </div>

              <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all duration-700"
                  style={{ width: `${(qualified.length / totalWorkers) * 100}%` }}
                />
              </div>

              <div className="flex justify-between text-xs text-gray-400 dark:text-slate-500 mt-1.5">
                <span className="text-green-600 dark:text-green-400">
                  {qualified.length} qualified
                </span>
                <span className="text-amber-600 dark:text-amber-400">
                  {almostQualified.length} almost qualified
                </span>
                <span className="text-red-500 dark:text-red-400">
                  {noSubmission.length} no report
                </span>
              </div>
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800 dark:text-blue-300">
              The live ranking matches the current-week qualification used on the admin dashboard.
              Ranking order is based on qualification first, then score, then souls, attendees, and
              fellowship strength. Click any worker to see the full calculation breakdown.
            </p>
          </div>

          {loading ? (
            <Loader text="Loading qualification..." />
          ) : (
            <>
              <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-xl p-1 flex-wrap w-fit">
                {currentTabs.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setResultTab(item.key)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap",
                      resultTab === item.key
                        ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm"
                        : "text-gray-500 dark:text-slate-400 hover:text-gray-700"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {activeTab.list.length === 0 ? (
                  <div className="card p-10 text-center text-gray-400 dark:text-slate-500">
                    {activeTab.emptyText}
                  </div>
                ) : (
                  <>
                    {pagedWorkers.map((item, index) => (
                      <WorkerRow
                        key={item.worker?._id || `${activeTab.key}-${index}`}
                        item={item}
                        index={(activeTab.page - 1) * PER_PAGE + index}
                        view={activeTab.key}
                      />
                    ))}

                    <Pagination
                      page={activeTab.page}
                      totalPages={Math.max(
                        1,
                        Math.ceil(activeTab.list.length / PER_PAGE)
                      )}
                      totalItems={activeTab.list.length}
                      perPage={PER_PAGE}
                      label="workers"
                      onPage={activeTab.setPage}
                    />
                  </>
                )}
              </div>
            </>
          )}
        </>
      )}

      {tab === "history" && (
        <div className="space-y-5">
          <div className="card p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {HISTORY_PERIODS.map((period) => (
                <button
                  key={period.value}
                  onClick={() => setHistoryPeriod(period.value)}
                  className={cn(
                    "px-3 py-2 rounded-xl text-xs font-medium border-2 transition-all",
                    historyPeriod === period.value
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400"
                      : "border-gray-100 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:border-purple-200"
                  )}
                >
                  {period.label}
                </button>
              ))}
            </div>

            {historyPeriod === "custom" && (
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1">
                  <label className="form-label">From</label>
                  <input
                    type="date"
                    className="input-field"
                    value={customFrom}
                    onChange={(event) => setCustomFrom(event.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="form-label">To</label>
                  <input
                    type="date"
                    className="input-field"
                    value={customTo}
                    onChange={(event) => setCustomTo(event.target.value)}
                  />
                </div>
                <button onClick={fetchHistory} className="btn-primary px-6">
                  Load
                </button>
              </div>
            )}
          </div>

          {historyLoading ? (
            <Loader text="Loading history..." />
          ) : historyData.length === 0 ? (
            <div className="card p-10 text-center text-gray-400 dark:text-slate-500">
              No qualification history found for this period.
            </div>
          ) : (
            <div className="space-y-4">
              {historyData.map((week) => {
                const weekLabel = getWeekLabel(week.weekReference);
                const isExpanded = expandedHistoryWeek === weekLabel;
                const total = week.qualified.length + week.almostQualified.length;
                const rate =
                  total > 0 ? Math.round((week.qualified.length / total) * 100) : 0;

                return (
                  <div key={weekLabel} className="card overflow-hidden">
                    <div
                      className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                      onClick={() =>
                        setExpandedHistoryWeek(isExpanded ? null : weekLabel)
                      }
                    >
                      <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 dark:text-slate-100 text-sm">
                          {weekLabel}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">
                          {week.qualified.length} qualified - {week.almostQualified.length} almost
                          qualified - {rate}% qualification rate
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            downloadCSV(
                              "all",
                              [...week.qualified, ...week.almostQualified],
                              week.qualified,
                              week.almostQualified,
                              [],
                              `qualification-${weekLabel.replace(/\s/g, "-")}`
                            );
                          }}
                          className="p-1.5 text-gray-400 hover:text-purple-600 rounded-lg"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-gray-100 dark:border-slate-700 p-4 bg-gray-50 dark:bg-slate-800/30 space-y-3">
                        {[
                          {
                            label: "Qualified",
                            list: week.qualified,
                            headingClass: "text-green-600 dark:text-green-400",
                            badgeClass:
                              "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
                          },
                          {
                            label: "Almost Qualified",
                            list: week.almostQualified,
                            headingClass: "text-amber-600 dark:text-amber-400",
                            badgeClass:
                              "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
                          },
                        ].map((group) =>
                          group.list.length > 0 ? (
                            <div key={group.label}>
                              <p
                                className={cn(
                                  "text-xs font-semibold uppercase tracking-wider mb-2",
                                  group.headingClass
                                )}
                              >
                                {group.label} ({group.list.length})
                              </p>

                              <div className="space-y-1.5">
                                {group.list.map((item, index) => (
                                  <div
                                    key={item.worker?._id || `${group.label}-${index}`}
                                    className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700"
                                  >
                                    <span className="text-xs font-bold text-gray-400 w-5">
                                      {index + 1}
                                    </span>
                                    <div
                                      className={cn(
                                        "w-7 h-7 rounded-full font-bold flex items-center justify-center text-xs",
                                        group.badgeClass
                                      )}
                                    >
                                      {item.worker?.fullName?.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                                        {item.worker?.fullName}
                                      </p>
                                      <p className="text-xs text-gray-400 dark:text-slate-500">
                                        ID: {item.worker?.workerId || "ID pending"} -{" "}
                                        {formatDepartment(item.worker?.department)}
                                      </p>
                                    </div>
                                    <span className="text-sm font-bold text-gray-700 dark:text-slate-300">
                                      {item.totalScore || 0} pts
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Qualification;
