import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Download,
  Printer,
  RefreshCw,
  Search,
  Shield,
  Trophy,
  Users,
  X,
} from "lucide-react";
import Loader from "../../components/common/Loader";
import Pagination from "../../components/common/Pagination";
import { ToastContainer, useToast } from "../../components/common/Toast";
import { getServiceRoleQualificationHistory } from "../../services/metricsService";
import { getWeekLabel } from "../../utils/formatDate";
import { cn } from "../../utils/scoreHelpers";

const ROLE_TABS = [
  { key: "leading", label: "Leading Roles", icon: Trophy },
  { key: "supporting", label: "Supporting Roles", icon: Shield },
  { key: "remaining", label: "Remaining Workers", icon: Users },
];

const WEEKS_PER_PAGE = 6;
const ITEMS_PER_PAGE = 15;
const PRINT_AREA_ID = "service-role-week-print-area";

const PRINT_STYLE = `
.service-role-print-shell {
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

  .service-role-print-shell {
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

const getWeekKey = (week) => new Date(week.weekReference).toISOString();

const normalizeText = (value = "") =>
  value.toString().trim().toLowerCase().replace(/\s+/g, " ");

const getStatusClass = (status) => {
  if (status === "qualified") {
    return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
  }
  if (status === "almost-qualified") {
    return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300";
  }
  return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
};

const getWeekSearchText = (week) => {
  const date = new Date(week.weekReference);
  const isoDate = Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  const year = Number.isNaN(date.getTime()) ? "" : date.getUTCFullYear();

  return normalizeText(
    [
      getWeekLabel(week.weekReference),
      isoDate,
      year,
      `week ${getWeekLabel(week.weekReference)}`,
    ].join(" ")
  );
};

const getEntrySearchText = (entry) => {
  const role = entry.serviceRoleQualification || {};
  return normalizeText(
    [
      entry.worker?.fullName,
      entry.worker?.workerId,
      entry.worker?.email,
      formatDepartment(entry.worker?.department),
      entry.qualificationStatusLabel,
      role.ruleMatched,
      role.mainChurchCount,
      role.cellMeetingPeopleCount,
      entry.totalScore,
    ].join(" ")
  );
};

const paginate = (list, page, perPage) => {
  const safePage = Math.max(1, page || 1);
  return list.slice((safePage - 1) * perPage, safePage * perPage);
};

const ServiceRoleQualification = () => {
  const { toasts, toast, removeToast } = useToast();
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedWeek, setExpandedWeek] = useState(null);
  const [activeTabs, setActiveTabs] = useState({});
  const [search, setSearch] = useState("");
  const [weekPage, setWeekPage] = useState(1);
  const [listPages, setListPages] = useState({});
  const [printableWeek, setPrintableWeek] = useState(null);

  const fetchWeeks = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await getServiceRoleQualificationHistory({
        isLateSubmission: false,
      });
      const nextWeeks = data.weeks || [];
      setWeeks(nextWeeks);

      setExpandedWeek((current) => {
        if (current && nextWeeks.some((week) => getWeekKey(week) === current)) {
          return current;
        }

        return nextWeeks.length > 0 ? getWeekKey(nextWeeks[0]) : null;
      });
    } catch {
      toast.error("Error", "Could not load service role qualification.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchWeeks();
  }, [fetchWeeks]);

  useEffect(() => {
    setWeekPage(1);
    setListPages({});
  }, [search]);

  const filteredWeeks = useMemo(() => {
    const query = normalizeText(search);
    if (!query) return weeks;

    return weeks
      .map((week) => {
        const weekMatches = getWeekSearchText(week).includes(query);

        if (weekMatches) {
          return week;
        }

        const nextWeek = { ...week };
        ROLE_TABS.forEach(({ key }) => {
          nextWeek[key] = (week[key] || []).filter((entry) =>
            getEntrySearchText(entry).includes(query)
          );
        });

        const hasMatches = ROLE_TABS.some(({ key }) => nextWeek[key]?.length > 0);
        return hasMatches ? nextWeek : null;
      })
      .filter(Boolean);
  }, [search, weeks]);

  useEffect(() => {
    if (!filteredWeeks.length) {
      setExpandedWeek(null);
      return;
    }

    setExpandedWeek((current) => {
      if (current && filteredWeeks.some((week) => getWeekKey(week) === current)) {
        return current;
      }

      return getWeekKey(filteredWeeks[0]);
    });
  }, [filteredWeeks]);

  const totals = useMemo(
    () =>
      filteredWeeks.reduce(
        (acc, week) => ({
          leading: acc.leading + (week.leading?.length || 0),
          supporting: acc.supporting + (week.supporting?.length || 0),
          remaining: acc.remaining + (week.remaining?.length || 0),
          submitted: acc.submitted + (week.counts?.submitted || 0),
        }),
        { leading: 0, supporting: 0, remaining: 0, submitted: 0 }
      ),
    [filteredWeeks]
  );

  const weekTotalPages = Math.max(1, Math.ceil(filteredWeeks.length / WEEKS_PER_PAGE));
  const visibleWeeks = paginate(filteredWeeks, weekPage, WEEKS_PER_PAGE);

  useEffect(() => {
    setWeekPage((current) => Math.min(Math.max(1, current), weekTotalPages));
  }, [weekTotalPages]);

  const setRoleTab = (weekKey, tab) => {
    setActiveTabs((prev) => ({ ...prev, [weekKey]: tab }));
    setListPages((prev) => ({ ...prev, [`${weekKey}:${tab}`]: 1 }));
  };

  const setActiveListPage = (weekKey, tab, page) => {
    setListPages((prev) => ({ ...prev, [`${weekKey}:${tab}`]: page }));
  };

  const getActiveListPage = (weekKey, tab) =>
    listPages[`${weekKey}:${tab}`] || 1;

  const printWeek = (week) => {
    setPrintableWeek(week);

    const previousTitle = document.title;
    document.title = `Service Role Qualification - ${getWeekLabel(week.weekReference)}`;

    const restoreTitle = () => {
      document.title = previousTitle;
      window.removeEventListener("afterprint", restoreTitle);
      setPrintableWeek(null);
    };

    window.addEventListener("afterprint", restoreTitle);
    window.setTimeout(() => {
      window.print();
      window.setTimeout(restoreTitle, 1000);
    }, 80);
  };

  const downloadWeekCSV = (week) => {
    const rows = [
      [
        "Role Group",
        "Rank",
        "Name",
        "Worker ID",
        "Department",
        "Qualification Status",
        "Score",
        "Main Church People",
        "Cell Meeting People",
        "Rule Matched",
      ],
    ];

    [
      ["Leading Roles", week.leading || []],
      ["Supporting Roles", week.supporting || []],
      ["Remaining Workers", week.remaining || []],
    ].forEach(([group, list]) => {
      list.forEach((item, index) => {
        rows.push([
          group,
          index + 1,
          item.worker?.fullName || "",
          item.worker?.workerId || "ID pending",
          formatDepartment(item.worker?.department),
          item.qualificationStatusLabel || "",
          item.totalScore || 0,
          item.serviceRoleQualification?.mainChurchCount || 0,
          item.serviceRoleQualification?.cellMeetingPeopleCount || 0,
          item.serviceRoleQualification?.ruleMatched || "",
        ]);
      });
    });

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `service-role-qualification-${getWeekLabel(
      week.weekReference
    ).replace(/\s/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const RoleList = ({ list = [], emptyText, startIndex = 0 }) => {
    if (list.length === 0) {
      return (
        <div className="py-10 text-center text-sm text-gray-400 dark:text-slate-500">
          {emptyText}
        </div>
      );
    }

    return (
      <div className="divide-y divide-gray-100 dark:divide-slate-700">
        {list.map((item, index) => {
          const role = item.serviceRoleQualification || {};
          const absoluteIndex = startIndex + index;
          return (
            <div
              key={item.worker?._id || `${item.worker?.workerId || "worker"}-${absoluteIndex}`}
              className="py-2.5 flex flex-col xl:flex-row xl:items-center gap-2.5"
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 font-bold text-xs flex items-center justify-center flex-shrink-0">
                  {absoluteIndex + 1}
                </div>
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-bold text-xs flex items-center justify-center flex-shrink-0">
                  {item.worker?.fullName?.charAt(0) || "?"}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-gray-900 dark:text-slate-100 truncate">
                    {item.worker?.fullName || "Unknown worker"}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                    ID: {item.worker?.workerId || "ID pending"} -{" "}
                    {formatDepartment(item.worker?.department)}
                  </p>
                  <span
                    className={cn(
                      "inline-flex mt-1 text-[11px] px-2 py-0.5 rounded-full font-semibold",
                      getStatusClass(item.qualificationStatus)
                    )}
                  >
                    {item.qualificationStatusLabel || "No Report"}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 xl:w-[300px]">
                {[
                  { label: "Main", value: role.mainChurchCount || 0, className: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300" },
                  { label: "Cell", value: role.cellMeetingPeopleCount || 0, className: "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300" },
                  { label: "Score", value: item.totalScore || 0, className: "bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300" },
                ].map((metric) => (
                  <span
                    key={metric.label}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                      metric.className
                    )}
                  >
                    <span className="opacity-75">{metric.label}</span>
                    <span>{metric.value}</span>
                  </span>
                ))}
              </div>

              <p className="text-xs text-gray-500 dark:text-slate-400 xl:w-64">
                {role.ruleMatched}
              </p>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) return <Loader text="Loading service role qualification..." />;

  return (
    <div className="space-y-5 animate-fade-in">
      <style>{PRINT_STYLE}</style>
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link
            to="/admin/qualification"
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="section-title">Service Role Qualification</h1>
            <p className="section-subtitle">
              Weekly Leading, Supporting, and Remaining worker lists from qualification metrics
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchWeeks(true)}
          disabled={refreshing}
          className="btn-outline text-sm flex items-center gap-1.5 w-fit"
        >
          <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          Refresh
        </button>
      </div>

      <div className="card p-3 sm:p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input-field pl-10 pr-10"
            placeholder="Search by worker, Worker ID, week, date, month, or year..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
          Showing {filteredWeeks.length} of {weeks.length} week
          {weeks.length === 1 ? "" : "s"}.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Weeks", value: filteredWeeks.length, color: "text-purple-700 dark:text-purple-300" },
          { label: "Leading Roles", value: totals.leading, color: "text-blue-700 dark:text-blue-300" },
          { label: "Supporting Roles", value: totals.supporting, color: "text-green-700 dark:text-green-300" },
        ].map((stat) => (
          <div key={stat.label} className="card p-3 sm:p-4">
            <p className={cn("text-xl sm:text-2xl font-bold", stat.color)}>{stat.value}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-300">
          Leading roles require 4+ people to main church services, or 2-3 to main services with 4+
          to cell meetings. Supporting roles require 2-3 people to main services, or 2+ people to
          cell meetings. Remaining workers are ordered by weekly qualification result: qualified,
          almost qualified, then no report.
        </p>
      </div>

      {filteredWeeks.length === 0 ? (
        <div className="card p-10 text-center text-gray-400 dark:text-slate-500">
          No service role qualification records match your search.
        </div>
      ) : (
        <div className="space-y-3">
          {visibleWeeks.map((week) => {
            const weekKey = getWeekKey(week);
            const isExpanded = expandedWeek === weekKey;
            const activeTab = activeTabs[weekKey] || "leading";
            const activeList = week[activeTab] || [];
            const activeListPage = getActiveListPage(weekKey, activeTab);
            const activeListTotalPages = Math.max(
              1,
              Math.ceil(activeList.length / ITEMS_PER_PAGE)
            );
            const safeListPage = Math.min(activeListPage, activeListTotalPages);
            const visibleList = paginate(activeList, safeListPage, ITEMS_PER_PAGE);
            const startIndex = (safeListPage - 1) * ITEMS_PER_PAGE;

            return (
              <div key={weekKey} className="card overflow-hidden">
                <div
                  className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                  onClick={() => setExpandedWeek(isExpanded ? null : weekKey)}
                >
                  <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 dark:text-slate-100 text-sm">
                      {getWeekLabel(week.weekReference)}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">
                      {week.leading?.length || 0} leading - {week.supporting?.length || 0} supporting
                      - {week.remaining?.length || 0} remaining - {week.counts?.submitted || 0} submitted
                    </p>
                  </div>

                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      printWeek(week);
                    }}
                    className="p-1.5 text-gray-400 hover:text-purple-600 rounded-lg"
                    title="Print week"
                  >
                    <Printer className="w-4 h-4" />
                  </button>

                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      downloadWeekCSV(week);
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

                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-slate-700 p-3 bg-gray-50 dark:bg-slate-800/30">
                    <div className="flex gap-1 bg-white dark:bg-slate-900 rounded-xl p-1 flex-wrap w-full sm:w-fit mb-4">
                      {ROLE_TABS.map(({ key, label, icon }) => (
                        <button
                          key={key}
                          onClick={() => setRoleTab(weekKey, key)}
                          className={cn(
                            "flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-1 sm:flex-none",
                            activeTab === key
                              ? "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                              : "text-gray-500 dark:text-slate-400 hover:text-gray-700"
                          )}
                        >
                          {createElement(icon, { className: "w-4 h-4" })}
                          <span className="truncate">
                            {label} ({week[key]?.length || 0})
                          </span>
                        </button>
                      ))}
                    </div>

                    <RoleList
                      list={visibleList}
                      startIndex={startIndex}
                      emptyText={
                        activeTab === "leading"
                          ? "No workers qualified for leading roles this week."
                          : activeTab === "supporting"
                          ? "No workers qualified for supporting roles this week."
                          : "No remaining workers found for this week."
                      }
                    />

                    <Pagination
                      page={safeListPage}
                      totalPages={activeListTotalPages}
                      totalItems={activeList.length}
                      perPage={ITEMS_PER_PAGE}
                      label="workers"
                      onPage={(page) =>
                        setActiveListPage(
                          weekKey,
                          activeTab,
                          Math.min(Math.max(1, page), activeListTotalPages)
                        )
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}

          <Pagination
            page={weekPage}
            totalPages={weekTotalPages}
            totalItems={filteredWeeks.length}
            perPage={WEEKS_PER_PAGE}
            label="weeks"
            onPage={(page) => setWeekPage(Math.min(Math.max(1, page), weekTotalPages))}
          />
        </div>
      )}

      <div className="service-role-print-shell">
        <ServiceRoleWeekPrint week={printableWeek} />
      </div>
    </div>
  );
};

const ServiceRoleWeekPrint = ({ week }) => {
  if (!week) return null;

  const groups = [
    ["Leading Roles", week.leading || []],
    ["Supporting Roles", week.supporting || []],
    ["Remaining Workers", week.remaining || []],
  ];

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
              Service Role Qualification
            </h1>
            <div style={{ fontSize: 12, color: "#475569" }}>
              {getWeekLabel(week.weekReference)}
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 11, color: "#475569" }}>
            <div>{week.leading?.length || 0} leading</div>
            <div>{week.supporting?.length || 0} supporting</div>
            <div>{week.remaining?.length || 0} remaining</div>
          </div>
        </div>
      </div>

      {groups.map(([title, list]) => (
        <div key={title} style={{ marginBottom: 18, breakInside: "avoid" }}>
          <h2 style={{ fontSize: 14, margin: "0 0 8px", color: "#111827" }}>
            {title} ({list.length})
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                {["#", "Worker", "ID", "Status", "Main", "Cell", "Score", "Rule"].map((label) => (
                  <th
                    key={label}
                    style={{
                      textAlign: label === "#" ? "center" : "left",
                      border: "1px solid #cbd5e1",
                      padding: 7,
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ border: "1px solid #e5e7eb", padding: 10, textAlign: "center", color: "#64748b" }}>
                    No workers in this group.
                  </td>
                </tr>
              ) : (
                list.map((entry, index) => {
                  const role = entry.serviceRoleQualification || {};
                  return (
                    <tr key={entry.worker?._id || `${title}-${index}`}>
                      <td style={{ border: "1px solid #e5e7eb", padding: 7, textAlign: "center" }}>{index + 1}</td>
                      <td style={{ border: "1px solid #e5e7eb", padding: 7, fontWeight: 700 }}>{entry.worker?.fullName || "Unknown"}</td>
                      <td style={{ border: "1px solid #e5e7eb", padding: 7 }}>{entry.worker?.workerId || "ID pending"}</td>
                      <td style={{ border: "1px solid #e5e7eb", padding: 7 }}>{entry.qualificationStatusLabel || "No Report"}</td>
                      <td style={{ border: "1px solid #e5e7eb", padding: 7 }}>{role.mainChurchCount || 0}</td>
                      <td style={{ border: "1px solid #e5e7eb", padding: 7 }}>{role.cellMeetingPeopleCount || 0}</td>
                      <td style={{ border: "1px solid #e5e7eb", padding: 7 }}>{entry.totalScore || 0}</td>
                      <td style={{ border: "1px solid #e5e7eb", padding: 7 }}>{role.ruleMatched || ""}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ))}

      <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 8, fontSize: 9, color: "#94a3b8" }}>
        Generated {new Date().toLocaleDateString("en-GH")}
      </div>
    </div>
  );
};

export default ServiceRoleQualification;
