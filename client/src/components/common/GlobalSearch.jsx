import { useState, useEffect, useRef } from "react";
import { Search, X, Users, FileText, Trophy, Clock, ClipboardList, Calendar, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import axiosInstance from "../../utils/axiosInstance";
import { cn } from "../../utils/scoreHelpers";

const QUICK_LINKS = [
  { label: "Workers", icon: <Users className="w-4 h-4" />, to: "/admin/workers", role: "admin" },
  { label: "Reports", icon: <FileText className="w-4 h-4" />, to: "/admin/reports", role: "admin" },
  { label: "Qualification", icon: <Trophy className="w-4 h-4" />, to: "/admin/qualification", role: "admin" },
  { label: "Roster", icon: <Calendar className="w-4 h-4" />, to: "/admin/roster", role: "admin" },
  { label: "Portal Control", icon: <Clock className="w-4 h-4" />, to: "/admin/portal", role: "admin" },
  { label: "Report Types", icon: <ClipboardList className="w-4 h-4" />, to: "/admin/report-types", role: "admin" },
  { label: "Submit Report", icon: <FileText className="w-4 h-4" />, to: "/portal/submit-report", role: "worker" },
  { label: "My Reports", icon: <FileText className="w-4 h-4" />, to: "/portal/my-reports", role: "worker" },
  { label: "Front Desk", icon: <Users className="w-4 h-4" />, to: "/portal/front-desk", role: "worker" },
];

const GlobalSearch = () => {
  const { isAdminLevel } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ workers: [], reports: [] });
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults({ workers: [], reports: [] }); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        if (isAdminLevel) {
          const [wRes, rRes] = await Promise.all([
            axiosInstance.get(`/workers?search=${query}`).catch(() => ({ data: { workers: [] } })),
            axiosInstance.get(`/reports?search=${query}`).catch(() => ({ data: { reports: [] } })),
          ]);
          setResults({ workers: wRes.data.workers?.slice(0, 5) || [], reports: rRes.data.reports?.slice(0, 3) || [] });
        }
      } catch {} finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, isAdminLevel]);

  const go = (to) => { navigate(to); setOpen(false); setQuery(""); };

  const filteredLinks = QUICK_LINKS.filter((l) =>
    (isAdminLevel ? true : l.role === "worker") &&
    (!query || l.label.toLowerCase().includes(query.toLowerCase()))
  );

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors border border-gray-200 dark:border-slate-700 w-48"
    >
      <Search className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1 text-left">Search...</span>
      <kbd className="text-xs text-gray-400 bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded border border-gray-200 dark:border-slate-600">
        {navigator.platform?.includes("Mac") ? "⌘K" : "Ctrl+K"}
      </kbd>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-slate-700">
          <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none text-base"
            placeholder="Search workers, reports, pages..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="text-xs text-gray-400 bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded border border-gray-200 dark:border-slate-600">Esc</kbd>
        </div>

        <div className="max-h-96 overflow-y-auto py-2">
          {searching && (
            <div className="px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
              Searching...
            </div>
          )}

          {results.workers.length > 0 && (
            <div>
              <p className="px-4 py-1.5 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Workers</p>
              {results.workers.map((w) => (
                <button key={w._id} onClick={() => go(`/admin/workers/${w._id}`)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-left">
                  <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-bold flex items-center justify-center text-sm flex-shrink-0">
                    {w.fullName?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{w.fullName}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">ID: {w.workerId || "No ID"} - {w.email}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}

          {results.reports.length > 0 && (
            <div>
              <p className="px-4 py-1.5 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Reports</p>
              {results.reports.map((r) => (
                <button key={r._id} onClick={() => go(`/admin/reports/${r._id}`)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-left">
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{r.submittedBy?.fullName} - {r.reportType}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{r.submittedBy?.workerId}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}

          {filteredLinks.length > 0 && (
            <div>
              <p className="px-4 py-1.5 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Pages</p>
              {filteredLinks.map((l) => (
                <button key={l.to} onClick={() => go(l.to)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-left">
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 flex items-center justify-center flex-shrink-0">
                    {l.icon}
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100 flex-1">{l.label}</p>
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}

          {!searching && query.length >= 2 && results.workers.length === 0 && results.reports.length === 0 && filteredLinks.length === 0 && (
            <p className="px-4 py-8 text-sm text-gray-400 dark:text-slate-500 text-center">No results for "{query}"</p>
          )}

          {!query && filteredLinks.length === 0 && (
            <p className="px-4 py-6 text-sm text-gray-400 dark:text-slate-500 text-center">Start typing to search workers, reports or pages.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;