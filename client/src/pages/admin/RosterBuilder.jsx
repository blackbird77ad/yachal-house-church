import { useState, useEffect } from "react";
import { Save, Send, Copy, CheckCircle, ChevronDown, ChevronUp, X, Users, UserPlus } from "lucide-react";
import { getRosterBuilderData, createOrUpdateRoster, publishRoster, getWhatsAppText } from "../../services/rosterService";
import { useToast, ToastContainer } from "../../components/common/Toast";
import Loader from "../../components/common/Loader";
import { getWeekReference, formatDate } from "../../utils/formatDate";
import Modal from "../../components/common/Modal";
import { cn } from "../../utils/scoreHelpers";

const DEPARTMENTS = [
  { value: "song-ministration", label: "Song Ministration" },
  { value: "media", label: "Media" },
  { value: "security", label: "Security" },
  { value: "sunday-school", label: "Sunday School" },
  { value: "ushering", label: "Ushering" },
  { value: "projection", label: "Projection" },
  { value: "brief-writing", label: "Brief Writing" },
  { value: "production", label: "Production" },
  { value: "service-coordination", label: "Service Coordination" },
  { value: "front-desk", label: "Front Desk" },
];

const RosterBuilder = () => {
  const { toasts, toast, removeToast } = useToast();
  const [rosterData, setRosterData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState({});
  const [expanded, setExpanded] = useState({});
  const [notes, setNotes] = useState("");
  const [serviceType, setServiceType] = useState("sunday");
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [rosterId, setRosterId] = useState(null);
  const [published, setPublished] = useState(false);
  const [whatsappText, setWhatsappText] = useState("");
  const [showWhatsapp, setShowWhatsapp] = useState(false);
  const [copied, setCopied] = useState(false);
  const [workerModal, setWorkerModal] = useState(null); // dept value currently picking workers for
  const [workerSearch, setWorkerSearch] = useState("");

  const weekRef = getWeekReference();

  useEffect(() => {
    getRosterBuilderData({ weekReference: weekRef.toISOString() })
      .then(({ rosterData: data }) => {
        setRosterData(data);
        const initial = {};
        DEPARTMENTS.forEach((d) => { initial[d.value] = { assignments: [] }; });
        setSlots(initial);
      })
      .catch(() => toast.error("Error", "Could not load roster data."))
      .finally(() => setLoading(false));
  }, []);

  const openWorkerModal = (deptValue) => {
    setWorkerSearch("");
    setWorkerModal(deptValue);
  };

  const allWorkers = rosterData
    ? [
        ...(rosterData.qualified || []).map((w) => ({ ...w, isQualified: true })),
        ...(rosterData.disqualified || []).map((w) => ({ ...w, isQualified: false })),
      ]
    : [];

  const toggleWorkerInDept = (deptValue, workerItem) => {
    setSlots((prev) => {
      const existing = prev[deptValue]?.assignments || [];
      const alreadyAdded = existing.find((a) => a.worker._id === workerItem.worker._id);
      if (alreadyAdded) {
        return { ...prev, [deptValue]: { ...prev[deptValue], assignments: existing.filter((a) => a.worker._id !== workerItem.worker._id) } };
      }
      return {
        ...prev,
        [deptValue]: {
          ...prev[deptValue],
          assignments: [...existing, { worker: workerItem.worker, isQualified: workerItem.isQualified, isCoordinator: false, totalScore: workerItem.totalScore }],
        },
      };
    });
  };

  const toggleCoordinator = (deptValue, workerId) => {
    setSlots((prev) => ({
      ...prev,
      [deptValue]: {
        ...prev[deptValue],
        assignments: prev[deptValue].assignments.map((a) =>
          a.worker._id === workerId ? { ...a, isCoordinator: !a.isCoordinator } : a
        ),
      },
    }));
  };

  const removeFromDept = (deptValue, workerId) => {
    setSlots((prev) => ({
      ...prev,
      [deptValue]: {
        ...prev[deptValue],
        assignments: prev[deptValue].assignments.filter((a) => a.worker._id !== workerId),
      },
    }));
  };

  const buildSlotsArray = () =>
    DEPARTMENTS.map((d) => ({
      department: d.value,
      assignments: slots[d.value]?.assignments || [],
    })).filter((s) => s.assignments.length > 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { roster } = await createOrUpdateRoster({ weekReference: weekRef.toISOString(), serviceType, serviceDate, slots: buildSlotsArray(), notes });
      setRosterId(roster._id);
      toast.success("Saved", "Roster draft saved.");
    } catch (err) { toast.error("Error", err.response?.data?.message || "Could not save."); }
    finally { setSaving(false); }
  };

  const handlePublish = async () => {
    if (!rosterId) { toast.warning("Save first", "Save the roster before publishing."); return; }
    if (!confirm("Publish this roster? Workers will be notified.")) return;
    try { await publishRoster(rosterId); setPublished(true); toast.success("Published", "Roster published. Workers notified."); }
    catch (err) { toast.error("Error", err.response?.data?.message || "Could not publish."); }
  };

  const handleWhatsApp = async () => {
    if (!rosterId) { toast.warning("Save first", "Save the roster first."); return; }
    try { const { text } = await getWhatsAppText(rosterId); setWhatsappText(text); setShowWhatsapp(true); }
    catch { toast.error("Error", "Could not generate WhatsApp text."); }
  };

  const handleCopy = () => { navigator.clipboard.writeText(whatsappText); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const filteredWorkers = allWorkers.filter((w) =>
    w.worker?.fullName?.toLowerCase().includes(workerSearch.toLowerCase()) ||
    w.worker?.workerId?.includes(workerSearch)
  );

  const qualifiedFiltered = filteredWorkers.filter((w) => w.isQualified);
  const disqualifiedFiltered = filteredWorkers.filter((w) => !w.isQualified);

  if (loading) return <Loader text="Loading roster data..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="section-title">Roster Builder</h1>
          <p className="section-subtitle">Week of {formatDate(weekRef)}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleWhatsApp} className="btn-outline text-sm flex items-center gap-2">
            <Copy className="w-4 h-4" /> WhatsApp
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-outline text-sm flex items-center gap-2">
            <Save className="w-4 h-4" />{saving ? "Saving..." : "Save Draft"}
          </button>
          <button onClick={handlePublish} disabled={published} className="btn-primary text-sm flex items-center gap-2">
            <Send className="w-4 h-4" />{published ? "Published" : "Publish"}
          </button>
        </div>
      </div>

      <div className="card p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div><label className="form-label">Service Type</label>
            <select className="input-field" value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
              <option value="tuesday">Tuesday Service</option>
              <option value="sunday">Sunday Service</option>
              <option value="special">Special Service</option>
            </select>
          </div>
          <div><label className="form-label">Service Date</label>
            <input type="date" className="input-field" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
          </div>
          <div><label className="form-label">Notes (optional)</label>
            <input className="input-field" placeholder="Any notes for this roster..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      </div>

      {showWhatsapp && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-900 dark:text-slate-100">WhatsApp Format</h3>
            <div className="flex gap-2">
              <button onClick={handleCopy} className="btn-outline text-xs py-1.5 flex items-center gap-1">
                {copied ? <><CheckCircle className="w-3 h-3 text-green-500" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
              </button>
              <button onClick={() => setShowWhatsapp(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
          </div>
          <pre className="text-xs text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-800 rounded-xl p-4 whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto">{whatsappText}</pre>
        </div>
      )}

      <div className="space-y-3">
        {DEPARTMENTS.map((dept) => {
          const assigned = slots[dept.value]?.assignments || [];
          const isExpanded = expanded[dept.value];

          return (
            <div key={dept.value} className="card overflow-hidden">
              <div
                className="flex items-center gap-4 p-5 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                onClick={() => setExpanded({ ...expanded, [dept.value]: !isExpanded })}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-bold text-gray-900 dark:text-slate-100">{dept.label}</h3>
                    {assigned.length > 0 && (
                      <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                        {assigned.length} assigned
                      </span>
                    )}
                  </div>
                  {assigned.length > 0 && (
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                      {assigned.map((a) => a.worker.fullName).join(", ")}
                    </p>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); openWorkerModal(dept.value); }}
                  className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1.5 flex-shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Assign Workers
                </button>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
              </div>

              {isExpanded && assigned.length > 0 && (
                <div className="border-t border-gray-100 dark:border-slate-700 p-5">
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">Assigned Workers</p>
                  <div className="space-y-2">
                    {assigned.map((a) => (
                      <div key={a.worker._id} className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border",
                        a.isQualified
                          ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10"
                          : "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10"
                      )}>
                        <div className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0",
                          a.isQualified ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                        )}>
                          {a.worker.fullName?.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{a.worker.fullName}</p>
                          <p className="text-xs text-gray-400 dark:text-slate-500">ID: {a.worker.workerId} - Score: {a.totalScore || 0}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {a.isQualified
                            ? <span className="text-xs text-green-700 dark:text-green-400 font-medium">Qualified</span>
                            : <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">Not qualified</span>
                          }
                          <button
                            onClick={() => toggleCoordinator(dept.value, a.worker._id)}
                            className={cn(
                              "text-xs px-2.5 py-1 rounded-full border font-medium transition-all",
                              a.isCoordinator
                                ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-700"
                                : "border-gray-200 dark:border-slate-600 text-gray-400 hover:border-purple-300 hover:text-purple-600"
                            )}
                          >
                            {a.isCoordinator ? "Coordinator" : "Set Coord."}
                          </button>
                          <button onClick={() => removeFromDept(dept.value, a.worker._id)} className="text-red-400 hover:text-red-600 p-1">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isExpanded && assigned.length === 0 && (
                <div className="border-t border-gray-100 dark:border-slate-700 p-5 text-center">
                  <p className="text-sm text-gray-400 dark:text-slate-500">No workers assigned yet. Click "Assign Workers" to add.</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={!!workerModal}
        onClose={() => setWorkerModal(null)}
        title={`Assign Workers: ${DEPARTMENTS.find((d) => d.value === workerModal)?.label || ""}`}
        size="2xl"
      >
        {workerModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Select one or more workers. You can assign workers regardless of qualification status. Currently assigned: <strong>{slots[workerModal]?.assignments?.length || 0}</strong>
            </p>

            <input
              className="input-field"
              placeholder="Search by name or Worker ID..."
              value={workerSearch}
              onChange={(e) => setWorkerSearch(e.target.value)}
              autoFocus
            />

            <div className="max-h-[60vh] overflow-y-auto space-y-4">
              {qualifiedFiltered.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5" /> Qualified this week ({qualifiedFiltered.length})
                  </p>
                  <div className="space-y-1.5">
                    {qualifiedFiltered.map((item) => {
                      const isAssigned = slots[workerModal]?.assignments?.find((a) => a.worker._id === item.worker._id);
                      return (
                        <div
                          key={item.worker._id}
                          onClick={() => toggleWorkerInDept(workerModal, item)}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all",
                            isAssigned
                              ? "border-green-400 bg-green-50 dark:bg-green-900/20"
                              : "border-gray-100 dark:border-slate-700 hover:border-green-300 hover:bg-green-50 dark:hover:bg-green-900/10"
                          )}
                        >
                          <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold flex items-center justify-center text-sm flex-shrink-0">
                            {item.worker.fullName?.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{item.worker.fullName}</p>
                            <p className="text-xs text-gray-400 dark:text-slate-500">ID: {item.worker.workerId} - {item.worker.department?.replace(/-/g, " ")} - Score: {item.totalScore || 0}</p>
                          </div>
                          {isAssigned && <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {disqualifiedFiltered.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Users className="w-3.5 h-3.5" /> Not qualified this week ({disqualifiedFiltered.length})
                  </p>
                  <div className="space-y-1.5">
                    {disqualifiedFiltered.map((item) => {
                      const isAssigned = slots[workerModal]?.assignments?.find((a) => a.worker._id === item.worker._id);
                      return (
                        <div
                          key={item.worker._id}
                          onClick={() => toggleWorkerInDept(workerModal, item)}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all",
                            isAssigned
                              ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20"
                              : "border-gray-100 dark:border-slate-700 hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/10"
                          )}
                        >
                          <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-bold flex items-center justify-center text-sm flex-shrink-0">
                            {item.worker.fullName?.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{item.worker.fullName}</p>
                            <p className="text-xs text-gray-400 dark:text-slate-500">ID: {item.worker.workerId} - {item.worker.department?.replace(/-/g, " ")} - Score: {item.totalScore || 0}</p>
                          </div>
                          {isAssigned && <CheckCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {filteredWorkers.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-8">No workers found.</p>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-700">
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {slots[workerModal]?.assignments?.length || 0} worker(s) assigned to this department
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