import { useState, useEffect } from "react";
import { Calendar, Users, Star } from "lucide-react";
import axiosInstance from "../../utils/axiosInstance";
import Loader from "../../components/common/Loader";
import { formatDate } from "../../utils/formatDate";
import { useAuth } from "../../hooks/useAuth";

const WorkerRoster = () => {
  const { user } = useAuth();
  const [roster, setRoster] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosInstance.get("/roster/my-assignment")
      .then(({ data }) => setRoster(data.roster))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader text="Loading your roster..." />;

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="section-title">My Roster Assignment</h1>
        <p className="section-subtitle">Your duty assignment for the upcoming service</p>
      </div>

      {!roster ? (
        <div className="card p-14 text-center">
          <Calendar className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-2">No roster published yet</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400">Your duty assignment will appear here once the roster is published by the admin team.</p>
        </div>
      ) : (
        <>
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-purple-700 dark:text-purple-400" />
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-slate-100 capitalize">{roster.serviceType} Service</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">{formatDate(roster.serviceDate)}</p>
              </div>
              <span className="ml-auto badge-success">Published</span>
            </div>
            {roster.notes && <p className="text-sm text-gray-500 dark:text-slate-400 mt-3 border-t border-gray-100 dark:border-slate-700 pt-3">{roster.notes}</p>}
          </div>

          {roster.myAssignments?.length > 0 ? (
            <div className="space-y-3">
              <h2 className="font-bold text-gray-900 dark:text-slate-100">Your Assignments</h2>
              {roster.myAssignments.map((a, i) => (
                <div key={i} className="card p-5 flex items-center gap-4">
                  <div className="w-11 h-11 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-purple-700 dark:text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-slate-100 capitalize">{a.department?.replace(/-/g, " ")}</p>
                    {a.isCoordinator && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium flex items-center gap-1 mt-0.5">
                        <Star className="w-3 h-3" /> Coordinator
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card p-10 text-center">
              <p className="text-sm text-gray-500 dark:text-slate-400">You do not have a duty assignment in this roster.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default WorkerRoster;