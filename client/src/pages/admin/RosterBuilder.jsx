import { useState, useEffect } from "react";
import { Save, Send, Copy, CheckCircle, ChevronDown, ChevronUp, X, Users, UserPlus, Calendar, MapPin, Clock, AlertCircle } from "lucide-react";
import axiosInstance from "../../utils/axiosInstance";
import { useToast, ToastContainer } from "../../components/common/Toast";
import Loader from "../../components/common/Loader";
import { getWeekLabel, getWeekReference } from "../../utils/formatDate";
import Modal from "../../components/common/Modal";
import { cn } from "../../utils/scoreHelpers";

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

const RosterBuilder = () => {
  const { toasts, toast, removeToast } = useToast();
  const [rosterData, setRosterData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState(() => {
    const s = {};
    DEPARTMENTS.forEach((d) => { s[d.value] = { assignments: [] }; });
    return s;
  });
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
  const [workerModal, setWorkerModal] = useState(null);
  const [workerSearch, setWorkerSearch] = useState("");
  const [whatsappText, setWhatsappText] = useState("");
  const [showWhatsapp, setShowWhatsapp] = useState(false);
  const [copied, setCopied] = useState(false);

  const weekRef = getWeekReference();

  useEffect(() => {
    axiosInstance.get(`/roster/builder?weekReference=${weekRef.toISOString()}`)
      .then(({ data }) => setRosterData(data.rosterData))
      .catch(() => toast.error("Error", "Could not load worker data."))
      .finally(() => setLoading(false));
  }, []);

  const allWorkers = rosterData ? [
    ...(rosterData.qualified   || []).map((w) => ({ ...w, cat: "qualified" })),
    ...(rosterData.disqualified|| []).map((w) => ({ ...w, cat: "disqualified" })),
    ...(rosterData.noSubmission|| []).map((w) => ({ ...w, cat: "no-report" })),
  ] : [];

  const filteredWorkers = allWorkers.filter((w) =>
    !workerSearch ||
    w.worker?.fullName?.toLowerCase().includes(workerSearch.toLowerCase()) ||
    w.worker?.workerId?.includes(workerSearch)
  );

  const qualifiedFiltered    = filteredWorkers.filter((w) => w.cat === "qualified");
  const disqualifiedFiltered = filteredWorkers.filter((w) => w.cat === "disqualified");
  const noReportFiltered     = filteredWorkers.filter((w) => w.cat === "no-report");

  const isAssigned = (deptValue, workerId) =>
    slots[deptValue]?.assignments?.some((a) => a.worker?._id === workerId);

  const toggleWorker = (deptValue, item) => {
    setSlots((prev) => {
      const existing = prev[deptValue]?.assignments || [];
      const already = existing.find((a) => a.worker?._id === item.worker?._id);
      if (already) return { ...prev, [deptValue]: { ...prev[deptValue], assignments: existing.filter((a) => a.worker?._id !== item.worker?._id) } };
      return { ...prev, [deptValue]: { ...prev[deptValue], assignments: [...existing, { worker: item.worker, isQualified: item.cat === "qualified", isCoordinator: false, totalScore: item.totalScore }] } };
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
    weekReference: weekRef.toISOString(),
    serviceType,
    serviceDate,
    serviceTime,
    specialServiceName: specialName,
    specialLocation,
    notes,
    slots: DEPARTMENTS.map((d) => ({ department: d.value, assignments: slots[d.value]?.assignments || [] })).filter((s) => s.assignments.length > 0),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await axiosInstance.post("/roster", buildPayload());
      setRosterId(data.roster._id);
      toast.success("Saved", "Roster draft saved.");
    } catch (err) { toast.error("Error", err.response?.data?.message || "Could not save."); }
    finally { setSaving(false); }
  };

  const handlePublish = async () => {
    if (!rosterId) { toast.warning("Save first", "Save the roster before publishing."); return; }
    if (!confirm("Publish this roster? All workers will be notified.")) return;
    try {
      await axiosInstance.put(`/roster/${rosterId}/publish`);
      setPublished(true);
      toast.success("Published", "Roster published. Workers notified.");
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
            {item.worker?.workerId} · {item.worker?.department?.replace(/-/g, " ")}
            {item.totalScore ? ` · ${item.totalScore} pts` : ""}
          </p>
        </div>
        {assigned && <CheckCircle className="w-5 h-5 text-purple-500 flex-shrink-0" />}
      </div>
    );
  };

  if (loading) return <Loader text="Loading qualification data..." />;

  const totalAssigned = Object.values(slots).reduce((t, s) => t + s.assignments.length, 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="section-title">Roster Builder</h1>
          <p className="section-subtitle">{getWeekLabel(weekRef)} · {totalAssigned} workers assigned</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleWhatsApp} className="btn-ghost text-sm flex items-center gap-1.5"><Copy className="w-4 h-4" />WhatsApp</button>
          <button onClick={handleSave} disabled={saving} className="btn-outline text-sm flex items-center gap-1.5"><Save className="w-4 h-4" />{saving ? "Saving..." : "Save Draft"}</button>
          <button onClick={handlePublish} disabled={published} className="btn-primary text-sm flex items-center gap-1.5"><Send className="w-4 h-4" />{published ? "Published" : "Publish"}</button>
        </div>
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
        {DEPARTMENTS.map((dept) => {
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
                  onClick={(e) => { e.stopPropagation(); setWorkerSearch(""); setWorkerModal(dept.value); }}
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
                        <p className="text-xs text-gray-400 dark:text-slate-500">{a.worker.workerId} · {a.totalScore || 0} pts · {a.isQualified ? "Qualified" : "Not qualified"}</p>
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
      <Modal isOpen={!!workerModal} onClose={() => setWorkerModal(null)} title={`Assign Workers: ${DEPARTMENTS.find((d) => d.value === workerModal)?.label || ""}`} size="2xl">
        {workerModal && (
          <div className="space-y-4">
            <input className="input-field" placeholder="Search by name or Worker ID..." value={workerSearch} onChange={(e) => setWorkerSearch(e.target.value)} autoFocus />

            <p className="text-xs text-gray-500 dark:text-slate-400">
              Currently assigned: <strong>{slots[workerModal]?.assignments?.length || 0}</strong>.
              Workers who did not submit a report this week are shown but marked separately.
            </p>

            <div className="max-h-[55vh] overflow-y-auto space-y-4 pr-1">
              {qualifiedFiltered.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" /> Qualified this week ({qualifiedFiltered.length})
                  </p>
                  <div className="space-y-1.5">
                    {qualifiedFiltered.filter((item) => item?.worker?._id).map((item) => <WorkerItem key={item.worker._id} item={item} dept={workerModal} />)}
                  </div>
                </div>
              )}
              {disqualifiedFiltered.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> Not qualified ({disqualifiedFiltered.length})
                  </p>
                  <div className="space-y-1.5">
                    {disqualifiedFiltered.filter((item) => item?.worker?._id).map((item) => <WorkerItem key={item.worker._id} item={item} dept={workerModal} />)}
                  </div>
                </div>
              )}
              {noReportFiltered.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" /> No report submitted ({noReportFiltered.length})
                  </p>
                  <div className="space-y-1.5">
                    {noReportFiltered.filter((item) => item?.worker?._id).map((item) => <WorkerItem key={item.worker._id} item={item} dept={workerModal} />)}
                  </div>
                </div>
              )}
              {filteredWorkers.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-8">
                  No workers found. Run <strong>Calculate Now</strong> on the Qualification page first.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-700">
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {slots[workerModal]?.assignments?.length || 0} assigned to {DEPARTMENTS.find((d) => d.value === workerModal)?.label}
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