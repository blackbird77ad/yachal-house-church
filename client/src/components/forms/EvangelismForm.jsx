import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Send, CheckCircle, Users, AlertTriangle, UserPlus, X } from "lucide-react";
import { useReports } from "../../hooks/useReports";
import { SOUL_STATUSES } from "../../utils/constants";
import { useToast, ToastContainer } from "../../components/common/Toast";
import { cn } from "../../utils/scoreHelpers";

const emptySoul     = { fullName: "", status: "", location: "", phone: "", age: "" };
const emptyFollowUp = { fullName: "", topic: "", scriptures: "" };
const emptyAttendee = { fullName: "", age: "", attendedTuesday: false, attendedSunday: false, attendedSpecial: false };

const EvangelismForm = ({ weekType, portalOpen, weekDate, isArrears, isEditMode, existingReportId }) => {
  const { handleSaveDraft, handleSubmit, handleEdit, fetchMyDraft, loading } = useReports();
  const { toasts, toast, removeToast } = useToast();
  const [submitted, setSubmitted]         = useState(false);
  const [souls, setSouls]                 = useState([{ ...emptySoul }]);
  const [scriptures, setScriptures]       = useState("");
  const [followUps, setFollowUps]         = useState([{ ...emptyFollowUp }]);
  const [attendees, setAttendees]         = useState([{ ...emptyAttendee }]);
  const [partners, setPartners]           = useState([""]);
  const [serviceAttendance, setServiceAttendance] = useState([
    { serviceType: "tuesday", attended: false, reportingTime: "", lateReason: "" },
    { serviceType: "sunday",  attended: false, reportingTime: "", lateReason: "" },
  ]);
  const [cellAttended, setCellAttended]   = useState(false);
  const [cellRole, setCellRole]           = useState("");
  const [cellReportingTime, setCellReportingTime] = useState("");
  const [duplicates, setDuplicates]       = useState([]);

  useEffect(() => {
    fetchMyDraft({ reportType: "evangelism", weekType, weekDate })
      .then(({ draft }) => {
        if (!draft) return;
        if (draft.status === "submitted" && !isEditMode) setSubmitted(true);
        if (draft.evangelismData?.souls?.length) setSouls(draft.evangelismData.souls.map((s) => ({ ...emptySoul, ...s })));
        if (draft.evangelismData?.scriptures?.length) setScriptures(draft.evangelismData.scriptures.join(", "));
        if (draft.evangelismData?.evangelismPartners?.length) setPartners(draft.evangelismData.evangelismPartners.length ? draft.evangelismData.evangelismPartners : [""]);
        if (draft.followUpData?.followUps?.length) setFollowUps(draft.followUpData.followUps.map((f) => ({ ...f, scriptures: f.scriptures?.join(", ") || "" })));
        if (draft.churchAttendees?.length) setAttendees(draft.churchAttendees.map((a) => ({ ...emptyAttendee, ...a })));
        if (draft.serviceAttendance?.length) setServiceAttendance(draft.serviceAttendance);
        if (draft.cellData) { setCellAttended(draft.cellData.didAttend); setCellRole(draft.cellData.role || ""); setCellReportingTime(draft.cellData.reportingTime || ""); }
      }).catch(() => {});
  }, [weekType, weekDate]);

  const updateSoul     = (i, key, val) => setSouls((p) => p.map((s, idx) => idx === i ? { ...s, [key]: val } : s));
  const updateFollowUp = (i, key, val) => setFollowUps((p) => p.map((f, idx) => idx === i ? { ...f, [key]: val } : f));
  const updateAttendee = (i, key, val) => setAttendees((p) => p.map((a, idx) => idx === i ? { ...a, [key]: val } : a));
  const updateSA       = (i, key, val) => setServiceAttendance((p) => p.map((s, idx) => idx === i ? { ...s, [key]: val } : s));
  const updatePartner  = (i, val)      => setPartners((p) => p.map((pr, idx) => idx === i ? val : pr));

  const qualifyingSoulsCount = souls.filter((s) => s.age === "" || Number(s.age) >= 12).length;
  const qualifyingAttendees  = attendees.filter((a) => a.age === "" || Number(a.age) >= 12);
  const churchCounts = qualifyingAttendees.reduce(
    (t, a) => t + (a.attendedTuesday ? 1 : 0) + (a.attendedSunday ? 1 : 0) + (a.attendedSpecial ? 1 : 0), 0
  );

  const buildPayload = () => ({
    reportType: "evangelism",
    weekType,
    weekDate,
    isEdit: isEditMode,
    evangelismData: {
      souls,
      scriptures: scriptures.split(",").map((s) => s.trim()).filter(Boolean),
      evangelismPartners: partners.map((p) => p.trim()).filter(Boolean),
    },
    followUpData: { followUps: followUps.map((f) => ({ ...f, scriptures: f.scriptures.split(",").map((s) => s.trim()).filter(Boolean) })) },
    churchAttendees: attendees,
    serviceAttendance,
    cellData: { didAttend: cellAttended, role: cellRole, reportingTime: cellReportingTime },
  });

  const validate = () => {
    const filled = partners.map((p) => p.trim()).filter(Boolean);
    if (filled.length === 0) {
      toast.warning("Partners required", "Please enter your evangelism partner name(s). If you went alone, write 'None'.");
      return false;
    }
    return true;
  };

  const handleDraft = async () => {
    try { await handleSaveDraft(buildPayload()); toast.success("Draft saved", "Progress saved."); }
    catch { toast.error("Error", "Could not save draft."); }
  };

  const handleFinalSubmit = async () => {
    if (!portalOpen) { toast.warning("Portal closed", "The portal is not open."); return; }
    if (!validate()) return;
    setDuplicates([]);
    try {
      if (isEditMode && existingReportId) { await handleEdit(existingReportId, buildPayload()); }
      else { await handleSubmit(buildPayload()); }
      setSubmitted(true);
      toast.success(isEditMode ? "Updated" : "Submitted", isEditMode ? "Report updated." : "Report submitted.");
    } catch (err) {
      const msg  = err.response?.data?.message || "Could not submit.";
      const dups = err.response?.data?.duplicates || [];
      if (dups.length > 0) { setDuplicates(dups); toast.error("Duplicate souls found", msg); }
      else { toast.error("Error", msg); }
    }
  };

  if (submitted) return (
    <div className="card p-12 text-center">
      <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
      <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">{isEditMode ? "Report Updated" : "Report Submitted"}</h3>
      <p className="text-gray-500 dark:text-slate-400 text-sm mb-6">
        {isArrears ? "Arrears report submitted and locked permanently." : "Submitted. Editable until Monday 2:59pm."}
      </p>
      {!isArrears && portalOpen && <button onClick={() => setSubmitted(false)} className="btn-outline">Edit Report</button>}
    </div>
  );

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Disclaimer */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Important — Personal Report Only</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            This report must contain <strong>only your personal</strong> evangelism — not your partner's. Do not include souls, follow-ups or church attendees that belong to your partner.
            If you and a partner evangelised to the same person, only <strong>one of you</strong> may claim them. Whoever submits first takes the claim — the system will block duplicates.
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
            <strong>Age rule:</strong> Only people aged 12 and above count toward your qualification targets.
          </p>
        </div>
      </div>

      {/* Duplicate error */}
      {duplicates.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-sm font-bold text-red-800 dark:text-red-300 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {duplicates.length} person(s) already claimed by your partner
          </p>
          <ul className="space-y-1">
            {duplicates.map((d, i) => (
              <li key={i} className="text-xs text-red-700 dark:text-red-400">
                • <strong>{d.soul}</strong> — already submitted by <strong>{d.claimedBy}</strong>. Remove this person from your report.
              </li>
            ))}
          </ul>
          <button onClick={() => setDuplicates([])} className="mt-2 text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
            <X className="w-3 h-3" /> Dismiss
          </button>
        </div>
      )}

      {/* Evangelism Partners */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-2">
          <h3 className="font-bold text-gray-900 dark:text-slate-100">Evangelism Partner(s) This Week</h3>
          <span className="text-xs text-red-400 font-semibold">Required</span>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">
          List everyone you evangelised with this week. If you went alone, write <strong>None</strong>.
        </p>
        <div className="space-y-2">
          {partners.map((partner, i) => (
            <div key={i} className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input className="input-field flex-1"
                placeholder={i === 0 ? "Partner full name (or 'None' if alone)" : "Partner full name"}
                value={partner} onChange={(e) => updatePartner(i, e.target.value)} />
              {partners.length > 1 && (
                <button onClick={() => setPartners((p) => p.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              )}
            </div>
          ))}
          <button onClick={() => setPartners((p) => [...p, ""])} className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 mt-1">
            <Plus className="w-3 h-3" /> Add another partner
          </button>
        </div>
      </div>

      {/* Souls */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-bold text-gray-900 dark:text-slate-100">Souls Preached To</h3>
            <div className="flex items-center gap-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full text-sm font-semibold">
              <Users className="w-3.5 h-3.5" /> {souls.length} recorded · {qualifyingSoulsCount} qualifying (12+)
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">Minimum 4 qualifying souls (aged 12+). Personal only — not your partner's.</p>
        <div className="space-y-4">
          {souls.map((soul, i) => (
            <div key={i} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 dark:text-slate-500">Soul #{i + 1}</span>
                {souls.length > 1 && <button onClick={() => setSouls((s) => s.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="form-label">Full Name</label><input className="input-field" placeholder="Name" value={soul.fullName} onChange={(e) => updateSoul(i, "fullName", e.target.value)} /></div>
                <div>
                  <label className="form-label">Age</label>
                  <input type="number" min="1" max="120" className="input-field" placeholder="Age (blank if unknown)" value={soul.age} onChange={(e) => updateSoul(i, "age", e.target.value)} />
                  {soul.age !== "" && Number(soul.age) < 12 && <p className="text-xs text-amber-500 mt-1">Under 12 — does not count toward qualification.</p>}
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <select className="input-field" value={soul.status} onChange={(e) => updateSoul(i, "status", e.target.value)}>
                    <option value="">Select status</option>
                    {SOUL_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div><label className="form-label">Phone</label><input className="input-field" placeholder="Phone number" value={soul.phone} onChange={(e) => updateSoul(i, "phone", e.target.value)} /></div>
                <div className="sm:col-span-2"><label className="form-label">Location / Area</label><input className="input-field" placeholder="Area or location" value={soul.location} onChange={(e) => updateSoul(i, "location", e.target.value)} /></div>
              </div>
              {i === souls.length - 1 && (
                <button onClick={() => setSouls((s) => [...s, { ...emptySoul }])} className="w-full py-2 border-2 border-dashed border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 rounded-xl text-sm font-medium hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> Add another soul
                </button>
              )}
            </div>
          ))}
        </div>
        {qualifyingSoulsCount < 4 && (
          <div className="mt-4 flex items-center gap-2">
            <div className="flex-1 bg-gray-100 dark:bg-slate-700 rounded-full h-2">
              <div className="bg-purple-600 h-2 rounded-full transition-all" style={{ width: `${Math.min((qualifyingSoulsCount / 4) * 100, 100)}%` }} />
            </div>
            <span className="text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">{qualifyingSoulsCount}/4 qualifying</span>
          </div>
        )}
        <div className="mt-4"><label className="form-label">Scriptures Used (comma separated)</label><input className="input-field" placeholder="e.g. Mark 16:15, Romans 1:16" value={scriptures} onChange={(e) => setScriptures(e.target.value)} /></div>
      </div>

      {/* Follow-ups */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <h3 className="font-bold text-gray-900 dark:text-slate-100">Follow-up Activities</h3>
          <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-3 py-1 rounded-full text-sm font-semibold">{followUps.length}</span>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">Only your personal follow-ups — not your partner's.</p>
        <div className="space-y-4">
          {followUps.map((f, i) => (
            <div key={i} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 dark:text-slate-500">#{i + 1}</span>
                {followUps.length > 1 && <button onClick={() => setFollowUps((p) => p.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><label className="form-label">Full Name</label><input className="input-field" placeholder="Name" value={f.fullName} onChange={(e) => updateFollowUp(i, "fullName", e.target.value)} /></div>
                <div><label className="form-label">Topic</label><input className="input-field" placeholder="Topic discussed" value={f.topic} onChange={(e) => updateFollowUp(i, "topic", e.target.value)} /></div>
                <div><label className="form-label">Scriptures</label><input className="input-field" placeholder="Hebrews 10:24-25" value={f.scriptures} onChange={(e) => updateFollowUp(i, "scriptures", e.target.value)} /></div>
              </div>
              {i === followUps.length - 1 && (
                <button onClick={() => setFollowUps((p) => [...p, { ...emptyFollowUp }])} className="w-full py-2 border-2 border-dashed border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 rounded-xl text-sm font-medium hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> Add another follow-up
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* People brought to church */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-gray-900 dark:text-slate-100">People Brought to Church</h3>
            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-sm font-semibold">{churchCounts} qualifying count{churchCounts !== 1 ? "s" : ""}</span>
          </div>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">Only people aged 12+ count. Each service = 1 count. Do not include people brought by your partner.</p>
        <div className="space-y-3">
          {attendees.map((a, i) => (
            <div key={i} className="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-300 dark:text-slate-600 w-5">#{i + 1}</span>
                <input className="input-field flex-1" placeholder="Full name" value={a.fullName} onChange={(e) => updateAttendee(i, "fullName", e.target.value)} />
                <input type="number" min="1" max="120" className="input-field w-20" placeholder="Age" value={a.age} onChange={(e) => updateAttendee(i, "age", e.target.value)} />
                {attendees.length > 1 && <button onClick={() => setAttendees((p) => p.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
              </div>
              {a.age !== "" && Number(a.age) < 12 && <p className="text-xs text-amber-500 pl-8">Under 12 — does not count toward qualification.</p>}
              <div className="flex flex-wrap gap-2 pl-8">
                {[{ field: "attendedTuesday", label: "Tuesday" }, { field: "attendedSunday", label: "Sunday" }, { field: "attendedSpecial", label: "Special" }].map(({ field, label }) => (
                  <label key={field} className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors select-none",
                    a[field] ? "border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : "border-gray-200 dark:border-slate-600 text-gray-500")}>
                    <input type="checkbox" className="sr-only" checked={a[field]} onChange={(e) => updateAttendee(i, field, e.target.checked)} />
                    {label}
                  </label>
                ))}
              </div>
              {i === attendees.length - 1 && (
                <button onClick={() => setAttendees((p) => [...p, { ...emptyAttendee }])} className="w-full py-2 border-2 border-dashed border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 rounded-xl text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> Add another person
                </button>
              )}
            </div>
          ))}
        </div>
        {churchCounts < 4 && (
          <div className="mt-4 flex items-center gap-2">
            <div className="flex-1 bg-gray-100 dark:bg-slate-700 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${Math.min((churchCounts / 4) * 100, 100)}%` }} />
            </div>
            <span className="text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">{churchCounts}/4 target</span>
          </div>
        )}
      </div>

      {/* Service Attendance */}
      <div className="card p-6">
        <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-4">Service Attendance</h3>
        <div className="space-y-4">
          {serviceAttendance.map((s, i) => (
            <div key={s.serviceType} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
              <label className="flex items-center gap-2 cursor-pointer mb-3">
                <input type="checkbox" className="w-4 h-4 accent-purple-600" checked={s.attended} onChange={(e) => updateSA(i, "attended", e.target.checked)} />
                <span className="font-medium text-gray-900 dark:text-slate-100 capitalize">{s.serviceType} Service</span>
              </label>
              {s.attended && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className="form-label">Reporting Time</label><input type="time" className="input-field" value={s.reportingTime} onChange={(e) => updateSA(i, "reportingTime", e.target.value)} /></div>
                  <div><label className="form-label">Late reason (if applicable)</label><input className="input-field" placeholder="Reason for lateness" value={s.lateReason || ""} onChange={(e) => updateSA(i, "lateReason", e.target.value)} /></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Cell */}
      <div className="card p-6">
        <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-4">Cell / Fellowship Meeting</h3>
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

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-end pb-6">
        <button onClick={handleDraft} disabled={loading} className="btn-outline flex items-center justify-center gap-2">
          <Save className="w-4 h-4" />{loading ? "Saving..." : "Save Draft"}
        </button>
        <button
          onClick={handleFinalSubmit}
          disabled={loading || !portalOpen || (weekType === "past" && !weekDate)}
          className={cn("flex items-center justify-center gap-2 font-medium px-4 py-2 rounded-lg transition-all",
            portalOpen && (weekType !== "past" || weekDate) ? "btn-primary" : "bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed")}
        >
          <Send className="w-4 h-4" />
          {!portalOpen ? "Portal Closed" : isEditMode ? "Update Report" : "Submit Report"}
        </button>
      </div>
    </div>
  );
};

export default EvangelismForm;