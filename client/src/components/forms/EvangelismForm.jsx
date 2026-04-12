import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Send, CheckCircle, Users, AlertTriangle, UserPlus, X } from "lucide-react";
import { useReports } from "../../hooks/useReports";
import { getMyWeekAttendance } from "../../services/attendanceService";
import axiosInstance from "../../utils/axiosInstance";
import { SOUL_STATUSES } from "../../utils/constants";
import { useToast, ToastContainer } from "../../components/common/Toast";
import { cn } from "../../utils/scoreHelpers";

const emptySoul     = { fullName: "", status: "", location: "", phone: "" };
const emptyFollowUp = { fullName: "", topic: "", scriptures: "" };
const emptyAttendee = { fullName: "", olderThan12: false, attendedTuesday: false, attendedSunday: false, attendedSpecial: false };
const emptyCell     = { cellName: "", meetingDays: [], reportTime: "", role: "" };

const DAYS         = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const FELLOWSHIPS  = ["Fellowship 1","Fellowship 2","Fellowship 3","Other"];
const PRAYER_DAYS  = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

const EvangelismForm = ({ weekType, portalOpen, weekDate, isArrears, isEditMode, existingReportId }) => {
  const { handleSaveDraft, handleSubmit, handleEdit, fetchMyDraft, loading } = useReports();
  const { toasts, toast, removeToast } = useToast();
  const [submitted, setSubmitted]   = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [partners, setPartners]     = useState([{ workerId: "", fullName: "", resolved: false, notFound: false }]);
  const [souls, setSouls]           = useState([{ ...emptySoul }]);
  const [scriptures, setScriptures] = useState("");
  const [followUps, setFollowUps]   = useState([{ ...emptyFollowUp }]);
  const [attendees, setAttendees]   = useState([{ ...emptyAttendee }]);
  const [serviceAttendance, setServiceAttendance] = useState([
    { serviceType: "tuesday", attended: null, reportingTime: "", lateReason: "" },
    { serviceType: "sunday",  attended: null, reportingTime: "", lateReason: "" },
  ]);
  const [didAttendCell, setDidAttendCell]   = useState(null);
  const [cells, setCells]                   = useState([{ ...emptyCell }]);
  const [fellowshipName, setFellowshipName] = useState("");
  const [fellowshipOther, setFellowshipOther] = useState("");
  const [prayedThisWeek, setPrayedThisWeek] = useState(null);
  const [prayerDay, setPrayerDay]           = useState("");
  const [prayerStartTime, setPrayerStartTime] = useState("");
  const [hoursOfPrayer, setHoursOfPrayer]   = useState("");
  const [frontDeskCheckIns, setFrontDeskCheckIns] = useState({});
  const [pastCellNames, setPastCellNames]           = useState([]); // { tuesday: { time, timingCategory } }

  // Fetch past cell names for autocomplete suggestions
  useEffect(() => {
    axiosInstance.get("/reports/my-cell-names")
      .then(({ data }) => setPastCellNames(data.cellNames || []))
      .catch(() => {});
  }, []);

  // Fetch front desk check-ins for this week to pre-fill service attendance
  useEffect(() => {
    getMyWeekAttendance(weekDate ? { weekStart: weekDate } : {})
      .then(({ checkIns }) => {
        setFrontDeskCheckIns(checkIns || {});
        // Pre-fill service attendance times from front desk records
        setServiceAttendance((prev) => prev.map((s) => {
          const record = (checkIns || {})[s.serviceType];
          if (record && s.attended === null) {
            return { ...s, attended: true, reportingTime: record.time, _fromFrontDesk: true };
          }
          return s;
        }));
      })
      .catch(() => {}); // silently fail  worker can still enter manually
  }, [weekDate]);

  useEffect(() => {
    fetchMyDraft({ reportType: "evangelism", weekType, weekDate })
      .then(({ draft }) => {
        if (!draft) return;
        if (draft.status === "submitted" && !isEditMode) { setSubmitted(true); return; }
        if (draft.evangelismData?.souls?.length) setSouls(draft.evangelismData.souls.map((s) => ({ ...emptySoul, ...s })));
        if (draft.evangelismData?.scriptures?.length) setScriptures(draft.evangelismData.scriptures.join(", "));
        if (draft.evangelismData?.evangelismPartners?.length) {
          setPartners(draft.evangelismData.evangelismPartners.map((p) => ({
            workerId: p, fullName: "", resolved: false, notFound: false,
          })));
        }
        if (draft.followUpData?.followUps?.length) setFollowUps(draft.followUpData.followUps.map((f) => ({ ...f, scriptures: f.scriptures?.join(", ") || "" })));
        if (draft.churchAttendees?.length) setAttendees(draft.churchAttendees.map((a) => ({ ...emptyAttendee, ...a })));
        if (draft.serviceAttendance?.length) setServiceAttendance(draft.serviceAttendance.map((s) => ({ ...s, attended: s.attended ?? null })));
        if (draft.cellData) {
          setDidAttendCell(draft.cellData.didAttendCell ?? null);
          if (draft.cellData.cells?.length) setCells(draft.cellData.cells.map((c) => ({ ...emptyCell, ...c })));
        }
        if (draft.fellowshipPrayerData) {
          const fn = draft.fellowshipPrayerData.fellowshipName || "";
          if (FELLOWSHIPS.slice(0,3).includes(fn)) setFellowshipName(fn);
          else if (fn) { setFellowshipName("Other"); setFellowshipOther(fn); }
          setPrayedThisWeek(draft.fellowshipPrayerData.prayedThisWeek ?? null);
          setPrayerDay(draft.fellowshipPrayerData.prayerDay || "");
          setPrayerStartTime(draft.fellowshipPrayerData.prayerStartTime || "");
          setHoursOfPrayer(draft.fellowshipPrayerData.hoursOfPrayer?.toString() || "");
        }
      }).catch(() => {});
  }, [weekType, weekDate]);

  const updateSoul     = (i, k, v) => setSouls((p) => p.map((s, idx) => idx === i ? { ...s, [k]: v } : s));
  const updateFollowUp = (i, k, v) => setFollowUps((p) => p.map((f, idx) => idx === i ? { ...f, [k]: v } : f));
  const updateAttendee = (i, k, v) => setAttendees((p) => p.map((a, idx) => idx === i ? { ...a, [k]: v } : a));
  const updateSA       = (i, k, v) => setServiceAttendance((p) => p.map((s, idx) => idx === i ? { ...s, [k]: v } : s));
  const updateCell     = (i, k, v) => setCells((p) => p.map((c, idx) => idx === i ? { ...c, [k]: v } : c));
  const updatePartner  = (i, v)    => setPartners((p) => p.map((pr, idx) => idx === i ? v : pr));
  const toggleCellDay  = (i, day)  => setCells((p) => p.map((c, idx) => idx === i
    ? { ...c, meetingDays: c.meetingDays.includes(day) ? c.meetingDays.filter((d) => d !== day) : [...c.meetingDays, day] }
    : c));

  const qualifyingAttendees = attendees.filter((a) => a.olderThan12);
  const churchCounts = qualifyingAttendees.reduce((t, a) =>
    t + (a.attendedTuesday ? 1 : 0) + (a.attendedSunday ? 1 : 0) + (a.attendedSpecial ? 1 : 0), 0);

  const resolvedFellowshipName = fellowshipName === "Other" ? fellowshipOther : fellowshipName;

  const buildPayload = () => ({
    reportType: "evangelism", weekType, weekDate, isEdit: isEditMode,
    evangelismData: {
      souls,
      scriptures: scriptures.split(",").map((s) => s.trim()).filter(Boolean),
      // Store Worker IDs for reliable duplicate checking
      evangelismPartners: partners.map((p) => p.workerId || p.fullName).filter(Boolean),
    },
    followUpData: { followUps: followUps.map((f) => ({ ...f, scriptures: f.scriptures.split(",").map((s) => s.trim()).filter(Boolean) })) },
    churchAttendees: attendees,
    serviceAttendance,
    cellData: { didAttendCell: didAttendCell === true, cells: didAttendCell === true ? cells : [] },
    fellowshipPrayerData: {
      fellowshipName: resolvedFellowshipName,
      prayedThisWeek: prayedThisWeek === true,
      prayerDay, prayerStartTime,
      hoursOfPrayer: Number(hoursOfPrayer) || 0,
    },
  });

  const validate = () => {
    const filledPartners = partners.filter((p) => p.workerId.trim() || p.fullName.trim());
    if (!filledPartners.length) {
      toast.warning("Partners required", "Enter your partner\'s Worker ID. If alone, type \'None\'."); return false;
    }
    if (serviceAttendance.some((s) => s.attended === null)) {
      toast.warning("Service attendance required", "Answer Yes or No for both Tuesday and Sunday service."); return false;
    }
    if (didAttendCell === null) {
      toast.warning("Cell attendance required", "Answer whether you attended cell meeting this week."); return false;
    }
    if (!fellowshipName) {
      toast.warning("Fellowship required", "Select which fellowship you belong to."); return false;
    }
    if (prayedThisWeek === null) {
      toast.warning("Fellowship prayer required", "Answer whether you prayed in your fellowship this week."); return false;
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
      if (isEditMode && existingReportId) await handleEdit(existingReportId, buildPayload());
      else await handleSubmit(buildPayload());
      setSubmitted(true);
      toast.success("Submitted", "Report submitted successfully.");
    } catch (err) {
      const msg  = err.response?.data?.message || "Could not submit.";
      const dups = err.response?.data?.duplicates || [];
      if (dups.length) { setDuplicates(dups); toast.error("Duplicate souls", msg); }
      else toast.error("Error", msg);
    }
  };

  if (submitted) return (
    <div className="card p-12 text-center space-y-4">
      <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
      <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100">{isEditMode ? "Report Updated" : "Report Submitted"}</h3>
      <p className="text-gray-500 dark:text-slate-400 text-sm">
        {isArrears ? "Arrears report submitted and locked." : "Submitted. Editable until Monday 2:59pm."}
      </p>
      {!isArrears && portalOpen && <button onClick={() => setSubmitted(false)} className="btn-outline">Edit Report</button>}
    </div>
  );

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Disclaimer */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Personal Report Only</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
            Submit only YOUR personal evangelism. Do not include souls or attendees belonging to your partner.
            Whoever submits first claims the person  duplicates are blocked automatically.
          </p>
        </div>
      </div>

      {/* Duplicates error */}
      {duplicates.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 space-y-1">
          <p className="font-bold text-red-800 dark:text-red-300 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />{duplicates.length} person(s) already claimed by your partner
          </p>
          {duplicates.map((d, i) => <p key={i} className="text-xs text-red-700 dark:text-red-400">• <strong>{d.soul}</strong>  submitted by <strong>{d.claimedBy}</strong></p>)}
          <button onClick={() => setDuplicates([])} className="text-xs text-red-500 flex items-center gap-1 pt-1"><X className="w-3 h-3" />Dismiss</button>
        </div>
      )}

      {/* ── Evangelism Partners ─────────────────────────────────── */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-900 dark:text-slate-100">Evangelism Partner(s) This Week</h3>
          <span className="text-xs text-red-400 font-semibold">Required</span>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500">List everyone you evangelised with. If alone, write <strong>None</strong>.</p>
        <div className="space-y-3">
          {partners.map((partner, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <input
                  className={cn("input-field flex-1",
                    partner.resolved ? "border-green-400 dark:border-green-600" :
                    partner.notFound ? "border-red-400 dark:border-red-600" : "")}
                  placeholder={i === 0 ? "Enter Worker ID (e.g. 042) or type None if alone" : "Enter Worker ID"}
                  value={partner.workerId}
                  onChange={async (e) => {
                    const val = e.target.value.trim();
                    const updated = [...partners];
                    updated[i] = { workerId: val, fullName: "", resolved: false, notFound: false };
                    setPartners(updated);
                    // Live lookup if 3+ chars and looks like a Worker ID
                    if (val.length >= 2 && val.toLowerCase() !== "none") {
                      try {
                        const { data } = await axiosInstance.get(`/workers/by-worker-id/${val}`);
                        if (data.worker) {
                          updated[i] = { workerId: val, fullName: data.worker.fullName, resolved: true, notFound: false };
                          setPartners([...updated]);
                        }
                      } catch {
                        if (val.length >= 3) {
                          updated[i] = { ...updated[i], notFound: true };
                          setPartners([...updated]);
                        }
                      }
                    }
                  }}
                />
                {partners.length > 1 && (
                  <button onClick={() => setPartners((p) => p.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {/* Resolved name confirmation */}
              {partner.resolved && partner.fullName && (
                <p className="text-xs text-green-600 dark:text-green-400 pl-6 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> {partner.fullName}  confirmed ✓
                </p>
              )}
              {partner.notFound && !partner.resolved && (
                <p className="text-xs text-red-500 dark:text-red-400 pl-6">Worker ID not found. Check and re-enter.</p>
              )}
              {partner.workerId.toLowerCase() === "none" && (
                <p className="text-xs text-gray-400 pl-6">Going alone this week  noted.</p>
              )}
            </div>
          ))}
          <button
            onClick={() => setPartners((p) => [...p, { workerId: "", fullName: "", resolved: false, notFound: false }])}
            className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1">
            <Plus className="w-3 h-3" />Add another partner
          </button>
        </div>
      </div>

      {/* ── Souls Preached To ───────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="font-bold text-gray-900 dark:text-slate-100">Souls Preached To</h3>
          <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />{souls.length} soul{souls.length !== 1 ? "s" : ""} · min 10 to qualify
          </span>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500">Minimum 10 souls for this week. Personal only  not your partner's.</p>
        <div className="space-y-3">
          {souls.map((soul, i) => (
            <div key={i} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400">Soul #{i + 1}</span>
                {souls.length > 1 && <button onClick={() => setSouls((s) => s.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="form-label">Full Name</label><input className="input-field" placeholder="Name" value={soul.fullName} onChange={(e) => updateSoul(i, "fullName", e.target.value)} /></div>
                <div>
                  <label className="form-label">Status</label>
                  <select className="input-field" value={soul.status} onChange={(e) => updateSoul(i, "status", e.target.value)}>
                    <option value="">Select status</option>
                    {SOUL_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div><label className="form-label">Phone</label><input className="input-field" placeholder="Phone" value={soul.phone} onChange={(e) => updateSoul(i, "phone", e.target.value)} /></div>
                <div><label className="form-label">Location / Area</label><input className="input-field" placeholder="Area" value={soul.location} onChange={(e) => updateSoul(i, "location", e.target.value)} /></div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => setSouls((s) => [...s, { ...emptySoul }])} className="w-full py-2.5 border-2 border-dashed border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 rounded-xl text-sm font-medium hover:bg-purple-50 dark:hover:bg-purple-900/20 flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" />Add another soul
        </button>
        {souls.length < 10 && (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-100 dark:bg-slate-700 rounded-full h-2">
              <div className="bg-purple-600 h-2 rounded-full transition-all" style={{ width: `${(souls.length / 10) * 100}%` }} />
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap">{souls.length}/10</span>
          </div>
        )}
        <div><label className="form-label">Scriptures Used (comma separated)</label><input className="input-field" placeholder="e.g. Mark 16:15, Romans 1:16" value={scriptures} onChange={(e) => setScriptures(e.target.value)} /></div>
      </div>

      {/* ── Follow-up Activities ────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-gray-900 dark:text-slate-100">Follow-up Activities</h3>
          <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-3 py-1 rounded-full text-sm font-semibold">{followUps.length}</span>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500">Only your personal follow-ups  not your partner's.</p>
        <div className="space-y-3">
          {followUps.map((f, i) => (
            <div key={i} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                {followUps.length > 1 && <button onClick={() => setFollowUps((p) => p.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><label className="form-label">Full Name</label><input className="input-field" placeholder="Name" value={f.fullName} onChange={(e) => updateFollowUp(i, "fullName", e.target.value)} /></div>
                <div><label className="form-label">Topic</label><input className="input-field" placeholder="Topic discussed" value={f.topic} onChange={(e) => updateFollowUp(i, "topic", e.target.value)} /></div>
                <div><label className="form-label">Scriptures</label><input className="input-field" placeholder="Hebrews 10:24-25" value={f.scriptures} onChange={(e) => updateFollowUp(i, "scriptures", e.target.value)} /></div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => setFollowUps((p) => [...p, { ...emptyFollowUp }])} className="w-full py-2.5 border-2 border-dashed border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 rounded-xl text-sm font-medium hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" />Add follow-up
        </button>
      </div>

      {/* ── People Brought to Church ────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="font-bold text-gray-900 dark:text-slate-100">People Brought to Church</h3>
          <span className={cn("px-3 py-1 rounded-full text-sm font-semibold",
            churchCounts >= 4 ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300")}>
            {churchCounts} qualifying{churchCounts >= 4 ? " ✓" : ` / 4 min`}
          </span>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500">
          Tick <strong>"Older than 12"</strong> for each person  only those count toward the 4-count minimum.
          Tick each service they attended (each = 1 count).
        </p>
        <div className="space-y-3">
          {attendees.map((a, i) => (
            <div key={i} className="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400 w-6">#{i + 1}</span>
                <input className="input-field flex-1" placeholder="Full name" value={a.fullName} onChange={(e) => updateAttendee(i, "fullName", e.target.value)} />
                {attendees.length > 1 && <button onClick={() => setAttendees((p) => p.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>}
              </div>
              {/* Older than 12 toggle */}
              <label className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 cursor-pointer select-none transition-all w-full",
                a.olderThan12 ? "border-purple-400 bg-purple-50 dark:bg-purple-900/20" : "border-gray-200 dark:border-slate-600")}>
                <input type="checkbox" className="w-4 h-4 accent-purple-600 flex-shrink-0" checked={a.olderThan12} onChange={(e) => updateAttendee(i, "olderThan12", e.target.checked)} />
                <span className={cn("text-sm font-medium", a.olderThan12 ? "text-purple-700 dark:text-purple-300" : "text-gray-500 dark:text-slate-400")}>
                  {a.olderThan12 ? "✓ Older than 12  counts toward qualification" : "Tick if this person is older than 12"}
                </span>
              </label>
              {/* Services attended */}
              <div className="flex flex-wrap gap-2 pl-2">
                {[{ field: "attendedTuesday", label: "Tuesday" }, { field: "attendedSunday", label: "Sunday" }, { field: "attendedSpecial", label: "Special" }].map(({ field, label }) => (
                  <label key={field} className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors select-none",
                    a[field] ? "border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : "border-gray-200 dark:border-slate-600 text-gray-500")}>
                    <input type="checkbox" className="sr-only" checked={a[field]} onChange={(e) => updateAttendee(i, field, e.target.checked)} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => setAttendees((p) => [...p, { ...emptyAttendee }])} className="w-full py-2.5 border-2 border-dashed border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 rounded-xl text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" />Add another person
        </button>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-100 dark:bg-slate-700 rounded-full h-2">
            <div className={cn("h-2 rounded-full transition-all", churchCounts >= 4 ? "bg-green-500" : "bg-blue-500")} style={{ width: `${Math.min((churchCounts / 4) * 100, 100)}%` }} />
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap">{churchCounts}/4 min</span>
        </div>
      </div>

      {/* ── Your Service Attendance ─────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-900 dark:text-slate-100">Your Service Attendance</h3>
          <span className="text-xs text-red-400 font-semibold">Required</span>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500">Did you personally attend service? Answer both.</p>
        {serviceAttendance.map((s, i) => (
          <div key={s.serviceType} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3">
            <p className="font-semibold text-gray-900 dark:text-slate-100 capitalize text-sm">{s.serviceType} Service</p>
            {/* Show front desk verified badge if check-in was recorded */}
            {frontDeskCheckIns[s.serviceType] && (
              <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-3 py-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                  Front desk recorded your check-in at <strong>{frontDeskCheckIns[s.serviceType].time}</strong>
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {[{ val: true, label: "Yes, I attended" }, { val: false, label: "No, I did not" }].map(({ val, label }) => (
                <button key={String(val)} type="button" onClick={() => updateSA(i, "attended", val)}
                  className={cn("py-2.5 rounded-xl border-2 text-sm font-medium transition-all",
                    s.attended === val
                      ? val ? "border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                             : "border-red-300 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                      : "border-gray-200 dark:border-slate-600 text-gray-500 hover:border-gray-300")}>
                  {label}
                </button>
              ))}
            </div>
            {s.attended === true && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">
                    Your Reporting Time
                    {frontDeskCheckIns[s.serviceType] && (
                      <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-normal">· recorded by front desk</span>
                    )}
                  </label>
                  <input
                    type="time"
                    className={cn("input-field", frontDeskCheckIns[s.serviceType] ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700" : "")}
                    value={s.reportingTime}
                    onChange={(e) => updateSA(i, "reportingTime", e.target.value)}
                    readOnly={!!frontDeskCheckIns[s.serviceType]}
                  />
                  {frontDeskCheckIns[s.serviceType] && (
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Time locked  recorded by front desk</p>
                  )}
                </div>
                <div><label className="form-label">Late reason (if any)</label><input className="input-field" placeholder="Leave blank if on time" value={s.lateReason || ""} onChange={(e) => updateSA(i, "lateReason", e.target.value)} /></div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Cell Meeting ────────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-900 dark:text-slate-100">Cell Meeting</h3>
          <span className="text-xs text-red-400 font-semibold">Required</span>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500">
          Attending at least one cell meeting this week qualifies you for the cell criterion.
          A worker may belong to one or more cells.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[{ val: true, label: "Yes, I attended" }, { val: false, label: "No, I did not" }].map(({ val, label }) => (
            <button key={String(val)} type="button" onClick={() => setDidAttendCell(val)}
              className={cn("py-2.5 rounded-xl border-2 text-sm font-medium transition-all",
                didAttendCell === val
                  ? val ? "border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                         : "border-red-300 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                  : "border-gray-200 dark:border-slate-600 text-gray-500 hover:border-gray-300")}>
              {label}
            </button>
          ))}
        </div>

        {didAttendCell === true && (
          <div className="space-y-4">
            {cells.map((cell, i) => (
              <div key={i} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">Cell {i + 1}</p>
                  {cells.length > 1 && <button onClick={() => setCells((p) => p.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
                </div>
                <div className="relative">
                  <label className="form-label">Cell Name</label>
                  <input
                    className="input-field"
                    placeholder="Name of your cell"
                    value={cell.cellName}
                    onChange={(e) => updateCell(i, "cellName", e.target.value)}
                    autoComplete="off"
                  />
                  {/* Past cell name suggestions */}
                  {pastCellNames.length > 0 && cell.cellName === "" && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {pastCellNames.map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => updateCell(i, "cellName", name)}
                          className="px-2.5 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 rounded-lg text-xs font-medium hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Filtered suggestions while typing */}
                  {pastCellNames.length > 0 && cell.cellName.length > 0 && (
                    (() => {
                      const filtered = pastCellNames.filter((n) =>
                        n.toLowerCase().includes(cell.cellName.toLowerCase()) && n !== cell.cellName
                      );
                      return filtered.length > 0 ? (
                        <div className="absolute z-10 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg overflow-hidden">
                          {filtered.map((name) => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => updateCell(i, "cellName", name)}
                              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      ) : null;
                    })()
                  )}
                </div>
                <div>
                  <label className="form-label">Meeting Day <span className="text-gray-400 font-normal text-xs"> select one</span></label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {DAYS.map((day) => (
                      <button key={day} type="button"
                        onClick={() => updateCell(i, "meetingDays", cell.meetingDays[0] === day ? [] : [day])}
                        className={cn("px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                          cell.meetingDays[0] === day
                            ? "border-purple-400 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                            : "border-gray-200 dark:border-slate-600 text-gray-500 hover:border-purple-300")}>
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className="form-label">Time you reported</label><input type="time" className="input-field" value={cell.reportTime} onChange={(e) => updateCell(i, "reportTime", e.target.value)} /></div>
                  <div><label className="form-label">Role played (if any)</label><input className="input-field" placeholder="e.g. Led worship, Taught" value={cell.role} onChange={(e) => updateCell(i, "role", e.target.value)} /></div>
                </div>
              </div>
            ))}
            <button onClick={() => setCells((p) => [...p, { ...emptyCell }])} className="w-full py-2.5 border-2 border-dashed border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 rounded-xl text-sm font-medium hover:bg-purple-50 dark:hover:bg-purple-900/20 flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" />Add another cell
            </button>
          </div>
        )}

        {didAttendCell === true && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
            <p className="text-xs text-green-700 dark:text-green-400 font-medium">Cell attendance qualifies ✓</p>
          </div>
        )}
      </div>

      {/* ── Fellowship Prayer ───────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-900 dark:text-slate-100">Fellowship Prayer</h3>
          <span className="text-xs text-red-400 font-semibold">Required</span>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500">Praying for 2+ hours in your fellowship this week qualifies you for the fellowship criterion.</p>

        <div>
          <label className="form-label">Which fellowship do you belong to? <span className="text-red-400">*</span></label>
          <div className="flex flex-wrap gap-2 mt-2">
            {FELLOWSHIPS.map((f) => (
              <button key={f} type="button" onClick={() => setFellowshipName(f)}
                className={cn("px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all",
                  fellowshipName === f
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                    : "border-gray-200 dark:border-slate-600 text-gray-500 hover:border-purple-300")}>
                {f}
              </button>
            ))}
          </div>
          {fellowshipName === "Other" && (
            <input className="input-field mt-3" placeholder="Enter your fellowship name" value={fellowshipOther} onChange={(e) => setFellowshipOther(e.target.value)} />
          )}
        </div>

        <div>
          <label className="form-label">Did you pray in your fellowship this week? <span className="text-red-400">*</span></label>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {[{ val: true, label: "Yes, I prayed" }, { val: false, label: "No, I did not" }].map(({ val, label }) => (
              <button key={String(val)} type="button" onClick={() => setPrayedThisWeek(val)}
                className={cn("py-2.5 rounded-xl border-2 text-sm font-medium transition-all",
                  prayedThisWeek === val
                    ? val ? "border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                           : "border-red-300 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                    : "border-gray-200 dark:border-slate-600 text-gray-500 hover:border-gray-300")}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {prayedThisWeek === true && (
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
            <div>
              <label className="form-label">Day of prayer <span className="text-red-400">*</span></label>
              <div className="flex flex-wrap gap-2 mt-1">
                {PRAYER_DAYS.map((day) => (
                  <button key={day} type="button" onClick={() => setPrayerDay(day)}
                    className={cn("px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                      prayerDay === day
                        ? "border-purple-400 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                        : "border-gray-200 dark:border-slate-600 text-gray-500 hover:border-purple-300")}>
                    {day}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label">Time prayer started <span className="text-red-400">*</span></label>
                <input type="time" className="input-field" value={prayerStartTime} onChange={(e) => setPrayerStartTime(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Hours of prayer <span className="text-red-400">*</span></label>
                <input type="number" min="0" max="12" step="0.5" className="input-field" placeholder="e.g. 2" value={hoursOfPrayer} onChange={(e) => setHoursOfPrayer(e.target.value)} />
                {hoursOfPrayer !== "" && Number(hoursOfPrayer) < 2 && (
                  <p className="text-xs text-amber-500 mt-1">Minimum 2 hours to qualify for fellowship criterion.</p>
                )}
                {hoursOfPrayer !== "" && Number(hoursOfPrayer) >= 2 && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" />2+ hours  qualifies ✓</p>
                )}
              </div>
            </div>
          </div>
        )}
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

export default EvangelismForm;