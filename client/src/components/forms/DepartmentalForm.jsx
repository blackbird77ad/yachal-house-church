import { useEffect, useMemo, useRef, useState } from "react";
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
import { useDraftInteraction } from "../../hooks/useDraftInteraction";
import { useToast, ToastContainer } from "../../components/common/Toast";
import { getAllWorkers } from "../../services/workerService";
import {
  getFriendlyReportError,
  getNoDraftYetMessage,
  getReportSuccessMessage,
} from "../../utils/reportFeedback";
import { cn } from "../../utils/scoreHelpers";

const DEPARTMENT_OPTIONS = [
  { value: "ushering", label: "Ushering" },
  { value: "music", label: "Music" },
  { value: "children", label: "Children" },
  { value: "media", label: "Media" },
  { value: "front-desk", label: "Front Desk" },
  { value: "technical", label: "Technical" },
  { value: "other", label: "Other" },
];

const SERVICE_OPTIONS = [
  { value: "tuesday", label: "Tuesday Service" },
  { value: "sunday", label: "Sunday Service" },
  { value: "other", label: "Other" },
];

const createId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `dept-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const makeWorkerTimeRow = () => ({
  id: createId(),
  workerInput: "",
  time: "",
});

const makeWorkerAssignmentRow = () => ({
  id: createId(),
  workerInput: "",
  assignment: "",
});

const makeWorkerCountRow = () => ({
  id: createId(),
  workerInput: "",
  count: "",
});

const makeChildRow = () => ({
  id: createId(),
  childName: "",
  broughtBy: "",
  time: "",
});

const makeQualifiedRow = () => ({
  id: createId(),
  workerInput: "",
});

const formatWorkerOption = (worker) =>
  worker?.workerId ? `${worker.fullName} (${worker.workerId})` : worker.fullName;

const resolveWorkerSelection = (value = "", workers = []) => {
  const raw = value.trim();
  if (!raw) return { name: "", workerId: "" };

  const byOption = workers.find((worker) => formatWorkerOption(worker) === raw);
  if (byOption) {
    return {
      name: byOption.fullName || raw,
      workerId: byOption.workerId || "",
    };
  }

  const byId = workers.find((worker) => worker.workerId === raw);
  if (byId) {
    return {
      name: byId.fullName || raw,
      workerId: byId.workerId || "",
    };
  }

  const byName = workers.find(
    (worker) => worker.fullName?.trim().toLowerCase() === raw.toLowerCase()
  );
  if (byName) {
    return {
      name: byName.fullName || raw,
      workerId: byName.workerId || "",
    };
  }

  return { name: raw, workerId: "" };
};

const hydrateWorkerTimeRows = (rows = []) =>
  rows.length
    ? rows.map((row) => ({
        id: createId(),
        workerInput:
          row?.workerId && row?.name
            ? `${row.name} (${row.workerId})`
            : row?.name || "",
        time: row?.time || "",
      }))
    : [makeWorkerTimeRow()];

const hydrateWorkerAssignmentRows = (rows = []) =>
  rows.length
    ? rows.map((row) => ({
        id: createId(),
        workerInput:
          row?.workerId && row?.name
            ? `${row.name} (${row.workerId})`
            : row?.name || "",
        assignment: row?.assignment || "",
      }))
    : [makeWorkerAssignmentRow()];

const hydrateWorkerCountRows = (rows = []) =>
  rows.length
    ? rows.map((row) => ({
        id: createId(),
        workerInput:
          row?.workerId && row?.name
            ? `${row.name} (${row.workerId})`
            : row?.name || "",
        count:
          row?.count === 0 || row?.count
            ? String(row.count)
            : "",
      }))
    : [makeWorkerCountRow()];

const hydrateChildRows = (rows = []) =>
  rows.length
    ? rows.map((row) => ({
        id: createId(),
        childName: row?.childName || "",
        broughtBy: row?.broughtBy || "",
        time: row?.time || "",
      }))
    : [makeChildRow()];

const hydrateQualifiedRows = (rows = []) =>
  rows.length
    ? rows.map((value) => ({
        id: createId(),
        workerInput: value || "",
      }))
    : [makeQualifiedRow()];

const hasMeaningfulWorkerTimeRow = (row) =>
  row.workerInput.trim() || row.time.trim();

const hasMeaningfulAssignmentRow = (row) =>
  row.workerInput.trim() || row.assignment.trim();

const hasMeaningfulCountRow = (row) =>
  row.workerInput.trim() || row.count.toString().trim();

const renderHint = (text) => (
  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{text}</p>
);

const DepartmentalForm = ({
  weekType,
  weekReference,
  portalOpen,
  weekDate,
  isArrears,
  isEditMode,
  existingReportId,
  weekLabel,
}) => {
  const { handleSaveDraft, handleSubmit, handleEdit, fetchMyDraft, loading } =
    useReports();
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
    department: "",
    otherDepartment: "",
    service: "",
    otherService: "",
    serviceDate: "",
    activities: "",
    comments: "",
  });

  const [attendees, setAttendees] = useState([makeWorkerTimeRow()]);
  const [lateness, setLateness] = useState([makeWorkerTimeRow()]);
  const [absentees, setAbsentees] = useState([makeWorkerTimeRow()]);
  const [teamAssignments, setTeamAssignments] = useState([
    makeWorkerAssignmentRow(),
  ]);
  const [convertsToChurch, setConvertsToChurch] = useState([
    makeWorkerCountRow(),
  ]);
  const [convertsToCell, setConvertsToCell] = useState([makeWorkerCountRow()]);
  const [childrenRegister, setChildrenRegister] = useState([makeChildRow()]);
  const [qualifyingWorkers, setQualifyingWorkers] = useState([
    makeQualifiedRow(),
  ]);

  useEffect(() => {
    getAllWorkers({ status: "approved", limit: 1000 })
      .then(({ workers }) => setApprovedWorkers(workers || []))
      .catch(() => setApprovedWorkers([]));
  }, []);

  useEffect(() => {
    let mounted = true;

    fetchMyDraft({
      reportType: "departmental",
      weekReference,
      weekType,
      weekDate,
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

        const data = draft.departmentalData || {};

        setForm({
          department: data.department || "",
          otherDepartment: data.otherDepartment || "",
          service: data.service || "",
          otherService: data.otherService || "",
          serviceDate: data.serviceDate
            ? new Date(data.serviceDate).toISOString().split("T")[0]
            : "",
          activities: data.activities || "",
          comments: data.comments || "",
        });
        setAttendees(hydrateWorkerTimeRows(data.attendees || []));
        setLateness(hydrateWorkerTimeRows(data.lateness || []));
        setAbsentees(hydrateWorkerTimeRows(data.absentees || []));
        setTeamAssignments(
          hydrateWorkerAssignmentRows(data.teamAssignments || [])
        );
        setConvertsToChurch(
          hydrateWorkerCountRows(data.convertsToChurch || [])
        );
        setConvertsToCell(hydrateWorkerCountRows(data.convertsToCell || []));
        setChildrenRegister(hydrateChildRows(data.childrenRegister || []));
        setQualifyingWorkers(
          hydrateQualifiedRows(data.qualifyingWorkers || [])
        );

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
  }, [fetchMyDraft, isEditMode, weekDate, weekReference, weekType]);

  const workerOptions = useMemo(
    () => approvedWorkers.map((worker) => formatWorkerOption(worker)),
    [approvedWorkers]
  );

  const mapWorkerTimeRows = (rows) =>
    rows
      .filter(hasMeaningfulWorkerTimeRow)
      .map((row) => {
        const resolved = resolveWorkerSelection(row.workerInput, approvedWorkers);
        return {
          name: resolved.name,
          workerId: resolved.workerId,
          time: row.time.trim(),
        };
      });

  const mapAssignmentRows = (rows) =>
    rows
      .filter(hasMeaningfulAssignmentRow)
      .map((row) => {
        const resolved = resolveWorkerSelection(row.workerInput, approvedWorkers);
        return {
          name: resolved.name,
          workerId: resolved.workerId,
          assignment: row.assignment.trim(),
        };
      });

  const mapCountRows = (rows) =>
    rows
      .filter(hasMeaningfulCountRow)
      .map((row) => {
        const resolved = resolveWorkerSelection(row.workerInput, approvedWorkers);
        return {
          name: resolved.name,
          workerId: resolved.workerId,
          count: Number(row.count) || 0,
        };
      });

  const mapQualifyingWorkers = (rows) =>
    rows
      .map((row) => resolveWorkerSelection(row.workerInput, approvedWorkers))
      .filter((row) => row.name)
      .map((row) => (row.workerId ? `${row.name} (${row.workerId})` : row.name));

  const buildPayload = () => ({
    reportType: "departmental",
    weekType,
    weekDate,
    weekReference,
    isEdit: isEditMode,
    draftStarted: hasInteracted,
    departmentalData: {
      department: form.department,
      otherDepartment:
        form.department === "other" ? form.otherDepartment.trim() : "",
      service: form.service,
      otherService: form.service === "other" ? form.otherService.trim() : "",
      serviceDate: form.serviceDate || null,
      attendees: mapWorkerTimeRows(attendees),
      lateness: mapWorkerTimeRows(lateness),
      absentees: mapWorkerTimeRows(absentees),
      teamAssignments: mapAssignmentRows(teamAssignments),
      convertsToChurch: mapCountRows(convertsToChurch),
      convertsToCell: mapCountRows(convertsToCell),
      childrenRegister: childrenRegister
        .filter(
          (row) =>
            row.childName.trim() || row.broughtBy.trim() || row.time.trim()
        )
        .map((row) => ({
          childName: row.childName.trim(),
          broughtBy: row.broughtBy.trim(),
          time: row.time.trim(),
        })),
      activities: form.activities.trim(),
      comments: form.comments.trim(),
      qualifyingWorkers: mapQualifyingWorkers(qualifyingWorkers),
    },
  });

  const validation = {
    hasDepartment: !!form.department,
    hasOtherDepartment:
      form.department !== "other" || !!form.otherDepartment.trim(),
    hasService:
      !!form.service &&
      (form.service !== "other" || !!form.otherService.trim()),
    hasDate: !!form.serviceDate,
    hasAttendees: mapWorkerTimeRows(attendees).length > 0,
    hasLateness: mapWorkerTimeRows(lateness).length > 0,
    hasAbsentees: mapWorkerTimeRows(absentees).length > 0,
    hasAssignments: mapAssignmentRows(teamAssignments).length > 0,
    hasConvertsToChurch: mapCountRows(convertsToChurch).length > 0,
    hasConvertsToCell: mapCountRows(convertsToCell).length > 0,
    hasQualifyingWorkers: mapQualifyingWorkers(qualifyingWorkers).length > 0,
  };

  const saveDraftInternal = async ({ silent = false, source = "manual" } = {}) => {
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

      setAutoSaveState("saving");
      const result = await handleSaveDraft(buildPayload());

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

      if (!silent || source === "auto") {
        toast.success(
          "Draft saved",
          getReportSuccessMessage(
            result,
            source === "manual"
              ? "Draft saved."
              : "Draft autosaved. It will count only after submission."
          )
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
      saveDraftInternal({ silent: true, source: "auto" });
    };
  });

  const handleDraft = async () => {
    await saveDraftInternal({ silent: false, source: "manual" });
  };

  useEffect(() => {
    if (!draftLoaded || !hydrated || submitted || isEditMode || !hasInteracted) return;

    const interval = setInterval(() => {
      autoSaveRef.current();
    }, 60000);

    const onBlur = () => {
      if (Date.now() - lastSaveRef.current > 10000) {
        autoSaveRef.current();
      }
    };

    window.addEventListener("blur", onBlur);

    return () => {
      clearInterval(interval);
      window.removeEventListener("blur", onBlur);
    };
  }, [
    draftLoaded,
    hydrated,
    submitted,
    form,
    attendees,
    lateness,
    absentees,
    teamAssignments,
    convertsToChurch,
    convertsToCell,
    childrenRegister,
    qualifyingWorkers,
    isEditMode,
    hasInteracted,
  ]);

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

    if (!validation.hasDepartment) {
      toast.warning("Department required", "Please select the department.");
      return;
    }

    if (!validation.hasOtherDepartment) {
      toast.warning(
        "Department name required",
        "Please enter the department name."
      );
      return;
    }

    if (!validation.hasService) {
      toast.warning(
        "Service required",
        "Please choose the service/meeting and fill the other service name if needed."
      );
      return;
    }

    if (!validation.hasDate) {
      toast.warning("Date required", "Please select the date of submission.");
      return;
    }

    if (!validation.hasAttendees) {
      toast.warning(
        "Attendees required",
        "Add at least one attendee, or type None if there were none."
      );
      return;
    }

    if (!validation.hasLateness) {
      toast.warning(
        "Lateness required",
        "Add at least one lateness entry, or type None if there was none."
      );
      return;
    }

    if (!validation.hasAbsentees) {
      toast.warning(
        "Absentees required",
        "Add at least one absentee entry, or type None if there was none."
      );
      return;
    }

    if (!validation.hasAssignments) {
      toast.warning(
        "Assignments required",
        "Add at least one team assignment."
      );
      return;
    }

    if (!validation.hasConvertsToChurch) {
      toast.warning(
        "Church converts required",
        "Add the converts/disciples brought to church for each team member."
      );
      return;
    }

    if (!validation.hasConvertsToCell) {
      toast.warning(
        "Cell converts required",
        "Add the converts/disciples brought to cell or fellowship for each team member."
      );
      return;
    }

    if (!validation.hasQualifyingWorkers) {
      toast.warning(
        "Qualifying workers required",
        "List the people who qualify to work."
      );
      return;
    }

    try {
      const result =
        isEditMode && existingReportId
          ? await handleEdit(existingReportId, buildPayload())
          : await handleSubmit(buildPayload());
      setSubmitted(true);
      toast.success(
        isEditMode ? "Report updated" : "Report submitted",
        getReportSuccessMessage(
          result,
          isEditMode ? "Departmental report updated." : "Departmental report submitted."
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

  const statusText =
    autoSaveState === "saving"
      ? "Saving..."
      : autoSaveState === "saved" && lastSavedAt
        ? "Draft saved just now"
        : autoSaveState === "offline"
          ? "Offline - draft not saved"
          : autoSaveState === "error"
            ? "Failed to save draft"
            : "Autosave active";

  const updateWorkerTimeRow = (setRows, rowId, field, value) => {
    setRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
  };

  const updateAssignmentRow = (rowId, field, value) => {
    setTeamAssignments((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
  };

  const updateCountRow = (setRows, rowId, field, value) => {
    setRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
  };

  const updateChildRow = (rowId, field, value) => {
    setChildrenRegister((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
  };

  const renderWorkerTimeSection = ({
    title,
    rows,
    setRows,
    helpText,
    timeLabel,
  }) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-slate-100">
            {title}
          </h4>
          {renderHint(helpText)}
        </div>
        <button
          type="button"
          onClick={() => {
            markInteracted();
            setRows((prev) => [...prev, makeWorkerTimeRow()]);
          }}
          className="btn-outline text-xs py-1.5 flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div
            key={row.id}
            className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400">
                Entry #{index + 1}
              </span>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    markInteracted();
                    setRows((prev) => prev.filter((item) => item.id !== row.id));
                  }}
                  className="text-red-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label">Worker Name / ID</label>
                <input
                  list="departmental-workers"
                  className="input-field"
                  placeholder="Choose from workers or type manually"
                  value={row.workerInput}
                  onChange={(e) =>
                    updateWorkerTimeRow(setRows, row.id, "workerInput", e.target.value)
                  }
                />
              </div>
              <div>
                <label className="form-label">{timeLabel}</label>
                <input
                  type="time"
                  className="input-field"
                  value={row.time}
                  onChange={(e) =>
                    updateWorkerTimeRow(setRows, row.id, "time", e.target.value)
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAssignmentSection = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-slate-100">
            Team Assignments
          </h4>
          {renderHint(
            "Example: Name of worker 1 - Assignment."
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            markInteracted();
            setTeamAssignments((prev) => [...prev, makeWorkerAssignmentRow()]);
          }}
          className="btn-outline text-xs py-1.5 flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>

      <div className="space-y-3">
        {teamAssignments.map((row, index) => (
          <div
            key={row.id}
            className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400">
                Assignment #{index + 1}
              </span>
              {teamAssignments.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    markInteracted();
                    setTeamAssignments((prev) =>
                      prev.filter((item) => item.id !== row.id)
                    );
                  }}
                  className="text-red-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label">Worker Name / ID</label>
                <input
                  list="departmental-workers"
                  className="input-field"
                  placeholder="Choose from workers or type manually"
                  value={row.workerInput}
                  onChange={(e) =>
                    updateAssignmentRow(row.id, "workerInput", e.target.value)
                  }
                />
              </div>
              <div>
                <label className="form-label">Assignment</label>
                <input
                  className="input-field"
                  placeholder="e.g. Main door, Backing vocals, Camera 1"
                  value={row.assignment}
                  onChange={(e) =>
                    updateAssignmentRow(row.id, "assignment", e.target.value)
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderCountSection = ({
    title,
    rows,
    setRows,
    helpText,
  }) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-slate-100">
            {title}
          </h4>
          {renderHint(helpText)}
        </div>
        <button
          type="button"
          onClick={() => {
            markInteracted();
            setRows((prev) => [...prev, makeWorkerCountRow()]);
          }}
          className="btn-outline text-xs py-1.5 flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div
            key={row.id}
            className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400">
                Entry #{index + 1}
              </span>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    markInteracted();
                    setRows((prev) => prev.filter((item) => item.id !== row.id));
                  }}
                  className="text-red-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label">Worker Name / ID</label>
                <input
                  list="departmental-workers"
                  className="input-field"
                  placeholder="Choose from workers or type manually"
                  value={row.workerInput}
                  onChange={(e) =>
                    updateCountRow(setRows, row.id, "workerInput", e.target.value)
                  }
                />
              </div>
              <div>
                <label className="form-label">Number</label>
                <input
                  type="number"
                  min="0"
                  className="input-field"
                  placeholder="0"
                  value={row.count}
                  onChange={(e) =>
                    updateCountRow(setRows, row.id, "count", e.target.value)
                  }
                />
              </div>
            </div>
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
          Departmental Report Submitted
        </h3>
        <p className="text-gray-500 dark:text-slate-400 text-sm">
          {isArrears
            ? "Submitted and locked permanently."
            : "Editable until Monday 2:59pm."}
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
    <div className="space-y-6" {...interactionProps}>
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <datalist id="departmental-workers">
        {workerOptions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>

      <div className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-purple-600 dark:text-purple-400 font-semibold">
            {weekType === "late" ? "Arrears submission" : "Current week submission"}
          </p>
          <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
            {weekLabel || "This report will be saved under the active reporting week."}
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
            Coordinators can pick workers from the approved worker list or type names manually. Drafts stay separate until you press Submit Report.
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

      <div className="card p-6 space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-purple-600 dark:text-purple-400 font-semibold">
            Section 1 of 3
          </p>
          <h3 className="font-bold text-gray-900 dark:text-slate-100 mt-1">
            Weekly Reporting - Departmental Report
          </h3>
          {renderHint(
            "This form is to be filled by coordinators of a department or persons on duty. Kindly fill all applicable areas."
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">
              Department <span className="text-red-400">*</span>
            </label>
            <select
              className="input-field"
              value={form.department}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, department: e.target.value }))
              }
            >
              <option value="">Select department</option>
              {DEPARTMENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {form.department === "other" && (
            <div>
              <label className="form-label">
                Other Department Name <span className="text-red-400">*</span>
              </label>
              <input
                className="input-field"
                placeholder="Enter the department name"
                value={form.otherDepartment}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    otherDepartment: e.target.value,
                  }))
                }
              />
            </div>
          )}

          <div>
            <label className="form-label">
              Service / Meeting <span className="text-red-400">*</span>
            </label>
            <select
              className="input-field"
              value={form.service}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, service: e.target.value }))
              }
            >
              <option value="">Select service</option>
              {SERVICE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {form.service === "other" && (
            <div>
              <label className="form-label">
                Other Service Name <span className="text-red-400">*</span>
              </label>
              <input
                className="input-field"
                placeholder="Enter the service or meeting name"
                value={form.otherService}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    otherService: e.target.value,
                  }))
                }
              />
            </div>
          )}

          <div>
            <label className="form-label">
              Date of Submission <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              className="input-field"
              value={form.serviceDate}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, serviceDate: e.target.value }))
              }
            />
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-purple-600 dark:text-purple-400 font-semibold">
            Section 2 of 3
          </p>
          <h3 className="font-bold text-gray-900 dark:text-slate-100 mt-1">
            Attendance & Assignments
          </h3>
        </div>

        {renderWorkerTimeSection({
          title: "Attendees",
          rows: attendees,
          setRows: setAttendees,
          helpText:
            "Time of arrival for duty or meeting. Example: Name of worker 1 - 6:00am.",
          timeLabel: "Arrival Time",
        })}

        {renderWorkerTimeSection({
          title: "Lateness",
          rows: lateness,
          setRows: setLateness,
          helpText:
            "Time permission was sought. Example: Name of worker 1 - 6:00am.",
          timeLabel: "Permission Time",
        })}

        {renderWorkerTimeSection({
          title: "Absentees",
          rows: absentees,
          setRows: setAbsentees,
          helpText:
            "Time permission was sought. Example: Name of worker 1 - 6:00am.",
          timeLabel: "Permission Time",
        })}

        {renderAssignmentSection()}

        {renderCountSection({
          title:
            "New Converts / Disciples Each Team Member Brought to Church",
          rows: convertsToChurch,
          setRows: setConvertsToChurch,
          helpText:
            "Example: Name of worker 1 - number of converts or disciples.",
        })}

        {renderCountSection({
          title:
            "New Converts / Disciples Each Team Member Brought to Cell / Fellowship",
          rows: convertsToCell,
          setRows: setConvertsToCell,
          helpText:
            "Example: Name of worker 1 - number of converts or disciples.",
        })}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-slate-100">
                Children Register
              </h4>
              {renderHint(
                "If Children's department, attach the register of children and indicate who brought them and the time."
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                markInteracted();
                setChildrenRegister((prev) => [...prev, makeChildRow()]);
              }}
              className="btn-outline text-xs py-1.5 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>

          <div className="space-y-3">
            {childrenRegister.map((row, index) => (
              <div
                key={row.id}
                className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400">
                    Child #{index + 1}
                  </span>
                  {childrenRegister.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        markInteracted();
                        setChildrenRegister((prev) =>
                          prev.filter((item) => item.id !== row.id)
                        );
                      }}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="form-label">Child Name</label>
                    <input
                      className="input-field"
                      placeholder="Name of child"
                      value={row.childName}
                      onChange={(e) =>
                        updateChildRow(row.id, "childName", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="form-label">Discipler / Guardian</label>
                    <input
                      className="input-field"
                      placeholder="Who brought the child"
                      value={row.broughtBy}
                      onChange={(e) =>
                        updateChildRow(row.id, "broughtBy", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="form-label">Time</label>
                    <input
                      type="time"
                      className="input-field"
                      value={row.time}
                      onChange={(e) =>
                        updateChildRow(row.id, "time", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-purple-600 dark:text-purple-400 font-semibold">
            Section 3 of 3
          </p>
          <h3 className="font-bold text-gray-900 dark:text-slate-100 mt-1">
            Activity Report
          </h3>
          {renderHint(
            "State any activities, details, observations, or other useful notes."
          )}
        </div>

        <div>
          <label className="form-label">Activities / Details / Observations</label>
          <textarea
            rows={5}
            className="input-field resize-none"
            placeholder="Kindly state any activities, details, observations, etc."
            value={form.activities}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, activities: e.target.value }))
            }
          />
        </div>

        <div>
          <label className="form-label">Comments</label>
          <textarea
            rows={4}
            className="input-field resize-none"
            placeholder="Additional comments"
            value={form.comments}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, comments: e.target.value }))
            }
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-slate-100">
                People Who Qualify to Work
              </h4>
              {renderHint(
                "List names of people who qualify to work. You can pick from the worker list or type manually."
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                markInteracted();
                setQualifyingWorkers((prev) => [...prev, makeQualifiedRow()]);
              }}
              className="btn-outline text-xs py-1.5 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>

          <div className="space-y-3">
            {qualifyingWorkers.map((row, index) => (
              <div
                key={row.id}
                className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400">
                    Qualifying Worker #{index + 1}
                  </span>
                  {qualifyingWorkers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        markInteracted();
                        setQualifyingWorkers((prev) =>
                          prev.filter((item) => item.id !== row.id)
                        );
                      }}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div>
                  <label className="form-label">
                    Worker Name / ID <span className="text-red-400">*</span>
                  </label>
                  <input
                    list="departmental-workers"
                    className="input-field"
                    placeholder="Choose from workers or type manually"
                    value={row.workerInput}
                    onChange={(e) =>
                      setQualifyingWorkers((prev) =>
                        prev.map((item) =>
                          item.id === row.id
                            ? { ...item, workerInput: e.target.value }
                            : item
                        )
                      )
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-amber-600 dark:text-amber-400 text-right">
        If Submit Report does not go through, the form will show which required
        section is missing. Draft can still be saved.
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
          {!portalOpen
            ? "Portal Closed"
            : isEditMode
              ? "Update Report"
              : "Submit Report"}
        </button>
      </div>
    </div>
  );
};

export default DepartmentalForm;
