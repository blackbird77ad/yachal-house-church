import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Send, CheckCircle } from "lucide-react";
import { useReports } from "../../hooks/useReports";
import { useToast, ToastContainer } from "../../components/common/Toast";

const FellowshipForm = ({ weekType, portalOpen, weekDate, isArrears, isEditMode, existingReportId }) => {
  const { handleSaveDraft, handleSubmit, handleEdit, fetchMyDraft, loading } = useReports();
  const { toasts, toast, removeToast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ fellowship: "", meetingDate: "", timeStarted: "", timeEnded: "", duration: "", prayerLedBy: "", participants: [""], comments: "" });

  useEffect(() => {
    fetchMyDraft({ reportType: "fellowship-prayer", weekType, weekDate }).then(({ draft }) => {
      if (!draft) return;
      if (draft.status === "submitted") setSubmitted(true);
      if (draft.fellowshipPrayerData) setForm({ ...form, ...draft.fellowshipPrayerData, participants: draft.fellowshipPrayerData.participants?.length ? draft.fellowshipPrayerData.participants : [""] });
    }).catch(() => {});
  }, [weekType]);

  const buildPayload = () => ({
    isEdit: isEditMode || false, reportType: "fellowship-prayer", weekType, fellowshipPrayerData: { ...form, duration: Number(form.duration) } });

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
      setSubmitted(true); toast.success(isEditMode ? "Updated" : "Submitted", "Fellowship prayer report submitted."); }
    catch (err) { toast.error("Error", err.response?.data?.message || "Could not submit."); }
  };

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
        <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-5">Fellowship Prayer Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="form-label">Fellowship Name</label><input className="input-field" placeholder="Name of fellowship" value={form.fellowship} onChange={(e) => setForm({ ...form, fellowship: e.target.value })} /></div>
          <div><label className="form-label">Meeting Date</label><input type="date" className="input-field" value={form.meetingDate} onChange={(e) => setForm({ ...form, meetingDate: e.target.value })} /></div>
          <div><label className="form-label">Time Prayer Began</label><input type="time" className="input-field" value={form.timeStarted} onChange={(e) => setForm({ ...form, timeStarted: e.target.value })} /></div>
          <div><label className="form-label">Time Prayer Ended</label><input type="time" className="input-field" value={form.timeEnded} onChange={(e) => setForm({ ...form, timeEnded: e.target.value })} /></div>
          <div><label className="form-label">Duration (hours)</label><input type="number" min="0" step="0.5" className="input-field" placeholder="e.g. 2" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></div>
          <div><label className="form-label">Prayer Led By</label><input className="input-field" placeholder="Name of coordinator/leader" value={form.prayerLedBy} onChange={(e) => setForm({ ...form, prayerLedBy: e.target.value })} /></div>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 dark:text-slate-100">Participants</h3>
          <button onClick={() => setForm({ ...form, participants: [...form.participants, ""] })} className="btn-outline text-xs py-1.5 flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>
        </div>
        <div className="space-y-2">
          {form.participants.map((p, i) => (
            <div key={i} className="flex gap-2">
              <input className="input-field flex-1" placeholder="Participant name" value={p} onChange={(e) => setForm({ ...form, participants: form.participants.map((v, idx) => idx === i ? e.target.value : v) })} />
              {form.participants.length > 1 && <button onClick={() => setForm({ ...form, participants: form.participants.filter((_, idx) => idx !== i) })} className="text-red-400 hover:text-red-600 p-2"><Trash2 className="w-4 h-4" /></button>}
            </div>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-4">Comments</h3>
        <textarea className="input-field resize-none" rows={4} placeholder="Any additional comments or observations..." value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-end pb-6">
        <button onClick={handleDraft} disabled={loading} className="btn-outline flex items-center justify-center gap-2"><Save className="w-4 h-4" />{loading ? "Saving..." : "Save Draft"}</button>
        <button onClick={handleFinalSubmit} disabled={loading || !portalOpen} className="btn-primary flex items-center justify-center gap-2"><Send className="w-4 h-4" />{portalOpen ? "Submit Report" : "Portal Closed"}</button>
      </div>
    </div>
  );
};

export default FellowshipForm;