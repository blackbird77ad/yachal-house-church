import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Send, CheckCircle } from "lucide-react";
import { useReports } from "../../hooks/useReports";
import { useToast, ToastContainer } from "../../components/common/Toast";

const BriefForm = ({ weekType, portalOpen, lateWeekDate, isArrears, isEditMode }) => {
  const { handleSaveDraft, handleSubmit, fetchMyDraft, loading } = useReports();
  const { toasts, toast, removeToast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    meeting: "",
    meetingDate: "",
    workerHourBefore: [""],
    workerThirtyMins: [""],
    workerAfterService: [""],
    workerAbsent: [""],
    preServicePrayers: {
      thirtyToSixtyMins: [""],
      tenToThirtyMins: [""],
      notSeenPraying: [""],
    },
    observationsBefore: "",
    observationsDuring: "",
    comments: "",
  });

  useEffect(() => {
    fetchMyDraft({ reportType: "brief", weekType })
      .then(({ draft }) => {
        if (!draft) return;
        if (draft.status === "submitted") setSubmitted(true);
        if (draft.briefData) {
          setForm((prev) => ({
            ...prev,
            ...draft.briefData,
            preServicePrayers: {
              ...prev.preServicePrayers,
              ...(draft.briefData.preServicePrayers || {}),
            },
          }));
        }
      })
      .catch(() => {});
  }, [weekType, fetchMyDraft]);

  const buildPayload = () => ({
    isEdit: isEditMode || false,
    reportType: "brief",
    weekType,
    briefData: { ...form },
  });

  const handleDraft = async () => {
    try {
      await handleSaveDraft(buildPayload());
      toast.success("Draft saved", "Your progress has been saved.");
    } catch {
      toast.error("Error", "Could not save draft.");
    }
  };

  const handleFinalSubmit = async () => {
    if (!portalOpen) {
      toast.warning("Portal closed", "The portal is not open yet.");
      return;
    }

    try {
      await handleSubmit(buildPayload());
      setSubmitted(true);
      toast.success("Submitted", "Your brief report has been submitted.");
    } catch (err) {
      toast.error("Error", err.response?.data?.message || "Could not submit.");
    }
  };

  const addToList = (field) =>
    setForm((prev) => ({
      ...prev,
      [field]: [...prev[field], ""],
    }));

  const updateList = (field, i, val) =>
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].map((v, idx) => (idx === i ? val : v)),
    }));

  const removeFromList = (field, i) =>
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, idx) => idx !== i),
    }));

  const addToPreService = (sub) =>
    setForm((prev) => ({
      ...prev,
      preServicePrayers: {
        ...prev.preServicePrayers,
        [sub]: [...prev.preServicePrayers[sub], ""],
      },
    }));

  const updatePreService = (sub, i, val) =>
    setForm((prev) => ({
      ...prev,
      preServicePrayers: {
        ...prev.preServicePrayers,
        [sub]: prev.preServicePrayers[sub].map((v, idx) => (idx === i ? val : v)),
      },
    }));

  const removePreService = (sub, i) =>
    setForm((prev) => ({
      ...prev,
      preServicePrayers: {
        ...prev.preServicePrayers,
        [sub]: prev.preServicePrayers[sub].filter((_, idx) => idx !== i),
      },
    }));

  if (submitted)
    return (
      <div className="card p-12 text-center">
        <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
          Report Submitted
        </h3>
        <button onClick={() => setSubmitted(false)} className="btn-outline mt-4">
          Edit Report
        </button>
      </div>
    );

  const listSection = (field, label, placeholder) => (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-800 dark:text-slate-200 text-sm">
          {label}
        </h4>
        <button
          type="button"
          onClick={() => addToList(field)}
          className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>
      <div className="space-y-2">
        {form[field].map((val, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="input-field flex-1 text-sm"
              placeholder={placeholder}
              value={val}
              onChange={(e) => updateList(field, i, e.target.value)}
            />
            {form[field].length > 1 && (
              <button
                type="button"
                onClick={() => removeFromList(field, i)}
                className="text-red-400 hover:text-red-600 p-2"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const preServiceSection = (field, label) => (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-800 dark:text-slate-200 text-sm">
          {label}
        </h4>
        <button
          type="button"
          onClick={() => addToPreService(field)}
          className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>
      <div className="space-y-2">
        {form.preServicePrayers[field].map((val, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="input-field flex-1 text-sm"
              placeholder="Worker’s name"
              value={val}
              onChange={(e) => updatePreService(field, i, e.target.value)}
            />
            {form.preServicePrayers[field].length > 1 && (
              <button
                type="button"
                onClick={() => removePreService(field, i)}
                className="text-red-400 hover:text-red-600 p-2"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="card p-6">
        <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-5">
          Service Details
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Meeting/Service</label>
            <select
              className="input-field"
              value={form.meeting}
              onChange={(e) => setForm({ ...form, meeting: e.target.value })}
            >
              <option value="">Select service</option>
              <option value="Tuesday Service">Tuesday Service</option>
              <option value="Sunday Service">Sunday Service</option>
              <option value="Special Service">Special Service</option>
            </select>
          </div>

          <div>
            <label className="form-label">Date</label>
            <input
              type="date"
              className="input-field"
              value={form.meetingDate}
              onChange={(e) => setForm({ ...form, meetingDate: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-6">
        <h3 className="font-bold text-gray-900 dark:text-slate-100">
          Worker Arrival Times
        </h3>

        {listSection(
          "workerHourBefore",
          "Workers on duty who reported 1 hour or more before service",
          "Name and time (e.g., Sis Agnes 7:00 AM)"
        )}

        {listSection(
          "workerThirtyMins",
          "Workers on duty who reported at least 30 minutes before service",
          "Name and time (e.g., Bro Prah 7:22 AM)"
        )}

        {listSection(
          "workerAfterService",
          "Workers on duty who reported after the service commenced",
          "Name and time (e.g., Bro John Doe 8:08 AM)"
        )}

        {listSection(
          "workerAbsent",
          "Workers on duty who did not report for duty",
          "Name of worker"
        )}
      </div>

      <div className="card p-6 space-y-5">
        <h3 className="font-bold text-gray-900 dark:text-slate-100">
          Pre-Service Prayers
        </h3>

        {preServiceSection(
          "thirtyToSixtyMins",
          "Workers on duty seen praying an hour before service"
        )}

        {preServiceSection(
          "tenToThirtyMins",
          "Workers on duty seen praying at most 30 minutes before service"
        )}

        {preServiceSection(
          "notSeenPraying",
          "Workers on duty who were not seen praying before service"
        )}
      </div>

      <div className="card p-6 space-y-4">
        <h3 className="font-bold text-gray-900 dark:text-slate-100">
          Observations
        </h3>

        <div>
          <label className="form-label">Before Service</label>
          <textarea
            className="input-field resize-none"
            rows={3}
            placeholder="Observations before the service commenced..."
            value={form.observationsBefore}
            onChange={(e) => setForm({ ...form, observationsBefore: e.target.value })}
          />
        </div>

        <div>
          <label className="form-label">During and After Service</label>
          <textarea
            className="input-field resize-none"
            rows={3}
            placeholder="Observations during and after service..."
            value={form.observationsDuring}
            onChange={(e) => setForm({ ...form, observationsDuring: e.target.value })}
          />
        </div>

        <div>
          <label className="form-label">Comments</label>
          <textarea
            className="input-field resize-none"
            rows={3}
            placeholder="Any additional comments..."
            value={form.comments}
            onChange={(e) => setForm({ ...form, comments: e.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-end pb-6">
        <button
          onClick={handleDraft}
          disabled={loading}
          className="btn-outline flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          {loading ? "Saving..." : "Save Draft"}
        </button>

        <button
          onClick={handleFinalSubmit}
          disabled={loading || !portalOpen}
          className="btn-primary flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          {portalOpen ? "Submit Report" : "Portal Closed"}
        </button>
      </div>
    </div>
  );
};

export default BriefForm;