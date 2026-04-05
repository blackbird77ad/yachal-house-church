import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Send, CheckCircle } from "lucide-react";
import { useReports } from "../../hooks/useReports";
import { useToast, ToastContainer } from "../../components/common/Toast";

const listField = (label, value, onChange, placeholder) => (
  <div className="sm:col-span-2">
    <label className="form-label">{label}</label>
    <textarea className="input-field resize-none" rows={2} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

const ProductionForm = ({ weekType, portalOpen, lateWeekDate, isArrears, isEditMode }) => {
  const { handleSaveDraft, handleSubmit, fetchMyDraft, loading } = useReports();
  const { toasts, toast, removeToast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    meeting: "", meetingDate: "", reportingTime: "", prayer: "",
    songMinistration: "", media: "", ushering: "", frontDesk: "",
    serviceCoordination: "", briefWriting: "", security: "", sundaySchool: "",
    preServicePrayers: { thirtyToSixtyMins: "", tenToThirtyMins: "" },
    permissionsSought: "", observations: "", challenges: "", suggestions: "",
  });

  useEffect(() => {
    fetchMyDraft({ reportType: "production", weekType }).then(({ draft }) => {
      if (!draft) return;
      if (draft.status === "submitted") setSubmitted(true);
      if (draft.productionData) setForm({ ...form, ...draft.productionData, preServicePrayers: draft.productionData.preServicePrayers || form.preServicePrayers });
    }).catch(() => {});
  }, [weekType]);

  const buildPayload = () => ({
    isEdit: isEditMode || false, reportType: "production", weekType, productionData: { ...form } });

  const handleDraft = async () => {
    try { await handleSaveDraft(buildPayload()); toast.success("Draft saved", "Progress saved."); }
    catch { toast.error("Error", "Could not save draft."); }
  };

  const handleFinalSubmit = async () => {
    if (!portalOpen) { toast.warning("Portal closed", "Portal is not open yet."); return; }
    try { await handleSubmit(buildPayload()); setSubmitted(true); toast.success("Submitted", "Production report submitted."); }
    catch (err) { toast.error("Error", err.response?.data?.message || "Could not submit."); }
  };

  if (submitted) return (
    <div className="card p-12 text-center">
      <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
      <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">Report Submitted</h3>
      <button onClick={() => setSubmitted(false)} className="btn-outline mt-4">Edit Report</button>
    </div>
  );

  const f = (field) => ({ value: form[field], onChange: (v) => setForm({ ...form, [field]: v }) });

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="card p-6">
        <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-5">Service Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div><label className="form-label">Meeting/Service</label>
            <select className="input-field" value={form.meeting} onChange={(e) => setForm({ ...form, meeting: e.target.value })}>
              <option value="">Select</option>
              <option>Tuesday Service</option>
              <option>Sunday Service</option>
              <option>Special Service</option>
            </select>
          </div>
          <div><label className="form-label">Date</label><input type="date" className="input-field" value={form.meetingDate} onChange={(e) => setForm({ ...form, meetingDate: e.target.value })} /></div>
          <div><label className="form-label">Reporting Time</label><input type="time" className="input-field" value={form.reportingTime} onChange={(e) => setForm({ ...form, reportingTime: e.target.value })} /></div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-5">Department Assignments</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: "Prayer", field: "prayer", placeholder: "Name and time e.g. Ps Oscar 4:00pm" },
            { label: "Song Ministration", field: "songMinistration", placeholder: "Name, role and time" },
            { label: "Media", field: "media", placeholder: "Name and time" },
            { label: "Ushering", field: "ushering", placeholder: "Names and times" },
            { label: "Front Desk", field: "frontDesk", placeholder: "Names and times" },
            { label: "Service Coordination", field: "serviceCoordination", placeholder: "Name and time" },
            { label: "Brief Writing", field: "briefWriting", placeholder: "Name and time" },
            { label: "Security", field: "security", placeholder: "Names and times" },
            { label: "Sunday School", field: "sundaySchool", placeholder: "Names and times" },
          ].map(({ label, field, placeholder }) => (
            <div key={field}>
              <label className="form-label">{label}</label>
              <textarea className="input-field resize-none" rows={2} placeholder={placeholder} value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} />
            </div>
          ))}
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h3 className="font-bold text-gray-900 dark:text-slate-100">Pre-Service Prayers</h3>
        <div><label className="form-label">31 mins to 1 hour before service</label><textarea className="input-field resize-none" rows={2} placeholder="Names of workers present" value={form.preServicePrayers.thirtyToSixtyMins} onChange={(e) => setForm({ ...form, preServicePrayers: { ...form.preServicePrayers, thirtyToSixtyMins: e.target.value } })} /></div>
        <div><label className="form-label">10 mins to 30 mins before service</label><textarea className="input-field resize-none" rows={2} placeholder="Names of workers present" value={form.preServicePrayers.tenToThirtyMins} onChange={(e) => setForm({ ...form, preServicePrayers: { ...form.preServicePrayers, tenToThirtyMins: e.target.value } })} /></div>
      </div>

      <div className="card p-6 space-y-4">
        <h3 className="font-bold text-gray-900 dark:text-slate-100">Permissions and Observations</h3>
        <div><label className="form-label">Permissions Sought</label><textarea className="input-field resize-none" rows={2} placeholder="Names and times of permissions" value={form.permissionsSought} onChange={(e) => setForm({ ...form, permissionsSought: e.target.value })} /></div>
        <div><label className="form-label">Observations and Comments</label><textarea className="input-field resize-none" rows={3} placeholder="General service observations..." value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} /></div>
        <div><label className="form-label">Challenges</label><textarea className="input-field resize-none" rows={2} placeholder="Any challenges encountered..." value={form.challenges} onChange={(e) => setForm({ ...form, challenges: e.target.value })} /></div>
        <div><label className="form-label">Suggestions</label><textarea className="input-field resize-none" rows={2} placeholder="Suggestions for improvement..." value={form.suggestions} onChange={(e) => setForm({ ...form, suggestions: e.target.value })} /></div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-end pb-6">
        <button onClick={handleDraft} disabled={loading} className="btn-outline flex items-center justify-center gap-2"><Save className="w-4 h-4" />{loading ? "Saving..." : "Save Draft"}</button>
        <button onClick={handleFinalSubmit} disabled={loading || !portalOpen} className="btn-primary flex items-center justify-center gap-2"><Send className="w-4 h-4" />{portalOpen ? "Submit Report" : "Portal Closed"}</button>
      </div>
    </div>
  );
};

export default ProductionForm;