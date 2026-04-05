import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Send, CheckCircle } from "lucide-react";
import { useReports } from "../../hooks/useReports";
import { useToast, ToastContainer } from "../../components/common/Toast";

const DepartmentalForm = ({ weekType, portalOpen, weekDate, isArrears, isEditMode, existingReportId }) => {
  const { handleSaveDraft, handleSubmit, handleEdit, fetchMyDraft, loading } = useReports();
  const { toasts, toast, removeToast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    department: "", service: "", activities: "", comments: "",
    attendees: [{ name: "", time: "" }],
    lateness: [{ name: "", time: "" }],
    absentees: [{ name: "", time: "" }],
    teamAssignments: [{ name: "", assignment: "" }],
    convertsToChurch: [{ name: "", count: "" }],
    convertsToCell: [{ name: "", count: "" }],
    qualifyingWorkers: [""],
  });

  useEffect(() => {
    fetchMyDraft({ reportType: "departmental", weekType, weekDate }).then(({ draft }) => {
      if (!draft) return;
      if (draft.status === "submitted") setSubmitted(true);
      if (draft.departmentalData) setForm({ ...form, ...draft.departmentalData });
    }).catch(() => {});
  }, [weekType]);

  const buildPayload = () => ({
    isEdit: isEditMode || false, reportType: "departmental", weekType, departmentalData: { ...form } });

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
      setSubmitted(true); toast.success(isEditMode ? "Updated" : "Submitted", "Departmental report submitted."); }
    catch (err) { toast.error("Error", err.response?.data?.message || "Could not submit."); }
  };

  const updateRow = (field, i, key, val) => setForm({ ...form, [field]: form[field].map((r, idx) => idx === i ? { ...r, [key]: val } : r) });
  const addRow = (field, empty) => setForm({ ...form, [field]: [...form[field], { ...empty }] });
  const removeRow = (field, i) => setForm({ ...form, [field]: form[field].filter((_, idx) => idx !== i) });

  if (submitted) return (
    <div className="card p-12 text-center">
      <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
      <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">Report Submitted</h3>
      <button onClick={() => setSubmitted(false)} className="btn-outline mt-4">Edit Report</button>
    </div>
  );

  const pairRows = (field, key1, key2, label1, label2, empty) => (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900 dark:text-slate-100 capitalize">{field.replace(/([A-Z])/g, " $1")}</h3>
        <button onClick={() => addRow(field, empty)} className="btn-outline text-xs py-1.5 flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>
      </div>
      <div className="space-y-2">
        {form[field].map((row, i) => (
          <div key={i} className="flex gap-2">
            <input className="input-field flex-1" placeholder={label1} value={row[key1]} onChange={(e) => updateRow(field, i, key1, e.target.value)} />
            <input className="input-field flex-1" placeholder={label2} value={row[key2]} onChange={(e) => updateRow(field, i, key2, e.target.value)} />
            {form[field].length > 1 && <button onClick={() => removeRow(field, i)} className="text-red-400 hover:text-red-600 p-2"><Trash2 className="w-4 h-4" /></button>}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="card p-6">
        <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-5">Department Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="form-label">Department</label><input className="input-field" placeholder="Your department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
          <div><label className="form-label">Service/Meeting</label>
            <select className="input-field" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })}>
              <option value="">Select</option>
              <option>Tuesday Service</option>
              <option>Sunday Service</option>
              <option>Special Service</option>
            </select>
          </div>
        </div>
      </div>

      {pairRows("attendees", "name", "time", "Worker name", "Time of arrival", { name: "", time: "" })}
      {pairRows("lateness", "name", "time", "Worker name", "Time permission sought", { name: "", time: "" })}
      {pairRows("absentees", "name", "time", "Worker name", "Time permission sought", { name: "", time: "" })}
      {pairRows("teamAssignments", "name", "assignment", "Worker name", "Assignment", { name: "", assignment: "" })}
      {pairRows("convertsToChurch", "name", "count", "Worker name", "Number of converts", { name: "", count: "" })}
      {pairRows("convertsToCell", "name", "count", "Worker name", "Number brought to cell", { name: "", count: "" })}

      <div className="card p-6 space-y-4">
        <h3 className="font-bold text-gray-900 dark:text-slate-100">Activity Report</h3>
        <div><label className="form-label">Activities and Observations</label><textarea className="input-field resize-none" rows={4} placeholder="Details of activities, observations etc." value={form.activities} onChange={(e) => setForm({ ...form, activities: e.target.value })} /></div>
        <div><label className="form-label">Comments</label><textarea className="input-field resize-none" rows={3} placeholder="Any additional comments..." value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} /></div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 dark:text-slate-100">Workers Qualifying to Work</h3>
          <button onClick={() => setForm({ ...form, qualifyingWorkers: [...form.qualifyingWorkers, ""] })} className="btn-outline text-xs py-1.5 flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>
        </div>
        <div className="space-y-2">
          {form.qualifyingWorkers.map((w, i) => (
            <div key={i} className="flex gap-2">
              <input className="input-field flex-1" placeholder="Worker name" value={w} onChange={(e) => setForm({ ...form, qualifyingWorkers: form.qualifyingWorkers.map((v, idx) => idx === i ? e.target.value : v) })} />
              {form.qualifyingWorkers.length > 1 && <button onClick={() => setForm({ ...form, qualifyingWorkers: form.qualifyingWorkers.filter((_, idx) => idx !== i) })} className="text-red-400 hover:text-red-600 p-2"><Trash2 className="w-4 h-4" /></button>}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-end pb-6">
        <button onClick={handleDraft} disabled={loading} className="btn-outline flex items-center justify-center gap-2"><Save className="w-4 h-4" />{loading ? "Saving..." : "Save Draft"}</button>
        <button onClick={handleFinalSubmit} disabled={loading || !portalOpen} className="btn-primary flex items-center justify-center gap-2"><Send className="w-4 h-4" />{portalOpen ? "Submit Report" : "Portal Closed"}</button>
      </div>
    </div>
  );
};

export default DepartmentalForm;