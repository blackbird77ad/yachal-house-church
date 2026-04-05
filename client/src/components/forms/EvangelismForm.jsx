import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Save, Send, CheckCircle, Users } from "lucide-react";
import { useReports } from "../../hooks/useReports";
import { SOUL_STATUSES } from "../../utils/constants";
import { useToast, ToastContainer } from "../../components/common/Toast";
import { cn } from "../../utils/scoreHelpers";

const emptySoul = { fullName: "", status: "", location: "", phone: "" };
const emptyFollowUp = { fullName: "", topic: "", scriptures: "" };
const emptyAttendee = { fullName: "", attendedTuesday: false, attendedSunday: false, attendedSpecial: false };

const EvangelismForm = ({ weekType, portalOpen, weekDate, isArrears, isEditMode, existingReportId }) => {
  const { handleSaveDraft, handleSubmit, handleEdit, fetchMyDraft, loading } = useReports();
  const { toasts, toast, removeToast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [souls, setSouls] = useState([{ ...emptySoul }]);
  const [scriptures, setScriptures] = useState("");
  const [followUps, setFollowUps] = useState([{ ...emptyFollowUp }]);
  const [attendees, setAttendees] = useState([{ ...emptyAttendee }]);
  const [serviceAttendance, setServiceAttendance] = useState([
    { serviceType: "tuesday", attended: false, reportingTime: "", lateReason: "" },
    { serviceType: "sunday", attended: false, reportingTime: "", lateReason: "" },
  ]);
  const [cellAttended, setCellAttended] = useState(false);
  const [cellRole, setCellRole] = useState("");
  const [cellReportingTime, setCellReportingTime] = useState("");

  useEffect(() => {
    // Load draft or existing submitted report data
    fetchMyDraft({ reportType: "evangelism", weekType, weekDate })
      .then(({ draft }) => {
        if (!draft) return;
        if (draft.status === "submitted" && !isEditMode) setSubmitted(true);
        if (draft.evangelismData?.souls?.length) setSouls(draft.evangelismData.souls);
        if (draft.evangelismData?.scriptures?.length) setScriptures(draft.evangelismData.scriptures.join(", "));
        if (draft.followUpData?.followUps?.length) setFollowUps(draft.followUpData.followUps.map((f) => ({ ...f, scriptures: f.scriptures?.join(", ") || "" })));
        if (draft.churchAttendees?.length) setAttendees(draft.churchAttendees);
        if (draft.serviceAttendance?.length) setServiceAttendance(draft.serviceAttendance);
        if (draft.cellData) { setCellAttended(draft.cellData.didAttend); setCellRole(draft.cellData.role || ""); setCellReportingTime(draft.cellData.reportingTime || ""); }
      }).catch(() => {});
  }, [weekType, weekDate]);

  const buildPayload = () => ({
    reportType: "evangelism",
    weekType,
    weekDate,
    isEdit: isEditMode,
    evangelismData: { souls, scriptures: scriptures.split(",").map((s) => s.trim()).filter(Boolean) },
    followUpData: { followUps: followUps.map((f) => ({ ...f, scriptures: f.scriptures.split(",").map((s) => s.trim()).filter(Boolean) })) },
    churchAttendees: attendees,
    serviceAttendance,
    cellData: { didAttend: cellAttended, role: cellRole, reportingTime: cellReportingTime },
  });

  const handleDraft = async () => {
    try { await handleSaveDraft(buildPayload()); toast.success("Draft saved", "Your progress has been saved."); }
    catch { toast.error("Error", "Could not save draft."); }
  };

  const handleFinalSubmit = async () => {
    if (!portalOpen) { toast.warning("Portal closed", "The portal is not open for submission yet."); return; }
    try {
      if (isEditMode && existingReportId) {
        await handleEdit(existingReportId, buildPayload());
      } else {
        await handleSubmit(buildPayload());
      }
      setSubmitted(true);
      toast.success(isEditMode ? "Report updated" : "Submitted", isEditMode ? "Your report has been updated." : "Your report has been submitted.");
    } catch (err) {
      toast.error("Error", err.response?.data?.message || "Could not submit.");
    }
  };

  const addSoul = () => setSouls((prev) => [...prev, { ...emptySoul }]);
  const addFollowUp = () => setFollowUps((prev) => [...prev, { ...emptyFollowUp }]);
  const addAttendee = () => setAttendees((prev) => [...prev, { ...emptyAttendee }]);

  const churchCounts = attendees.reduce(
    (t, a) => t + (a.attendedTuesday ? 1 : 0) + (a.attendedSunday ? 1 : 0) + (a.attendedSpecial ? 1 : 0), 0
  );

  if (submitted) return (
    <div className="card p-12 text-center">
      <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
      <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
        {isEditMode ? "Report Updated" : "Report Submitted"}
      </h3>
      <p className="text-gray-500 dark:text-slate-400 text-sm mb-6">
        {isArrears
          ? "Your arrears report has been submitted and locked permanently."
          : "Submitted successfully. Editable until Monday 2:59pm while the portal is open."}
      </p>
      {!isArrears && portalOpen && (
        <button onClick={() => setSubmitted(false)} className="btn-outline">Edit Report</button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Souls section */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-bold text-gray-900 dark:text-slate-100">Souls Preached To</h3>
            <div className="flex items-center gap-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full text-sm font-semibold">
              <Users className="w-3.5 h-3.5" />
              {souls.length} {souls.length === 1 ? "soul" : "souls"}
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">Minimum 10 souls required for qualification.</p>
        <div className="space-y-4">
          {souls.map((soul, i) => (
            <div key={i} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 dark:text-slate-500">Soul #{i + 1}</span>
                {souls.length > 1 && (
                  <button onClick={() => setSouls(souls.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="form-label">Full Name</label><input className="input-field" placeholder="Name" value={soul.fullName} onChange={(e) => setSouls(souls.map((s, idx) => idx === i ? { ...s, fullName: e.target.value } : s))} /></div>
                <div><label className="form-label">Status</label>
                  <select className="input-field" value={soul.status} onChange={(e) => setSouls(souls.map((s, idx) => idx === i ? { ...s, status: e.target.value } : s))}>
                    <option value="">Select status</option>
                    {SOUL_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div><label className="form-label">Location</label><input className="input-field" placeholder="Area/location" value={soul.location} onChange={(e) => setSouls(souls.map((s, idx) => idx === i ? { ...s, location: e.target.value } : s))} /></div>
                <div><label className="form-label">Phone (optional)</label><input className="input-field" placeholder="Phone number" value={soul.phone} onChange={(e) => setSouls(souls.map((s, idx) => idx === i ? { ...s, phone: e.target.value } : s))} /></div>
              </div>
              {i === souls.length - 1 && (
                <button onClick={addSoul} className="w-full py-2 border-2 border-dashed border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 rounded-xl text-sm font-medium hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> Add another soul
                </button>
              )}
            </div>
          ))}
        </div>
        {souls.length < 10 && (
          <div className="mt-4 flex items-center gap-2">
            <div className="flex-1 bg-gray-100 dark:bg-slate-700 rounded-full h-2">
              <div className="bg-purple-600 h-2 rounded-full transition-all duration-300" style={{ width: `${(souls.length / 10) * 100}%` }} />
            </div>
            <span className="text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">{souls.length}/10 minimum</span>
          </div>
        )}
        <div className="mt-4">
          <label className="form-label">Scriptures Used (comma separated)</label>
          <input className="input-field" placeholder="e.g. Mark 16:15, Romans 1:16" value={scriptures} onChange={(e) => setScriptures(e.target.value)} />
        </div>
      </div>

      {/* Follow-ups */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-gray-900 dark:text-slate-100">Follow-up Activities</h3>
            <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-3 py-1 rounded-full text-sm font-semibold">{followUps.length}</span>
          </div>
        </div>
        <div className="space-y-4">
          {followUps.map((f, i) => (
            <div key={i} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 dark:text-slate-500">#{i + 1}</span>
                {followUps.length > 1 && <button onClick={() => setFollowUps(followUps.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><label className="form-label">Full Name</label><input className="input-field" placeholder="Name" value={f.fullName} onChange={(e) => setFollowUps(followUps.map((fu, idx) => idx === i ? { ...fu, fullName: e.target.value } : fu))} /></div>
                <div><label className="form-label">Topic</label><input className="input-field" placeholder="Topic discussed" value={f.topic} onChange={(e) => setFollowUps(followUps.map((fu, idx) => idx === i ? { ...fu, topic: e.target.value } : fu))} /></div>
                <div><label className="form-label">Scriptures</label><input className="input-field" placeholder="Hebrews 10:24-25" value={f.scriptures} onChange={(e) => setFollowUps(followUps.map((fu, idx) => idx === i ? { ...fu, scriptures: e.target.value } : fu))} /></div>
              </div>
              {i === followUps.length - 1 && (
                <button onClick={addFollowUp} className="w-full py-2 border-2 border-dashed border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 rounded-xl text-sm font-medium hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> Add another follow-up
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* People brought to church */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-gray-900 dark:text-slate-100">People Brought to Church</h3>
            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-sm font-semibold">{churchCounts} counts</span>
          </div>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">Each service counts as 1 toward your 4-count target.</p>
        <div className="space-y-3">
          {attendees.map((a, i) => (
            <div key={i} className="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-300 dark:text-slate-600 w-5">#{i + 1}</span>
                <input className="input-field flex-1" placeholder="Full name" value={a.fullName} onChange={(e) => setAttendees(attendees.map((at, idx) => idx === i ? { ...at, fullName: e.target.value } : at))} />
                {attendees.length > 1 && <button onClick={() => setAttendees(attendees.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
              </div>
              <div className="flex flex-wrap gap-2 pl-8">
                {[{ field: "attendedTuesday", label: "Tuesday" }, { field: "attendedSunday", label: "Sunday" }, { field: "attendedSpecial", label: "Special" }].map(({ field, label }) => (
                  <label key={field} className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors select-none", a[field] ? "border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : "border-gray-200 dark:border-slate-600 text-gray-500")}>
                    <input type="checkbox" className="sr-only" checked={a[field]} onChange={(e) => setAttendees(attendees.map((at, idx) => idx === i ? { ...at, [field]: e.target.checked } : at))} />
                    {label}
                  </label>
                ))}
              </div>
              {i === attendees.length - 1 && (
                <button onClick={addAttendee} className="w-full py-2 border-2 border-dashed border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 rounded-xl text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> Add another person
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Service attendance */}
      <div className="card p-6">
        <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-4">Service Attendance</h3>
        <div className="space-y-4">
          {serviceAttendance.map((s, i) => (
            <div key={s.serviceType} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
              <label className="flex items-center gap-2 cursor-pointer mb-3">
                <input type="checkbox" className="w-4 h-4 accent-purple-600" checked={s.attended} onChange={(e) => setServiceAttendance(serviceAttendance.map((sa, idx) => idx === i ? { ...sa, attended: e.target.checked } : sa))} />
                <span className="font-medium text-gray-900 dark:text-slate-100 capitalize">{s.serviceType} Service</span>
              </label>
              {s.attended && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className="form-label">Reporting Time</label><input type="time" className="input-field" value={s.reportingTime} onChange={(e) => setServiceAttendance(serviceAttendance.map((sa, idx) => idx === i ? { ...sa, reportingTime: e.target.value } : sa))} /></div>
                  <div><label className="form-label">Late reason (if applicable)</label><input className="input-field" placeholder="Reason for lateness" value={s.lateReason || ""} onChange={(e) => setServiceAttendance(serviceAttendance.map((sa, idx) => idx === i ? { ...sa, lateReason: e.target.value } : sa))} /></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Cell */}
      <div className="card p-6">
        <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-4">Cell/Fellowship Meeting</h3>
        <label className="flex items-center gap-2 cursor-pointer mb-4">
          <input type="checkbox" className="w-4 h-4 accent-purple-600" checked={cellAttended} onChange={(e) => setCellAttended(e.target.checked)} />
          <span className="text-sm text-gray-700 dark:text-slate-300">I attended the cell/fellowship meeting this week</span>
        </label>
        {cellAttended && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="form-label">Role Assigned</label><input className="input-field" placeholder="e.g. Lead and teach" value={cellRole} onChange={(e) => setCellRole(e.target.value)} /></div>
            <div><label className="form-label">Reporting Time</label><input type="time" className="input-field" value={cellReportingTime} onChange={(e) => setCellReportingTime(e.target.value)} /></div>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-end pb-6">
        <button onClick={handleDraft} disabled={loading} className="btn-outline flex items-center justify-center gap-2">
          <Save className="w-4 h-4" />{loading ? "Saving..." : "Save Draft"}
        </button>
        <button
          onClick={handleFinalSubmit}
          disabled={loading || !portalOpen || (weekType === "past" && !weekDate)}
          className={cn(
            "flex items-center justify-center gap-2 font-medium px-4 py-2 rounded-lg transition-all",
            portalOpen && (weekType !== "past" || weekDate) ? "btn-primary" : "bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed"
          )}
        >
          <Send className="w-4 h-4" />
          {!portalOpen ? "Portal Closed" : isEditMode ? "Update Report" : "Submit Report"}
        </button>
      </div>
    </div>
  );
};

export default EvangelismForm;