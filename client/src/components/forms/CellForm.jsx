import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Send, CheckCircle } from "lucide-react";
import { useReports } from "../../hooks/useReports";
import { useToast, ToastContainer } from "../../components/common/Toast";

const CellForm = ({ weekType, portalOpen, weekDate, isArrears, isEditMode, existingReportId }) => {
  const { handleSaveDraft, handleSubmit, handleEdit, fetchMyDraft, loading } = useReports();
  const { toasts, toast, removeToast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    cellName: "", coordinatorName: "", meetingDate: "", attendees: [""], topicsTaught: [""], activities: [""], newConverts: [""], didAttend: false, role: "", reportingTime: "",
  });

  useEffect(() => {
    fetchMyDraft({ reportType: "cell", weekType, weekDate }).then(({ draft }) => {
      if (!draft) return;
      if (draft.status === "submitted") setSubmitted(true);
      if (draft.cellData) setForm({ ...form, ...draft.cellData, attendees: draft.cellData.attendees?.length ? draft.cellData.attendees : [""], topicsTaught: draft.cellData.topicsTaught?.length ? draft.cellData.topicsTaught : [""], activities: draft.cellData.activities?.length ? draft.cellData.activities : [""], newConverts: draft.cellData.newConverts?.length ? draft.cellData.newConverts : [""] });
    }).catch(() => {});
  }, [weekType]);

  const buildPayload = () => ({
    isEdit: isEditMode || false, reportType: "cell", weekType, cellData: { ...form } });

  const handleDraft = async () => {
    try { await handleSaveDraft(buildPayload()); toast.success("Draft saved", "Progress saved."); }
    catch { toast.error("Error", "Could not save draft."); }
  };

  const handleFinalSubmit = async () => {
    if (!portalOpen) { toast.warning("Portal closed", "Portal is not open yet."); return; }
    try {
      if (isEditMode && existingReportId) {
        await handleEdit(existingReportId, buildPayload());
      } else {
        await handleSubmit(buildPayload());
      }
      setSubmitted(true); toast.success(isEditMode ? "Updated" : "Submitted", "Cell report submitted."); }
    catch (err) { toast.error("Error", err.response?.data?.message || "Could not submit."); }
  };

  const updateList = (field, i, val) => setForm({ ...form, [field]: form[field].map((v, idx) => idx === i ? val : v) });
  const addItem = (field) => setForm({ ...form, [field]: [...form[field], ""] });
  const removeItem = (field, i) => setForm({ ...form, [field]: form[field].filter((_, idx) => idx !== i) });

  if (submitted) return (
    <div className="card p-12 text-center">
      <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
      <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">Report Submitted</h3>
      <button onClick={() => setSubmitted(false)} className="btn-outline mt-4">Edit Report</button>
    </div>
  );

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <div className="card p-6">
        <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-5">Cell Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="form-label">Cell/Fellowship Name</label><input className="input-field" placeholder="Name of cell" value={form.cellName} onChange={(e) => setForm({ ...form, cellName: e.target.value })} /></div>
          <div><label className="form-label">Coordinator Name</label><input className="input-field" placeholder="Name of coordinator" value={form.coordinatorName} onChange={(e) => setForm({ ...form, coordinatorName: e.target.value })} /></div>
          <div><label className="form-label">Meeting Date</label><input type="date" className="input-field" value={form.meetingDate} onChange={(e) => setForm({ ...form, meetingDate: e.target.value })} /></div>
          <div><label className="form-label">Your Reporting Time</label><input type="time" className="input-field" value={form.reportingTime} onChange={(e) => setForm({ ...form, reportingTime: e.target.value })} /></div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-4">Your Participation</h3>
        <label className="flex items-center gap-2 cursor-pointer mb-4">
          <input type="checkbox" className="w-4 h-4 accent-purple-600" checked={form.didAttend} onChange={(e) => setForm({ ...form, didAttend: e.target.checked })} />
          <span className="text-sm text-gray-700 dark:text-slate-300">I attended this cell meeting</span>
        </label>
        <div><label className="form-label">Role(s) Assigned</label><input className="input-field" placeholder="e.g. Lead and teach" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></div>
      </div>

      {[
        { field: "attendees", label: "Attendees", placeholder: "Name of attendee" },
        { field: "topicsTaught", label: "Topics Taught", placeholder: "Topic taught" },
        { field: "activities", label: "Cell Activities", placeholder: "Activity description" },
        { field: "newConverts", label: "New Converts Who Attended", placeholder: "Name of convert" },
      ].map(({ field, label, placeholder }) => (
        <div key={field} className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 dark:text-slate-100">{label}</h3>
            <button onClick={() => addItem(field)} className="btn-outline text-xs py-1.5 flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>
          </div>
          <div className="space-y-2">
            {form[field].map((val, i) => (
              <div key={i} className="flex gap-2">
                <input className="input-field flex-1" placeholder={placeholder} value={val} onChange={(e) => updateList(field, i, e.target.value)} />
                {form[field].length > 1 && <button onClick={() => removeItem(field, i)} className="text-red-400 hover:text-red-600 p-2"><Trash2 className="w-4 h-4" /></button>}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex flex-col sm:flex-row gap-3 justify-end pb-6">
        <button onClick={handleDraft} disabled={loading} className="btn-outline flex items-center justify-center gap-2"><Save className="w-4 h-4" />{loading ? "Saving..." : "Save Draft"}</button>
        <button onClick={handleFinalSubmit} disabled={loading || !portalOpen} className="btn-primary flex items-center justify-center gap-2"><Send className="w-4 h-4" />{portalOpen ? "Submit Report" : "Portal Closed"}</button>
      </div>
    </div>
  );
};

export default CellForm;