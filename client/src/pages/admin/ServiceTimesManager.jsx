import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Save, X, Clock } from "lucide-react";
import axiosInstance from "../../utils/axiosInstance";
import { useToast, ToastContainer } from "../../components/common/Toast";
import Modal from "../../components/common/Modal";

const ServiceTimesManager = () => {
  const { toasts, toast, removeToast } = useToast();
  const [times, setTimes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ serviceType: "sunday", label: "", day: "", time: "", description: "", isActive: true });

  const fetch = async () => {
    try { const { data } = await axiosInstance.get("/service-times"); setTimes(data.times || []); }
    catch { toast.error("Error", "Could not load service times."); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const openCreate = () => { setEditing(null); setForm({ serviceType: "sunday", label: "Sunday Service", day: "Sunday", time: "8:30 AM", description: "", isActive: true }); setShowModal(true); };
  const openEdit = (t) => { setEditing(t); setForm({ serviceType: t.serviceType, label: t.label, day: t.day, time: t.time, description: t.description || "", isActive: t.isActive }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.label || !form.day || !form.time) { toast.warning("Required", "Label, day and time are required."); return; }
    setSaving(true);
    try {
      if (editing) { await axiosInstance.put(`/service-times/${editing._id}`, form); toast.success("Updated", "Service time updated."); }
      else { await axiosInstance.post("/service-times", form); toast.success("Created", "Service time created."); }
      setShowModal(false);
      fetch();
    } catch { toast.error("Error", "Could not save."); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Remove this service time?")) return;
    try { await axiosInstance.delete(`/service-times/${id}`); toast.success("Removed", "Service time removed."); fetch(); }
    catch { toast.error("Error", "Could not remove."); }
  };

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-900 dark:text-slate-100">Service Times</h2>
          <p className="text-xs text-gray-400 dark:text-slate-500">Manage times shown on the public website</p>
        </div>
        <button onClick={openCreate} className="btn-primary text-sm flex items-center gap-2"><Plus className="w-4 h-4" />Add Time</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : times.length === 0 ? (
        <div className="card p-10 text-center text-gray-400 dark:text-slate-500 text-sm">No service times yet. Add one above.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {times.map((t) => (
            <div key={t._id} className={`card p-5 ${!t.isActive ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                  <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(t)} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(t._id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-1">{t.label}</p>
              <p className="font-bold text-gray-900 dark:text-slate-100 text-lg">{t.day}</p>
              <p className="text-purple-700 dark:text-purple-400 font-semibold">{t.time}</p>
              {t.description && <p className="text-xs text-gray-400 dark:text-slate-500 mt-2 leading-relaxed">{t.description}</p>}
              {!t.isActive && <span className="badge-warning text-xs mt-2 inline-block">Inactive</span>}
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit Service Time" : "Add Service Time"}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="form-label">Type</label>
              <select className="input-field" value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value })}>
                <option value="tuesday">Tuesday</option>
                <option value="sunday">Sunday</option>
                <option value="special">Special</option>
              </select>
            </div>
            <div><label className="form-label">Day</label><input className="input-field" placeholder="e.g. Tuesday" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} /></div>
            <div><label className="form-label">Label</label><input className="input-field" placeholder="e.g. Midweek Service" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></div>
            <div><label className="form-label">Time</label><input className="input-field" placeholder="e.g. 5:30 PM" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
          </div>
          <div><label className="form-label">Description (optional)</label><textarea className="input-field resize-none" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-purple-600" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            <span className="text-sm text-gray-700 dark:text-slate-300">Active (visible on public website)</span>
          </label>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-slate-700">
            <button onClick={() => setShowModal(false)} className="btn-ghost">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2"><Save className="w-4 h-4" />{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ServiceTimesManager;