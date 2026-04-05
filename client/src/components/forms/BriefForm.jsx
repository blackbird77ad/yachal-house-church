import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Send, CheckCircle } from "lucide-react";
import { useReports } from "../../hooks/useReports";
import { useToast, ToastContainer } from "../../components/common/Toast";

const BriefForm = ({ weekType, portalOpen, lateWeekDate, isArrears, isEditMode }) => {
  const { handleSaveDraft, handleSubmit, fetchMyDraft, loading } = useReports();
  const { toasts, toast, removeToast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    meeting: "", meetingDate: "",
    workerHourBefore: [""], workerThirtyMins: [""], workerAfterService: [""],
    preServicePrayers: { thirtyToSixtyMins: [""], tenToThirtyMins: [""] },
    observationsBefore: "", observationsDuring: "", comments: "",
  });

  useEffect(() => {
    fetchMyDraft({ reportType: "brief", weekType }).then(({ draft }) => {
      if (!draft) return;
      if (draft.status === "submitted") setSubmitted(true);
      if (draft.briefData) setForm({ ...form, ...draft.briefData });
    }).catch(() => {});
  }, [weekType]);

  const buildPayload = () => ({
    isEdit: isEditMode || false, reportType: "brief", weekType, briefData: { ...form } });

  const handleDraft = async () => {
    try { await handleSaveDraft(buildPayload()); toast.success("Draft saved", "Progress saved."); }
    catch { toast.error("Error", "Could not save draft."); }
  };

  const handleFinalSubmit = async () => {
    if (!portalOpen) { toast.warning("Portal closed", "Portal is not open yet."); return; }
    try { await handleSubmit(buildPayload()); setSubmitted(true); toast.success("Submitted", "Brief report submitted."); }
    catch (err) { toast.error("Error", err.response?.data?.message || "Could not submit."); }
  };

  const addToList = (field) => setForm({ ...form, [field]: [...form[field], ""] });
  const updateList = (field, i, val) => setForm({ ...form, [field]: form[field].map((v, idx) => idx === i ? val : v) });
  const removeFromList = (field, i) => setForm({ ...form, [field]: form[field].filter((_, idx) => idx !== i) });
  const addToPreService = (sub) => setForm({ ...form, preServicePrayers: { ...form.preServicePrayers, [sub]: [...form.preServicePrayers[sub], ""] } });
  const updatePreService = (sub, i, val) => setForm({ ...form, preServicePrayers: { ...form.preServicePrayers, [sub]: form.preServicePrayers[sub].map((v, idx) => idx === i ? val : v) } });
  const removePreService = (sub, i) => setForm({ ...form, preServicePrayers: { ...form.preServicePrayers, [sub]: form.preServicePrayers[sub].filter((_, idx) => idx !== i) } });

  if (submitted) return (
    <div className="card p-12 text-center">
      <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
      <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">Report Submitted</h3>
      <button onClick={() => setSubmitted(false)} className="btn-outline mt-4">Edit Report</button>
    </div>
  );

  const listSection = (field, label, placeholder) => (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-800 dark:text-slate-200 text-sm">{label}</h4>
        <button onClick={() => addToList(field)} className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>
      </div>
      <div className="space-y-2">
        {form[field].map((val, i) => (
          <div key={i} className="flex gap-2">
            <input className="input-field flex-1 text-sm" placeholder={placeholder} value={val} onChange={(e) => updateList(field, i, e.target.value)} />
            {form[field].length > 1 && <button onClick={() => removeFromList(field, i)} className="text-red-400 hover:text-red-600 p-2"><Trash2 className="w-3 h-3" /></button>}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <div className="card p-6">
        <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-5">Service Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="form-label">Meeting/Service</label>
            <select className="input-field" value={form.meeting} onChange={(e) => setForm({ ...form, meeting: e.target.value })}>
              <option value="">Select service</option>
              <option value="Tuesday Service">Tuesday Service</option>
              <option value="Sunday Service">Sunday Service</option>
              <option value="Special Service">Special Service</option>
            </select>
          </div>
          <div><label className="form-label">Date</label><input type="date" className="input-field" value={form.meetingDate} onChange={(e) => setForm({ ...form, meetingDate: e.target.value })} /></div>
        </div>
      </div>

      <div className="card p-6 space-y-6">
        <h3 className="font-bold text-gray-900 dark:text-slate-100">Worker Arrival Times</h3>
        {listSection("workerHourBefore", "Workers who reported 1hr or more before service", "Name and time e.g. Sis Agnes 7:00am")}
        {listSection("workerThirtyMins", "Workers who reported 30 mins before service", "Name and time e.g. Bro Prah 7:22am")}
        {listSection("workerAfterService", "Workers who reported after service commenced", "Name and time e.g. Bro Josiah 8:08am")}
      </div>

      <div className="card p-6 space-y-5">
        <h3 className="font-bold text-gray-900 dark:text-slate-100">Pre-Service Prayers</h3>
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-800 dark:text-slate-200 text-sm">31 mins to 1 hour before service</h4>
            <button onClick={() => addToPreService("thirtyToSixtyMins")} className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>
          </div>
          <div className="space-y-2">
            {form.preServicePrayers.thirtyToSixtyMins.map((val, i) => (
              <div key={i} className="flex gap-2">
                <input className="input-field flex-1 text-sm" placeholder="Name of worker" value={val} onChange={(e) => updatePreService("thirtyToSixtyMins", i, e.target.value)} />
                {form.preServicePrayers.thirtyToSixtyMins.length > 1 && <button onClick={() => removePreService("thirtyToSixtyMins", i)} className="text-red-400 hover:text-red-600 p-2"><Trash2 className="w-3 h-3" /></button>}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-800 dark:text-slate-200 text-sm">10 mins to 30 mins before service</h4>
            <button onClick={() => addToPreService("tenToThirtyMins")} className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>
          </div>
          <div className="space-y-2">
            {form.preServicePrayers.tenToThirtyMins.map((val, i) => (
              <div key={i} className="flex gap-2">
                <input className="input-field flex-1 text-sm" placeholder="Name of worker" value={val} onChange={(e) => updatePreService("tenToThirtyMins", i, e.target.value)} />
                {form.preServicePrayers.tenToThirtyMins.length > 1 && <button onClick={() => removePreService("tenToThirtyMins", i)} className="text-red-400 hover:text-red-600 p-2"><Trash2 className="w-3 h-3" /></button>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h3 className="font-bold text-gray-900 dark:text-slate-100">Observations</h3>
        <div><label className="form-label">Before Service</label><textarea className="input-field resize-none" rows={3} placeholder="Observations before service commenced..." value={form.observationsBefore} onChange={(e) => setForm({ ...form, observationsBefore: e.target.value })} /></div>
        <div><label className="form-label">During and After Service</label><textarea className="input-field resize-none" rows={3} placeholder="Observations during and after service..." value={form.observationsDuring} onChange={(e) => setForm({ ...form, observationsDuring: e.target.value })} /></div>
        <div><label className="form-label">Comments</label><textarea className="input-field resize-none" rows={3} placeholder="Any additional comments..." value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} /></div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-end pb-6">
        <button onClick={handleDraft} disabled={loading} className="btn-outline flex items-center justify-center gap-2"><Save className="w-4 h-4" />{loading ? "Saving..." : "Save Draft"}</button>
        <button onClick={handleFinalSubmit} disabled={loading || !portalOpen} className="btn-primary flex items-center justify-center gap-2"><Send className="w-4 h-4" />{portalOpen ? "Submit Report" : "Portal Closed"}</button>
      </div>
    </div>
  );
};

export default BriefForm;