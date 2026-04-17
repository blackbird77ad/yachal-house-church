import { useState, useEffect, useMemo } from "react";
import { Calendar, Users, Star, FileText, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../utils/axiosInstance";
import Loader from "../../components/common/Loader";
import Pagination from "../../components/common/Pagination";
import { formatDate, formatDateTime } from "../../utils/formatDate";
import { cn } from "../../utils/scoreHelpers";

const PER_PAGE = 4;

const WorkerRoster = () => {
  const navigate = useNavigate();
  const [rosters, setRosters] = useState([]);
  const [page, setPage] = useState(1);
  const [totalRosters, setTotalRosters] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axiosInstance
      .get("/roster/my-assignment", {
        params: {
          page,
          limit: PER_PAGE,
        },
      })
      .then(({ data }) => {
        setRosters(Array.isArray(data?.rosters) ? data.rosters : []);
        setTotalRosters(data?.total || 0);
        setTotalPages(data?.totalPages || 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  const totalAssignments = useMemo(
    () =>
      rosters.reduce(
        (sum, roster) => sum + (Array.isArray(roster.myAssignments) ? roster.myAssignments.length : 0),
        0
      ),
    [rosters]
  );

  if (loading) return <Loader text="Loading your roster..." />;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="btn-ghost text-xs flex items-center gap-1.5 mb-3"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Go Back
          </button>
          <h1 className="section-title">My Roster</h1>
          <p className="section-subtitle">
            Published duty rosters, full department assignments, and where you are placed
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 text-sm font-semibold text-purple-700 dark:text-purple-300">
            <Calendar className="w-4 h-4" />
            Rosters: {totalRosters}
          </span>

          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm font-semibold text-gray-700 dark:text-slate-200">
            <Users className="w-4 h-4" />
            Assignments: {totalAssignments}
          </span>
        </div>
      </div>

      {rosters.length === 0 ? (
        <div className="card p-14 text-center">
          <Calendar className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-2">
            No roster published yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Your duty roster will appear here once the admin team publishes it.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {rosters.map((roster, idx) => (
            <div key={roster._id || idx} className="card p-6 space-y-5">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-purple-700 dark:text-purple-400" />
                </div>

                <div>
                  <p className="font-bold text-gray-900 dark:text-slate-100 capitalize">
                    {roster.headline || `${roster.serviceType} Service`}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    {formatDate(roster.serviceDate)}
                    {roster.publishedAt ? ` · Published ${formatDateTime(roster.publishedAt)}` : ""}
                  </p>
                </div>

                <span className="ml-auto badge-success">
                  {roster.isAssigned ? "Assigned" : "Published"}
                </span>
              </div>

              {roster.notes && (
                <div className="rounded-xl bg-gray-50 dark:bg-slate-800 p-4 border border-gray-100 dark:border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                      Notes
                    </p>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-slate-400">{roster.notes}</p>
                </div>
              )}

              {Array.isArray(roster.myAssignments) && roster.myAssignments.length > 0 ? (
                <div className="space-y-3">
                  <h2 className="font-bold text-gray-900 dark:text-slate-100">
                    Your Assignments ({roster.myAssignments.length})
                  </h2>

                  {roster.myAssignments.map((a, i) => (
                    <div
                      key={i}
                      className="card p-5 flex items-center gap-4 border border-gray-100 dark:border-slate-700"
                    >
                      <div className="w-11 h-11 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Users className="w-5 h-5 text-purple-700 dark:text-purple-400" />
                      </div>

                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 dark:text-slate-100 capitalize">
                          {a.department?.replace(/-/g, " ")}
                        </p>
                        {a.subRole && (
                          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                            {a.subRole}
                          </p>
                        )}

                        {a.isCoordinator && (
                          <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium flex items-center gap-1 mt-0.5">
                            <Star className="w-3 h-3" />
                            Coordinator
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card p-10 text-center">
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    You do not have a duty assignment in this roster.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <h2 className="font-bold text-gray-900 dark:text-slate-100">
                  Full Roster Details
                </h2>

                {(roster.slots || []).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 dark:border-slate-700 p-5 text-sm text-gray-500 dark:text-slate-400">
                    No departments were added to this roster.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(roster.slots || []).map((slot, slotIndex) => (
                      <div
                        key={`${roster._id}-${slot.department}-${slotIndex}`}
                        className="rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden"
                      >
                        <div className="px-4 py-3 bg-gray-50 dark:bg-slate-800/60 flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-slate-100 capitalize">
                              {slot.department?.replace(/-/g, " ")}
                            </p>
                            {slot.subRole && (
                              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                                {slot.subRole}
                              </p>
                            )}
                          </div>
                          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                            {(slot.assignments || []).length} assigned
                          </span>
                        </div>

                        <div className="p-4 space-y-2">
                          {(slot.assignments || []).length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-slate-400">
                              No worker assigned yet.
                            </p>
                          ) : (
                            slot.assignments.map((assignment, assignmentIndex) => (
                              <div
                                key={`${slot.department}-${assignment.worker?._id || assignmentIndex}`}
                                className={cn(
                                  "flex items-center gap-3 rounded-xl border p-3",
                                  assignment.isMine
                                    ? "border-purple-300 bg-purple-50 dark:bg-purple-900/20"
                                    : "border-gray-100 dark:border-slate-700"
                                )}
                              >
                                <div
                                  className={cn(
                                    "w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0",
                                    assignment.isMine
                                      ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                                      : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
                                  )}
                                >
                                  {assignment.worker?.fullName?.charAt(0) || "?"}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">
                                    {assignment.worker?.fullName}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-slate-400">
                                    {assignment.worker?.workerId || "ID pending"} · {assignment.worker?.department?.replace(/-/g, " ") || "Unassigned"}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap justify-end">
                                  {assignment.isCoordinator && (
                                    <span className="text-[11px] px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-semibold">
                                      Coordinator
                                    </span>
                                  )}
                                  {assignment.isMine && (
                                    <span className="text-[11px] px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-semibold">
                                      You
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalRosters}
            perPage={PER_PAGE}
            label="rosters"
            onPage={setPage}
          />
        </div>
      )}
    </div>
  );
};

export default WorkerRoster;
