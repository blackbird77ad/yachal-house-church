import { useState, useEffect, useRef } from "react";
import {
  Trophy, CheckCircle, XCircle, Users, ChevronDown, ChevronUp,
  Copy, RefreshCw, Download, AlertCircle, Play, History,
  Calendar, FileX, Clock,
} from "lucide-react";
import { getAllWorkersStatus, getAllMetrics, triggerManualProcessing } from "../../services/metricsService";
import Loader from "../../components/common/Loader";
import Pagination from "../../components/common/Pagination";
import { getCriteriaStatus } from "../../utils/scoreHelpers";
import { getWeekLabel, getWeekReference, formatDate } from "../../utils/formatDate";
import { useToast, ToastContainer } from "../../components/common/Toast";

const HISTORY_PERIODS = [
  { label: "Last 4 weeks", value: "4-weeks" },
  { label: "Last 3 months", value: "3-months" },
  { label: "Last 6 months", value: "6-months" },
  { label: "Full year", value: "year" },
  { label: "Custom", value: "custom" },
];

const getHistoryDates = (period) => {
  const now = new Date();
  switch (period) {
    case "4-weeks":   return { from: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000) };
    case "3-months":  return { from: new Date(now.getFullYear(), now.getMonth() - 3, 1) };
    case "6-months":  return { from: new Date(now.getFullYear(), now.getMonth() - 6, 1) };
    case "year":      return { from: new Date(now.getFullYear(), 0, 1) };
    default:          return { from: null };
  }
};

const PER_PAGE = 15;

const Qualification = () => {
  const { toasts, toast, removeToast } = useToast();
  const [tab, setTab] = useState("current");

  // Current week
  const [qualified, setQualified]       = useState([]);
  const [disqualified, setDisqualified] = useState([]);
  const [noSubmission, setNoSubmission] = useState([]);
  const [summary, setSummary]           = useState(null);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [processing, setProcessing]     = useState(false);
  const [expandedId, setExpandedId]     = useState(null);
  const [resultTab, setResultTab]       = useState("no-submission");
  const [copied, setCopied]             = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const dropdownRef = useRef(null);

  // Page state per tab
  const [qualPage, setQualPage]         = useState(1);
  const [disqualPage, setDisqualPage]   = useState(1);
  const [noSubPage, setNoSubPage]       = useState(1);

  // History
  const [historyPeriod, setHistoryPeriod]       = useState("4-weeks");
  const [customFrom, setCustomFrom]             = useState("");
  const [customTo, setCustomTo]                 = useState("");
  const [historyData, setHistoryData]           = useState([]);
  const [historyLoading, setHistoryLoading]     = useState(false);
  const [expandedHistoryWeek, setExpandedHistoryWeek] = useState(null);

  // Reporting week = the Mon-Sun week workers submitted reports for
  // Portal opens Friday and closes Monday 2:59pm for PREVIOUS week submissions
  // so weekRef = last Monday (getPreviousWeekReference)
  const weekRef = getPreviousWeekReference();

  // ── Fetch all workers status in one call ─────────────────────
  const fetchCurrent = async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const data = await getAllWorkersStatus();
      setQualified(data.qualified || []);
      setDisqualified(data.disqualified || []);
      setNoSubmission(data.noSubmission || []);
      setSummary(data.summary || null);
      // Default tab: show no-submission first so admin sees who hasn't submitted
      if ((data.noSubmission || []).length > 0) setResultTab("no-submission");
      else if ((data.qualified || []).length > 0) setResultTab("qualified");
      else setResultTab("disqualified");
    } catch (err) {
      toast.error("Error", "Could not load qualification data.");
    } finally { setLoading(false); setRefreshing(false); }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      let from, to;
      if (historyPeriod !== "custom") {
        from = getHistoryDates(historyPeriod).from;
      } else {
        from = customFrom ? new Date(customFrom) : null;
        to   = customTo   ? new Date(customTo + "T23:59:59") : null;
      }
      const params = { isLateSubmission: false };
      if (from) params.dateFrom = from.toISOString();
      if (to)   params.dateTo   = to.toISOString();

      const { metrics } = await getAllMetrics(params);
      const grouped = (metrics || []).reduce((acc, m) => {
        const wk = getWeekLabel(m.weekReference);
        if (!acc[wk]) acc[wk] = { weekReference: m.weekReference, qualified: [], disqualified: [] };
        if (m.isQualified) acc[wk].qualified.push(m);
        else acc[wk].disqualified.push(m);
        return acc;
      }, {});
      setHistoryData(Object.values(grouped).sort((a, b) => new Date(b.weekReference) - new Date(a.weekReference)));
    } catch { toast.error("Error", "Could not load history."); }
    finally { setHistoryLoading(false); }
  };

  useEffect(() => {
    fetchCurrent();
    const i = setInterval(() => fetchCurrent(true), 90000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (tab === "history" && historyPeriod !== "custom") fetchHistory();
  }, [tab, historyPeriod]);

  useEffect(() => {
    const h = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDownload(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleProcessNow = async () => {
    setProcessing(true);
    try {
      await triggerManualProcessing({ weekReference: weekRef.toISOString() });
      toast.success("Done", "Qualification calculated for all workers.");
      await fetchCurrent(true);
    } catch (err) {
      toast.error("Error", err.response?.data?.message || "Could not process.");
    } finally { setProcessing(false); }
  };

  const generateWhatsApp = (qList = qualified, dList = disqualified, nList = noSubmission, weekLabel = getWeekLabel(weekRef)) => {
    let text = `*Yachal House Qualification — ${weekLabel}*\n\n`;
    text += `✅ *QUALIFIED (${qList.length})*\n`;
    qList.forEach((m, i) => { text += `${i + 1}. ${m.worker?.fullName} (${m.worker?.workerId})\n`; });
    text += `\n❌ *NOT QUALIFIED (${dList.length})*\n`;
    dList.forEach((m, i) => { text += `${i + 1}. ${m.worker?.fullName} (${m.worker?.workerId})\n`; });
    if (nList.length > 0) {
      text += `\n⏳ *NO SUBMISSION (${nList.length})*\n`;
      nList.forEach((m, i) => { text += `${i + 1}. ${m.worker?.fullName} (${m.worker?.workerId})\n`; });
    }
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    toast.success("Copied", "WhatsApp text copied.");
  };

  const downloadCSV = (type, qList = qualified, dList = disqualified, nList = noSubmission, filename = "qualification") => {
    const rows = [["Rank", "Name", "Worker ID", "Department", "Score", "Status"]];
    if (type === "all" || type === "qualified")
      qList.forEach((m, i) => rows.push([i + 1, m.worker?.fullName, m.worker?.workerId, m.worker?.department?.replace(/-/g, " "), m.totalScore || 0, "Qualified"]));
    if (type === "all" || type === "disqualified")
      dList.forEach((m, i) => rows.push([type === "all" ? qList.length + i + 1 : i + 1, m.worker?.fullName, m.worker?.workerId, m.worker?.department?.replace(/-/g, " "), m.totalScore || 0, "Not Qualified"]));
    if (type === "all")
      nList.forEach((m, i) => rows.push([qList.length + dList.length + i + 1, m.worker?.fullName, m.worker?.workerId, m.worker?.department?.replace(/-/g, " "), 0, "No Submission"]));
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    setShowDownload(false);
  };

  // ── Worker row component ──────────────────────────────────────
  const WorkerRow = ({ item, index, isQualified, noSub = false }) => {
    const w = item.worker;
    const isExpanded = expandedId === w?._id;
    const criteria = noSub ? [] : getCriteriaStatus(item.qualificationBreakdown);
    return (
      <div className="card overflow-hidden">
        <div
          className={`flex items-center gap-3 p-4 transition-colors ${!noSub ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50" : ""}`}
          onClick={() => !noSub && setExpandedId(isExpanded ? null : w?._id)}
        >
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
            index === 0 ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700" :
            index === 1 ? "bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-slate-200" :
            index === 2 ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700" :
            "bg-gray-50 dark:bg-slate-800 text-gray-400"}`}
          >{index + 1}</div>
          <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-bold flex items-center justify-center flex-shrink-0 text-sm">
            {w?.fullName?.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 dark:text-slate-100 truncate text-sm">{w?.fullName}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">ID: {w?.workerId} · {w?.department?.replace(/-/g, " ") || "Unassigned"}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {noSub ? (
              <span className="badge-warning text-xs flex items-center gap-1"><Clock className="w-3 h-3" />No report</span>
            ) : (
              <div className="text-right">
                <p className="font-bold text-gray-900 dark:text-slate-100 text-sm">{item.totalScore || 0} pts</p>
                {isQualified
                  ? <span className="badge-success text-xs">Qualified</span>
                  : <span className="badge-danger text-xs">Not qualified</span>}
              </div>
            )}
            {!noSub && (isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />)}
          </div>
        </div>
        {isExpanded && !noSub && (
          <div className="border-t border-gray-100 dark:border-slate-700 p-4 bg-gray-50 dark:bg-slate-800/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {criteria.map((c) => (
                <div key={c.key} className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs ${c.passed ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20" : "border-red-100 dark:border-red-900 bg-red-50 dark:bg-red-900/10"}`}>
                  {c.passed ? <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                  <span className="text-gray-700 dark:text-slate-300 flex-1">{c.label}</span>
                  {c.weight && (
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${c.passed ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400" : "bg-red-100 dark:bg-red-900/40 text-red-500"}`}>
                      {c.weight}%
                    </span>
                  )}
                </div>
              ))}
            </div>
            {item.missingCriteria?.length > 0 && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-3 font-medium">
                Missing: {item.missingCriteria.join(", ")}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  const totalAll = (summary?.totalWorkers) || (qualified.length + disqualified.length + noSubmission.length);

  return (
    <div className="space-y-5 animate-fade-in">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="section-title">Qualification</h1>
          <p className="section-subtitle">
            {tab === "current" ? `${getWeekLabel(weekRef)} · ${totalAll} total workers` : "Historical records"}
          </p>
        </div>
        {tab === "current" && (
          <div className="flex flex-wrap gap-2">
            <button onClick={handleProcessNow} disabled={processing} className="btn-primary text-sm flex items-center gap-1.5">
              <Play className={`w-4 h-4 ${processing ? "animate-spin" : ""}`} />
              {processing ? "Calculating..." : "Calculate Now"}
            </button>
            <button onClick={() => fetchCurrent(true)} disabled={refreshing} className="btn-ghost text-sm flex items-center gap-1.5">
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />Refresh
            </button>
            <div className="relative" ref={dropdownRef}>
              <button onClick={() => setShowDownload(!showDownload)} className="btn-outline text-sm flex items-center gap-1.5">
                <Download className="w-4 h-4" />Export
              </button>
              {showDownload && (
                <div className="fixed right-4 z-[70] mt-1 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 py-1">
                  {[
                    { label: "All workers", action: () => downloadCSV("all") },
                    { label: "Qualified only", action: () => downloadCSV("qualified") },
                    { label: "Not qualified", action: () => downloadCSV("disqualified") },
                  ].map((item) => (
                    <button key={item.label} onClick={item.action} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700">
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => generateWhatsApp()} className="btn-outline text-sm flex items-center gap-1.5">
              <Copy className="w-4 h-4" />{copied ? "Copied!" : "WhatsApp"}
            </button>
          </div>
        )}
      </div>

      {/* Tab switcher: Current / History */}
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
        {[
          { key: "current", label: "Current Week", icon: <Trophy className="w-4 h-4" /> },
          { key: "history", label: "History", icon: <History className="w-4 h-4" /> },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm" : "text-gray-500 dark:text-slate-400"}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── CURRENT WEEK ─────────────────────────────────────────── */}
      {tab === "current" && (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Workers",  value: totalAll,                    color: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400", icon: <Users className="w-5 h-5" /> },
              { label: "Qualified",      value: qualified.length,            color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",   icon: <Trophy className="w-5 h-5" /> },
              { label: "Not Qualified",  value: disqualified.length,         color: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",           icon: <XCircle className="w-5 h-5" /> },
              { label: "No Submission",  value: noSubmission.length,         color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",   icon: <FileX className="w-5 h-5" /> },
            ].map((s) => (
              <div key={s.label} className="card p-4">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${s.color}`}>{s.icon}</div>
                <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{s.value}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Pass rate bar */}
          {totalAll > 0 && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">Pass Rate</p>
                <p className="text-sm font-bold text-purple-700 dark:text-purple-400">
                  {totalAll > 0 ? Math.round((qualified.length / totalAll) * 100) : 0}%
                  <span className="text-xs text-gray-400 font-normal ml-1">({qualified.length}/{totalAll})</span>
                </p>
              </div>
              <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all duration-700"
                  style={{ width: `${totalAll > 0 ? (qualified.length / totalAll) * 100 : 0}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 dark:text-slate-500 mt-1.5">
                <span className="text-green-600 dark:text-green-400">{qualified.length} qualified</span>
                <span className="text-amber-600 dark:text-amber-400">{noSubmission.length} pending</span>
                <span className="text-red-500 dark:text-red-400">{disqualified.length} not qualified</span>
              </div>
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Shows <strong>all {totalAll} workers</strong> — qualified, not qualified, and those who haven't submitted yet.
              Click <strong>Calculate Now</strong> to refresh. Final results lock Monday at 2:59pm.
            </p>
          </div>

          {loading ? <Loader text="Loading all workers..." /> : (
            <>
              {/* Result tabs */}
              <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-xl p-1 flex-wrap w-fit">
                {[
                  { key: "no-submission", label: `No Report (${noSubmission.length})`,   show: true },
                  { key: "qualified",     label: `Qualified (${qualified.length})`,       show: true },
                  { key: "disqualified",  label: `Not Qualified (${disqualified.length})`, show: true },
                ].map((t) => (
                  <button key={t.key} onClick={() => setResultTab(t.key)}
                    className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${resultTab === t.key ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm" : "text-gray-500 dark:text-slate-400 hover:text-gray-700"}`}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Worker list */}
              {(() => {
                const isNoSub = resultTab === "no-submission";
                const isQual  = resultTab === "qualified";
                const list    = isNoSub ? noSubmission : isQual ? qualified : disqualified;
                const page    = isNoSub ? noSubPage : isQual ? qualPage : disqualPage;
                const setPage = isNoSub ? setNoSubPage : isQual ? setQualPage : setDisqualPage;
                const paged   = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);

                return (
                  <div className="space-y-2">
                    {list.length === 0 ? (
                      <div className="card p-10 text-center text-gray-400 dark:text-slate-500">
                        {isNoSub ? "All workers have submitted their report." : isQual ? "No workers have qualified yet." : "No disqualified workers."}
                      </div>
                    ) : (
                      <>
                        {paged.map((item, i) => (
                          <WorkerRow
                            key={item.worker?._id}
                            item={item}
                            index={(page - 1) * PER_PAGE + i}
                            isQualified={isQual}
                            noSub={isNoSub}
                          />
                        ))}
                        <Pagination
                          page={page}
                          totalPages={Math.ceil(list.length / PER_PAGE)}
                          totalItems={list.length}
                          perPage={PER_PAGE}
                          label="workers"
                          onPage={setPage}
                        />
                      </>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </>
      )}

      {/* ── HISTORY ──────────────────────────────────────────────── */}
      {tab === "history" && (
        <div className="space-y-5">
          <div className="card p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {HISTORY_PERIODS.map((p) => (
                <button key={p.value} onClick={() => setHistoryPeriod(p.value)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border-2 transition-all ${historyPeriod === p.value ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400" : "border-gray-100 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:border-purple-200"}`}>
                  {p.label}
                </button>
              ))}
            </div>
            {historyPeriod === "custom" && (
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1"><label className="form-label">From</label><input type="date" className="input-field" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} /></div>
                <div className="flex-1"><label className="form-label">To</label><input type="date" className="input-field" value={customTo} onChange={(e) => setCustomTo(e.target.value)} /></div>
                <button onClick={fetchHistory} className="btn-primary px-6">Load</button>
              </div>
            )}
          </div>

          {historyLoading ? <Loader text="Loading history..." /> : historyData.length === 0 ? (
            <div className="card p-10 text-center text-gray-400 dark:text-slate-500">No qualification history for this period.</div>
          ) : (
            <div className="space-y-4">
              {historyData.map((week) => {
                const wkLabel   = getWeekLabel(week.weekReference);
                const isExpanded = expandedHistoryWeek === wkLabel;
                const total     = week.qualified.length + week.disqualified.length;
                const rate      = total > 0 ? Math.round((week.qualified.length / total) * 100) : 0;
                return (
                  <div key={wkLabel} className="card overflow-hidden">
                    <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors" onClick={() => setExpandedHistoryWeek(isExpanded ? null : wkLabel)}>
                      <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 dark:text-slate-100 text-sm">{wkLabel}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{week.qualified.length} qualified · {week.disqualified.length} not qualified · {rate}% pass rate</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); downloadCSV("all", week.qualified, week.disqualified, [], `qualification-${wkLabel.replace(/\s/g, "-")}`); }} className="p-1.5 text-gray-400 hover:text-purple-600 rounded-lg" title="Download"><Download className="w-4 h-4" /></button>
                        <button onClick={(e) => { e.stopPropagation(); generateWhatsApp(week.qualified, week.disqualified, [], wkLabel); }} className="p-1.5 text-gray-400 hover:text-green-600 rounded-lg" title="WhatsApp"><Copy className="w-4 h-4" /></button>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-gray-100 dark:border-slate-700 p-4 bg-gray-50 dark:bg-slate-800/30 space-y-3">
                        {[{ list: week.qualified, label: "Qualified", colorClass: "text-green-600 dark:text-green-400", rowClass: "border-green-100 dark:border-green-900", dotClass: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
                          { list: week.disqualified, label: "Not Qualified", colorClass: "text-red-500 dark:text-red-400", rowClass: "border-red-100 dark:border-red-900", dotClass: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" }
                        ].map(({ list, label, colorClass, rowClass, dotClass }) =>
                          list.length > 0 && (
                            <div key={label}>
                              <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${colorClass}`}>{label} ({list.length})</p>
                              <div className="space-y-1.5">
                                {list.map((m, i) => (
                                  <div key={m.worker?._id} className={`flex items-center gap-3 p-2.5 bg-white dark:bg-slate-800 rounded-xl border ${rowClass}`}>
                                    <span className="text-xs font-bold text-gray-400 w-5">{i + 1}</span>
                                    <div className={`w-7 h-7 rounded-full font-bold flex items-center justify-center text-xs ${dotClass}`}>{m.worker?.fullName?.charAt(0)}</div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{m.worker?.fullName}</p>
                                      <p className="text-xs text-gray-400 dark:text-slate-500">ID: {m.worker?.workerId}</p>
                                    </div>
                                    <span className="text-sm font-bold text-gray-700 dark:text-slate-300">{m.totalScore || 0} pts</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
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