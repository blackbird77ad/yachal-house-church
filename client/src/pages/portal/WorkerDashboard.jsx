import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FileText, Clock, CheckCircle, AlertCircle, ChevronRight, Bell } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { getPortalStatus } from "../../services/portalService";
import { getMyReports } from "../../services/reportService";
import Loader from "../../components/common/Loader";
import { formatDate, getWeekLabel, getWeekReference } from "../../utils/formatDate";
import { REPORT_TYPES } from "../../utils/constants";
import PushPrompt from "../../components/common/PushPrompt";

const WorkerDashboard = () => {
  const { user } = useAuth();
  const [portal, setPortal] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [reportsRes, portalRes] = await Promise.all([
        getMyReports({ limit: 5 }).catch(() => ({ reports: [] })),
        getPortalStatus().catch(() => ({ isOpen: false })),
      ]);
      setReports(reportsRes.reports || []);
      setPortal(portalRes);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      getPortalStatus().then(setPortal).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <Loader text="Loading your dashboard..." />;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="section-title">Welcome, {user?.fullName?.split(" ")[0]}</h1>
          <p className="section-subtitle">{getWeekLabel(getWeekReference())}</p>
        </div>
        {user?.workerId && (
          <div className="inline-flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 px-4 py-2 rounded-xl">
            <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">Worker ID</span>
            <span className="text-2xl font-bold text-purple-700 dark:text-purple-300 tracking-widest">{user.workerId}</span>
          </div>
        )}
      </div>

      {/* Push notification prompt - shows once until dismissed or enabled */}
      <PushPrompt />

      {/* Portal status banner */}
      <div className={`rounded-xl border px-5 py-4 flex items-center gap-3 ${
        portal?.isOpen
          ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
          : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
      }`}>
        {portal?.isOpen
          ? <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          : <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        }
        <div className="flex-1">
          <p className={`text-sm font-semibold ${portal?.isOpen ? "text-green-800 dark:text-green-300" : "text-amber-800 dark:text-amber-300"}`}>
            {portal?.isOpen
              ? `Portal is open. ${portal.timeLeft ? `Closes in ${portal.timeLeft.hours}h ${portal.timeLeft.minutes}m.` : ""}`
              : "Portal is currently closed. Opens every Friday at midnight."}
          </p>
          <p className={`text-xs mt-0.5 ${portal?.isOpen ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
            {portal?.isOpen ? "Select a report type to begin." : "Fill your report anytime. Drafts save automatically."}
          </p>
        </div>
        {portal?.isOpen && (
          <Link to="/portal/submit-report" className="btn-primary text-xs py-1.5 px-3 flex-shrink-0">
            Submit Report
          </Link>
        )}
      </div>

      {/* Recent reports */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-gray-900 dark:text-slate-100">My Submitted Reports</h2>
          <Link to="/portal/submit-report" className="text-xs text-purple-700 dark:text-purple-400 hover:underline flex items-center gap-1">
            Submit <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {reports.length === 0 ? (
          <div className="text-center py-10">
            <FileText className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">No reports submitted yet.</p>
            <Link to="/portal/submit-report" className="btn-primary text-sm">Submit your first report</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {reports.map((r) => {
              const type = REPORT_TYPES.find((t) => t.value === r.reportType);
              return (
                <div key={r._id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                  <div className="w-9 h-9 bg-purple-50 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{type?.label || r.reportType}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{formatDate(r.weekReference)}</p>
                  </div>
                  {r.isLateSubmission && <span className="badge-warning text-xs flex-shrink-0">Arrears</span>}
                  <span className="badge-success text-xs flex-shrink-0">Submitted</span>
                </div>
              );
            })}
            <div className="pt-2">
              <Link to="/portal/my-reports" className="text-xs text-purple-700 dark:text-purple-400 hover:underline">
                View all reports
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { to: "/portal/submit-report", icon: <FileText className="w-5 h-5" />, label: "Submit Report", desc: "Fill and submit your weekly report", color: "text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20" },
          { to: "/portal/my-reports",    icon: <Clock className="w-5 h-5" />,    label: "My Reports",    desc: "View and download past reports",   color: "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20" },
          { to: "/portal/notifications", icon: <Bell className="w-5 h-5" />,     label: "Notifications", desc: "Check your latest alerts",          color: "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" },
        ].map((item) => (
          <Link key={item.to} to={item.to} className="card p-5 hover:shadow-card-hover transition-all group">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${item.color} group-hover:scale-110 transition-transform`}>
              {item.icon}
            </div>
            <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm mb-1">{item.label}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">{item.desc}</p>
          </Link>
        ))}
      </div>

    </div>
  );
};

export default WorkerDashboard;