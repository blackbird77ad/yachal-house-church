import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Save, X } from "lucide-react";
import { getAllReportTypes, createReportType, updateReportType, deleteReportType } from "../../services/reportTypeService";
import { useToast, ToastContainer } from "../../components/common/Toast";
import Loader from "../../components/common/Loader";
import Pagination from "../../components/common/Pagination";
import Modal from "../../components/common/Modal";

const FIELD_TYPES = ["text", "textarea", "number", "date", "time", "select", "checkbox", "radio"];

const emptyField = { label: "", fieldName: "", fieldType: "text", required: false, placeholder: "", options: [] };

const ReportTypes = () => {
  const { toasts, toast, removeToast } = useToast();
  const [types, setTypes] = useState([]);
  const [page, setPage] = useState(1);
  const PER_PAGE = 15;
  const paginatedTypes = types.slice((page-1)*PER_PAGE, page*PER_PAGE);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", fields: [{ ...emptyField }] });
  const [saving, setSaving] = useState(false);

  const fetchTypes = async () => {
    try { const { reportTypes } = await getAllReportTypes(); setTypes(reportTypes); }
    catch { toast.error("Error", "Could not load report types."); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTypes(); }, []);

  const openCreate = () => { setEditing(null); setForm({ name: "", description: "", fields: [{ ...emptyField }] }); setModalOpen(true); };
  const openEdit = (type) => { setEditing(type); setForm({ name: type.name, description: type.description || "", fields: type.fields?.length ? type.fields : [{ ...emptyField }] }); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.warning("Required", "Report type name is required."); return; }
    setSaving(true);
    try {
      if (editing) { await updateReportType(editing._id, form); toast.success("Updated", "Report type updated."); }
      else { await createReportType(form); toast.success("Created", "New report type created."); }
      setModalOpen(false);
      fetchTypes();
    } catch (err) {
      toast.error("Error", err.response?.data?.message || "Could not save.");
    } finally { setSaving(false); }
  };

  const handleToggle = async (type) => {
    try { await updateReportType(type._id, { isActive: !type.isActive }); fetchTypes(); }
    catch { toast.error("Error", "Could not update."); }
  };

  const handleDelete = async (typeId) => {
    if (!confirm("Delete this report type?")) return;
    try { await deleteReportType(typeId); toast.success("Deleted", "Report type removed."); fetchTypes(); }
    catch { toast.error("Error", "Could not delete."); }
  };

  const addField = () => setForm({ ...form, fields: [...form.fields, { ...emptyField }] });
  const removeField = (i) => setForm({ ...form, fields: form.fields.filter((_, idx) => idx !== i) });
  const updateField = (i, key, val) => setForm({ ...form, fields: form.fields.map((f, idx) => idx === i ? { ...f, [key]: val, fieldName: key === "label" ? val.toLowerCase().replace(/\s+/g, "_") : f.fieldName } : f) });

  if (loading) return <Loader text="Loading report types..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Report Types</h1>
          <p className="section-subtitle">Manage custom report types and their fields</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />New Type</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {types.map((type) => (
          <div key={type._id} className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-slate-100">{type.name}</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{type.fields?.length || 0} fields</p>
              </div>
              <button onClick={() => handleToggle(type)} className={`flex-shrink-0 ${type.isActive ? "text-green-600 dark:text-green-400" : "text-gray-400"}`}>
                {type.isActive ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
              </button>
            </div>
            {type.description && <p className="text-xs text-gray-400 dark:text-slate-500 mb-4 leading-relaxed">{type.description}</p>}
            <div className="flex gap-2">
              <button onClick={() => openEdit(type)} className="btn-ghost text-xs py-1.5 flex items-center gap-1"><Edit2 className="w-3 h-3" />Edit</button>
              <button onClick={() => handleDelete(type._id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs py-1.5 px-2 rounded-lg transition-colors flex items-center gap-1"><Trash2 className="w-3 h-3" />Delete</button>
            </div>
          </div>
        ))}
        {types.length === 0 && <div className="sm:col-span-3 card p-12 text-center text-gray-400 dark:text-slate-500">No custom report types yet. Create your first one.</div>}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Report Type" : "New Report Type"} size="2xl">
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="form-label">Name</label><input className="input-field" placeholder="e.g. Outreach Report" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="form-label">Description (optional)</label><input className="input-field" placeholder="Brief description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-900 dark:text-slate-100 text-sm">Fields</h4>
              <button onClick={addField} className="btn-outline text-xs py-1.5 flex items-center gap-1"><Plus className="w-3 h-3" />Add Field</button>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {form.fields.map((field, i) => (
                <div key={i} className="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-2 relative">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div><label className="form-label text-xs">Label</label><input className="input-field text-sm" placeholder="Field label" value={field.label} onChange={(e) => updateField(i, "label", e.target.value)} /></div>
                    <div><label className="form-label text-xs">Field Name</label><input className="input-field text-sm" placeholder="field_name" value={field.fieldName} onChange={(e) => updateField(i, "fieldName", e.target.value)} /></div>
                    <div><label className="form-label text-xs">Type</label>
                      <select className="input-field text-sm" value={field.fieldType} onChange={(e) => updateField(i, "fieldType", e.target.value)}>
                        {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700 dark:text-slate-300">
                      <input type="checkbox" className="w-3.5 h-3.5 accent-purple-600" checked={field.required} onChange={(e) => updateField(i, "required", e.target.checked)} />Required
                    </label>
                    <input className="input-field text-xs flex-1" placeholder="Placeholder text" value={field.placeholder} onChange={(e) => updateField(i, "placeholder", e.target.value)} />
                  </div>
                  {form.fields.length > 1 && <button onClick={() => removeField(i)} className="absolute top-2 right-2 text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>}
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-slate-700">
            <button onClick={() => setModalOpen(false)} className="btn-ghost">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2"><Save className="w-4 h-4" />{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </Modal>
      <div className="px-4 pb-2">
        <Pagination page={page} totalPages={Math.ceil(types.length/PER_PAGE)} totalItems={types.length} perPage={PER_PAGE} label="report types" onPage={setPage} />
      </div>
    </div>
  );
};

export default ReportTypes;