import { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus,
  Trash2,
  Save,
  Send,
  CheckCircle,
  Clock3,
  WifiOff,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useReports } from "../../hooks/useReports";
import { useToast, ToastContainer } from "../../components/common/Toast";
import { getAllWorkers } from "../../services/workerService";
import { cn } from "../../utils/scoreHelpers";

const createId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `participant-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const createParticipant = ({
  type = "manual",
  workerId = "",
  fullName = "",
  isApprovedWorker = false,
} = {}) => ({
  id: createId(),
  type,
  workerId,
  fullName,
  isApprovedWorker,
});

const normalizeParticipant = (p) => {
  if (typeof p === "string") {
    return createParticipant({
      type: "manual",
      fullName: p,
      isApprovedWorker: false,
    });
  }

  return createParticipant({
    type: p?.type === "worker" ? "worker" : "manual",
    workerId: p?.workerId || "",
    fullName: p?.fullName || "",
    isApprovedWorker: !!p?.isApprovedWorker,
  });
};

const matchesWorker = (worker, query) => {
  const q = query.trim().toLowerCase();
  if (!q) return false;

  return (
    worker?.fullName?.toLowerCase().includes(q) ||
    worker?.workerId?.toLowerCase().includes(q)
  );
};

const parseBulkLine = (line) => {
  const raw = line.trim();
  if (!raw) return null;
  return raw;
};

const FellowshipForm = ({
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

  const [approvedWorkers, setApprovedWorkers] = useState([]);

  const [form, setForm] = useState({
    fellowship: "",
    meetingDate: "",
    timeStarted: "",
    timeEnded: "",
    duration: "",
    prayerLedBy: "",
    participants: [],
    comments: "",
  });

  const formRef = useRef(form);
  useEffect(() => {
    formRef.current = form;
  }, [form]);

  const [participantDraft, setParticipantDraft] = useState({
    query: "",
    bulk: "",
    showBulk: false,
    error: "",
  });

  const [showParticipants, setShowParticipants] = useState(true);

  useEffect(() => {
    getAllWorkers({ status: "approved", limit: 1000 })
      .then(({ workers }) => setApprovedWorkers(workers || []))
      .catch(() => setApprovedWorkers([]));
  }, []);

  useEffect(() => {
    let mounted = true;
    setDraftLoaded(false);
    setHydrated(false);

    fetchMyDraft({ weekReference,
    reportType: "fellowship-prayer", weekType, weekDate })
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

        if (draft.fellowshipPrayerData) {
          const nextForm = {
            fellowship: draft.fellowshipPrayerData.fellowship || "",
            meetingDate: draft.fellowshipPrayerData.meetingDate
              ? new Date(draft.fellowshipPrayerData.meetingDate).toISOString().split("T")[0]
              : "",
            timeStarted: draft.fellowshipPrayerData.timeStarted || "",
            timeEnded: draft.fellowshipPrayerData.timeEnded || "",
            duration:
              draft.fellowshipPrayerData.duration !== undefined &&
              draft.fellowshipPrayerData.duration !== null
                ? String(draft.fellowshipPrayerData.duration)
                : "",
            prayerLedBy: draft.fellowshipPrayerData.prayerLedBy || "",
            participants: Array.isArray(draft.fellowshipPrayerData.participants)
              ? draft.fellowshipPrayerData.participants.map(normalizeParticipant)
              : [],
            comments: draft.fellowshipPrayerData.comments || "",
          };

          setForm(nextForm);
          formRef.current = nextForm;
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

  const resolveWorker = (identifier) => {
    const cleaned = identifier.trim();
    if (!cleaned) return null;

    const byId = approvedWorkers.find((worker) => worker.workerId === cleaned);
    if (byId) return byId;

    const exactByName = approvedWorkers.find(
      (worker) => worker.fullName?.trim().toLowerCase() === cleaned.toLowerCase()
    );
    if (exactByName) return exactByName;

    return null;
  };

  const suggestions = useMemo(() => {
    const query = participantDraft.query.trim();
    if (!query) return [];
    return approvedWorkers.filter((worker) => matchesWorker(worker, query)).slice(0, 6);
  }, [approvedWorkers, participantDraft.query]);

  const addParticipant = (entry) => {
    setForm((prev) => {
      const duplicate = prev.participants.some((existing) => {
        if (entry.type === "worker" && existing.type === "worker") {
          return existing.workerId === entry.workerId;
        }
        return (
          existing.type === entry.type &&
          existing.fullName.trim().toLowerCase() === entry.fullName.trim().toLowerCase()
        );
      });

      if (duplicate) {
        toast.warning("Already added", `${entry.fullName} is already in the participants list.`);
        return prev;
      }

      return {
        ...prev,
        participants: [...prev.participants, entry],
      };
    });
  };

  const removeParticipant = (entryId) => {
    setForm((prev) => ({
      ...prev,
      participants: prev.participants.filter((entry) => entry.id !== entryId),
    }));
  };

  const clearParticipantDraft = (overrides = {}) => {
    setParticipantDraft((prev) => ({
      ...prev,
      query: "",
      bulk: "",
      error: "",
      ...overrides,
    }));
  };

  const handleAddSingleParticipant = () => {
    const query = participantDraft.query.trim();

    if (!query) {
      setParticipantDraft((prev) => ({
        ...prev,
        error: "Enter a Worker ID or participant name.",
      }));
      return;
    }

    const resolvedWorker = resolveWorker(query);

    if (resolvedWorker) {
      addParticipant(
        createParticipant({
          type: "worker",
          workerId: resolvedWorker.workerId || "",
          fullName: resolvedWorker.fullName || query,
          isApprovedWorker: true,
        })
      );
      clearParticipantDraft();
      return;
    }

    if (/^\d+$/.test(query)) {
      setParticipantDraft((prev) => ({
        ...prev,
        error: `Worker ID ${query} was not found among approved workers. Type the name manually if needed.`,
      }));
      return;
    }

    addParticipant(
      createParticipant({
        type: "manual",
        fullName: query,
        isApprovedWorker: false,
      })
    );
    clearParticipantDraft();
  };

  const handleSelectSuggestedWorker = (worker) => {
    addParticipant(
      createParticipant({
        type: "worker",
        workerId: worker.workerId || "",
        fullName: worker.fullName || "",
        isApprovedWorker: true,
      })
    );
    clearParticipantDraft();
  };

  const handleBulkAdd = () => {
    const lines = (participantDraft.bulk || "")
      .split("\n")
      .map(parseBulkLine)
      .filter(Boolean);

    if (lines.length === 0) {
      setParticipantDraft((prev) => ({
        ...prev,
        error: "Paste at least one line.",
      }));
      return;
    }

    const validEntries = [];
    const invalidEntries = [];

    lines.forEach((identifier) => {
      const worker = resolveWorker(identifier);

      if (worker) {
        validEntries.push(
          createParticipant({
            type: "worker",
            workerId: worker.workerId || "",
            fullName: worker.fullName || identifier,
            isApprovedWorker: true,
          })
        );
        return;
      }

      if (/^\d+$/.test(identifier.trim())) {
        invalidEntries.push(identifier.trim());
        return;
      }

      validEntries.push(
        createParticipant({
          type: "manual",
          fullName: identifier.trim(),
          isApprovedWorker: false,
        })
      );
    });

    if (validEntries.length > 0) {
      setForm((prev) => {
        const next = [...prev.participants];

        validEntries.forEach((entry) => {
          const duplicate = next.some((existing) => {
            if (entry.type === "worker" && existing.type === "worker") {
              return existing.workerId === entry.workerId;
            }
            return (
              existing.type === entry.type &&
              existing.fullName.trim().toLowerCase() === entry.fullName.trim().toLowerCase()
            );
          });

          if (!duplicate) next.push(entry);
        });

        return {
          ...prev,
          participants: next,
        };
      });
    }

    setParticipantDraft((prev) => ({
      ...prev,
      bulk: "",
      error:
        invalidEntries.length > 0
          ? `Not added: ${invalidEntries.join(", ")}. Retry with another ID or type the name manually.`
          : "",
    }));

    if (validEntries.length > 0) {
      toast.success(
        "Participants added",
        `${validEntries.length} valid entr${validEntries.length === 1 ? "y" : "ies"} added.`
      );
    }
  };

  const buildPayload = (currentForm = formRef.current) => ({
    reportType: "fellowship-prayer",
    weekType,
    weekDate,
    weekReference,
    isEdit: isEditMode,
    fellowshipPrayerData: {
      ...currentForm,
      duration: Number(currentForm.duration) || 0,
      participants: (currentForm.participants || [])
        .filter((p) => p.fullName.trim())
        .map((p) => ({
          type: p.type,
          workerId: p.workerId || "",
          fullName: p.fullName || "",
          isApprovedWorker: !!p.isApprovedWorker,
        })),
    },
  });

  const requiredValid = useMemo(
    () =>
      form.fellowship.trim() &&
      form.meetingDate &&
      form.timeStarted &&
      form.timeEnded,
    [form]
  );

  const saveDraftInternal = async ({ silent = false } = {}) => {
    try {
      if (!navigator.onLine) {
        setAutoSaveState("offline");
        if (!silent) {
          toast.warning("Offline", "You appear to be offline. Draft was not saved.");
        }
        return;
      }

      const payload = buildPayload(formRef.current);

      setAutoSaveState("saving");
      await handleSaveDraft(payload);
      setAutoSaveState("saved");
      setLastSavedAt(new Date());
      lastSaveRef.current = Date.now();

      if (!silent) {
        toast.success("Draft saved", "Progress saved as draft.");
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
    await saveDraftInternal({ silent: false });
  };

  useEffect(() => {
    if (!draftLoaded || !hydrated || submitted) return;

    const interval = setInterval(() => {
      saveDraftInternal({ silent: true });
    }, 60000);

    return () => {
      clearInterval(interval);
    };
  }, [draftLoaded, hydrated, submitted]);

  useEffect(() => {
    if (!draftLoaded) return;
    const timeout = setTimeout(() => {
      if (autoSaveState === "saved") setAutoSaveState("idle");
    }, 4000);
    return () => clearTimeout(timeout);
  }, [autoSaveState, draftLoaded]);

  const handleFinalSubmit = async () => {
    if (!portalOpen) {
      toast.warning("Portal closed", "Portal is not open.");
      return;
    }

    if (!requiredValid) {
      toast.warning("Required", "Fill the fellowship name, date, and prayer times before submitting.");
      return;
    }

    try {
      if (isEditMode && existingReportId) {
        await handleEdit(existingReportId, buildPayload(formRef.current));
      } else {
        await handleSubmit(buildPayload(formRef.current));
      }

      setSubmitted(true);
      toast.success(
        isEditMode ? "Updated" : "Submitted",
        "Fellowship prayer report submitted."
      );
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
          Fellowship Prayer Details
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">
              Fellowship Name <span className="text-red-500">*</span>
            </label>
            <input
              className="input-field"
              placeholder="Name of fellowship"
              value={form.fellowship}
              onChange={(e) => setForm((prev) => ({ ...prev, fellowship: e.target.value }))}
            />
          </div>

          <div>
            <label className="form-label">
              Meeting Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              className="input-field"
              value={form.meetingDate}
              onChange={(e) => setForm((prev) => ({ ...prev, meetingDate: e.target.value }))}
            />
          </div>

          <div>
            <label className="form-label">
              Time Prayer Began <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              className="input-field"
              value={form.timeStarted}
              onChange={(e) => setForm((prev) => ({ ...prev, timeStarted: e.target.value }))}
            />
          </div>

          <div>
            <label className="form-label">
              Time Prayer Ended <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              className="input-field"
              value={form.timeEnded}
              onChange={(e) => setForm((prev) => ({ ...prev, timeEnded: e.target.value }))}
            />
          </div>

          <div>
            <label className="form-label">Duration (hours)</label>
            <input
              type="number"
              min="0"
              step="0.5"
              className="input-field"
              placeholder="e.g. 2"
              value={form.duration}
              onChange={(e) => setForm((prev) => ({ ...prev, duration: e.target.value }))}
            />
          </div>

          <div>
            <label className="form-label">Prayer Led By</label>
            <input
              className="input-field"
              placeholder="Name of coordinator/leader"
              value={form.prayerLedBy}
              onChange={(e) => setForm((prev) => ({ ...prev, prayerLedBy: e.target.value }))}
            />
          </div>
        </div>
      </div>

      <div className="card p-6">
        <button
          type="button"
          onClick={() => setShowParticipants((prev) => !prev)}
          className="w-full flex items-center justify-between gap-3 mb-4"
        >
          <div className="text-left">
            <h3 className="font-bold text-gray-900 dark:text-slate-100">Participants</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Add by Worker ID, approved worker name, or manual participant name.
            </p>
          </div>
          {showParticipants ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {showParticipants && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
              <div className="relative">
                <label className="form-label">Worker ID or Participant Name</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    className="input-field pl-9"
                    placeholder="Type Worker ID or name"
                    value={participantDraft.query}
                    onChange={(e) =>
                      setParticipantDraft((prev) => ({
                        ...prev,
                        query: e.target.value,
                        error: "",
                      }))
                    }
                  />
                </div>

                {suggestions.length > 0 && (
                  <div className="mt-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                    {suggestions.map((worker) => (
                      <button
                        key={worker._id}
                        type="button"
                        onClick={() => handleSelectSuggestedWorker(worker)}
                        className="w-full text-left px-3 py-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                      >
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                          {worker.fullName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          Worker ID: {worker.workerId}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleAddSingleParticipant}
                  className="btn-outline w-full flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>

            {participantDraft.error && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                {participantDraft.error}
              </div>
            )}

            <div className="rounded-xl border border-dashed border-gray-300 dark:border-slate-600 p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                  Bulk add participants
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setParticipantDraft((prev) => ({
                      ...prev,
                      showBulk: !prev.showBulk,
                    }))
                  }
                  className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
                >
                  {participantDraft.showBulk ? "Hide" : "Show"}
                </button>
              </div>

              {participantDraft.showBulk && (
                <>
                  <textarea
                    rows={5}
                    className="input-field resize-none"
                    placeholder={`One per line. Example:
263
948
Kwame York
Visitor Kofi`}
                    value={participantDraft.bulk}
                    onChange={(e) =>
                      setParticipantDraft((prev) => ({
                        ...prev,
                        bulk: e.target.value,
                        error: "",
                      }))
                    }
                  />

                  <button
                    type="button"
                    onClick={handleBulkAdd}
                    className="btn-outline text-sm"
                  >
                    Add Valid Entries
                  </button>
                </>
              )}
            </div>

            {form.participants.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                  Added participants
                </p>

                {form.participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center gap-3 justify-between rounded-xl border border-gray-200 dark:border-slate-700 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                        {participant.fullName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {participant.type === "worker"
                          ? `Approved worker${participant.workerId ? ` • ID ${participant.workerId}` : ""}`
                          : "Manual entry"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeParticipant(participant.id)}
                      className="text-red-400 hover:text-red-600 p-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-slate-400">
                No participants added yet.
              </p>
            )}

            <div>
              <label className="form-label">Comments</label>
              <textarea
                rows={4}
                className="input-field resize-none"
                placeholder="Any remarks or summary"
                value={form.comments}
                onChange={(e) => setForm((prev) => ({ ...prev, comments: e.target.value }))}
              />
            </div>
          </div>
        )}
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

export default FellowshipForm;
