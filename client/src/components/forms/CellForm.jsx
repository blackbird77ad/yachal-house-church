import { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus,
  Trash2,
  Save,
  Send,
  CheckCircle,
  Users,
  Clock3,
  WifiOff,
} from "lucide-react";
import { useReports } from "../../hooks/useReports";
import { useDraftInteraction } from "../../hooks/useDraftInteraction";
import { useToast, ToastContainer } from "../../components/common/Toast";
import {
  getFriendlyReportError,
  getNoDraftYetMessage,
  getReportSuccessMessage,
} from "../../utils/reportFeedback";
import { cn } from "../../utils/scoreHelpers";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const ACTIVITIES = [
  { value: "teaching", label: "Teaching", icon: "📖" },
  { value: "prayer", label: "Prayer Meeting", icon: "🙏" },
  { value: "holy-ghost", label: "Holy Ghost Meeting", icon: "🔥" },
  { value: "other", label: "Other", icon: "✨" },
];

const emptyMember = { fullName: "", reportingTime: "", role: "" };
const emptyAttendee = { fullName: "", location: "", phone: "" };
const emptyTopic = { title: "", duration: "", verses: "" };

const CellForm = ({
  weekType,
  weekReference,
  portalOpen,
  weekDate,
  isArrears,
  isEditMode,
  existingReportId,
  weekLabel,
}) => {
  const { handleSaveDraft, handleSubmit, handleEdit, fetchMyDraft, loading } = useReports();
  const { toasts, toast, removeToast } = useToast();
  const { hasInteracted, interactionProps, markInteracted } = useDraftInteraction();

  const [submitted, setSubmitted] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [autoSaveState, setAutoSaveState] = useState("idle");
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const lastSaveRef = useRef(0);
  const autoSaveRef = useRef(() => {});

  const [cellName, setCellName] = useState("");
  const [location, setLocation] = useState("");
  const [meetingDay, setMeetingDay] = useState("");
  const [meetingTime, setMeetingTime] = useState("");

  const [coordinatorName, setCoordinatorName] = useState("");
  const [coordinatorReportTime, setCoordinatorReportTime] = useState("");
  const [coordinatorRole, setCoordinatorRole] = useState("");

  const [coCoordinatorName, setCoCoordinatorName] = useState("");
  const [coCoordinatorReportTime, setCoCoordinatorReportTime] = useState("");
  const [coCoordinatorRole, setCoCoordinatorRole] = useState("");

  const [members, setMembers] = useState([{ ...emptyMember }]);
  const [attendees, setAttendees] = useState([{ ...emptyAttendee }]);

  const [activityType, setActivityType] = useState("");
  const [activityOther, setActivityOther] = useState("");
  const [topics, setTopics] = useState([{ ...emptyTopic }]);
  const [activityDuration, setActivityDuration] = useState("");
  const [activityVerses, setActivityVerses] = useState("");

  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadDraft = async () => {
      if (!mounted) return;
      setDraftLoaded(false);
      setHydrated(false);

      try {
        const { draft } = await fetchMyDraft({
          weekReference,
          reportType: "cell",
          weekType,
          weekDate,
        });

        if (!mounted) return;

        if (!draft) {
          setDraftLoaded(true);
          setHydrated(true);
          return;
        }

        if (draft.status === "submitted" && !isEditMode) {
          setSubmitted(true);
          setDraftLoaded(true);
          setHydrated(true);
          return;
        }

        const d = draft.cellReportData || draft.cellData || {};

        if (d.cellName) setCellName(d.cellName);
        if (d.location) setLocation(d.location);
        if (d.meetingDay) setMeetingDay(d.meetingDay);
        if (d.meetingTime) setMeetingTime(d.meetingTime);

        if (d.coordinatorName) setCoordinatorName(d.coordinatorName);
        if (d.coordinatorReportTime) setCoordinatorReportTime(d.coordinatorReportTime || "");
        if (d.coordinatorRole) setCoordinatorRole(d.coordinatorRole || "");

        if (d.coCoordinatorName) setCoCoordinatorName(d.coCoordinatorName);
        if (d.coCoordinatorReportTime) setCoCoordinatorReportTime(d.coCoordinatorReportTime || "");
        if (d.coCoordinatorRole) setCoCoordinatorRole(d.coCoordinatorRole || "");

        if (d.members?.length) setMembers(d.members);
        if (d.attendees?.length) setAttendees(d.attendees);

        if (d.activityType) setActivityType(d.activityType);
        if (d.activityOther) setActivityOther(d.activityOther);
        if (d.topics?.length) setTopics(d.topics);
        if (d.activityDuration) setActivityDuration(d.activityDuration);
        if (d.activityVerses) setActivityVerses(d.activityVerses);

        if (d.remarks) setRemarks(d.remarks);

        setDraftLoaded(true);
        setHydrated(true);
      } catch {
        if (!mounted) return;
        setDraftLoaded(true);
        setHydrated(true);
      }
    };

    loadDraft();

    return () => {
      mounted = false;
    };
  }, [weekReference, weekType, weekDate, isEditMode, fetchMyDraft]);

  const updateMember = (i, k, v) =>
    setMembers((p) => p.map((m, idx) => (idx === i ? { ...m, [k]: v } : m)));

  const updateAttendee = (i, k, v) =>
    setAttendees((p) => p.map((a, idx) => (idx === i ? { ...a, [k]: v } : a)));

  const updateTopic = (i, k, v) =>
    setTopics((p) => p.map((t, idx) => (idx === i ? { ...t, [k]: v } : t)));

  const totalAttendance = useMemo(() => {
    return (
      (coordinatorName.trim() ? 1 : 0) +
      (coCoordinatorName.trim() ? 1 : 0) +
      members.filter((m) => m.fullName.trim()).length +
      attendees.filter((a) => a.fullName.trim()).length
    );
  }, [coordinatorName, coCoordinatorName, members, attendees]);

  const buildPayload = () => ({
    reportType: "cell",
    weekType,
    weekDate,
    weekReference,
    isEdit: isEditMode,
    draftStarted: hasInteracted,
    cellReportData: {
      cellName,
      location,
      meetingDay,
      meetingTime,
      coordinatorName,
      coordinatorReportTime,
      coordinatorRole,
      coCoordinatorName,
      coCoordinatorReportTime,
      coCoordinatorRole,
      members: members.filter((m) => m.fullName.trim()),
      attendees: attendees.filter((a) => a.fullName.trim()),
      activityType,
      activityOther: activityType === "other" ? activityOther : "",
      topics: activityType === "teaching" ? topics.filter((t) => t.title.trim()) : [],
      activityDuration:
        activityType === "prayer" || activityType === "holy-ghost"
          ? activityDuration
          : "",
      activityVerses,
      totalAttendance,
      remarks,
    },
  });

  const requiredValid = useMemo(() => {
    return !!cellName.trim() && !!meetingDay && !!activityType;
  }, [cellName, meetingDay, activityType]);

  const saveDraftInternal = async ({ silent = false, source = "manual" } = {}) => {
    try {
      if (isEditMode) {
        if (!silent) {
          toast.info(
            "Already submitted",
            "This report is already submitted. Use Update Report to save changes."
          );
        }
        return;
      }

      if (!hasInteracted) {
        if (!silent) {
          toast.info("Nothing to save yet", getNoDraftYetMessage());
        }
        return;
      }

      if (!navigator.onLine) {
        setAutoSaveState("offline");
        if (!silent) {
          toast.warning("Offline", "Draft was not saved because this device is offline.");
        }
        return;
      }

      setAutoSaveState("saving");
      const result = await handleSaveDraft(buildPayload());

      if (result?.skipped) {
        setAutoSaveState("idle");
        if (!silent) {
          toast.info("Draft not saved", getReportSuccessMessage(result, getNoDraftYetMessage()));
        }
        return;
      }

      setAutoSaveState("saved");
      setLastSavedAt(new Date());
      lastSaveRef.current = Date.now();

      if (!silent || source === "auto") {
        toast.success(
          "Draft saved",
          getReportSuccessMessage(
            result,
            source === "manual"
              ? "Draft saved."
              : "Draft autosaved. It will count only after submission."
          )
        );
      }
    } catch (err) {
      setAutoSaveState("error");
      if (!silent) {
        toast.error(
          "Draft not saved",
          getFriendlyReportError(err, { action: "draft" })
        );
      }
    }
  };

  useEffect(() => {
    autoSaveRef.current = () => {
      saveDraftInternal({ silent: true, source: "auto" });
    };
  });

  const handleDraft = async () => {
    await saveDraftInternal({ silent: false, source: "manual" });
  };

  useEffect(() => {
    if (!draftLoaded || !hydrated || submitted || isEditMode || !hasInteracted) return;

    const interval = setInterval(() => {
      autoSaveRef.current();
    }, 60000);

    const onBlur = () => {
      if (Date.now() - lastSaveRef.current > 10000) {
        autoSaveRef.current();
      }
    };

    window.addEventListener("blur", onBlur);

    return () => {
      clearInterval(interval);
      window.removeEventListener("blur", onBlur);
    };
  }, [
    draftLoaded,
    hydrated,
    submitted,
    cellName,
    location,
    meetingDay,
    meetingTime,
    coordinatorName,
    coordinatorReportTime,
    coordinatorRole,
    coCoordinatorName,
    coCoordinatorReportTime,
    coCoordinatorRole,
    members,
    attendees,
    activityType,
    activityOther,
    topics,
    activityDuration,
    activityVerses,
    remarks,
    isEditMode,
    hasInteracted,
  ]);

  useEffect(() => {
    if (!draftLoaded) return;
    const timeout = setTimeout(() => {
      if (autoSaveState === "saved") setAutoSaveState("idle");
    }, 4000);
    return () => clearTimeout(timeout);
  }, [autoSaveState, draftLoaded]);

  const handleFinalSubmit = async () => {
    if (!portalOpen) {
      toast.warning("Portal closed", "Portal is not open.");
      return;
    }

    if (!requiredValid) {
      toast.warning("Required", "Please enter the cell name, meeting day and activity type.");
      return;
    }

    try {
      const result =
        isEditMode && existingReportId
          ? await handleEdit(existingReportId, buildPayload())
          : await handleSubmit(buildPayload());
      setSubmitted(true);
      toast.success(
        isEditMode ? "Report updated" : "Report submitted",
        getReportSuccessMessage(
          result,
          isEditMode ? "Cell report updated." : "Cell report submitted."
        )
      );
    } catch (err) {
      toast.error(
        isEditMode ? "Update not saved" : "Report not submitted",
        getFriendlyReportError(err, {
          action: isEditMode ? "update" : "submit",
        })
      );
    }
  };

  const statusText = useMemo(() => {
    if (autoSaveState === "saving") return "Saving...";
    if (autoSaveState === "saved" && lastSavedAt) return "Draft saved just now";
    if (autoSaveState === "offline") return "Offline — draft not saved";
    if (autoSaveState === "error") return "Failed to save draft";
    return "Autosave active";
  }, [autoSaveState, lastSavedAt]);

  if (submitted) {
    return (
      <div className="card p-12 text-center space-y-4">
        <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
        <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100">
          Cell Report Submitted
        </h3>
        <p className="text-gray-500 dark:text-slate-400 text-sm">
          {isArrears ? "Submitted and locked permanently." : "Editable until Monday 2:59pm."}
        </p>
        {!isArrears && portalOpen && (
          <button onClick={() => setSubmitted(false)} className="btn-outline">
            Edit Report
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6" {...interactionProps}>
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-purple-600 dark:text-purple-400 font-semibold">
            {weekType === "late" ? "Arrears submission" : "Current week submission"}
          </p>
          <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
            {weekLabel || "This report will be saved under the active reporting week."}
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
            Autosave is on. If you are not ready, your work stays as a draft. Drafts do not count until you press Submit Report.
          </p>
        </div>

        <div
          className={cn(
            "text-xs font-medium px-3 py-2 rounded-xl border flex items-center gap-2 w-fit",
            autoSaveState === "saving" &&
              "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300",
            autoSaveState === "saved" &&
              "border-green-300 bg-green-50 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300",
            autoSaveState === "offline" &&
              "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300",
            autoSaveState === "error" &&
              "border-red-300 bg-red-50 text-red-700 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300",
            autoSaveState === "idle" &&
              "border-gray-200 bg-gray-50 text-gray-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
          )}
        >
          {autoSaveState === "offline" ? (
            <WifiOff className="w-3.5 h-3.5" />
          ) : (
            <Clock3 className="w-3.5 h-3.5" />
          )}
          {statusText}
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-bold text-gray-900 dark:text-slate-100">Cell Details</h3>
          <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl px-4 py-2">
            <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <div className="text-right">
              <p className="text-lg font-bold text-purple-700 dark:text-purple-300 leading-none">
                {totalAttendance}
              </p>
              <p className="text-xs text-purple-500 dark:text-purple-400 leading-none mt-0.5">
                Total Attendance
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">
              Cell Name <span className="text-red-400">*</span>
            </label>
            <input
              className="input-field"
              placeholder="Name of cell"
              value={cellName}
              onChange={(e) => setCellName(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">Location / Venue</label>
            <input
              className="input-field"
              placeholder="Where the cell meets"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">
              Meeting Day <span className="text-red-400">*</span>
            </label>
            <div className="flex flex-wrap gap-2 mt-1">
              {DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                      onClick={() => {
                        markInteracted();
                        setMeetingDay(day);
                      }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                    meetingDay === day
                      ? "border-purple-400 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                      : "border-gray-200 dark:border-slate-600 text-gray-500 hover:border-purple-300"
                  )}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="form-label">Meeting Time</label>
            <input
              type="time"
              className="input-field"
              value={meetingTime}
              onChange={(e) => setMeetingTime(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="font-bold text-gray-900 dark:text-slate-100">Coordinator</h3>

        <div className="space-y-4">
          <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3">
            <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
              Coordinator
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="form-label">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  className="input-field"
                  placeholder="Coordinator full name"
                  value={coordinatorName}
                  onChange={(e) => setCoordinatorName(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Time Reported</label>
                <input
                  type="time"
                  className="input-field"
                  value={coordinatorReportTime}
                  onChange={(e) => setCoordinatorReportTime(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Role Played (if any)</label>
                <input
                  className="input-field"
                  placeholder="e.g. Led teaching"
                  value={coordinatorRole}
                  onChange={(e) => setCoordinatorRole(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3">
            <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
              Co-coordinator
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="form-label">Full Name</label>
                <input
                  className="input-field"
                  placeholder="Co-coordinator full name (if any)"
                  value={coCoordinatorName}
                  onChange={(e) => setCoCoordinatorName(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Time Reported</label>
                <input
                  type="time"
                  className="input-field"
                  value={coCoordinatorReportTime}
                  onChange={(e) => setCoCoordinatorReportTime(e.target.value)}
                  disabled={!coCoordinatorName.trim()}
                />
              </div>
              <div>
                <label className="form-label">Role Played (if any)</label>
                <input
                  className="input-field"
                  placeholder="e.g. Led prayer"
                  value={coCoordinatorRole}
                  onChange={(e) => setCoCoordinatorRole(e.target.value)}
                  disabled={!coCoordinatorName.trim()}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 dark:text-slate-100">Members</h3>
          <button
            onClick={() => {
              markInteracted();
              setMembers((prev) => [...prev, { ...emptyMember }]);
            }}
            className="btn-outline text-xs py-1.5 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>

        <div className="space-y-3">
          {members.map((m, i) => (
            <div key={i} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400">Member #{i + 1}</span>
                {members.length > 1 && (
                  <button
                    onClick={() => {
                      markInteracted();
                      setMembers((prev) => prev.filter((_, idx) => idx !== i));
                    }}
                    className="text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  className="input-field"
                  placeholder="Full name"
                  value={m.fullName}
                  onChange={(e) => updateMember(i, "fullName", e.target.value)}
                />
                <input
                  type="time"
                  className="input-field"
                  value={m.reportingTime}
                  onChange={(e) => updateMember(i, "reportingTime", e.target.value)}
                />
                <input
                  className="input-field"
                  placeholder="Role played"
                  value={m.role}
                  onChange={(e) => updateMember(i, "role", e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 dark:text-slate-100">
            New Converts / Visitors
          </h3>
          <button
            onClick={() => {
              markInteracted();
              setAttendees((prev) => [...prev, { ...emptyAttendee }]);
            }}
            className="btn-outline text-xs py-1.5 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>

        <div className="space-y-3">
          {attendees.map((a, i) => (
            <div key={i} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400">Attendee #{i + 1}</span>
                {attendees.length > 1 && (
                  <button
                    onClick={() => {
                      markInteracted();
                      setAttendees((prev) => prev.filter((_, idx) => idx !== i));
                    }}
                    className="text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  className="input-field"
                  placeholder="Full name"
                  value={a.fullName}
                  onChange={(e) => updateAttendee(i, "fullName", e.target.value)}
                />
                <input
                  className="input-field"
                  placeholder="Location"
                  value={a.location}
                  onChange={(e) => updateAttendee(i, "location", e.target.value)}
                />
                <input
                  className="input-field"
                  placeholder="Phone"
                  value={a.phone}
                  onChange={(e) => updateAttendee(i, "phone", e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="font-bold text-gray-900 dark:text-slate-100">
          Cell Activity <span className="text-red-400">*</span>
        </h3>

        <div className="flex flex-wrap gap-2">
          {ACTIVITIES.map((activity) => (
            <button
              key={activity.value}
              type="button"
              onClick={() => {
                markInteracted();
                setActivityType(activity.value);
              }}
              className={cn(
                "px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all",
                activityType === activity.value
                  ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                  : "border-gray-200 dark:border-slate-600 text-gray-500 hover:border-purple-300"
              )}
            >
              <span className="mr-2">{activity.icon}</span>
              {activity.label}
            </button>
          ))}
        </div>

        {activityType === "other" && (
          <div>
            <label className="form-label">Describe activity</label>
            <input
              className="input-field"
              placeholder="Describe activity"
              value={activityOther}
              onChange={(e) => setActivityOther(e.target.value)}
            />
          </div>
        )}

        {activityType === "teaching" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-900 dark:text-slate-100">Teaching Topics</h4>
              <button
                onClick={() => {
                  markInteracted();
                  setTopics((prev) => [...prev, { ...emptyTopic }]);
                }}
                className="btn-outline text-xs py-1.5 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add topic
              </button>
            </div>

            {topics.map((t, i) => (
              <div key={i} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400">Topic #{i + 1}</span>
                  {topics.length > 1 && (
                    <button
                      onClick={() => {
                        markInteracted();
                        setTopics((prev) => prev.filter((_, idx) => idx !== i));
                      }}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    className="input-field"
                    placeholder="Topic title"
                    value={t.title}
                    onChange={(e) => updateTopic(i, "title", e.target.value)}
                  />
                  <input
                    className="input-field"
                    placeholder="Duration"
                    value={t.duration}
                    onChange={(e) => updateTopic(i, "duration", e.target.value)}
                  />
                  <input
                    className="input-field"
                    placeholder="Bible verses"
                    value={t.verses}
                    onChange={(e) => updateTopic(i, "verses", e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {(activityType === "prayer" || activityType === "holy-ghost") && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="form-label">Duration</label>
              <input
                className="input-field"
                placeholder="e.g. 2 hours"
                value={activityDuration}
                onChange={(e) => setActivityDuration(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label">Bible Verses</label>
              <input
                className="input-field"
                placeholder="e.g. Acts 2"
                value={activityVerses}
                onChange={(e) => setActivityVerses(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <div className="card p-5">
        <label className="form-label">Comments / Remarks / Observations</label>
        <textarea
          rows={4}
          className="input-field resize-none"
          placeholder="Any final remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
      </div>

      <p className="text-xs text-amber-600 dark:text-amber-400 text-right">
        If Submit Report does not go through, the form will show which required section is missing. Draft can still be saved.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 justify-end pb-6">
        {!isEditMode && (
          <button
            type="button"
            data-draft-ignore="true"
            onClick={handleDraft}
            disabled={loading}
            className="btn-outline flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {loading ? "Saving..." : "Save Draft"}
          </button>
        )}

        <button
          type="button"
          data-draft-ignore="true"
          onClick={handleFinalSubmit}
          disabled={loading || !portalOpen}
          className={cn(
            "flex items-center justify-center gap-2 font-medium px-4 py-2 rounded-lg transition-all",
            portalOpen
              ? "btn-primary"
              : "bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed"
          )}
        >
          <Send className="w-4 h-4" />
          {!portalOpen ? "Portal Closed" : isEditMode ? "Update Report" : "Submit Report"}
        </button>
      </div>
    </div>
  );
};

export default CellForm;
