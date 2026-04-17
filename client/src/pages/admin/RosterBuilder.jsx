import { useState, useEffect } from "react";
import { Save, Send, Copy, CheckCircle, ChevronDown, ChevronUp, X, Users, UserPlus, Calendar, MapPin, Clock, AlertCircle, Plus, RotateCcw } from "lucide-react";
import axiosInstance from "../../utils/axiosInstance";
import { useToast, ToastContainer } from "../../components/common/Toast";
import Loader from "../../components/common/Loader";
import Pagination from "../../components/common/Pagination";
import { getWeekLabel, getWeekReference } from "../../utils/formatDate";
import Modal from "../../components/common/Modal";
import { cn, compareQualificationRank } from "../../utils/scoreHelpers";

const DEPARTMENTS = [
  { value: "song-ministration", label: "Song Ministration" },
  { value: "media",             label: "Media" },
  { value: "security",          label: "Security" },
  { value: "sunday-school",     label: "Sunday School" },
  { value: "ushering",          label: "Ushering" },
  { value: "projection",        label: "Projection" },
  { value: "brief-writing",     label: "Brief Writing" },
  { value: "production",        label: "Production" },
  { value: "service-coordination", label: "Service Coordination" },
  { value: "front-desk",        label: "Front Desk" },
];

const buildSlotMap = (departments = DEPARTMENTS) => {
  const slots = {};
  departments.forEach((department) => {
    slots[department.value] = { assignments: [] };
  });
  return slots;
};

const formatDepartmentLabel = (value = "") =>
  value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const RosterBuilder = () => {
  const { toasts, toast, removeToast } = useToast();
  const [rosterData, setRosterData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingExistingRoster, setLoadingExistingRoster] = useState(true);
  const [availableRosters, setAvailableRosters] = useState([]);
  const [slots, setSlots] = useState(() => buildSlotMap());
  const [expanded, setExpanded] = useState({});
  const [notes, setNotes] = useState("");
  const [serviceType, setServiceType] = useState("sunday");
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [serviceTime, setServiceTime] = useState("09:00");
  const [specialName, setSpecialName] = useState("");
  const [specialLocation, setSpecialLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [rosterId, setRosterId] = useState(null);
  const [published, setPublished] = useState(false);
  const [republishNeeded, setRepublishNeeded] = useState(false);
  const [workerModal, setWorkerModal] = useState(null);
  const [modalPage, setModalPage] = useState(1);
  const MODAL_PER_PAGE = 10;
  const [customDepts, setCustomDepts] = useState([]);
  const [showAddDept, setShowAddDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");

  const allDepartments = [
    ...DEPARTMENTS,
    ...customDepts,
  ];
  const [workerSearch, setWorkerSearch] = useState("");
  const [whatsappText, setWhatsappText] = useState("");
  const [showWhatsapp, setShowWhatsapp] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rosterWeekReference, setRosterWeekReference] = useState(null);
  const [rankingWeekReference, setRankingWeekReference] = useState(null);

  const weekRef = getWeekReference();

  useEffect(() => {
    axiosInstance.get("/roster/builder")
      .then(({ data }) => {
        setRosterData(data.rosterData);
        setRosterWeekReference(data.rosterWeekReference || null);
        setRankingWeekReference(data.rankingWeekReference || null);
      })
      .catch(() => toast.error("Error", "Could not load worker data."))
      .finally(() => setLoading(false));
  }, []);

  const applyRosterToForm = (roster = null) => {
    if (!roster) {
      setCustomDepts([]);
      setSlots(buildSlotMap());
      setNotes("");
      setSpecialName("");
      setServiceDate(new Date().toISOString().split("T")[0]);
      setServiceTime("09:00");
      setRosterId(null);
      setPublished(false);
      setRepublishNeeded(false);
      return;
    }

    const customRosterDepartments = (roster.slots || [])
      .map((slot) => slot.department)
      .filter((department) => !DEPARTMENTS.some((item) => item.value === department))
      .map((department) => ({
        value: department,
        label: formatDepartmentLabel(department),
      }));

    const allRosterDepartments = [...DEPARTMENTS, ...customRosterDepartments];
    const nextSlots = buildSlotMap(allRosterDepartments);

    (roster.slots || []).forEach((slot) => {
      nextSlots[slot.department] = {
        assignments: (slot.assignments || []).map((assignment) => ({
          ...assignment,
          score: assignment.score ?? assignment.totalScore ?? 0,
        })),
      };
    });

    setCustomDepts(customRosterDepartments);
    setSlots(nextSlots);
    setNotes(roster.notes || "");
    setServiceDate(
      roster.serviceDate
        ? new Date(roster.serviceDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0]
    );
    setServiceTime(
      roster.serviceDate
        ? new Date(roster.serviceDate).toTimeString().slice(0, 5)
        : "09:00"
    );
    setSpecialName(roster.specialServiceName || "");
    setRosterId(roster._id || null);
    setPublished(!!roster.isPublished);
    setRepublishNeeded(!!roster.needsRepublish);
  };

  const loadAvailableRosters = async (preferredRosterId = null) => {
    if (!rosterWeekReference) return;

    setLoadingExistingRoster(true);
    try {
      const { data } = await axiosInstance.get("/roster", {
        params: {
          weekReference: rosterWeekReference,
          serviceType,
          limit: 50,
        },
      });

      const rosters = data.rosters || [];
      setAvailableRosters(rosters);

      let nextRoster = null;
      if (preferredRosterId) {
        nextRoster = rosters.find((item) => item._id === preferredRosterId) || null;
      }
      if (!nextRoster && rosterId) {
        nextRoster = rosters.find((item) => item._id === rosterId) || null;
      }
      if (!nextRoster && rosters.length > 0) {
        nextRoster = rosters[0];
      }

      applyRosterToForm(nextRoster);
    } catch {
      toast.error("Error", "Could not load the saved roster for this service.");
    } finally {
      setLoadingExistingRoster(false);
    }
  };

  useEffect(() => {
    loadAvailableRosters();
  }, [rosterWeekReference, serviceType]);

  const rankedSubmittedWorkers = rosterData
    ? (
        rosterData.ranking?.length
          ? rosterData.ranking
          : [
              ...(rosterData.qualified || []).map((w) => ({ ...w, cat: "qualified" })),
              ...(rosterData.disqualified || []).map((w) => ({ ...w, cat: "disqualified" })),
              ...(rosterData.noSubmission || []).map((w) => ({ ...w, cat: "no-report" })),
            ].sort((a, b) => {
              if (!a.submittedReport && !b.submittedReport) {
                return (a.worker?.fullName || "").localeCompare(b.worker?.fullName || "");
              }
              if (!a.submittedReport) return 1;
              if (!b.submittedReport) return -1;
              return compareQualificationRank(a, b);
            })
      ).map((worker, index) => {
        const cat = worker.submittedReport
          ? worker.isQualified
            ? "qualified"
            : "disqualified"
          : "no-report";

        return {
          ...worker,
          cat,
          rank: worker.submittedReport ? index + 1 : null,
        };
      })
    : [];

  const allWorkers = rankedSubmittedWorkers;

  const getWorkerIdLabel = (worker) => worker?.workerId || "ID pending";

  const filteredWorkers = allWorkers.filter((w) =>
    !workerSearch ||
    w.worker?.fullName?.toLowerCase().includes(workerSearch.toLowerCase()) ||
    w.worker?.workerId?.includes(workerSearch)
  );
  const totalModalPages = Math.max(1, Math.ceil(filteredWorkers.length / MODAL_PER_PAGE));
  const safeModalPage = Math.min(modalPage, totalModalPages);
  const pagedWorkers = filteredWorkers.slice(
    (safeModalPage - 1) * MODAL_PER_PAGE,
    safeModalPage * MODAL_PER_PAGE
  );

  const isAssigned = (deptValue, workerId) =>
    slots[deptValue]?.assignments?.some((a) => a.worker?._id === workerId);

  const toggleWorker = (deptValue, item) => {
    setSlots((prev) => {
      const existing = prev[deptValue]?.assignments || [];
      const already = existing.find((a) => a.worker?._id === item.worker?._id);
      if (already) return { ...prev, [deptValue]: { ...prev[deptValue], assignments: existing.filter((a) => a.worker?._id !== item.worker?._id) } };
      return {
        ...prev,
        [deptValue]: {
          ...prev[deptValue],
          assignments: [
            ...existing,
            {
              worker: item.worker,
              isQualified: item.cat === "qualified",
              isCoordinator: false,
              score: item.totalScore || 0,
            },
          ],
        },
      };
    });
  };

  const toggleCoordinator = (deptValue, workerId) => {
    setSlots((prev) => ({
      ...prev,
      [deptValue]: { ...prev[deptValue], assignments: prev[deptValue].assignments.map((a) => a.worker?._id === workerId ? { ...a, isCoordinator: !a.isCoordinator } : a) },
    }));
  };

  const removeWorker = (deptValue, workerId) => {
    setSlots((prev) => ({
      ...prev,
      [deptValue]: { ...prev[deptValue], assignments: prev[deptValue].assignments.filter((a) => a.worker?._id !== workerId) },
    }));
  };

  const buildPayload = () => ({
    rosterId,
    weekReference: rosterWeekReference,
    serviceType,
    serviceDate,
    serviceTime,
    specialServiceName: specialName,
    specialLocation,
    notes,
    slots: allDepartments.map((d) => ({ department: d.value, assignments: slots[d.value]?.assignments || [] })).filter((s) => s.assignments.length > 0),
  });

  const handleAddDept = () => {
    const name = newDeptName.trim();
    if (!name) return;
    const value = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (allDepartments.some((d) => d.value === value)) {
      toast.warning("Already exists", "A department with that name already exists.");
      return;
    }
    const newDept = { value, label: name };
    setCustomDepts((prev) => [...prev, newDept]);
    setSlots((prev) => ({ ...prev, [value]: { assignments: [] } }));
    setShowAddDept(false);
    setNewDeptName("");
    toast.success("Added", `"${name}" department added to this roster.`);
  };

  const handleSave = async () => {
    if (!rosterWeekReference) {
      toast.error("Error", "Roster week is still loading. Please wait a moment.");
      return;
    }
    setSaving(true);
    try {
      const { data } = await axiosInstance.post("/roster", buildPayload());
      setRosterId(data.roster._id);
      setPublished(!!data.roster.isPublished);
      setRepublishNeeded(!!data.roster.needsRepublish);
      await loadAvailableRosters(data.roster._id);
      toast.success("Saved", data.message || "Roster saved.");
    } catch (err) { toast.error("Error", err.response?.data?.message || "Could not save."); }
    finally { setSaving(false); }
  };

  const handleResetAssignments = async () => {
    if (!rosterId) {
      toast.warning("Select roster", "Open or save a roster before resetting assignments.");
      return;
    }

    if (published) {
      toast.warning("Published roster", "Use edit and republish for published rosters.");
      return;
    }

    if (!confirm("Clear all assignments for this draft roster and start again?")) return;

    try {
      const { data } = await axiosInstance.put(`/roster/${rosterId}/reset`);
      applyRosterToForm(data.roster);
      await loadAvailableRosters(rosterId);
      toast.success("Reset", data.message || "Assignments cleared.");
    } catch (err) {
      toast.error("Error", err.response?.data?.message || "Could not reset assignments.");
    }
  };

  const handlePublish = async () => {
    if (!rosterId) { toast.warning("Save first", "Save the roster before publishing."); return; }
    if (!confirm(published ? "Republish this roster update? All assigned workers will be notified again to check their assignments." : "Publish this roster? All assigned workers will be notified.")) return;
    try {
      const { data } = await axiosInstance.put(`/roster/${rosterId}/publish`);
      setPublished(true);
      setRepublishNeeded(false);
      toast.success(data.republished ? "Republished" : "Published", data.message || "Workers notified.");
    } catch (err) { toast.error("Error", err.response?.data?.message || "Could not publish."); }
  };

  const handleWhatsApp = async () => {
    if (!rosterId) { toast.warning("Save first", "Save the roster before generating WhatsApp text."); return; }
    try {
      const { data } = await axiosInstance.get(`/roster/${rosterId}/whatsapp`);
      setWhatsappText(data.text);
      setShowWhatsapp(true);
    } catch { toast.error("Error", "Could not generate WhatsApp text."); }
  };

  const WorkerItem = ({ item, dept }) => {
    if (!item?.worker?._id) return null;
    const assigned = isAssigned(dept, item.worker._id);
    const catColor = item.cat === "qualified"
      ? "border-green-200 dark:border-green-800 hover:border-green-400 bg-green-50 dark:bg-green-900/10"
      : item.cat === "disqualified"
      ? "border-amber-200 dark:border-amber-800 hover:border-amber-400 bg-amber-50 dark:bg-amber-900/10"
      : "border-gray-200 dark:border-slate-700 hover:border-gray-400";

    return (
      <div
        onClick={() => toggleWorker(dept, item)}
        className={cn("flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all", assigned ? "border-purple-400 bg-purple-50 dark:bg-purple-900/20" : catColor)}
      >
        <div className={cn("w-8 h-8 rounded-full font-bold flex items-center justify-center text-sm flex-shrink-0",
          item.cat === "qualified" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
          : item.cat === "disqualified" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
          : "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400"
        )}>
          {item.worker?.fullName?.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{item.worker?.fullName}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500">
            {getWorkerIdLabel(item.worker)} · {item.worker?.department?.replace(/-/g, " ")}
            {item.rank ? ` · Rank #${item.rank}` : " · No report"}
            {item.rank ? ` · ${item.totalScore || 0} pts` : ""}
          </p>
        </div>
        <span
          className={cn(
            "text-[11px] px-2 py-1 rounded-full font-semibold flex-shrink-0",
            item.cat === "qualified"
              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
              : item.cat === "disqualified"
              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
              : "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400"
          )}
        >
          {item.cat === "qualified"
            ? "Qualified"
            : item.cat === "disqualified"
            ? "Not qualified"
            : "No report"}
        </span>
        {assigned && <CheckCircle className="w-5 h-5 text-purple-500 flex-shrink-0" />}
      </div>
    );
  };

  if (loading || loadingExistingRoster) return <Loader text="Loading qualification data..." />;

  const totalAssigned = Object.values(slots).reduce((t, s) => t + s.assignments.length, 0);
  const rosterWeekLabel = getWeekLabel(new Date(rosterWeekReference || weekRef.toISOString()));
  const rankingWeekLabel = rankingWeekReference
    ? getWeekLabel(new Date(rankingWeekReference))
    : null;
  const publishButtonLabel = published
    ? republishNeeded
      ? "Republish Changes"
      : "Republish"
    : "Publish";

  return (
    <div className="space-y-5 animate-fade-in">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="section-title">Roster Builder</h1>
          <p className="section-subtitle">{rosterWeekLabel} · {totalAssigned} workers assigned</p>
          {rankingWeekLabel && (
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              Ranking uses the immediately previous finalized qualification week: {rankingWeekLabel}
            </p>
          )}
          {published && (
            <p className="text-xs mt-1 text-blue-600 dark:text-blue-400">
              {republishNeeded
                ? "This roster has unpublished changes. Republish so workers are prompted to check their assignments again."
                : "This roster is already published. You can still edit it and republish updates if needed."}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => applyRosterToForm(null)}
            className="btn-outline text-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            New Roster
          </button>
          {rosterId && !published && (
            <button
              onClick={handleResetAssignments}
              className="btn-outline text-sm flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Assignments
            </button>
          )}
          <button onClick={handleWhatsApp} className="btn-ghost text-sm flex items-center gap-1.5"><Copy className="w-4 h-4" />WhatsApp</button>
          <button onClick={handleSave} disabled={saving} className="btn-outline text-sm flex items-center gap-1.5"><Save className="w-4 h-4" />{saving ? "Saving..." : "Save Draft"}</button>
          <button onClick={handlePublish} className="btn-primary text-sm flex items-center gap-1.5"><Send className="w-4 h-4" />{publishButtonLabel}</button>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-slate-100">Saved Rosters</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {availableRosters.length} roster{availableRosters.length === 1 ? "" : "s"} for this week and service type.
            </p>
          </div>
          <button
            onClick={() => applyRosterToForm(null)}
            className="btn-ghost text-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Start another roster
          </button>
        </div>

        {availableRosters.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">
            No saved roster yet for this service. Create one from the form below.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {availableRosters.map((roster) => {
              const isActive = roster._id === rosterId;
              const assignmentCount = (roster.slots || []).reduce(
                (sum, slot) => sum + ((slot.assignments || []).length || 0),
                0
              );

              return (
                <button
                  key={roster._id}
                  onClick={() => applyRosterToForm(roster)}
                  className={cn(
                    "text-left rounded-xl border p-4 transition-all",
                    isActive
                      ? "border-purple-400 bg-purple-50 dark:bg-purple-900/20"
                      : "border-gray-200 dark:border-slate-700 hover:border-purple-300"
                  )}
                >
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                      {roster.specialServiceName || `${roster.serviceType} service`}
                    </p>
                    <span
                      className={cn(
                        "text-[11px] px-2 py-0.5 rounded-full font-semibold",
                        roster.isPublished
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                          : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                      )}
                    >
                      {roster.isPublished ? "Published" : "Draft"}
                    </span>
                    {roster.needsRepublish && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                        Needs republish
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {new Date(roster.serviceDate).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                    {assignmentCount} assignment{assignmentCount === 1 ? "" : "s"}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {allWorkers.length === 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-300">
            <p className="font-semibold mb-1">No workers loaded yet</p>
            <p>Go to <strong>Qualification</strong>, click <strong>Calculate Now</strong>, then come back here to assign workers.</p>
          </div>
        </div>
      )}

      {/* Service details */}
      <div className="card p-5">
        <h2 className="font-bold text-gray-900 dark:text-slate-100 mb-4">Service Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="form-label">Service Type</label>
            <select className="input-field" value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
              <option value="sunday">Sunday Service</option>
              <option value="tuesday">Tuesday Service</option>
              <option value="special">Special Service</option>
            </select>
          </div>
          <div>
            <label className="form-label">Date</label>
            <input type="date" className="input-field" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Start Time</label>
            <input type="time" className="input-field" value={serviceTime} onChange={(e) => setServiceTime(e.target.value)} />
          </div>
          {serviceType === "special" && (
            <>
              <div>
                <label className="form-label">Special Service Name</label>
                <input className="input-field" placeholder="e.g. Easter Sunday, Harvest" value={specialName} onChange={(e) => setSpecialName(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Location</label>
                <input className="input-field" placeholder="e.g. Main Auditorium, Venue name" value={specialLocation} onChange={(e) => setSpecialLocation(e.target.value)} />
              </div>
            </>
          )}
          <div>
            <label className="form-label">Notes (optional)</label>
            <input className="input-field" placeholder="Any notes for this roster" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      </div>

      {/* WhatsApp preview */}
      {showWhatsapp && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-900 dark:text-slate-100">WhatsApp Format</h3>
            <div className="flex gap-2">
              <button onClick={() => { navigator.clipboard.writeText(whatsappText); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="btn-outline text-xs flex items-center gap-1">
                {copied ? <><CheckCircle className="w-3 h-3 text-green-500" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
              </button>
              <button onClick={() => setShowWhatsapp(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
          </div>
          <pre className="text-xs bg-gray-50 dark:bg-slate-800 rounded-xl p-4 whitespace-pre-wrap max-h-64 overflow-y-auto text-gray-700 dark:text-slate-300">{whatsappText}</pre>
        </div>
      )}

      {/* Department slots */}
      <div className="space-y-3">
        {allDepartments.map((dept) => {
          const assigned = slots[dept.value]?.assignments || [];
          const isExpanded = expanded[dept.value];

          return (
            <div key={dept.value} className="card overflow-hidden">
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                onClick={() => setExpanded({ ...expanded, [dept.value]: !isExpanded })}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm">{dept.label}</h3>
                    {assigned.length > 0 && (
                      <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs px-2 py-0.5 rounded-full font-semibold">
                        {assigned.length} assigned
                      </span>
                    )}
                  </div>
                  {assigned.length > 0 && (
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 truncate">
                      {assigned.map((a) => a.worker?.fullName || "Unknown").join(", ")}
                    </p>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setWorkerSearch(""); setWorkerModal(dept.value); setModalPage(1); }}
                  className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1.5 flex-shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Assign
                </button>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
              </div>

              {isExpanded && assigned.length > 0 && (
                <div className="border-t border-gray-100 dark:border-slate-700 p-4 space-y-2">
                  {assigned.map((a) => (
                    <div key={a.worker?._id || Math.random()} className={cn("flex items-center gap-3 p-3 rounded-xl border",
                      a.isQualified ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10" : "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10"
                    )}>
                      <div className={cn("w-8 h-8 rounded-full font-bold flex items-center justify-center text-sm flex-shrink-0",
                        a.isQualified ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                      )}>
                        {a.worker.fullName?.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{a.worker.fullName}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{getWorkerIdLabel(a.worker)} · {a.score ?? a.totalScore ?? 0} pts · {a.isQualified ? "Qualified" : "Not qualified"}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => toggleCoordinator(dept.value, a.worker._id)}
                          className={cn("text-xs px-2 py-1 rounded-full border font-medium transition-all", a.isCoordinator ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-700" : "border-gray-200 dark:border-slate-600 text-gray-400 hover:border-purple-300 hover:text-purple-600")}
                        >
                          {a.isCoordinator ? "Coordinator" : "Set Coord."}
                        </button>
                        <button onClick={() => removeWorker(dept.value, a.worker._id)} className="text-red-400 hover:text-red-600 p-1"><X className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Worker assignment modal */}
      <Modal isOpen={!!workerModal} onClose={() => setWorkerModal(null)} title={`Assign Workers: ${allDepartments.find((d) => d.value === workerModal)?.label || ""}`} size="2xl">
        {workerModal && (
          <div className="space-y-4">
            <input className="input-field" placeholder="Search by name or Worker ID..." value={workerSearch} onChange={(e) => { setWorkerSearch(e.target.value); setModalPage(1); }} autoFocus />

            <p className="text-xs text-gray-500 dark:text-slate-400">
              Currently assigned: <strong>{slots[workerModal]?.assignments?.length || 0}</strong>.
              Workers are ranked from the previous finalized week, then non-submitters are listed after them.
            </p>
            {rankingWeekLabel && (
              <p className="text-xs text-purple-600 dark:text-purple-400">
                Showing previous-week ranking from {rankingWeekLabel}.
              </p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                {
                  label: "All workers",
                  value: filteredWorkers.length,
                  color: "text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20",
                },
                {
                  label: "Qualified",
                  value: filteredWorkers.filter((item) => item.cat === "qualified").length,
                  color: "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20",
                },
                {
                  label: "Not qualified",
                  value: filteredWorkers.filter((item) => item.cat === "disqualified").length,
                  color: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20",
                },
                {
                  label: "No report",
                  value: filteredWorkers.filter((item) => item.cat === "no-report").length,
                  color: "text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-800",
                },
              ].map((stat) => (
                <div key={stat.label} className={cn("rounded-xl px-3 py-2", stat.color)}>
                  <p className="text-[11px] uppercase tracking-wider opacity-80">{stat.label}</p>
                  <p className="text-lg font-bold">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="max-h-[55vh] overflow-y-auto space-y-4 pr-1">
              {pagedWorkers.length > 0 && (
                <div className="space-y-1.5">
                  {pagedWorkers
                    .filter((item) => item?.worker?._id)
                    .map((item) => <WorkerItem key={item.worker._id} item={item} dept={workerModal} />)}
                </div>
              )}
              {filteredWorkers.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-8">
                  No workers found. Run <strong>Calculate Now</strong> on the Qualification page first.
                </p>
              )}
            </div>

            <Pagination
              page={safeModalPage}
              totalPages={totalModalPages}
              totalItems={filteredWorkers.length}
              perPage={MODAL_PER_PAGE}
              label="workers"
              onPage={setModalPage}
            />

            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-700">
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {slots[workerModal]?.assignments?.length || 0} assigned to {allDepartments.find((d) => d.value === workerModal)?.label}
              </p>
              <button onClick={() => setWorkerModal(null)} className="btn-primary">Done</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default RosterBuilder;
