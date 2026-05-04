import { useState, useEffect, useMemo, useRef } from "react";
import {
  Save,
  Send,
  CheckCircle,
  Clock3,
  WifiOff,
  Search,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useReports } from "../../hooks/useReports";
import { useDraftInteraction } from "../../hooks/useDraftInteraction";
import { useToast, ToastContainer } from "../../components/common/Toast";
import { getAllWorkers } from "../../services/workerService";
import {
  getFriendlyReportError,
  getNoDraftYetMessage,
  getReportSuccessMessage,
} from "../../utils/reportFeedback";
import { cn } from "../../utils/scoreHelpers";

const DEPARTMENTS = [
  { key: "prayer", label: "Prayer" },
  { key: "songMinistration", label: "Song Ministration" },
  { key: "media", label: "Media" },
  { key: "ushering", label: "Ushering" },
  { key: "frontDesk", label: "Front Desk" },
  { key: "serviceCoordination", label: "Service Coordination" },
  { key: "briefWriting", label: "Brief Writing" },
  { key: "security", label: "Security" },
  { key: "sundaySchool", label: "Sunday School" },
  { key: "otherDepartment", label: "Other Departments" },
];

const createId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `entry-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const createEntry = ({
  type = "manual",
  workerId = "",
  fullName = "",
  reportingTime = "",
  prayedIntoService = null,
  prayerTime = "",
  isApprovedWorker = false,
} = {}) => ({
  id: createId(),
  type,
  workerId,
  fullName,
  reportingTime,
  prayedIntoService,
  prayerTime,
  isApprovedWorker,
});

const createEmptyDepartmentAssignments = () =>
  DEPARTMENTS.reduce((acc, dept) => {
    acc[dept.key] = [];
    return acc;
  }, {});

const createEmptyDepartmentDrafts = () =>
  DEPARTMENTS.reduce((acc, dept) => {
    acc[dept.key] = {
      query: "",
      reportingTime: "",
      bulk: "",
      showBulk: false,
      error: "",
    };
    return acc;
  }, {});

const safeString = (value) => (typeof value === "string" ? value : "");

const toLegacyDepartmentString = (entries = []) =>
  entries
    .map((entry) => {
      const name = safeString(entry.fullName).trim();
      const time = safeString(entry.reportingTime).trim();
      if (!name) return null;
      return time ? `${name} — ${time}` : name;
    })
    .filter(Boolean)
    .join("; ");

const hydrateDepartmentAssignments = (productionData = {}) => {
  const initial = createEmptyDepartmentAssignments();

  DEPARTMENTS.forEach((dept) => {
    const structured = productionData?.departmentAssignments?.[dept.key];

    if (Array.isArray(structured) && structured.length > 0) {
      initial[dept.key] = structured.map((entry) =>
        createEntry({
          type: entry?.type === "worker" ? "worker" : "manual",
          workerId: safeString(entry?.workerId),
          fullName: safeString(entry?.fullName),
          reportingTime: safeString(entry?.reportingTime),
          prayedIntoService:
            typeof entry?.prayedIntoService === "boolean"
              ? entry.prayedIntoService
              : null,
          prayerTime: safeString(entry?.prayerTime),
          isApprovedWorker: !!entry?.isApprovedWorker,
        })
      );
      return;
    }

    const legacy = safeString(productionData?.[dept.key]).trim();
    if (legacy) {
      initial[dept.key] = [
        createEntry({
          type: "manual",
          fullName: legacy,
          reportingTime: "",
          prayedIntoService: null,
          prayerTime: "",
          isApprovedWorker: false,
        }),
      ];
    }
  });

  return initial;
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

  const separators = [" - ", " — ", " | ", ","];
  for (const separator of separators) {
    if (raw.includes(separator)) {
      const parts = raw.split(separator);
      const first = parts.shift()?.trim() || "";
      const second = parts.join(separator).trim();
      return { identifier: first, reportingTime: second };
    }
  }

  return { identifier: raw, reportingTime: "" };
};

const parseTimeToMinutes = (time) => {
  if (!time || typeof time !== "string" || !time.includes(":")) return null;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const formatPrayerStatus = (entry) => {
  if (entry.prayedIntoService === true) {
    return entry.prayerTime ? `Yes • ${entry.prayerTime}` : "Yes";
  }
  if (entry.prayedIntoService === false) return "No";
  return "Not set";
};

const ProductionForm = ({
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
  const { hasInteracted, interactionProps, markInteracted } = useDraftInteraction();

  const [submitted, setSubmitted] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [autoSaveState, setAutoSaveState] = useState("idle");
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const lastSaveRef = useRef(0);
  const autoSaveRef = useRef(() => {});

  const [approvedWorkers, setApprovedWorkers] = useState([]);

  const [form, setForm] = useState({
    meeting: "",
    meetingDate: "",
    serviceStartTime: "",
    serviceCloseTime: "",
    coordinatorReportingTime: "",
    permissionsSought: "",
    observations: "",
    challenges: "",
    suggestions: "",
  });

  const [departmentAssignments, setDepartmentAssignments] = useState(
    createEmptyDepartmentAssignments()
  );
  const [departmentDrafts, setDepartmentDrafts] = useState(createEmptyDepartmentDrafts());
  const [expandedDepartments, setExpandedDepartments] = useState(
    DEPARTMENTS.reduce((acc, dept, index) => {
      acc[dept.key] = index < 3;
      return acc;
    }, {})
  );

  const formRef = useRef(form);
  const departmentAssignmentsRef = useRef(departmentAssignments);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    departmentAssignmentsRef.current = departmentAssignments;
  }, [departmentAssignments]);

  useEffect(() => {
    getAllWorkers({ status: "approved", limit: 1000 })
      .then(({ workers }) => setApprovedWorkers(workers || []))
      .catch(() => setApprovedWorkers([]));
  }, []);

  useEffect(() => {
    let mounted = true;
    setDraftLoaded(false);
    setHydrated(false);

    fetchMyDraft({ reportType: "production", weekReference, weekType, weekDate })
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

        if (draft.productionData) {
          const nextForm = {
            meeting: draft.productionData.meeting || "",
            meetingDate: draft.productionData.meetingDate
              ? new Date(draft.productionData.meetingDate).toISOString().split("T")[0]
              : "",
            serviceStartTime:
              draft.productionData.serviceStartTime ||
              draft.productionData.reportingTime ||
              "",
            serviceCloseTime: draft.productionData.serviceCloseTime || "",
            coordinatorReportingTime:
              draft.productionData.coordinatorReportingTime || "",
            permissionsSought: Array.isArray(draft.productionData.permissionsSought)
              ? draft.productionData.permissionsSought.join(", ")
              : draft.productionData.permissionsSought || "",
            observations: draft.productionData.observations || "",
            challenges: draft.productionData.challenges || "",
            suggestions: draft.productionData.suggestions || "",
          };

          const nextAssignments = hydrateDepartmentAssignments(draft.productionData);

          setForm(nextForm);
          setDepartmentAssignments(nextAssignments);
          formRef.current = nextForm;
          departmentAssignmentsRef.current = nextAssignments;
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

  const setField = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const setDepartmentDraftField = (departmentKey, field, value) =>
    setDepartmentDrafts((prev) => ({
      ...prev,
      [departmentKey]: {
        ...prev[departmentKey],
        [field]: value,
      },
    }));

  const clearDepartmentDraft = (departmentKey, overrides = {}) =>
    setDepartmentDrafts((prev) => ({
      ...prev,
      [departmentKey]: {
        query: "",
        reportingTime: "",
        bulk: "",
        showBulk: prev[departmentKey].showBulk,
        error: "",
        ...overrides,
      },
    }));

  const addDepartmentEntry = (departmentKey, entry) => {
    markInteracted();
    setDepartmentAssignments((prev) => {
      const currentEntries = prev[departmentKey] || [];

      const duplicate = currentEntries.some((existing) => {
        if (entry.type === "worker" && existing.type === "worker") {
          return existing.workerId === entry.workerId;
        }
        return (
          existing.type === entry.type &&
          existing.fullName.trim().toLowerCase() === entry.fullName.trim().toLowerCase()
        );
      });

      if (duplicate) {
        toast.warning(
          "Already added",
          `${entry.fullName} is already in ${DEPARTMENTS.find((d) => d.key === departmentKey)?.label}.`
        );
        return prev;
      }

      return {
        ...prev,
        [departmentKey]: [...currentEntries, entry],
      };
    });
  };

  const removeDepartmentEntry = (departmentKey, entryId) => {
    markInteracted();
    setDepartmentAssignments((prev) => ({
      ...prev,
      [departmentKey]: (prev[departmentKey] || []).filter((entry) => entry.id !== entryId),
    }));
  };

  const updateDepartmentEntryField = (departmentKey, entryId, field, value) => {
    markInteracted();
    setDepartmentAssignments((prev) => ({
      ...prev,
      [departmentKey]: (prev[departmentKey] || []).map((entry) =>
        entry.id === entryId ? { ...entry, [field]: value } : entry
      ),
    }));
  };

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

  const handleAddSingleEntry = (departmentKey) => {
    const draft = departmentDrafts[departmentKey];
    const query = draft.query.trim();
    const reportingTime = draft.reportingTime.trim();

    if (!query) {
      setDepartmentDraftField(departmentKey, "error", "Enter a Worker ID or a name.");
      return;
    }

    const resolvedWorker = resolveWorker(query);

    if (resolvedWorker) {
      addDepartmentEntry(
        departmentKey,
        createEntry({
          type: "worker",
          workerId: resolvedWorker.workerId || "",
          fullName: resolvedWorker.fullName || query,
          reportingTime,
          prayedIntoService: null,
          prayerTime: "",
          isApprovedWorker: true,
        })
      );
      clearDepartmentDraft(departmentKey);
      return;
    }

    if (/^\d+$/.test(query)) {
      setDepartmentDraftField(
        departmentKey,
        "error",
        `Worker ID ${query} was not found among approved workers.`
      );
      return;
    }

    addDepartmentEntry(
      departmentKey,
      createEntry({
        type: "manual",
        fullName: query,
        reportingTime,
        prayedIntoService: null,
        prayerTime: "",
        isApprovedWorker: false,
      })
    );
    clearDepartmentDraft(departmentKey);
  };

  const handleSelectSuggestedWorker = (departmentKey, worker) => {
    const draft = departmentDrafts[departmentKey];
    addDepartmentEntry(
      departmentKey,
      createEntry({
        type: "worker",
        workerId: worker.workerId || "",
        fullName: worker.fullName || "",
        reportingTime: draft.reportingTime.trim(),
        prayedIntoService: null,
        prayerTime: "",
        isApprovedWorker: true,
      })
    );
    clearDepartmentDraft(departmentKey);
  };

  const handleBulkAdd = (departmentKey) => {
    markInteracted();

    const bulk = departmentDrafts[departmentKey].bulk || "";
    const lines = bulk
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setDepartmentDraftField(departmentKey, "error", "Paste at least one line.");
      return;
    }

    const validEntries = [];
    const invalidEntries = [];

    lines.forEach((line) => {
      const parsed = parseBulkLine(line);
      if (!parsed?.identifier) return;

      const worker = resolveWorker(parsed.identifier);

      if (worker) {
        validEntries.push(
          createEntry({
            type: "worker",
            workerId: worker.workerId || "",
            fullName: worker.fullName || parsed.identifier,
            reportingTime: parsed.reportingTime || "",
            prayedIntoService: null,
            prayerTime: "",
            isApprovedWorker: true,
          })
        );
        return;
      }

      if (/^\d+$/.test(parsed.identifier.trim())) {
        invalidEntries.push(parsed.identifier.trim());
        return;
      }

      validEntries.push(
        createEntry({
          type: "manual",
          fullName: parsed.identifier.trim(),
          reportingTime: parsed.reportingTime || "",
          prayedIntoService: null,
          prayerTime: "",
          isApprovedWorker: false,
        })
      );
    });

    if (validEntries.length > 0) {
      setDepartmentAssignments((prev) => {
        const currentEntries = prev[departmentKey] || [];
        const nextEntries = [...currentEntries];

        validEntries.forEach((entry) => {
          const duplicate = nextEntries.some((existing) => {
            if (entry.type === "worker" && existing.type === "worker") {
              return existing.workerId === entry.workerId;
            }
            return (
              existing.type === entry.type &&
              existing.fullName.trim().toLowerCase() === entry.fullName.trim().toLowerCase()
            );
          });

          if (!duplicate) nextEntries.push(entry);
        });

        return {
          ...prev,
          [departmentKey]: nextEntries,
        };
      });
    }

    setDepartmentDrafts((prev) => ({
      ...prev,
      [departmentKey]: {
        ...prev[departmentKey],
        bulk: "",
        error:
          invalidEntries.length > 0
            ? `Not added: ${invalidEntries.join(", ")}. Use manual name if needed.`
            : "",
      },
    }));

    if (validEntries.length > 0) {
      toast.success(
        "Department updated",
        `${validEntries.length} valid entr${validEntries.length === 1 ? "y" : "ies"} added.`
      );
    }
  };

  const allEntries = useMemo(() => {
    return DEPARTMENTS.flatMap((dept) =>
      (departmentAssignments[dept.key] || []).map((entry) => ({
        ...entry,
        departmentKey: dept.key,
        departmentLabel: dept.label,
      }))
    );
  }, [departmentAssignments]);

  const derivedTimingGroups = useMemo(() => {
    const startMins = parseTimeToMinutes(form.serviceStartTime);

    const groups = {
      oneHourPlus: [],
      thirtyMins: [],
      fifteenMins: [],
      late: [],
      prayedYes: [],
      prayedNo: [],
      prayerUnset: [],
    };

    allEntries.forEach((entry) => {
      const reportingMins = parseTimeToMinutes(entry.reportingTime);

      if (startMins !== null && reportingMins !== null) {
        const diff = startMins - reportingMins;

        if (diff >= 60) {
          groups.oneHourPlus.push(entry);
        } else if (diff >= 30 && diff < 60) {
          groups.thirtyMins.push(entry);
        } else if (diff >= 15 && diff < 30) {
          groups.fifteenMins.push(entry);
        } else if (diff <= 0) {
          groups.late.push(entry);
        }
      }

      if (entry.prayedIntoService === true) groups.prayedYes.push(entry);
      else if (entry.prayedIntoService === false) groups.prayedNo.push(entry);
      else groups.prayerUnset.push(entry);
    });

    return groups;
  }, [allEntries, form.serviceStartTime]);

  const buildPayload = (
    currentForm = formRef.current,
    currentAssignments = departmentAssignmentsRef.current
  ) => {
    const legacyFields = DEPARTMENTS.reduce((acc, dept) => {
      acc[dept.key] = toLegacyDepartmentString(currentAssignments[dept.key] || []);
      return acc;
    }, {});

    const structuredAssignments = DEPARTMENTS.reduce((acc, dept) => {
      acc[dept.key] = (currentAssignments[dept.key] || []).map((entry) => ({
        type: entry.type,
        workerId: entry.workerId || "",
        fullName: entry.fullName || "",
        reportingTime: entry.reportingTime || "",
        prayedIntoService:
          typeof entry.prayedIntoService === "boolean" ? entry.prayedIntoService : null,
        prayerTime: entry.prayerTime || "",
        isApprovedWorker: !!entry.isApprovedWorker,
      }));
      return acc;
    }, {});

    return {
      reportType: "production",
      weekType,
      weekDate,
      weekReference,
      isEdit: isEditMode,
      draftStarted: hasInteracted,
      productionData: {
        meeting: currentForm.meeting,
        meetingDate: currentForm.meetingDate,
        serviceStartTime: currentForm.serviceStartTime,
        serviceCloseTime: currentForm.serviceCloseTime,
        coordinatorReportingTime: currentForm.coordinatorReportingTime,
        ...legacyFields,
        departmentAssignments: structuredAssignments,
        autoSummary: {
          oneHourPlus: derivedTimingGroups.oneHourPlus.map((e) => e.fullName),
          thirtyMins: derivedTimingGroups.thirtyMins.map((e) => e.fullName),
          fifteenMins: derivedTimingGroups.fifteenMins.map((e) => e.fullName),
          late: derivedTimingGroups.late.map((e) => e.fullName),
          prayedYes: derivedTimingGroups.prayedYes.map((e) => ({
            fullName: e.fullName,
            prayerTime: e.prayerTime || "",
          })),
          prayedNo: derivedTimingGroups.prayedNo.map((e) => e.fullName),
          prayerUnset: derivedTimingGroups.prayerUnset.map((e) => e.fullName),
        },
        permissionsSought: currentForm.permissionsSought,
        observations: currentForm.observations,
        challenges: currentForm.challenges,
        suggestions: currentForm.suggestions,
      },
    };
  };

  const requiredValid = useMemo(() => {
    return !!form.meeting && !!form.serviceStartTime;
  }, [form.meeting, form.serviceStartTime]);

  const saveDraftInternal = async ({ silent = false } = {}) => {
    try {
      if (isEditMode) {
        if (!silent) {
          toast.info(
            "Already submitted",
            "This report is already submitted. Use Update Report to save changes."
          );
        }
        return;
      }

      if (!hasInteracted) {
        if (!silent) {
          toast.info("Nothing to save yet", getNoDraftYetMessage());
        }
        return;
      }

      if (!navigator.onLine) {
        setAutoSaveState("offline");
        if (!silent) {
          toast.warning("Offline", "You appear to be offline. Draft was not saved.");
        }
        return;
      }

      const payload = buildPayload(formRef.current, departmentAssignmentsRef.current);

      setAutoSaveState("saving");
      const result = await handleSaveDraft(payload);

      if (result?.skipped) {
        setAutoSaveState("idle");
        if (!silent) {
          toast.info("Draft not saved", getReportSuccessMessage(result, getNoDraftYetMessage()));
        }
        return;
      }

      setAutoSaveState("saved");
      setLastSavedAt(new Date());
      lastSaveRef.current = Date.now();

      if (!silent) {
        toast.success(
          "Draft saved",
          getReportSuccessMessage(result, "Draft saved.")
        );
      }
    } catch (err) {
      setAutoSaveState("error");
      if (!silent) {
        toast.error(
          "Draft not saved",
          getFriendlyReportError(err, { action: "draft" })
        );
      }
    }
  };

  useEffect(() => {
    autoSaveRef.current = () => {
      saveDraftInternal({ silent: true });
    };
  });

  const handleDraft = async () => {
    await saveDraftInternal({ silent: false });
  };

  useEffect(() => {
    if (!draftLoaded || !hydrated || submitted || isEditMode || !hasInteracted) return;

    const interval = setInterval(() => {
      autoSaveRef.current();
    }, 60000);

    return () => {
      clearInterval(interval);
    };
  }, [draftLoaded, hydrated, submitted, isEditMode, hasInteracted]);

  useEffect(() => {
    if (!draftLoaded) return;
    const timeout = setTimeout(() => {
      if (autoSaveState === "saved") setAutoSaveState("idle");
    }, 4000);
    return () => clearTimeout(timeout);
  }, [autoSaveState, draftLoaded]);

  const handleFinalSubmit = async () => {
    if (!portalOpen) {
      toast.warning("Portal closed", "The portal is not open.");
      return;
    }

    if (!requiredValid) {
      toast.warning("Required", "Please select the service type and service start time.");
      return;
    }

    try {
      const result =
        isEditMode && existingReportId
          ? await handleEdit(
              existingReportId,
              buildPayload(formRef.current, departmentAssignmentsRef.current)
            )
          : await handleSubmit(
              buildPayload(formRef.current, departmentAssignmentsRef.current)
            );
      setSubmitted(true);
      toast.success(
        isEditMode ? "Report updated" : "Report submitted",
        getReportSuccessMessage(
          result,
          isEditMode ? "Production report updated." : "Production report submitted."
        )
      );
    } catch (err) {
      toast.error(
        isEditMode ? "Update not saved" : "Report not submitted",
        getFriendlyReportError(err, {
          action: isEditMode ? "update" : "submit",
        })
      );
    }
  };

  const statusText = useMemo(() => {
    if (autoSaveState === "saving") return "Saving...";
    if (autoSaveState === "saved" && lastSavedAt) return "Draft saved just now";
    if (autoSaveState === "offline") return "Offline — draft not saved";
    if (autoSaveState === "error") return "Failed to save draft";
    return "Autosave active";
  }, [autoSaveState, lastSavedAt]);

  const renderSummaryList = (title, items, extraRenderer) => (
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 p-4">
      <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm mb-3">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">None</p>
      ) : (
        <div className="space-y-2">
          {items.map((entry) => (
            <div
              key={`${title}-${entry.id}`}
              className="rounded-lg bg-gray-50 dark:bg-slate-800 px-3 py-2"
            >
              <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                {entry.fullName}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {entry.departmentLabel}
                {entry.reportingTime ? ` • Reported ${entry.reportingTime}` : ""}
              </p>
              {extraRenderer ? extraRenderer(entry) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderTextarea = (label, value, onChange, placeholder, rows = 2) => (
    <div>
      <label className="form-label">{label}</label>
      <textarea
        className="input-field resize-none"
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );

  if (submitted) {
    return (
      <div className="card p-12 text-center space-y-4">
        <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
        <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100">
          Production Report Submitted
        </h3>
        <p className="text-gray-500 dark:text-slate-400 text-sm">
          {isArrears ? "Submitted and locked permanently." : "Editable until Monday 2:59pm."}
        </p>
        {!isArrears && portalOpen && (
          <button onClick={() => setSubmitted(false)} className="btn-outline">
            Edit Report
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6" {...interactionProps}>
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

      <div className="card p-5 space-y-4">
        <h3 className="font-bold text-gray-900 dark:text-slate-100">Service Details</h3>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="form-label">
              Service Type <span className="text-red-400">*</span>
            </label>
            <select
              className="input-field"
              value={form.meeting}
              onChange={(e) => setField("meeting", e.target.value)}
            >
              <option value="">Select service</option>
              <option value="tuesday">Tuesday Service</option>
              <option value="sunday">Sunday Service</option>
              <option value="special">Special Service</option>
            </select>
          </div>

          <div>
            <label className="form-label">Date</label>
            <input
              type="date"
              className="input-field"
              value={form.meetingDate}
              onChange={(e) => setField("meetingDate", e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">
              Service Start Time <span className="text-red-400">*</span>
            </label>
            <input
              type="time"
              className="input-field"
              value={form.serviceStartTime}
              onChange={(e) => setField("serviceStartTime", e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">Service Close Time</label>
            <input
              type="time"
              className="input-field"
              value={form.serviceCloseTime}
              onChange={(e) => setField("serviceCloseTime", e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">Coordinator Reporting Time</label>
            <input
              type="time"
              className="input-field"
              value={form.coordinatorReportingTime}
              onChange={(e) => setField("coordinatorReportingTime", e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="font-bold text-gray-900 dark:text-slate-100">Department Assignments</h3>
        <p className="text-xs text-gray-400 dark:text-slate-500">
          Add each worker once. Timing and prayer summaries are calculated automatically from these assignments.
        </p>

        <div className="space-y-4">
          {DEPARTMENTS.map((department) => {
            const draft = departmentDrafts[department.key];
            const entries = departmentAssignments[department.key] || [];
            const query = draft.query.trim();

            const suggestions =
              query.length === 0
                ? []
                : approvedWorkers
                    .filter((worker) => matchesWorker(worker, query))
                    .slice(0, 6);

            return (
              <div
                key={department.key}
                className="rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedDepartments((prev) => ({
                      ...prev,
                      [department.key]: !prev[department.key],
                    }))
                  }
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 dark:bg-slate-800/70"
                >
                  <div className="text-left">
                    <p className="font-semibold text-gray-900 dark:text-slate-100">
                      {department.label}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {entries.length} entr{entries.length === 1 ? "y" : "ies"}
                    </p>
                  </div>

                  {expandedDepartments[department.key] ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {expandedDepartments[department.key] && (
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_180px_auto] gap-3">
                      <div className="relative">
                        <label className="form-label">Worker ID or Name</label>
                        <div className="relative">
                          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            className="input-field pl-9"
                            placeholder="Type Worker ID or name"
                            value={draft.query}
                            onChange={(e) => {
                              setDepartmentDraftField(department.key, "query", e.target.value);
                              if (draft.error) {
                                setDepartmentDraftField(department.key, "error", "");
                              }
                            }}
                          />
                        </div>

                        {suggestions.length > 0 && (
                          <div className="mt-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                            {suggestions.map((worker) => (
                              <button
                                key={worker._id}
                                type="button"
                                onClick={() => handleSelectSuggestedWorker(department.key, worker)}
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

                      <div>
                        <label className="form-label">Reporting Time</label>
                        <input
                          type="time"
                          className="input-field"
                          value={draft.reportingTime}
                          onChange={(e) =>
                            setDepartmentDraftField(department.key, "reportingTime", e.target.value)
                          }
                        />
                      </div>

                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => handleAddSingleEntry(department.key)}
                          className="btn-outline w-full flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Add
                        </button>
                      </div>
                    </div>

                    {draft.error && (
                      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                        {draft.error}
                      </div>
                    )}

                    <div className="rounded-xl border border-dashed border-gray-300 dark:border-slate-600 p-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                          Bulk add
                        </p>

                        <button
                          type="button"
                          onClick={() =>
                            setDepartmentDraftField(
                              department.key,
                              "showBulk",
                              !draft.showBulk
                            )
                          }
                          className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
                        >
                          {draft.showBulk ? "Hide" : "Show"}
                        </button>
                      </div>

                      {draft.showBulk && (
                        <>
                          <textarea
                            rows={4}
                            className="input-field resize-none"
                            placeholder={`One per line. Examples:
263 - 16:00
948 - 16:15
Guest drummer - 16:20`}
                            value={draft.bulk}
                            onChange={(e) =>
                              setDepartmentDraftField(department.key, "bulk", e.target.value)
                            }
                          />

                          <button
                            type="button"
                            onClick={() => handleBulkAdd(department.key)}
                            className="btn-outline text-sm"
                          >
                            Add Valid Entries
                          </button>
                        </>
                      )}
                    </div>

                    {entries.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                          Added entries
                        </p>

                        {entries.map((entry) => (
                          <div
                            key={entry.id}
                            className="rounded-xl border border-gray-200 dark:border-slate-700 p-3 space-y-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                                  {entry.fullName}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-slate-400">
                                  {entry.type === "worker"
                                    ? `Approved worker${entry.workerId ? ` • ID ${entry.workerId}` : ""}`
                                    : "Manual entry"}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => removeDepartmentEntry(department.key, entry.id)}
                                className="text-red-400 hover:text-red-600 p-2"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <label className="form-label">Reporting Time</label>
                                <input
                                  type="time"
                                  className="input-field"
                                  value={entry.reportingTime || ""}
                                  onChange={(e) =>
                                    updateDepartmentEntryField(
                                      department.key,
                                      entry.id,
                                      "reportingTime",
                                      e.target.value
                                    )
                                  }
                                />
                              </div>

                              <div>
                                <label className="form-label">Prayed into service?</label>
                                <div className="grid grid-cols-2 gap-2">
                                  {[true, false].map((value) => (
                                    <button
                                      key={String(value)}
                                      type="button"
                                      onClick={() =>
                                        updateDepartmentEntryField(
                                          department.key,
                                          entry.id,
                                          "prayedIntoService",
                                          value
                                        )
                                      }
                                      className={cn(
                                        "py-2 rounded-lg border text-sm transition-all",
                                        entry.prayedIntoService === value
                                          ? value
                                            ? "border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                                            : "border-red-300 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                                          : "border-gray-200 dark:border-slate-600 text-gray-500"
                                      )}
                                    >
                                      {value ? "Yes" : "No"}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <label className="form-label">Time seen praying</label>
                                <input
                                  type="time"
                                  className="input-field"
                                  value={entry.prayerTime || ""}
                                  disabled={entry.prayedIntoService !== true}
                                  onChange={(e) =>
                                    updateDepartmentEntryField(
                                      department.key,
                                      entry.id,
                                      "prayerTime",
                                      e.target.value
                                    )
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="font-bold text-gray-900 dark:text-slate-100">
          Auto Summary from Assignments
        </h3>
        <p className="text-xs text-gray-400 dark:text-slate-500">
          These sections are read-only and are generated from worker assignments and service start time.
        </p>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {renderSummaryList(
            "1 hour or more before service",
            derivedTimingGroups.oneHourPlus
          )}

          {renderSummaryList(
            "30 mins to service start",
            derivedTimingGroups.thirtyMins
          )}

          {renderSummaryList(
            "15 mins to service start",
            derivedTimingGroups.fifteenMins
          )}

          {renderSummaryList(
            "Late / on the dot / after service start",
            derivedTimingGroups.late
          )}

          {renderSummaryList(
            "Prayed into service — Yes",
            derivedTimingGroups.prayedYes,
            (entry) => (
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                Seen praying: {entry.prayerTime || "Time not set"}
              </p>
            )
          )}

          {renderSummaryList(
            "Prayed into service — No / Not set",
            [...derivedTimingGroups.prayedNo, ...derivedTimingGroups.prayerUnset],
            (entry) => (
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                {formatPrayerStatus(entry)}
              </p>
            )
          )}
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="font-bold text-gray-900 dark:text-slate-100">
          Permissions, Observations and Remarks
        </h3>

        {renderTextarea(
          "Permissions Sought",
          form.permissionsSought,
          (value) => setField("permissionsSought", value),
          "Any permissions sought before or during service",
          2
        )}

        {renderTextarea(
          "Observations and Comments",
          form.observations,
          (value) => setField("observations", value),
          "Important observations and comments",
          3
        )}

        {renderTextarea(
          "Challenges",
          form.challenges,
          (value) => setField("challenges", value),
          "List challenges encountered",
          2
        )}

        {renderTextarea(
          "Suggestions",
          form.suggestions,
          (value) => setField("suggestions", value),
          "Suggestions for improvement",
          2
        )}
      </div>

      <p className="text-xs text-amber-600 dark:text-amber-400 text-right">
        If Submit Report does not go through, the form will show which required section is missing. Draft can still be saved.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 justify-end pb-6">
        {!isEditMode && (
          <button
            type="button"
            data-draft-ignore="true"
            onClick={handleDraft}
            disabled={loading}
            className="btn-outline flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {loading ? "Saving..." : "Save Draft"}
          </button>
        )}

        <button
          type="button"
          data-draft-ignore="true"
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

export default ProductionForm;
