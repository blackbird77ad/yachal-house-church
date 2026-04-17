import { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Eye,
  Edit2,
  Lock,
  RefreshCw,
  FolderOpen,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import axiosInstance from "../../utils/axiosInstance";
import { getPortalStatus } from "../../services/portalService";
import Loader from "../../components/common/Loader";
import Pagination from "../../components/common/Pagination";
import { formatDateTime, getWeekLabel } from "../../utils/formatDate";
import { REPORT_TYPES } from "../../utils/constants";
import { useToast, ToastContainer } from "../../components/common/Toast";
import { cn } from "../../utils/scoreHelpers";

const PER_PAGE = 15;

const getMyReportSummary = async () => {
  const { data } = await axiosInstance.get("/reports/my-report-summary");
  return data;
};

const deleteMyDraftReport = async (reportId) => {
  const { data } = await axiosInstance.delete(`/reports/my-drafts/${reportId}`);
  return data;
};

const MyReports = () => {
  const { toasts, toast, removeToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [all, setAll] = useState([]);
  const [portal, setPortal] = useState(null);
  const [summary, setSummary] = useState({
    statusCounts: { all: 0, draft: 0, submitted: 0 },
    typeCountsByStatus: {
      all: { all: 0 },
      draft: { all: 0 },
      submitted: { all: 0 },
    },
  });
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");

  const initialTab = searchParams.get("tab") === "drafts" ? "drafts" : "submitted";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedType, setSelectedType] = useState("all");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const fetchReports = async () => {
    setLoading(true);

    try {
      const [{ data: rData }, pData, summaryData] = await Promise.all([
        axiosInstance.get("/reports/my-reports", {
          params: {
            page,
            limit: PER_PAGE,
            status: activeTab === "drafts" ? "draft" : "submitted",
            ...(selectedType !== "all" ? { reportType: selectedType } : {}),
          },
        }),
        getPortalStatus().catch(() => ({ isOpen: false })),
        getMyReportSummary().catch(() => ({
          statusCounts: { all: 0, draft: 0, submitted: 0 },
          typeCountsByStatus: {
            all: { all: 0 },
            draft: { all: 0 },
            submitted: { all: 0 },
          },
        })),
      ]);

      setAll(rData.reports || []);
      setTotalPages(rData.totalPages || 1);
      setTotalItems(rData.total || 0);
      setPortal(pData);
      setSummary(summaryData);
    } catch {
      toast.error("Error", "Could not load your reports. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSearchParams(activeTab === "drafts" ? { tab: "drafts" } : { tab: "submitted" });
  }, [activeTab, setSearchParams]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, selectedType]);

  useEffect(() => {
    fetchReports();
  }, [page, activeTab, selectedType]);

  const typeLabel = (type) => REPORT_TYPES.find((t) => t.value === type)?.label || type;

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
      toast.success("Deleted", "Draft deleted permanently.");

      if (all.length === 1 && page > 1) setPage((prev) => prev - 1);
      else await fetchReports();
    } catch (err) {
      toast.error("Error", err.response?.data?.message || "Could not delete this draft.");
    } finally {
      setDeletingId("");
    }
  };

  const activeStatusKey = activeTab === "drafts" ? "draft" : "submitted";

  const draftsCount = summary?.statusCounts?.draft ?? 0;
  const submittedCount = summary?.statusCounts?.submitted ?? 0;

  const typeCounts = useMemo(() => {
    const activeTypeCounts = summary?.typeCountsByStatus?.[activeStatusKey] || {};
    const counts = { all: activeTypeCounts.all ?? totalItems };
    REPORT_TYPES.forEach((type) => {
      counts[type.value] = activeTypeCounts[type.value] || 0;
    });
    return counts;
  }, [activeStatusKey, summary, totalItems]);

  const groupedByWeek = useMemo(() => {
    return all.reduce((acc, r) => {
      const label = r.weekReference ? getWeekLabel(new Date(r.weekReference)) : "Unknown week";
      if (!acc[label]) acc[label] = [];
      acc[label].push(r);
      return acc;
    }, {});
  }, [all]);

  const sortedWeeks = useMemo(() => {
    return Object.entries(groupedByWeek).sort((a, b) => {
      const aDate = new Date(a[1][0]?.weekReference || 0).getTime();
      const bDate = new Date(b[1][0]?.weekReference || 0).getTime();
      return bDate - aDate;
    });
  }, [groupedByWeek]);

  if (loading) return <Loader text="Loading your reports..." />;

  return (
    <div className="space-y-5 animate-fade-in">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="section-title">My Reports</h1>
          <p className="section-subtitle">
            Page {page} of {totalPages} · {totalItems} item{totalItems !== 1 ? "s" : ""}
          </p>
        </div>

        <button onClick={fetchReports} className="btn-ghost text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {activeTab === "drafts" && totalItems > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Drafts are not submitted yet
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
              Drafts do not count toward qualification until you submit them. Deleted drafts cannot be recovered.
            </p>
          </div>
        </div>
      )}

      <div className="card p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "submitted", label: "Submitted", count: activeTab === "submitted" ? totalItems : submittedCount },
            { key: "drafts", label: "Drafts", count: activeTab === "drafts" ? totalItems : draftsCount },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setSelectedType("all");
              }}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all inline-flex items-center gap-2",
                activeTab === tab.key
                  ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                  : "border-gray-200 dark:border-slate-600 text-gray-500 hover:border-purple-300"
              )}
            >
              {tab.label}
              <span className="inline-flex min-w-[22px] h-5 items-center justify-center rounded-full px-1.5 text-xs font-bold bg-white/80 dark:bg-slate-800">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedType("all")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all",
              selectedType === "all"
                ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                : "border-gray-200 dark:border-slate-600 text-gray-500 hover:border-purple-300"
            )}
          >
            All ({typeCounts.all})
          </button>

          {REPORT_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => setSelectedType(type.value)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all",
                selectedType === type.value
                  ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                  : "border-gray-200 dark:border-slate-600 text-gray-500 hover:border-purple-300"
              )}
            >
              {type.label} ({typeCounts[type.value] || 0})
            </button>
          ))}
        </div>
      </div>

      {all.length === 0 ? (
        <div className="card p-12 text-center">
          {activeTab === "drafts" ? (
            <FolderOpen className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
          ) : (
            <FileText className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
          )}
          <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-2">
            No {activeTab === "drafts" ? "drafts" : "submitted reports"} here
          </h3>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Try another report type or create a new report.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedWeeks.map(([weekLabel, reports]) => (
            <div key={weekLabel} className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                <p className="font-semibold text-gray-900 dark:text-slate-100">{weekLabel}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {reports.length} item{reports.length !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-slate-700">
                {reports.map((r) => (
                  <div key={r._id} className="flex items-center gap-4 p-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-purple-50 dark:bg-purple-900/30">
                      <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                        {typeLabel(r.reportType)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                        {activeTab === "drafts"
                          ? `Last saved: ${r.updatedAt ? formatDateTime(r.updatedAt) : "N/A"}`
                          : `Submitted: ${r.submittedAt ? formatDateTime(r.submittedAt) : "N/A"}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {r.isLateSubmission && (
                        <span className="badge-warning text-xs">
                          {activeTab === "drafts" ? "Arrears Draft" : "Arrears"}
                        </span>
                      )}

                      {activeTab === "drafts" ? (
                        <>
                          <Link to={buildDraftLink(r)} className="btn-outline text-xs py-1.5 px-3">
                            Continue Draft
                          </Link>
                          <button
                            onClick={() => handleDeleteDraft(r._id)}
                            disabled={deletingId === r._id}
                            className="btn-ghost text-xs py-1.5 px-3 text-red-500 hover:text-red-600 flex items-center gap-1 disabled:opacity-50"
                          >
                            <Trash2 className="w-3 h-3" />
                            {deletingId === r._id ? "Deleting..." : "Delete Draft"}
                          </button>
                        </>
                      ) : (
                        <>
                          {portal?.isOpen && r.isEditable !== false && !r.isLateSubmission ? (
                            <Link
                              to={`/portal/submit-report?reportType=${r.reportType}&weekType=current&edit=1&reportId=${r._id}`}
                              className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1"
                            >
                              <Edit2 className="w-3 h-3" />
                              Edit
                            </Link>
                          ) : (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              Locked
                            </span>
                          )}

                          <Link
                            to={`/portal/my-reports/${r._id}`}
                            className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="card px-5">
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            perPage={PER_PAGE}
            label="reports"
            onPage={setPage}
          />
        </div>
      )}
    </div>
  );
};

export default MyReports;
