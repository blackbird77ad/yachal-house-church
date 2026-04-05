import { useState, useEffect } from "react";
import { Users, FileText, Trophy, Clock, AlertCircle, ChevronRight, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { getDashboardSummary, getLeaderboard } from "../../services/adminService";
import { getAllMetrics } from "../../services/metricsService";
import Loader from "../../components/common/Loader";
import ScoreBadge from "../../components/common/ScoreBadge";
import { formatDate, getWeekLabel, getWeekReference } from "../../utils/formatDate";
import { useAuth } from "../../hooks/useAuth";

const AdminDashboard = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getDashboardSummary().catch(() => ({})),
      getLeaderboard().catch(() => ({ leaderboard: [] })),
    ]).then(([s, l]) => {
      setSummary(s);
      setLeaderboard(l.leaderboard?.slice(0, 10) || []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader text="Loading dashboard..." />;

  const weekLabel = getWeekLabel(getWeekReference());

  const stats = [
    { label: "Total Workers", value: summary?.totalWorkers ?? 0, icon: <Users className="w-5 h-5" />, color: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400", link: "/admin/workers" },
    { label: "Pending Approval", value: summary?.pendingApprovals ?? 0, icon: <AlertCircle className="w-5 h-5" />, color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400", link: "/admin/workers?status=pending" },
    { label: "Submitted This Week", value: summary?.submittedThisWeek ?? 0, icon: <FileText className="w-5 h-5" />, color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400", link: "/admin/reports" },
    { label: "Qualified Workers", value: summary?.qualifiedWorkers ?? 0, icon: <Trophy className="w-5 h-5" />, color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400", link: "/admin/qualification" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="section-title">Admin Dashboard</h1>
          <p className="section-subtitle">{weekLabel} - Welcome, {user?.fullName?.split(" ")[0]}</p>
        </div>
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${summary?.portalOpen ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400"}`}>
          <Clock className="w-4 h-4" />
          Portal {summary?.portalOpen ? "Open" : "Closed"}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link key={stat.label} to={stat.link} className="card p-5 hover:shadow-card-hover transition-all group">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${stat.color} group-hover:scale-110 transition-transform`}>
              {stat.icon}
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{stat.value}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{stat.label}</p>
          </Link>
        ))}
      </div>

      {summary?.pendingApprovals > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-300 flex-1">
            {summary.pendingApprovals} worker{summary.pendingApprovals > 1 ? "s" : ""} waiting for account approval.
          </p>
          <Link to="/admin/workers?status=pending" className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1">
            Review <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-purple-600" />
              Leaderboard
            </h2>
            <Link to="/admin/qualification" className="text-xs text-purple-700 dark:text-purple-400 hover:underline flex items-center gap-1">
              Full view <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-8">No metrics processed yet for this week.</p>
          ) : (
            <div className="space-y-3">
              {leaderboard.map((m, i) => (
                <div key={m._id} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400" : i === 1 ? "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300" : i === 2 ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" : "bg-gray-50 dark:bg-slate-800 text-gray-400"}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{m.worker?.fullName}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">ID: {m.worker?.workerId} - {m.worker?.department?.replace(/-/g, " ")}</p>
                  </div>
                  <ScoreBadge score={m.totalScore} isQualified={m.isQualified} showLabel={false} size="sm" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6">
          <h2 className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2 mb-5">
            <BarChart3 className="w-4 h-4 text-green-600" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { to: "/admin/workers", label: "Manage Workers", icon: <Users className="w-5 h-5" />, color: "text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20" },
              { to: "/admin/reports", label: "View Reports", icon: <FileText className="w-5 h-5" />, color: "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20" },
              { to: "/admin/portal", label: "Portal Control", icon: <Clock className="w-5 h-5" />, color: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20" },
              { to: "/admin/qualification", label: "Qualification", icon: <Trophy className="w-5 h-5" />, color: "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" },
            ].map((item) => (
              <Link key={item.to} to={item.to} className="p-4 border border-gray-100 dark:border-slate-700 rounded-xl hover:shadow-md transition-all group">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${item.color} group-hover:scale-110 transition-transform`}>
                  {item.icon}
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{item.label}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;