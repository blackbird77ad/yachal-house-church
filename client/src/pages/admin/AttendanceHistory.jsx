import { useState, useEffect, useRef } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
} from "lucide-react";
import axiosInstance from "../../utils/axiosInstance";
import { useAuth } from "../../hooks/useAuth";
import Loader from "../../components/common/Loader";
import Pagination from "../../components/common/Pagination";
import { useToast, ToastContainer } from "../../components/common/Toast";
import { cn } from "../../utils/scoreHelpers";

const TIMING_LABELS = {
  "early-60plus": {
    label: "60+ early",
    color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
  },
  "early-30to60": {
    label: "30-60 min",
    color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  },
  "early-15to30": {
    label: "15-30 min",
    color: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
  },
  "early-0to15": {
    label: "0-15 min",
    color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  },
  late: {
    label: "Late",
    color: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  },
};

const SERVICE_TYPES = [
  { value: "all", label: "All Services" },
  { value: "sunday", label: "Sunday Service" },
  { value: "tuesday", label: "Tuesday Service" },
  { value: "special", label: "Special Service" },
];

const PER_PAGE = 15;

const AttendanceHistory = () => {
  const { user } = useAuth();
  const isAdminLevel = ["pastor", "admin", "moderator"].includes(user?.role);
  const { toasts, toast, removeToast } = useToast();

  const [sessions, setSessions] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSessions, setTotalSessions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedAttendance, setExpandedAttendance] = useState({});
  const [loadingDetails, setLoadingDetails] = useState({});
  const [serviceFilter, setServiceFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const lastFetchKeyRef = useRef("");
  const loadingListRef = useRef(false);

  const fetchSessions = async ({ force = false } = {}) => {
    if (!isAdminLevel) {
      setLoading(false);
      return;
    }

    const fetchKey = JSON.stringify({ page, serviceFilter, dateFrom, dateTo });
    if (!force && fetchKey === lastFetchKeyRef.current) return;
    if (loadingListRef.current) return;

    lastFetchKeyRef.current = fetchKey;
    loadingListRef.current = true;
    setLoading(true);

    try {
      const params = new URLSearchParams({
        limit: PER_PAGE,
        page,
      });

      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", `${dateTo}T23:59:59`);

      const { data } = await axiosInstance.get(`/attendance/history?${params.toString()}`);

      let list = data?.sessions || [];
      setTotalPages(data?.totalPages || 1);
      setTotalSessions(data?.total || list.length);

      if (serviceFilter !== "all") {
        list = list.filter((s) => s.serviceType === serviceFilter);
      }

      setSessions(list);
    } catch (err) {
      toast.error("Error", err.response?.data?.message || "Could not load attendance history.");
    } finally {
      loadingListRef.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [serviceFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchSessions();
  }, [page, serviceFilter, dateFrom, dateTo]);

  const fetchDetails = async (sessionId) => {
    if (expandedAttendance[sessionId]) {
      setExpandedId((prev) => (prev === sessionId ? null : sessionId));
      return;
    }

    setLoadingDetails((prev) => ({ ...prev, [sessionId]: true }));

    try {
      const { data } = await axiosInstance.get(`/attendance/report/${sessionId}`);
      setExpandedAttendance((prev) => ({ ...prev, [sessionId]: data }));
      setExpandedId(sessionId);
    } catch (err) {
      toast.error("Error", err.response?.data?.message || "Could not load session details.");
    } finally {
      setLoadingDetails((prev) => ({ ...prev, [sessionId]: false }));
    }
  };

  const downloadCSV = (sessionId) => {
    const detail = expandedAttendance[sessionId];
    if (!detail) return;

    const { session, attendance } = detail;
    const rows = [[
      "Name",
      "Worker ID",
      "Department",
      "Check-in Time",
      "Timing",
      "On Duty",
      "Verified",
    ]];

    attendance.forEach((a) => {
      rows.push([
        a.worker?.fullName || "",
        a.worker?.workerId || "",
        a.worker?.department?.replace(/-/g, " ") || "",
        new Date(a.checkInTime).toLocaleTimeString("en-GH", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        TIMING_LABELS[a.timingCategory]?.label || "",
        a.isOnDuty ? "Yes" : "No",
        a.verifiedByFrontDesk ? "Yes" : "No",
      ]);
    });

    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;

    const date = new Date(session.serviceDate)
      .toLocaleDateString("en-GH")
      .replace(/\//g, "-");

    anchor.download = `attendance-${session.serviceType}-${date}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const timeStr = (iso) =>
    iso
      ? new Date(iso).toLocaleTimeString("en-GH", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "N/A";

  const dateStr = (iso) =>
    iso
      ? new Date(iso).toLocaleDateString("en-GH", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "N/A";

  return (
    <div className="space-y-5 animate-fade-in">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div>
        <h1 className="section-title">Attendance History</h1>
        <p className="section-subtitle">{sessions.length} sessions found</p>
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="sm:w-44">
            <label className="form-label">Service Type</label>
            <select
              className="input-field"
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
            >
              {SERVICE_TYPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">From Date</label>
              <input
                type="date"
                className="input-field"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label">To Date</label>
              <input
                type="date"
                className="input-field"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </div>

        {(dateFrom || dateTo) && (
          <button
            onClick={() => {
              setDateFrom("");
              setDateTo("");
            }}
            className="btn-ghost text-sm"
          >
            Clear date filter
          </button>
        )}
      </div>

      {loading ? (
        <Loader text="Loading attendance history..." />
      ) : sessions.length === 0 ? (
        <div className="card p-12 text-center">
          <Calendar className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
          <p className="font-semibold text-gray-900 dark:text-slate-100 mb-2">
            No sessions found
          </p>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Try adjusting the filters above.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session, index) => {
            const rowKey = session._id || `${session.serviceDate}-${session.serviceType}-${index}`;
            const isExpanded = expandedId === session._id;
            const detail = expandedAttendance[session._id];
            const stats = session.stats || {};
            const serviceLabel =
              session.serviceType.charAt(0).toUpperCase() + session.serviceType.slice(1);

            return (
              <div key={rowKey} className="card overflow-hidden">
                <button
                  className="w-full flex items-start sm:items-center gap-4 p-5 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                  onClick={() => fetchDetails(session._id)}
                >
                  <div
                    className={cn(
                      "w-2 h-12 rounded-full flex-shrink-0",
                      session.isOpen ? "bg-green-400" : "bg-gray-200 dark:bg-slate-600"
                    )}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="font-bold text-gray-900 dark:text-slate-100">
                        {serviceLabel} Service
                      </p>

                      {session.specialServiceName && (
                        <span className="text-xs text-gray-500 dark:text-slate-400">
                          ({session.specialServiceName})
                        </span>
                      )}

                      {session.isOpen ? (
                        <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
                          Live
                        </span>
                      ) : (
                        <span className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
                          {session.closedBy === "auto" ? "Auto-closed" : "Closed"}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-400 dark:text-slate-500">
                      {dateStr(session.serviceDate)} · Start: {timeStr(session.serviceStartTime)}
                      {session.closedAt && ` · Closed: ${timeStr(session.closedAt)}`}
                      {session.primarySupervisor && ` · ${session.primarySupervisor.fullName}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                        {stats.totalCheckedIn || 0}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">
                        checked in
                      </p>
                    </div>

                    {stats.late > 0 && (
                      <div className="text-right">
                        <p className="text-lg font-bold text-red-600 dark:text-red-400">
                          {stats.late}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">late</p>
                      </div>
                    )}

                    {loadingDetails[session._id] ? (
                      <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                    ) : isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </button>

                {isExpanded && detail && (
                  <div className="border-t border-gray-100 dark:border-slate-700">
                    <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-gray-100 dark:divide-slate-700">
                      {[
                        { label: "60+ early", value: detail.stats?.early60Plus || 0, color: "text-emerald-600" },
                        { label: "30-60 min", value: detail.stats?.early30to60 || 0, color: "text-blue-600" },
                        { label: "15-30 min", value: detail.stats?.early15to30 || 0, color: "text-purple-600" },
                        { label: "0-15 min", value: detail.stats?.early0to15 || 0, color: "text-amber-600" },
                        { label: "Late", value: detail.stats?.late || 0, color: "text-red-600" },
                        { label: "On Duty", value: detail.stats?.onDuty || 0, color: "text-gray-600 dark:text-slate-400" },
                      ].map((s) => (
                        <div key={s.label} className="p-3 text-center">
                          <p className={cn("text-xl font-bold", s.color)}>{s.value}</p>
                          <p className="text-xs text-gray-400 dark:text-slate-500">{s.label}</p>
                        </div>
                      ))}
                    </div>

                    <div className="px-5 py-3 border-t border-gray-50 dark:border-slate-800 flex justify-end">
                      <button
                        onClick={() => downloadCSV(session._id)}
                        className="btn-outline text-xs flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" /> Download CSV
                      </button>
                    </div>

                    {detail.attendance?.length > 0 ? (
                      <div className="divide-y divide-gray-50 dark:divide-slate-800 max-h-80 overflow-y-auto">
                        {detail.attendance.map((a, i) => (
                          <div
                            key={a._id || `${a.worker?._id || "worker"}-${i}`}
                            className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors"
                          >
                            <span className="text-xs text-gray-300 dark:text-slate-600 w-5 flex-shrink-0 text-right">
                              {i + 1}
                            </span>

                            <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-bold flex items-center justify-center text-xs flex-shrink-0">
                              {a.worker?.fullName?.charAt(0)}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                                {a.worker?.fullName}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-slate-500">
                                {a.worker?.workerId} · {a.worker?.department?.replace(/-/g, " ")}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="font-mono text-sm text-gray-700 dark:text-slate-300">
                                {timeStr(a.checkInTime)}
                              </span>

                              <span
                                className={cn(
                                  "text-xs px-2 py-0.5 rounded-full font-medium",
                                  TIMING_LABELS[a.timingCategory]?.color
                                )}
                              >
                                {TIMING_LABELS[a.timingCategory]?.label}
                              </span>

                              {a.isOnDuty && (
                                <span className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
                                  Duty
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-sm text-gray-400 dark:text-slate-500">
                        No attendance records for this session.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="card px-5">
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalSessions}
            perPage={PER_PAGE}
            label="sessions"
            onPage={setPage}
          />
        </div>
      )}
    </div>
  );
};

export default AttendanceHistory;