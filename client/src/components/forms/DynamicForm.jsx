import { useState } from "react";
import { Save, Send } from "lucide-react";
import { useReports } from "../../hooks/useReports";
import { useToast, ToastContainer } from "../../components/common/Toast";

const DynamicForm = ({ reportType, fields = [], weekType, portalOpen }) => {
  const { handleSaveDraft, handleSubmit, loading } = useReports();
  const { toasts, toast, removeToast } = useToast();
  const [formData, setFormData] = useState({});

  const updateField = (name, value) => setFormData({ ...formData, [name]: value });

  const buildPayload = () => ({
    reportType: "custom",
    weekType,
    customReportType: reportType?._id,
    customData: formData,
  });

  const handleDraft = async () => {
    try { await handleSaveDraft(buildPayload()); toast.success("Draft saved", "Progress saved."); }
    catch { toast.error("Error", "Could not save draft."); }
  };

  const handleFinalSubmit = async () => {
    if (!portalOpen) { toast.warning("Portal closed", "Portal is not open yet."); return; }
    try { await handleSubmit(buildPayload()); toast.success("Submitted", "Report submitted successfully."); }
    catch (err) { toast.error("Error", err.response?.data?.message || "Could not submit."); }
  };

  const renderField = (field) => {
    const common = { className: "input-field", value: formData[field.fieldName] || "", onChange: (e) => updateField(field.fieldName, e.target.value), placeholder: field.placeholder || "", required: field.required };
    switch (field.fieldType) {
      case "textarea": return <textarea {...common} className="input-field resize-none" rows={4} />;
      case "select": return <select {...common}><option value="">Select</option>{field.options?.map((o) => <option key={o} value={o}>{o}</option>)}</select>;
      case "checkbox": return <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-purple-600" checked={!!formData[field.fieldName]} onChange={(e) => updateField(field.fieldName, e.target.checked)} /><span className="text-sm text-gray-700 dark:text-slate-300">{field.label}</span></label>;
      case "number": return <input type="number" {...common} />;
      case "date": return <input type="date" {...common} />;
      case "time": return <input type="time" {...common} />;
      default: return <input type="text" {...common} />;
    }
  };

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <div className="card p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {fields.sort((a, b) => a.order - b.order).map((field) => (
            <div key={field.fieldName} className={field.fieldType === "textarea" ? "sm:col-span-2" : ""}>
              {field.fieldType !== "checkbox" && <label className="form-label">{field.label}{field.required && <span className="text-red-500 ml-1">*</span>}</label>}
              {renderField(field)}
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

export default DynamicForm;