import { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus,
  Trash2,
  Save,
  Send,
  CheckCircle,
  Clock3,
  WifiOff,
} from "lucide-react";
import { useReports } from "../../hooks/useReports";
import { useToast, ToastContainer } from "../../components/common/Toast";
import { cn } from "../../utils/scoreHelpers";

const BriefForm = ({
  weekType,
  weekReference,
  portalOpen,
  weekDate,
  isArrears,
  isEditMode,
  existingReportId,
  weekLabel,
}) => {
  const { handleSaveDraft, handleSubmit, handleEdit, fetchMyDraft, loading } = useReports();
  const { toasts, toast, removeToast } = useToast();

  const [submitted, setSubmitted] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [autoSaveState, setAutoSaveState] = useState("idle");
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const lastSaveRef = useRef(Date.now());

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
    let mounted = true;
    setDraftLoaded(false);
    setHydrated(false);

    fetchMyDraft({ weekReference,
    reportType: "brief", weekType, weekDate })
      .then(({ draft }) => {
        if (!mounted) return;

        if (!draft) {
          setDraftLoaded(true);
          setHydrated(true);
          return;
        }

        if (draft.status === "submitted" && !isEditMode) {
          setSubmitted(true);
          setDraftLoaded(true);
          setHydrated(true);
          return;
        }

        if (draft.briefData) {
          setForm((prev) => ({
            ...prev,
            ...draft.briefData,
            meetingDate: draft.briefData.meetingDate
              ? new Date(draft.briefData.meetingDate).toISOString().split("T")[0]
              : "",
            workerHourBefore: draft.briefData.workerHourBefore?.length
              ? draft.briefData.workerHourBefore
              : [""],
            workerThirtyMins: draft.briefData.workerThirtyMins?.length
              ? draft.briefData.workerThirtyMins
              : [""],
            workerAfterService: draft.briefData.workerAfterService?.length
              ? draft.briefData.workerAfterService
              : [""],
            workerAbsent: draft.briefData.workerAbsent?.length
              ? draft.briefData.workerAbsent
              : [""],
            preServicePrayers: {
              thirtyToSixtyMins:
                draft.briefData.preServicePrayers?.thirtyToSixtyMins?.length
                  ? draft.briefData.preServicePrayers.thirtyToSixtyMins
                  : [""],
              tenToThirtyMins:
                draft.briefData.preServicePrayers?.tenToThirtyMins?.length
                  ? draft.briefData.preServicePrayers.tenToThirtyMins
                  : [""],
              notSeenPraying:
                draft.briefData.preServicePrayers?.notSeenPraying?.length
                  ? draft.briefData.preServicePrayers.notSeenPraying
                  : [""],
            },
          }));
        }

        setDraftLoaded(true);
        setHydrated(true);
      })
      .catch(() => {
        if (!mounted) return;
        setDraftLoaded(true);
        setHydrated(true);
      });

    return () => {
      mounted = false;
    };
  }, [weekReference, weekType, weekDate, isEditMode, fetchMyDraft]);

  const buildPayload = () => ({
    reportType: "brief",
    weekType,
    weekDate,
    weekReference,
    isEdit: isEditMode,
    briefData: {
      ...form,
      workerHourBefore: form.workerHourBefore.filter((v) => v.trim()),
      workerThirtyMins: form.workerThirtyMins.filter((v) => v.trim()),
      workerAfterService: form.workerAfterService.filter((v) => v.trim()),
      workerAbsent: form.workerAbsent.filter((v) => v.trim()),
      preServicePrayers: {
        thirtyToSixtyMins: form.preServicePrayers.thirtyToSixtyMins.filter((v) => v.trim()),
        tenToThirtyMins: form.preServicePrayers.tenToThirtyMins.filter((v) => v.trim()),
        notSeenPraying: form.preServicePrayers.notSeenPraying.filter((v) => v.trim()),
      },
    },
  });

  const requiredValid = useMemo(() => {
    return !!form.meeting;
  }, [form.meeting]);

  const saveDraftInternal = async ({ silent = false, source = "manual" } = {}) => {
    try {
      if (!navigator.onLine) {
        setAutoSaveState("offline");
        if (!silent) {
          toast.warning("Offline", "You appear to be offline. Draft was not saved.");
        }
        return;
      }

      setAutoSaveState("saving");
      await handleSaveDraft(buildPayload());
      setAutoSaveState("saved");
      setLastSavedAt(new Date());
      lastSaveRef.current = Date.now();

      if (!silent || source === "auto") {
        toast.success(
          "Draft saved",
          source === "manual"
            ? "Progress saved as draft."
            : "Autosaved as draft. Drafts do not count until submitted."
        );
      }
    } catch (err) {
      setAutoSaveState("error");
      if (!silent) {
        toast.error(
          "Draft save failed",
          err.response?.data?.message || "Could not save draft."
        );
      }
    }
  };

  const handleDraft = async () => {
    await saveDraftInternal({ silent: false, source: "manual" });
  };

  useEffect(() => {
    if (!draftLoaded || !hydrated || submitted) return;

    const interval = setInterval(() => {
      saveDraftInternal({ silent: true, source: "auto" });
    }, 60000);

    const onBlur = () => {
      if (Date.now() - lastSaveRef.current > 10000) {
        saveDraftInternal({ silent: true, source: "auto" });
      }
    };

    window.addEventListener("blur", onBlur);

    return () => {
      clearInterval(interval);
      window.removeEventListener("blur", onBlur);
    };
  }, [draftLoaded, hydrated, submitted, form]);

  useEffect(() => {
    if (!draftLoaded) return;
    const timeout = setTimeout(() => {
      if (autoSaveState === "saved") setAutoSaveState("idle");
    }, 4000);
    return () => clearTimeout(timeout);
  }, [autoSaveState, draftLoaded]);

  const handleFinalSubmit = async () => {
    if (!portalOpen) {
      toast.warning("Portal closed", "The portal is not open yet.");
      return;
    }

    if (!requiredValid) {
      toast.warning("Required", "Please select the meeting/service before submitting.");
      return;
    }

    try {
      if (isEditMode && existingReportId) {
        await handleEdit(existingReportId, buildPayload());
      } else {
        await handleSubmit(buildPayload());
      }
      setSubmitted(true);
      toast.success("Submitted", "Your brief report has been submitted.");
    } catch (err) {
      toast.error("Error", err.response?.data?.message || "Could not submit.");
    }
  };

  const statusText = useMemo(() => {
    if (autoSaveState === "saving") return "Saving...";
    if (autoSaveState === "saved" && lastSavedAt) return "Draft saved just now";
    if (autoSaveState === "offline") return "Offline — draft not saved";
    if (autoSaveState === "error") return "Failed to save draft";
    return "Autosave active";
  }, [autoSaveState, lastSavedAt]);

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
        [sub]: prev.preServicePrayers[sub].map((v, idx) =>
          idx === i ? val : v
        ),
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

  const renderListSection = (field, label, placeholder) => (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-800 dark:text-slate-200 text-sm">{label}</h4>
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

  const renderPreServiceSection = (field, label) => (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-800 dark:text-slate-200 text-sm">{label}</h4>
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

  if (submitted) {
    return (
      <div className="card p-12 text-center">
        <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
          Report Submitted
        </h3>
        <p className="text-gray-500 dark:text-slate-400 text-sm">
          {isArrears ? "Submitted and locked permanently." : "Editable until Monday 2:59pm."}
        </p>
        {!isArrears && portalOpen && (
          <button onClick={() => setSubmitted(false)} className="btn-outline mt-4">
            Edit Report
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-purple-600 dark:text-purple-400 font-semibold">
            {weekType === "late" ? "Arrears submission" : "Current week submission"}
          </p>
          <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
            {weekLabel || "This report will be saved under the active reporting week."}
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
            Autosave is on. If you are not ready, your work stays as a draft. Drafts do not count until you press Submit Report.
          </p>
        </div>

        <div
          className={cn(
            "text-xs font-medium px-3 py-2 rounded-xl border flex items-center gap-2 w-fit",
            autoSaveState === "saving" &&
              "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300",
            autoSaveState === "saved" &&
              "border-green-300 bg-green-50 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300",
            autoSaveState === "offline" &&
              "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300",
            autoSaveState === "error" &&
              "border-red-300 bg-red-50 text-red-700 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300",
            autoSaveState === "idle" &&
              "border-gray-200 bg-gray-50 text-gray-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
          )}
        >
          {autoSaveState === "offline" ? (
            <WifiOff className="w-3.5 h-3.5" />
          ) : (
            <Clock3 className="w-3.5 h-3.5" />
          )}
          {statusText}
        </div>
      </div>

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
              onChange={(e) => setForm((prev) => ({ ...prev, meeting: e.target.value }))}
            >
              <option value="">Select service</option>
              <option value="Tuesday Service">Tuesday Service</option>
              <option value="Sunday Service">Sunday Service</option>
              <option value="Special Service">Special Service</option>
            </select>
          </div>

          <div>
            <label className="form-label">Meeting Date</label>
            <input
              type="date"
              className="input-field"
              value={form.meetingDate}
              onChange={(e) => setForm((prev) => ({ ...prev, meetingDate: e.target.value }))}
            />
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-6">
        {renderListSection("workerHourBefore", "Workers Present 1 Hour Before", "Worker’s name")}
        {renderListSection("workerThirtyMins", "Workers Present 30 Minutes Before", "Worker’s name")}
        {renderListSection("workerAfterService", "Workers Seen After Service", "Worker’s name")}
        {renderListSection("workerAbsent", "Workers Absent", "Worker’s name")}
      </div>

      <div className="card p-6 space-y-6">
        <h3 className="font-bold text-gray-900 dark:text-slate-100">
          Pre-Service Prayers
        </h3>

        {renderPreServiceSection("thirtyToSixtyMins", "Praying 30–60 Minutes Before Service")}
        {renderPreServiceSection("tenToThirtyMins", "Praying 10–30 Minutes Before Service")}
        {renderPreServiceSection("notSeenPraying", "Not Seen Praying")}
      </div>

      <div className="card p-6 space-y-4">
        <div>
          <label className="form-label">Observations Before Service</label>
          <textarea
            rows={3}
            className="input-field resize-none"
            value={form.observationsBefore}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, observationsBefore: e.target.value }))
            }
          />
        </div>

        <div>
          <label className="form-label">Observations During Service</label>
          <textarea
            rows={3}
            className="input-field resize-none"
            value={form.observationsDuring}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, observationsDuring: e.target.value }))
            }
          />
        </div>

        <div>
          <label className="form-label">Comments</label>
          <textarea
            rows={4}
            className="input-field resize-none"
            value={form.comments}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, comments: e.target.value }))
            }
          />
        </div>
      </div>

      <p className="text-xs text-amber-600 dark:text-amber-400 text-right">
        If Submit Report does not go through, the form will show which required section is missing. Draft can still be saved.
      </p>

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
          className={cn(
            "flex items-center justify-center gap-2 font-medium px-4 py-2 rounded-lg transition-all",
            portalOpen
              ? "btn-primary"
              : "bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed"
          )}
        >
          <Send className="w-4 h-4" />
          {!portalOpen ? "Portal Closed" : isEditMode ? "Update Report" : "Submit Report"}
        </button>
      </div>
    </div>
  );
};

export default BriefForm;
