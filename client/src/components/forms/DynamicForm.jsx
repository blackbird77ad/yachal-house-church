import { useState, useEffect, useMemo, useRef } from "react";
import { Save, Send, Clock3, WifiOff } from "lucide-react";
import { useReports } from "../../hooks/useReports";
import { useToast, ToastContainer } from "../../components/common/Toast";
import { cn } from "../../utils/scoreHelpers";

const DynamicForm = ({
  reportType,
  fields = [],
  weekType,
  weekReference,
  portalOpen,
  weekDate,
  isEditMode,
  existingReportId,
  weekLabel,
}) => {
  const { handleSaveDraft, handleSubmit, handleEdit, fetchMyDraft, loading } = useReports();
  const { toasts, toast, removeToast } = useToast();

  const [formData, setFormData] = useState({});
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [autoSaveState, setAutoSaveState] = useState("idle"); // idle | saving | saved | error | offline
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const lastSaveRef = useRef(Date.now());

  const sortedFields = useMemo(
    () => [...fields].sort((a, b) => (a.order || 0) - (b.order || 0)),
    [fields]
  );

  useEffect(() => {
    let mounted = true;
    setDraftLoaded(false);
    setHydrated(false);

    if (!reportType?._id) {
      setDraftLoaded(true);
      setHydrated(true);
      return;
    }

    fetchMyDraft({
      reportType: "custom",
      weekReference,
      weekType,
      weekDate,
      customReportType: reportType._id,
    })
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

        setFormData(draft.customData || {});
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
  }, [reportType?._id, weekReference, weekType, weekDate, isEditMode, fetchMyDraft]);

  const updateField = (name, value) =>
    setFormData((prev) => ({ ...prev, [name]: value }));

  const buildPayload = () => ({
    reportType: "custom",
    weekType,
    weekDate,
    weekReference,
    isEdit: isEditMode,
    customReportType: reportType?._id,
    customData: formData,
  });

  const isFieldFilled = (field) => {
    const value = formData[field.fieldName];

    if (!field.required) return true;

    if (field.fieldType === "checkbox") {
      return value === true;
    }

    return value !== undefined && value !== null && String(value).trim() !== "";
  };

  const allRequiredValid = useMemo(
    () => sortedFields.every((field) => isFieldFilled(field)),
    [sortedFields, formData]
  );

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
      const msg = err.response?.data?.message || "Could not save draft.";
      console.error("Dynamic draft save failed:", err.response?.data || err);
      setAutoSaveState("error");
      if (!silent) {
        toast.error("Draft save failed", msg);
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
  }, [draftLoaded, hydrated, submitted, formData]);

  useEffect(() => {
    if (!draftLoaded) return;

    const timeout = setTimeout(() => {
      if (autoSaveState === "saved") setAutoSaveState("idle");
    }, 4000);

    return () => clearTimeout(timeout);
  }, [autoSaveState, draftLoaded]);

  const handleFinalSubmit = async () => {
    if (!portalOpen) {
      toast.warning("Portal closed", "Portal is not open right now.");
      return;
    }

    if (!allRequiredValid) {
      toast.warning("Required fields missing", "Fill all required fields before submitting.");
      return;
    }

    try {
      if (isEditMode && existingReportId) {
        await handleEdit(existingReportId, buildPayload());
      } else {
        await handleSubmit(buildPayload());
      }

      setSubmitted(true);
      toast.success("Submitted", "Report submitted successfully.");
    } catch (err) {
      const msg = err.response?.data?.message || "Could not submit.";
      console.error("Dynamic submit failed:", err.response?.data || err);
      toast.error("Error", msg);
    }
  };

  const statusText = useMemo(() => {
    if (autoSaveState === "saving") return "Saving...";
    if (autoSaveState === "saved" && lastSavedAt) return "Draft saved just now";
    if (autoSaveState === "offline") return "Offline — draft not saved";
    if (autoSaveState === "error") return "Failed to save draft";
    return "Autosave active";
  }, [autoSaveState, lastSavedAt]);

  const renderField = (field) => {
    const commonInputClass = "input-field";

    switch (field.fieldType) {
      case "textarea":
        return (
          <textarea
            className="input-field resize-none"
            rows={4}
            value={formData[field.fieldName] || ""}
            onChange={(e) => updateField(field.fieldName, e.target.value)}
            placeholder={field.placeholder || ""}
          />
        );

      case "select":
        return (
          <select
            className={commonInputClass}
            value={formData[field.fieldName] || ""}
            onChange={(e) => updateField(field.fieldName, e.target.value)}
          >
            <option value="">Select</option>
            {field.options?.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        );

      case "checkbox":
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 accent-purple-600"
              checked={!!formData[field.fieldName]}
              onChange={(e) => updateField(field.fieldName, e.target.checked)}
            />
            <span className="text-sm text-gray-700 dark:text-slate-300">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </span>
          </label>
        );

      case "number":
        return (
          <input
            type="number"
            className={commonInputClass}
            value={formData[field.fieldName] || ""}
            onChange={(e) => updateField(field.fieldName, e.target.value)}
            placeholder={field.placeholder || ""}
          />
        );

      case "date":
        return (
          <input
            type="date"
            className={commonInputClass}
            value={formData[field.fieldName] || ""}
            onChange={(e) => updateField(field.fieldName, e.target.value)}
          />
        );

      case "time":
        return (
          <input
            type="time"
            className={commonInputClass}
            value={formData[field.fieldName] || ""}
            onChange={(e) => updateField(field.fieldName, e.target.value)}
          />
        );

      default:
        return (
          <input
            type="text"
            className={commonInputClass}
            value={formData[field.fieldName] || ""}
            onChange={(e) => updateField(field.fieldName, e.target.value)}
            placeholder={field.placeholder || ""}
          />
        );
    }
  };

  if (submitted) {
    return (
      <div className="card p-12 text-center space-y-4">
        <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100">
          {isEditMode ? "Report Updated" : "Report Submitted"}
        </h3>
        <p className="text-gray-500 dark:text-slate-400 text-sm">
          Submitted successfully.
        </p>
        {!portalOpen && (
          <p className="text-xs text-gray-400 dark:text-slate-500">
            Portal is currently closed.
          </p>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {sortedFields.map((field) => (
            <div
              key={field.fieldName}
              className={field.fieldType === "textarea" ? "sm:col-span-2" : ""}
            >
              {field.fieldType !== "checkbox" && (
                <label className="form-label">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
              )}
              {renderField(field)}
            </div>
          ))}
        </div>
      </div>

      {!allRequiredValid && (
        <p className="text-xs text-amber-600 dark:text-amber-400 text-right">
          Complete all required fields before submitting. Draft can still be saved.
        </p>
      )}

      {!portalOpen && (
        <p className="text-xs text-red-500 text-right">
          Portal is closed. You can keep saving draft, but submission is disabled.
        </p>
      )}

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
          disabled={loading || !portalOpen || !allRequiredValid}
          className={cn(
            "flex items-center justify-center gap-2 font-medium px-4 py-2 rounded-lg transition-all",
            portalOpen && allRequiredValid
              ? "btn-primary"
              : "bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed"
          )}
        >
          <Send className="w-4 h-4" />
          {portalOpen ? (isEditMode ? "Update Report" : "Submit Report") : "Portal Closed"}
        </button>
      </div>
    </div>
  );
};

export default DynamicForm;
