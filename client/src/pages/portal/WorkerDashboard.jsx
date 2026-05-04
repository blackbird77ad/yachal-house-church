import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  Clock,
  Bell,
  Calendar,
  Send,
  ChevronRight,
  FolderOpen,
  Trash2,
} from "lucide-react";
import axiosInstance from "../../utils/axiosInstance";
import { useAuth } from "../../hooks/useAuth";
import { getPortalStatus } from "../../services/portalService";
import { deleteMyDraftReport, getMyReports } from "../../services/reportService";
import Loader from "../../components/common/Loader";
import { useToast, ToastContainer } from "../../components/common/Toast";
import { formatDateTime, getWeekLabel, getWeekReference } from "../../utils/formatDate";
import { REPORT_TYPES } from "../../utils/constants";
import { cn } from "../../utils/scoreHelpers";

const WorkerDashboard = () => {
  const { user } = useAuth();
  const { toasts, toast, removeToast } = useToast();

  const [portal, setPortal] = useState(null);
  const [reports, setReports] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [rosterCount, setRosterCount] = useState(0);
  const [draftsCount, setDraftsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");

  const fetchData = async () => {
    try {
      const [reportsRes, portalRes, unreadRes, rosterRes] = await Promise.all([
        getMyReports({ limit: 200 }).catch(() => ({ reports: [] })),
        getPortalStatus().catch(() => ({ isOpen: false })),
        axiosInstance.get("/notifications/unread-count").catch(() => ({ data: { count: 0 } })),
        axiosInstance.get("/roster/my-assignment").catch(() => ({ data: {} })),
      ]);

      const allReports = reportsRes.reports || [];
      setReports(allReports);
      setDraftsCount(allReports.filter((r) => r.status === "draft").length);
      setPortal(portalRes);
      setUnreadNotifications(unreadRes?.data?.count || 0);

      const rosterPayload = rosterRes?.data || {};
      setRosterCount(rosterPayload.total || rosterPayload.rosters?.length || 0);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const interval = setInterval(() => {
      getPortalStatus().then(setPortal).catch(() => {});
      axiosInstance
        .get("/notifications/unread-count")
        .then(({ data }) => setUnreadNotifications(data?.count || 0))
        .catch(() => {});
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const submittedReports = useMemo(
    () => reports.filter((r) => r.status === "submitted"),
    [reports]
  );

  const draftReports = useMemo(
    () => reports.filter((r) => r.status === "draft"),
    [reports]
  );

  const currentWeekLabel = getWeekLabel(getWeekReference());

  const typeLabel = (type) =>
    REPORT_TYPES.find((t) => t.value === type)?.label || type;

  const buildDraftLink = (draft) => {
    const params = new URLSearchParams();
    params.set("reportType", draft.reportType);
    params.set("weekType", draft.isLateSubmission ? "late" : "current");

    if (draft.weekReference) {
      const weekDate = new Date(draft.weekReference).toISOString().split("T")[0];
      params.set("weekDate", weekDate);
    }

    params.set("draft", "1");
    return `/portal/submit-report?${params.toString()}`;
  };

  const handleDeleteDraft = async (reportId) => {
    const confirmed = window.confirm(
      "Delete this draft permanently?\n\nThis action cannot be undone or recovered."
    );
    if (!confirmed) return;

    setDeletingId(reportId);
    try {
      await deleteMyDraftReport(reportId);
      toast.success("Draft deleted", "This draft was removed completely.");
      await fetchData();
    } catch (err) {
      toast.error(
        "Draft not deleted",
        err.response?.data?.message || "Could not delete this draft."
      );
    } finally {
      setDeletingId("");
    }
  };

  const topCards = [
    {
      to: "/portal/submit-report",
      label: "Submit Report",
      desc: "Start a new report or continue submission",
      icon: <Send className="w-5 h-5" />,
      count: null,
      color:
        "text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20",
    },
    {
      to: "/portal/notifications",
      label: "Notifications",
      desc: "Things you need to see",
      icon: <Bell className="w-5 h-5" />,
      count: unreadNotifications,
      color:
        "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20",
    },
    {
      to: "/portal/my-reports",
      label: "My Reports",
      desc: "View and print your submitted reports",
      icon: <FileText className="w-5 h-5" />,
      count: null,
      color: "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20",
    },
    {
      to: "/portal/my-reports?tab=drafts",
      label: "My Drafts",
      desc: "Continue drafts saved but not submitted",
      icon: <FolderOpen className="w-5 h-5" />,
      count: draftsCount,
      color: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20",
    },
    {
      to: "/portal/roster",
      label: "Roster",
      desc: "Published roster assignments",
      icon: <Calendar className="w-5 h-5" />,
      count: rosterCount,
      color: "text-pink-700 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/20",
    },
  ];

  if (loading) return <Loader text="Loading your dashboard..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="section-title">Welcome, {user?.fullName?.split(" ")[0]}</h1>
          <p className="section-subtitle">{currentWeekLabel}</p>
        </div>

        <Link
          to="/portal/profile"
          className="inline-flex items-center gap-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 px-4 py-3 rounded-xl hover:shadow-sm transition-all"
        >
          <div>
            <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
              {user?.fullName}
            </p>
            <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 tracking-widest">
              {user?.workerId || "—"}
            </p>
          </div>
        </Link>
      </div>
      <div
        className={cn(
          "rounded-xl border px-5 py-4 flex items-center gap-3",
          portal?.isOpen
            ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
            : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
        )}
      >
        <Clock
          className={cn(
            "w-5 h-5 flex-shrink-0",
            portal?.isOpen
              ? "text-green-600 dark:text-green-400"
              : "text-amber-600 dark:text-amber-400"
          )}
        />
        <div className="flex-1">
          <p
            className={cn(
              "text-sm font-semibold",
              portal?.isOpen
                ? "text-green-800 dark:text-green-300"
                : "text-amber-800 dark:text-amber-300"
            )}
          >
            {portal?.isOpen
              ? `Portal is open. ${
                  portal.timeLeft
                    ? `Closes in ${portal.timeLeft.hours}h ${portal.timeLeft.minutes}m.`
                    : ""
                }`
              : "Portal is currently closed."}
          </p>
          <p
            className={cn(
              "text-xs mt-0.5",
              portal?.isOpen
                ? "text-green-600 dark:text-green-400"
                : "text-amber-600 dark:text-amber-400"
            )}
          >
            Drafts save automatically. Drafts do not count toward qualification until submitted.
          </p>
        </div>

        <Link to="/portal/submit-report" className="btn-primary text-xs py-1.5 px-3 flex-shrink-0">
          Submit Report
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {topCards.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className="card p-5 hover:shadow-card-hover transition-all group"
          >
            <div className="flex items-start justify-between gap-3">
              <div
                className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform",
                  item.color
                )}
              >
                {item.icon}
              </div>

              {item.count !== null && (
                <span className="inline-flex min-w-[28px] h-7 items-center justify-center rounded-full px-2 text-xs font-bold bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200">
                  {item.count}
                </span>
              )}
            </div>

            <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm mb-1">
              {item.label}
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400">{item.desc}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-bold text-gray-900 dark:text-slate-100">
                My Drafts
                <span className="ml-2 inline-flex min-w-[24px] h-6 items-center justify-center rounded-full px-2 text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                  {draftReports.length}
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Saved but not submitted. Drafts do not count toward qualification.
              </p>
            </div>

            <Link
              to="/portal/my-reports?tab=drafts"
              className="text-xs text-purple-700 dark:text-purple-400 hover:underline flex items-center gap-1"
            >
              View more <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {draftReports.length === 0 ? (
            <div className="text-center py-8">
              <FolderOpen className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-slate-400">No drafts yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {draftReports.slice(0, 3).map((r) => (
                <div
                  key={r._id}
                  className="rounded-xl border border-gray-100 dark:border-slate-700 p-4 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">
                        {typeLabel(r.reportType)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                        Week: {r.weekReference ? getWeekLabel(new Date(r.weekReference)) : "Unknown"}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                        Last saved: {r.updatedAt ? formatDateTime(r.updatedAt) : "—"}
                      </p>
                    </div>

                    <span className="badge-warning text-xs flex-shrink-0">
                      {r.isLateSubmission ? "Arrears Draft" : "Current Draft"}
                    </span>
                  </div>

                  <div className="pt-3 flex flex-wrap gap-2">
                    <Link
                      to={buildDraftLink(r)}
                      className="btn-outline text-xs py-1.5 px-3"
                    >
                      Continue Draft
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDeleteDraft(r._id)}
                      disabled={deletingId === r._id}
                      className="btn-ghost text-xs py-1.5 px-3 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1 disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" />
                      {deletingId === r._id ? "Deleting..." : "Delete Draft"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-bold text-gray-900 dark:text-slate-100">
                My Reports
                <span className="ml-2 inline-flex min-w-[24px] h-6 items-center justify-center rounded-full px-2 text-xs font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                  {submittedReports.length}
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Submitted reports only.
              </p>
            </div>

            <Link
              to="/portal/my-reports?tab=submitted"
              className="text-xs text-purple-700 dark:text-purple-400 hover:underline flex items-center gap-1"
            >
              View more <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {submittedReports.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-slate-400">No submitted reports yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {submittedReports.slice(0, 3).map((r) => (
                <div
                  key={r._id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="w-9 h-9 bg-purple-50 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                      {typeLabel(r.reportType)}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">
                      {r.weekReference ? getWeekLabel(new Date(r.weekReference)) : "Unknown week"}
                    </p>
                  </div>

                  {r.isLateSubmission && (
                    <span className="badge-warning text-xs flex-shrink-0">Arrears</span>
                  )}
                  <span className="badge-success text-xs flex-shrink-0">Submitted</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkerDashboard;
