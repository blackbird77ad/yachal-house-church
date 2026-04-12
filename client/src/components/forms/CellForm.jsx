import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Send, CheckCircle, Users, MapPin, Clock, BookOpen, Flame, Heart } from "lucide-react";
import { useReports } from "../../hooks/useReports";
import { useToast, ToastContainer } from "../../components/common/Toast";
import { cn } from "../../utils/scoreHelpers";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

const ACTIVITIES = [
  { value: "teaching",      label: "Teaching",            icon: "📖" },
  { value: "prayer",        label: "Prayer Meeting",      icon: "🙏" },
  { value: "holy-ghost",    label: "Holy Ghost Meeting",  icon: "🔥" },
  { value: "other",         label: "Other",               icon: "✨" },
];

const emptyMember   = { fullName: "", reportingTime: "", role: "" };
const emptyAttendee = { fullName: "", location: "", phone: "" };
const emptyTopic    = { title: "", duration: "", verses: "" };

const CellForm = ({ weekType, portalOpen, weekDate, isArrears, isEditMode, existingReportId }) => {
  const { handleSaveDraft, handleSubmit, handleEdit, fetchMyDraft, loading } = useReports();
  const { toasts, toast, removeToast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  // ── Cell details ─────────────────────────────────────────────
  const [cellName, setCellName]               = useState("");
  const [location, setLocation]               = useState("");
  const [meetingDay, setMeetingDay]           = useState("");
  const [meetingTime, setMeetingTime]         = useState("");

  // ── Coordinator ───────────────────────────────────────────────
  const [coordinatorName, setCoordinatorName]           = useState("");
  const [coordinatorReportTime, setCoordinatorReportTime] = useState("");
  const [coordinatorRole, setCoordinatorRole]             = useState("");
  const [coCoordinatorName, setCoCoordinatorName]         = useState("");
  const [coCoordinatorReportTime, setCoCoordinatorReportTime] = useState("");
  const [coCoordinatorRole, setCoCoordinatorRole]         = useState("");

  // ── Members ───────────────────────────────────────────────────
  const [members, setMembers] = useState([{ ...emptyMember }]);

  // ── Attendees (new converts / visitors) ───────────────────────
  const [attendees, setAttendees] = useState([{ ...emptyAttendee }]);

  // ── Cell activity ─────────────────────────────────────────────
  const [activityType, setActivityType]       = useState("");
  const [activityOther, setActivityOther]     = useState("");
  const [topics, setTopics]                   = useState([{ ...emptyTopic }]);
  const [activityDuration, setActivityDuration] = useState("");
  const [activityVerses, setActivityVerses]   = useState("");

  // ── Remarks ───────────────────────────────────────────────────
  const [remarks, setRemarks] = useState("");

  // ── Load draft ────────────────────────────────────────────────
  useEffect(() => {
    fetchMyDraft({ reportType: "cell", weekType, weekDate })
      .then(({ draft }) => {
        if (!draft) return;
        if (draft.status === "submitted" && !isEditMode) { setSubmitted(true); return; }
        const d = draft.cellReportData || draft.cellData || {};
        if (d.cellName)           setCellName(d.cellName);
        if (d.location)           setLocation(d.location);
        if (d.meetingDay)         setMeetingDay(d.meetingDay);
        if (d.meetingTime)        setMeetingTime(d.meetingTime);
        if (d.coordinatorName)        setCoordinatorName(d.coordinatorName);
        if (d.coordinatorReportTime)  setCoordinatorReportTime(d.coordinatorReportTime || "");
        if (d.coordinatorRole)        setCoordinatorRole(d.coordinatorRole || "");
        if (d.coCoordinatorName)      setCoCoordinatorName(d.coCoordinatorName);
        if (d.coCoordinatorReportTime) setCoCoordinatorReportTime(d.coCoordinatorReportTime || "");
        if (d.coCoordinatorRole)      setCoCoordinatorRole(d.coCoordinatorRole || "");
        if (d.members?.length)    setMembers(d.members);
        if (d.attendees?.length)  setAttendees(d.attendees);
        if (d.activityType)       setActivityType(d.activityType);
        if (d.activityOther)      setActivityOther(d.activityOther);
        if (d.topics?.length)     setTopics(d.topics);
        if (d.activityDuration)   setActivityDuration(d.activityDuration);
        if (d.activityVerses)     setActivityVerses(d.activityVerses);
        if (d.remarks)            setRemarks(d.remarks);
      }).catch(() => {});
  }, [weekType, weekDate]);

  // ── Helpers ───────────────────────────────────────────────────
  const updateMember   = (i, k, v) => setMembers((p) => p.map((m, idx) => idx === i ? { ...m, [k]: v } : m));
  const updateAttendee = (i, k, v) => setAttendees((p) => p.map((a, idx) => idx === i ? { ...a, [k]: v } : a));
  const updateTopic    = (i, k, v) => setTopics((p) => p.map((t, idx) => idx === i ? { ...t, [k]: v } : t));

  // ── Build payload ─────────────────────────────────────────────
  const buildPayload = () => ({
    reportType: "cell",
    weekType,
    weekDate,
    isEdit: isEditMode,
    cellReportData: {
      cellName, location, meetingDay, meetingTime,
      coordinatorName, coordinatorReportTime, coordinatorRole,
      coCoordinatorName, coCoordinatorReportTime, coCoordinatorRole,
      members: members.filter((m) => m.fullName.trim()),
      attendees: attendees.filter((a) => a.fullName.trim()),
      activityType,
      activityOther: activityType === "other" ? activityOther : "",
      topics: activityType === "teaching" ? topics.filter((t) => t.title.trim()) : [],
      activityDuration: (activityType === "prayer" || activityType === "holy-ghost") ? activityDuration : "",
      activityVerses,
      // Auto-computed total attendance
      totalAttendance:
        (coordinatorName.trim() ? 1 : 0) +
        (coCoordinatorName.trim() ? 1 : 0) +
        members.filter((m) => m.fullName.trim()).length +
        attendees.filter((a) => a.fullName.trim()).length,
      remarks,
    },
  });

  const handleDraft = async () => {
    try { await handleSaveDraft(buildPayload()); toast.success("Draft saved", "Progress saved."); }
    catch { toast.error("Error", "Could not save draft."); }
  };

  const handleFinalSubmit = async () => {
    if (!portalOpen) { toast.warning("Portal closed", "Portal is not open."); return; }
    if (!cellName.trim()) { toast.warning("Required", "Please enter the cell name."); return; }
    if (!meetingDay) { toast.warning("Required", "Please select the meeting day."); return; }
    if (!activityType) { toast.warning("Required", "Please select the cell activity type."); return; }
    try {
      if (isEditMode && existingReportId) await handleEdit(existingReportId, buildPayload());
      else await handleSubmit(buildPayload());
      setSubmitted(true);
      toast.success("Submitted", "Cell report submitted.");
    } catch (err) {
      toast.error("Error", err.response?.data?.message || "Could not submit.");
    }
  };

  if (submitted) return (
    <div className="card p-12 text-center space-y-4">
      <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
      <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100">Cell Report Submitted</h3>
      <p className="text-gray-500 dark:text-slate-400 text-sm">
        {isArrears ? "Submitted and locked permanently." : "Editable until Monday 2:59pm."}
      </p>
      {!isArrears && portalOpen && <button onClick={() => setSubmitted(false)} className="btn-outline">Edit Report</button>}
    </div>
  );

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* ── Cell Details ────────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <h3 className="font-bold text-gray-900 dark:text-slate-100">Cell Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Cell Name <span className="text-red-400">*</span></label>
            <input className="input-field" placeholder="Name of cell" value={cellName} onChange={(e) => setCellName(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Location / Venue</label>
            <input className="input-field" placeholder="Where the cell meets" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Meeting Day <span className="text-red-400">*</span></label>
            <div className="flex flex-wrap gap-2 mt-1">
              {DAYS.map((day) => (
                <button key={day} type="button" onClick={() => setMeetingDay(day)}
                  className={cn("px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                    meetingDay === day
                      ? "border-purple-400 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                      : "border-gray-200 dark:border-slate-600 text-gray-500 hover:border-purple-300")}>
                  {day}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="form-label">Meeting Time</label>
            <input type="time" className="input-field" value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} />
          </div>

        </div>
      </div>

      {/* ── Coordinator ─────────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <h3 className="font-bold text-gray-900 dark:text-slate-100">Coordinator</h3>
          <div className="space-y-4">
          {/* Coordinator */}
          <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3">
            <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Coordinator</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="form-label">Full Name <span className="text-red-400">*</span></label>
                <input className="input-field" placeholder="Coordinator full name" value={coordinatorName} onChange={(e) => setCoordinatorName(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Time Reported</label>
                <input type="time" className="input-field" value={coordinatorReportTime} onChange={(e) => setCoordinatorReportTime(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Role Played (if any)</label>
                <input className="input-field" placeholder="e.g. Led teaching" value={coordinatorRole} onChange={(e) => setCoordinatorRole(e.target.value)} />
              </div>
            </div>
          </div>
          {/* Co-coordinator */}
          <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3">
            <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Co-coordinator</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="form-label">Full Name</label>
                <input className="input-field" placeholder="Co-coordinator full name (if any)" value={coCoordinatorName} onChange={(e) => setCoCoordinatorName(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Time Reported</label>
                <input type="time" className="input-field" value={coCoordinatorReportTime} onChange={(e) => setCoCoordinatorReportTime(e.target.value)} disabled={!coCoordinatorName.trim()} />
              </div>
              <div>
                <label className="form-label">Role Played (if any)</label>
                <input className="input-field" placeholder="e.g. Led prayer" value={coCoordinatorRole} onChange={(e) => setCoCoordinatorRole(e.target.value)} disabled={!coCoordinatorName.trim()} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Members ─────────────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-gray-900 dark:text-slate-100">Members Present</h3>
          <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2.5 py-0.5 rounded-full text-xs font-semibold">
            {members.filter((m) => m.fullName.trim()).length}
          </span>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500">Regular cell members who attended this meeting.</p>
        <div className="space-y-3">
          {members.map((m, i) => (
            <div key={i} className="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400 w-5">#{i + 1}</span>
                <input className="input-field flex-1" placeholder="Full name" value={m.fullName} onChange={(e) => updateMember(i, "fullName", e.target.value)} />
                {members.length > 1 && (
                  <button onClick={() => setMembers((p) => p.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 pl-7">
                <div>
                  <label className="form-label">Time Reported</label>
                  <input type="time" className="input-field" value={m.reportingTime} onChange={(e) => updateMember(i, "reportingTime", e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Role Played (if any)</label>
                  <input className="input-field" placeholder="e.g. Led prayer" value={m.role} onChange={(e) => updateMember(i, "role", e.target.value)} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => setMembers((p) => [...p, { ...emptyMember }])}
          className="w-full py-2.5 border-2 border-dashed border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 rounded-xl text-sm font-medium hover:bg-purple-50 dark:hover:bg-purple-900/20 flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" />Add member
        </button>
      </div>

      {/* ── New Converts / Visitors ─────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-gray-900 dark:text-slate-100">New Converts / Visitors</h3>
          <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2.5 py-0.5 rounded-full text-xs font-semibold">
            {attendees.filter((a) => a.fullName.trim()).length}
          </span>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500">New people who attended this cell meeting.</p>
        <div className="space-y-3">
          {attendees.map((a, i) => (
            <div key={i} className="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400 w-5">#{i + 1}</span>
                <input className="input-field flex-1" placeholder="Full name" value={a.fullName} onChange={(e) => updateAttendee(i, "fullName", e.target.value)} />
                {attendees.length > 1 && (
                  <button onClick={() => setAttendees((p) => p.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 pl-7">
                <div>
                  <label className="form-label">Location / Area</label>
                  <input className="input-field" placeholder="Where they live" value={a.location} onChange={(e) => updateAttendee(i, "location", e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Phone</label>
                  <input className="input-field" placeholder="Phone number" value={a.phone} onChange={(e) => updateAttendee(i, "phone", e.target.value)} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => setAttendees((p) => [...p, { ...emptyAttendee }])}
          className="w-full py-2.5 border-2 border-dashed border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 rounded-xl text-sm font-medium hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" />Add visitor / new convert
        </button>
      </div>

      {/* ── Cell Activity ────────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-900 dark:text-slate-100">Cell Activity</h3>
          <span className="text-xs text-red-400 font-semibold">Required</span>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500">What was the main activity at this cell meeting?</p>

        {/* Activity type selector */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ACTIVITIES.map((act) => (
            <button key={act.value} type="button" onClick={() => setActivityType(act.value)}
              className={cn("flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-sm font-medium transition-all",
                activityType === act.value
                  ? "border-purple-400 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                  : "border-gray-200 dark:border-slate-600 text-gray-500 hover:border-purple-200")}>
              <span className="text-xl">{act.icon}</span>
              <span className="text-xs text-center leading-tight">{act.label}</span>
            </button>
          ))}
        </div>

        {/* Other — free text */}
        {activityType === "other" && (
          <div>
            <label className="form-label">Describe the activity <span className="text-red-400">*</span></label>
            <input className="input-field" placeholder="Describe what took place" value={activityOther} onChange={(e) => setActivityOther(e.target.value)} />
          </div>
        )}

        {/* Teaching — topics */}
        {activityType === "teaching" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">Topic(s) / Title(s) Taught</p>
            </div>
            {topics.map((t, i) => (
              <div key={i} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400">Topic #{i + 1}</span>
                  {topics.length > 1 && (
                    <button onClick={() => setTopics((p) => p.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div>
                  <label className="form-label">Topic / Title <span className="text-red-400">*</span></label>
                  <input className="input-field" placeholder="e.g. The Power of Prayer" value={t.title} onChange={(e) => updateTopic(i, "title", e.target.value)} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Duration (minutes or hours)</label>
                    <input className="input-field" placeholder="e.g. 45 mins, 1.5 hours" value={t.duration} onChange={(e) => updateTopic(i, "duration", e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Bible Verses Used</label>
                    <input className="input-field" placeholder="e.g. John 3:16, Romans 8:28" value={t.verses} onChange={(e) => updateTopic(i, "verses", e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
            <button onClick={() => setTopics((p) => [...p, { ...emptyTopic }])}
              className="w-full py-2.5 border-2 border-dashed border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 rounded-xl text-sm font-medium hover:bg-purple-50 dark:hover:bg-purple-900/20 flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" />Add another topic
            </button>
          </div>
        )}

        {/* Prayer / Holy Ghost — duration + verses */}
        {(activityType === "prayer" || activityType === "holy-ghost") && (
          <div className="space-y-3 p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
            <div>
              <label className="form-label">
                {activityType === "prayer" ? "Duration of Prayer Meeting" : "Duration of Holy Ghost Meeting"}
                <span className="text-red-400 ml-1">*</span>
              </label>
              <input className="input-field" placeholder="e.g. 2 hours, 90 minutes" value={activityDuration} onChange={(e) => setActivityDuration(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Bible Verses Used (if any)</label>
              <input className="input-field" placeholder="e.g. Acts 2:1-4, Isaiah 61:1" value={activityVerses} onChange={(e) => setActivityVerses(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {/* ── Comments / Remarks ───────────────────────────────────── */}
      <div className="card p-5 space-y-3">
        <h3 className="font-bold text-gray-900 dark:text-slate-100">Comments / Remarks / Observations</h3>
        <p className="text-xs text-gray-400 dark:text-slate-500">Any notable observations, challenges, prayer requests or general remarks about this cell meeting.</p>
        <textarea
          className="input-field resize-none"
          rows={4}
          placeholder="e.g. The meeting was very impactful. One member requested prayer for healing. Attendance was lower due to..."
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
      </div>

      {/* ── Actions ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 justify-end pb-6">
        <button onClick={handleDraft} disabled={loading} className="btn-outline flex items-center justify-center gap-2">
          <Save className="w-4 h-4" />{loading ? "Saving..." : "Save Draft"}
        </button>
        <button
          onClick={handleFinalSubmit}
          disabled={loading || !portalOpen || (weekType === "past" && !weekDate)}
          className={cn("flex items-center justify-center gap-2 font-medium px-4 py-2 rounded-lg transition-all",
            portalOpen && (weekType !== "past" || weekDate)
              ? "btn-primary"
              : "bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed")}>
          <Send className="w-4 h-4" />
          {!portalOpen ? "Portal Closed" : isEditMode ? "Update Report" : "Submit Report"}
        </button>
      </div>
    </div>
  );
};

export default CellForm;