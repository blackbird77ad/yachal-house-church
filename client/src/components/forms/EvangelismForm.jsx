import { useState, useEffect, useRef, useMemo } from "react";
import {
  Plus,
  Trash2,
  Save,
  Send,
  CheckCircle,
  Users,
  AlertTriangle,
  UserPlus,
  X,
  Clock3,
  WifiOff,
} from "lucide-react";
import { useReports } from "../../hooks/useReports";
import axiosInstance from "../../utils/axiosInstance";
import { SOUL_STATUSES } from "../../utils/constants";
import { useToast, ToastContainer } from "../../components/common/Toast";
import { cn } from "../../utils/scoreHelpers";

const getMyWeekAttendance = async () => {
  const res = await axiosInstance.get("/attendance/my-week");
  return res.data;
};

const emptySoul = { fullName: "", status: "not_saved", location: "", phone: "" };
const emptyFollowUp = { fullName: "", topic: "", scriptures: "" };
const emptyAttendee = {
  fullName: "",
  olderThan12: false,
  attendedTuesday: false,
  attendedSunday: false,
  attendedSpecial: false,
};
const emptyCell = { cellName: "", meetingDays: [], reportTime: "", role: "" };

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const FELLOWSHIPS = ["Fellowship 1", "Fellowship 2", "Fellowship 3", "Other"];
const PRAYER_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const normalizeText = (value = "") =>
  value.toString().trim().replace(/\s+/g, " ").toLowerCase();

const normalizePhone = (value = "") =>
  value.toString().replace(/[^\d]/g, "");

const hasValue = (value) => normalizeText(value).length > 0;

const toTimeInputValue = (value = "") => {
  if (!value) return "";
  if (/^\d{2}:\d{2}$/.test(value)) return value;

  const match = value.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
  if (!match) return "";

  let [, h, m, ap] = match;
  let hour = parseInt(h, 10);
  const minute = m;
  const meridian = ap.toUpperCase();

  if (meridian === "AM") {
    if (hour === 12) hour = 0;
  } else {
    if (hour !== 12) hour += 12;
  }

  return `${String(hour).padStart(2, "0")}:${minute}`;
};

const EvangelismForm = ({
  weekType,
  portalOpen,
  weekDate,
  weekReference,   // explicit ISO string from frontend — source of truth
  isArrears,
  isEditMode,
  existingReportId,
  weekLabel,
}) => {
  const { handleSaveDraft, handleSubmit, handleEdit, fetchMyDraft, loading } = useReports();
  const { toasts, toast, removeToast } = useToast();

  const [submitted, setSubmitted] = useState(false);
  const [duplicates, setDuplicates] = useState([]);

  const [partners, setPartners] = useState([
    { workerId: "", fullName: "", resolved: false, notFound: false, isSearching: false },
  ]);

  const [souls, setSouls] = useState([{ ...emptySoul }]);
  const [scriptures, setScriptures] = useState("");
  const [followUps, setFollowUps] = useState([{ ...emptyFollowUp }]);
  const [attendees, setAttendees] = useState([{ ...emptyAttendee }]);

  const [serviceAttendance, setServiceAttendance] = useState([
    { serviceType: "tuesday", attended: null, reportingTime: "", lateReason: "" },
    { serviceType: "sunday", attended: null, reportingTime: "", lateReason: "" },
  ]);

  const [didAttendCell, setDidAttendCell] = useState(null);
  const [cells, setCells] = useState([{ ...emptyCell }]);

  const [didPrayWithCell, setDidPrayWithCell] = useState(null);
  const [cellPrayerDays, setCellPrayerDays] = useState([]);
  const [cellPrayerStartTime, setCellPrayerStartTime] = useState("");
  const [cellPrayerEndTime, setCellPrayerEndTime] = useState("");
  const [cellPrayerReportTime, setCellPrayerReportTime] = useState("");

  const [fellowshipName, setFellowshipName] = useState("");
  const [fellowshipOther, setFellowshipOther] = useState("");
  const [prayedThisWeek, setPrayedThisWeek] = useState(null);
  const [prayerDay, setPrayerDay] = useState("");
  const [prayerStartTime, setPrayerStartTime] = useState("");
  const [hoursOfPrayer, setHoursOfPrayer] = useState("");

  const [frontDeskCheckIns, setFrontDeskCheckIns] = useState({});
  const [pastCellNames, setPastCellNames] = useState([]);

  const [draftLoaded, setDraftLoaded] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState("idle");
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const partnerLookupTimers = useRef({});
  const lastSaveRef = useRef(Date.now());

  useEffect(() => {
    axiosInstance
      .get("/reports/my-cell-names")
      .then(({ data }) => setPastCellNames(data.cellNames || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    getMyWeekAttendance(weekDate ? { weekStart: weekDate } : {})
      .then(({ checkIns }) => {
        const records = checkIns || {};
        setFrontDeskCheckIns(records);

        setServiceAttendance((prev) =>
          prev.map((s) => {
            const record = records[s.serviceType];
            if (record && s.attended === null) {
              return {
                ...s,
                attended: true,
                reportingTime: toTimeInputValue(record.time),
                fromFrontDesk: true,
              };
            }
            return s;
          })
        );
      })
      .catch(() => {});
  }, [weekDate]);

  useEffect(() => {
    let mounted = true;
    setDraftLoaded(false);
    setHydrated(false);

    fetchMyDraft({ reportType: "evangelism", weekReference, weekType, weekDate })
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

        if (draft.evangelismData?.souls?.length) {
          setSouls(
  draft.evangelismData.souls.map((s) => ({
    ...emptySoul,
    ...s,
    status: s.status || "not_saved",
  }))
);
        }

        if (draft.evangelismData?.scriptures?.length) {
          setScriptures(draft.evangelismData.scriptures.join(", "));
        }

        if (draft.evangelismData?.evangelismPartners?.length) {
          setPartners(
            draft.evangelismData.evangelismPartners.map((p) => ({
              workerId: p,
              fullName: "",
              resolved: normalizeText(p) === "none",
              notFound: false,
              isSearching: false,
            }))
          );
        }

        if (draft.followUpData?.followUps?.length) {
          setFollowUps(
            draft.followUpData.followUps.map((f) => ({
              ...emptyFollowUp,
              ...f,
              scriptures: f.scriptures?.join(", ") || "",
            }))
          );
        }

        if (draft.churchAttendees?.length) {
          setAttendees(draft.churchAttendees.map((a) => ({ ...emptyAttendee, ...a })));
        }

        if (draft.serviceAttendance?.length) {
          setServiceAttendance(
            draft.serviceAttendance.map((s) => ({
              serviceType: s.serviceType,
              attended: s.attended ?? null,
              reportingTime: toTimeInputValue(s.reportingTime || ""),
              lateReason: s.lateReason || "",
              fromFrontDesk: !!frontDeskCheckIns?.[s.serviceType],
            }))
          );
        }

        if (draft.cellData) {
          setDidAttendCell(
            draft.cellData.didAttendCell ??
            draft.cellData.didAttend ??
            null
          );

          if (draft.cellData.cells?.length) {
            setCells(draft.cellData.cells.map((c) => ({ ...emptyCell, ...c })));
          }

          if (draft.cellData.cellPrayer) {
            setDidPrayWithCell(draft.cellData.cellPrayer.didPrayWithCell ?? null);
            setCellPrayerDays(draft.cellData.cellPrayer.days || []);
            setCellPrayerStartTime(toTimeInputValue(draft.cellData.cellPrayer.startTime || ""));
            setCellPrayerEndTime(toTimeInputValue(draft.cellData.cellPrayer.endTime || ""));
            setCellPrayerReportTime(toTimeInputValue(draft.cellData.cellPrayer.reportTime || ""));
          }
        }

        if (draft.fellowshipPrayerData) {
          const fn = draft.fellowshipPrayerData.fellowshipName || "";
          if (FELLOWSHIPS.slice(0, 3).includes(fn)) setFellowshipName(fn);
          else if (fn) {
            setFellowshipName("Other");
            setFellowshipOther(fn);
          }

          setPrayedThisWeek(draft.fellowshipPrayerData.prayedThisWeek ?? null);
          setPrayerDay(draft.fellowshipPrayerData.prayerDay || "");
          setPrayerStartTime(toTimeInputValue(draft.fellowshipPrayerData.prayerStartTime || ""));
          setHoursOfPrayer(draft.fellowshipPrayerData.hoursOfPrayer?.toString() || "");
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
  }, [weekReference, weekType, weekDate, isEditMode]);

  useEffect(() => {
  if (!draftLoaded) return;

  partners.forEach(async (partner, index) => {
    if (
      !partner.workerId ||
      normalizeText(partner.workerId) === "none" ||
      partner.resolved
    ) {
      return;
    }

    try {
      const { data } = await axiosInstance.get(`/workers/by-worker-id/${partner.workerId}`);

      setPartners((prev) =>
        prev.map((p, i) =>
          i === index
            ? {
                ...p,
                fullName: data.worker?.fullName || "",
                resolved: !!data.worker,
                notFound: !data.worker,
                isSearching: false,
              }
            : p
        )
      );
    } catch {
      setPartners((prev) =>
        prev.map((p, i) =>
          i === index
            ? {
                ...p,
                resolved: false,
                notFound: true,
                isSearching: false,
              }
            : p
        )
      );
    }
  });
}, [draftLoaded]);

  const updateSoul = (i, k, v) =>
  setSouls((p) =>
    p.map((s, idx) =>
      idx === i
        ? {
            ...s,
            [k]: v,
            ...(k === "fullName" && !s.status ? { status: "not_saved" } : {}),
          }
        : s
    )
  );

  const updateFollowUp = (i, k, v) =>
    setFollowUps((p) => p.map((f, idx) => (idx === i ? { ...f, [k]: v } : f)));

  const updateAttendee = (i, k, v) =>
    setAttendees((p) => p.map((a, idx) => (idx === i ? { ...a, [k]: v } : a)));

  const updateSA = (i, k, v) =>
    setServiceAttendance((p) => p.map((s, idx) => (idx === i ? { ...s, [k]: v } : s)));

  const updateCell = (i, k, v) =>
    setCells((p) => p.map((c, idx) => (idx === i ? { ...c, [k]: v } : c)));

  const togglePrayerDay = (day) => {
    setCellPrayerDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const partnerFilled = useMemo(
    () => partners.filter((p) => hasValue(p.workerId) || hasValue(p.fullName)),
    [partners]
  );

  const nonEmptySouls = useMemo(
    () =>
      souls.filter(
        (s) =>
          hasValue(s.fullName) ||
          normalizeText(s.status) !== "not_saved" ||
          hasValue(s.location) ||
          hasValue(s.phone)
      ),
    [souls]
  );

  const nonEmptyAttendees = useMemo(
    () => attendees.filter((a) => hasValue(a.fullName)),
    [attendees]
  );

  const qualifyingAttendees = useMemo(
    () => nonEmptyAttendees.filter((a) => a.olderThan12),
    [nonEmptyAttendees]
  );

  const churchCounts = useMemo(
    () =>
      qualifyingAttendees.reduce(
        (t, a) =>
          t +
          (a.attendedTuesday ? 1 : 0) +
          (a.attendedSunday ? 1 : 0) +
          (a.attendedSpecial ? 1 : 0),
        0
      ),
    [qualifyingAttendees]
  );

  const resolvedFellowshipName =
    fellowshipName === "Other" ? fellowshipOther : fellowshipName;

  const cellPrayerHours = useMemo(() => {
    if (!cellPrayerStartTime || !cellPrayerEndTime) return 0;
    const [sh, sm] = cellPrayerStartTime.split(":").map(Number);
    const [eh, em] = cellPrayerEndTime.split(":").map(Number);
    if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    if (end <= start) return 0;
    return (end - start) / 60;
  }, [cellPrayerStartTime, cellPrayerEndTime]);

  const localMatchWarnings = useMemo(() => {
    const warnings = [];

    const soulEntries = nonEmptySouls.map((s) => ({
      name: normalizeText(s.fullName),
      phone: normalizePhone(s.phone),
      status: normalizeText(s.status),
      raw: s,
    }));

    const attendeeEntries = nonEmptyAttendees.map((a) => ({
      name: normalizeText(a.fullName),
      raw: a,
    }));

    for (const soul of soulEntries) {
      for (const attendee of attendeeEntries) {
        if (soul.name && attendee.name && soul.name === attendee.name) {
          warnings.push({
            message: `"${soul.raw.fullName}" appears in both Souls Preached To and People Brought to Church. Confirm this is intentional.`,
          });
        }
      }
    }

    for (let i = 0; i < soulEntries.length; i++) {
      for (let j = i + 1; j < soulEntries.length; j++) {
        const a = soulEntries[i];
        const b = soulEntries[j];

        const nameMatch = a.name && b.name && a.name === b.name;
        const phoneMatch = a.phone && b.phone && a.phone === b.phone;
        const statusMatch = a.status && b.status && a.status === b.status;

        if ((nameMatch && phoneMatch) || (nameMatch && statusMatch)) {
          warnings.push({
            message: `Possible duplicate soul entry: "${a.raw.fullName}" appears more than once.`,
          });
        }
      }
    }

    return warnings;
  }, [nonEmptySouls, nonEmptyAttendees]);

  const sectionValidity = useMemo(() => {
    const partnersValid =
      partnerFilled.length > 0 &&
      partnerFilled.every(
        (p) =>
          normalizeText(p.workerId) === "none" ||
          p.resolved ||
          hasValue(p.fullName)
      );

    const serviceValid = serviceAttendance.every((s) => s.attended !== null);
    const cellAttendanceValid = didAttendCell !== null;
    const fellowshipValid = hasValue(fellowshipName);
    const fellowshipOtherValid =
      fellowshipName !== "Other" || hasValue(fellowshipOther);
    const fellowshipPrayerValid = prayedThisWeek !== null;

    const cellPrayerValid =
      didPrayWithCell === null ||
      didPrayWithCell === false ||
      (didPrayWithCell === true &&
        cellPrayerDays.length > 0 &&
        hasValue(cellPrayerStartTime) &&
        hasValue(cellPrayerEndTime) &&
        hasValue(cellPrayerReportTime));

    return {
      partnersValid,
      serviceValid,
      cellAttendanceValid,
      fellowshipValid,
      fellowshipOtherValid,
      fellowshipPrayerValid,
      cellPrayerValid,
      minimalSubmitValid:
        partnersValid &&
        serviceValid &&
        cellAttendanceValid &&
        fellowshipValid &&
        fellowshipOtherValid &&
        fellowshipPrayerValid &&
        cellPrayerValid,
    };
  }, [
    partnerFilled,
    serviceAttendance,
    didAttendCell,
    fellowshipName,
    fellowshipOther,
    prayedThisWeek,
    didPrayWithCell,
    cellPrayerDays,
    cellPrayerStartTime,
    cellPrayerEndTime,
    cellPrayerReportTime,
  ]);

  const buildPayload = () => ({
    reportType: "evangelism",
    weekType,
    weekDate,
    weekReference,   // always send the frontend-computed weekReference
    isEdit: isEditMode,
    evangelismData: {
      souls: nonEmptySouls.map((s) => ({
        fullName: s.fullName,
        status: s.status,
        location: s.location,
        phone: s.phone,
      })),
      scriptures: scriptures
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      evangelismPartners: partnerFilled
        .map((p) => p.workerId || p.fullName)
        .filter(Boolean),
    },
    followUpData: {
      followUps: followUps
        .filter((f) => hasValue(f.fullName) || hasValue(f.topic) || hasValue(f.scriptures))
        .map((f) => ({
          fullName: f.fullName,
          topic: f.topic,
          scriptures: f.scriptures
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        })),
    },
    churchAttendees: nonEmptyAttendees,
    serviceAttendance: serviceAttendance.map((s) => ({
      serviceType: s.serviceType,
      attended: s.attended,
      reportingTime: s.reportingTime,
      lateReason: s.lateReason || "",
    })),
    cellData: {
      didAttendCell: didAttendCell === true,
      cells: didAttendCell === true ? cells : [],
      cellPrayer: {
        didPrayWithCell: didPrayWithCell === true,
        days: didPrayWithCell === true ? cellPrayerDays : [],
        startTime: didPrayWithCell === true ? cellPrayerStartTime : "",
        endTime: didPrayWithCell === true ? cellPrayerEndTime : "",
        reportTime: didPrayWithCell === true ? cellPrayerReportTime : "",
        hours: didPrayWithCell === true ? cellPrayerHours : 0,
      },
    },
    fellowshipPrayerData: {
      fellowshipName: resolvedFellowshipName,
      prayedThisWeek: prayedThisWeek === true,
      prayerDay,
      prayerStartTime,
      hoursOfPrayer: Number(hoursOfPrayer) || 0,
    },
  });

  const validate = () => {
    if (!sectionValidity.partnersValid) {
      toast.warning(
        "Partners required",
        "Enter your partner's Worker ID, or type None if you went alone."
      );
      return false;
    }

    if (!sectionValidity.serviceValid) {
      toast.warning(
        "Service attendance required",
        "Answer Yes or No for both Tuesday and Sunday service."
      );
      return false;
    }

    if (!sectionValidity.cellAttendanceValid) {
      toast.warning(
        "Cell attendance required",
        "Answer whether you attended cell meeting this week."
      );
      return false;
    }

    if (!sectionValidity.fellowshipValid || !sectionValidity.fellowshipOtherValid) {
      toast.warning(
        "Fellowship required",
        "Select your fellowship and fill the custom fellowship name if needed."
      );
      return false;
    }

    if (!sectionValidity.fellowshipPrayerValid) {
      toast.warning(
        "Fellowship prayer required",
        "Answer whether you prayed in your fellowship this week."
      );
      return false;
    }

    if (!sectionValidity.cellPrayerValid) {
      toast.warning(
        "Cell prayer incomplete",
        "Complete the cell prayer details or choose No."
      );
      return false;
    }

    return true;
  };

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
      const payload = buildPayload();
      await handleSaveDraft(payload);
      setAutoSaveState("saved");
      setLastSavedAt(new Date());
      lastSaveRef.current = Date.now();

      if (!silent && source === "manual") {
        toast.success("Draft saved", "Progress saved as draft.");
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Could not save draft.";
      console.error("Draft save failed:", err.response?.data || err);
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
  }, [
    draftLoaded,
    hydrated,
    submitted,
    souls,
    partners,
    followUps,
    attendees,
    serviceAttendance,
    didAttendCell,
    cells,
    didPrayWithCell,
    cellPrayerDays,
    cellPrayerStartTime,
    cellPrayerEndTime,
    cellPrayerReportTime,
    fellowshipName,
    fellowshipOther,
    prayedThisWeek,
    prayerDay,
    prayerStartTime,
    hoursOfPrayer,
    scriptures,
  ]);

  useEffect(() => {
    if (!draftLoaded) return;

    const timeout = setTimeout(() => {
      if (autoSaveState === "saved") setAutoSaveState("idle");
    }, 4000);

    return () => clearTimeout(timeout);
  }, [autoSaveState, draftLoaded]);

  const handlePartnerLookup = (index, value) => {
    const val = value.trim();

    setPartners((prev) => {
      const updated = [...prev];
      updated[index] = {
        workerId: val,
        fullName: "",
        resolved: normalizeText(val) === "none",
        notFound: false,
        isSearching: false,
      };
      return updated;
    });

    if (partnerLookupTimers.current[index]) {
      clearTimeout(partnerLookupTimers.current[index]);
    }

    if (!val || val.toLowerCase() === "none") return;
    if (val.length < 3) return;

    partnerLookupTimers.current[index] = setTimeout(async () => {
      setPartners((prev) => {
        const updated = [...prev];
        if (!updated[index]) return prev;
        updated[index] = { ...updated[index], isSearching: true };
        return updated;
      });

      try {
        const { data } = await axiosInstance.get(`/workers/by-worker-id/${val}`);
        setPartners((prev) => {
          const updated = [...prev];
          if (!updated[index]) return prev;
          updated[index] = {
            workerId: val,
            fullName: data.worker?.fullName || "",
            resolved: !!data.worker,
            notFound: !data.worker,
            isSearching: false,
          };
          return updated;
        });
      } catch {
        setPartners((prev) => {
          const updated = [...prev];
          if (!updated[index]) return prev;
          updated[index] = {
            ...updated[index],
            resolved: false,
            notFound: true,
            isSearching: false,
          };
          return updated;
        });
      }
    }, 500);
  };

  const handleFinalSubmit = async () => {
    if (!portalOpen) {
      toast.warning("Portal closed", "The portal is not open.");
      return;
    }

    if (!validate()) return;

    setDuplicates([]);

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
  const dups = err.response?.data?.duplicates || [];
  console.error("Submit failed:", err.response?.data || err);

  if (dups.length) {
    setDuplicates(dups);
    toast.error("Duplicate souls", msg);
  } else {
    toast.error("Error", msg);
  }
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
      <div className="card p-12 text-center space-y-4">
        <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
        <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100">
          {isEditMode ? "Report Updated" : "Report Submitted"}
        </h3>
        <p className="text-gray-500 dark:text-slate-400 text-sm">
          {isArrears
            ? "Arrears report submitted and locked."
            : "Submitted. Editable until Monday 2:59pm."}
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
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-purple-600 dark:text-purple-400 font-semibold">
            {isArrears ? "Arrears submission" : "Current week submission"}
          </p>
          <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
  {weekLabel || "This report will be saved under the active reporting week."}
</p>
<p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
  Autosave is on. If you are not ready, your work stays as a draft. Drafts do not count for qualification until you press Submit Report before Monday 2:59pm.
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

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
            Personal Report Only
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
            Submit only your personal evangelism. Do not include souls or attendees belonging to your partner.
            Whoever submits first claims the person — duplicates are blocked automatically.
          </p>
        </div>
      </div>

      {localMatchWarnings.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-800 rounded-xl p-4 space-y-1">
          <p className="font-bold text-yellow-800 dark:text-yellow-300 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Review possible local matches
          </p>
          {localMatchWarnings.map((w, i) => (
            <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">
              • {w.message}
            </p>
          ))}
        </div>
      )}

      {duplicates.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 space-y-1">
          <p className="font-bold text-red-800 dark:text-red-300 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {duplicates.length} person(s) already claimed by your partner
          </p>
          {duplicates.map((d, i) => (
            <p key={i} className="text-xs text-red-700 dark:text-red-400">
              • <strong>{d.soul}</strong> — submitted by <strong>{d.claimedBy}</strong>
            </p>
          ))}
          <button
            onClick={() => setDuplicates([])}
            className="text-xs text-red-500 flex items-center gap-1 pt-1"
          >
            <X className="w-3 h-3" />
            Dismiss
          </button>
        </div>
      )}

      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-900 dark:text-slate-100">
            Evangelism Partner(s) This Week
          </h3>
          <span className="text-xs text-red-400 font-semibold">Required</span>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500">
          List everyone you evangelised with. If alone, write <strong>None</strong>.
        </p>

        <div className="space-y-3">
          {partners.map((partner, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <input
                  className={cn(
                    "input-field flex-1",
                    partner.resolved && "border-green-400 dark:border-green-600",
                    partner.notFound && "border-red-400 dark:border-red-600"
                  )}
                  placeholder={
                    i === 0
                      ? "Enter Worker ID (e.g. 042) or type None if alone"
                      : "Enter Worker ID"
                  }
                  value={partner.workerId}
                  onChange={(e) => handlePartnerLookup(i, e.target.value)}
                />
                {partners.length > 1 && (
                  <button
                    onClick={() => setPartners((p) => p.filter((_, idx) => idx !== i))}
                    className="text-red-400 hover:text-red-600 flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {partner.isSearching && (
                <p className="text-xs text-blue-500 dark:text-blue-400 pl-6">
                  Checking worker ID...
                </p>
              )}

              {partner.resolved && partner.fullName && normalizeText(partner.workerId) !== "none" && (
                <p className="text-xs text-green-600 dark:text-green-400 pl-6 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  {partner.fullName} — confirmed
                </p>
              )}

              {partner.notFound && !partner.resolved && (
                <p className="text-xs text-red-500 dark:text-red-400 pl-6">
                  Worker ID not found. Check and re-enter.
                </p>
              )}

              {partner.workerId.toLowerCase() === "none" && (
                <p className="text-xs text-gray-400 pl-6">
                  Evangelised alone.
                </p>
              )}
            </div>
          ))}

          <button
            onClick={() =>
              setPartners((p) => [
                ...p,
                { workerId: "", fullName: "", resolved: false, notFound: false, isSearching: false },
              ])
            }
            className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add another partner
          </button>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="font-bold text-gray-900 dark:text-slate-100">Souls Preached To</h3>
          <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            {nonEmptySouls.length} soul{nonEmptySouls.length !== 1 ? "s" : ""}
          </span>
        </div>

        <p className="text-xs text-gray-400 dark:text-slate-500">Optional.</p>

        <div className="space-y-3">
          {souls.map((soul, i) => (
            <div key={i} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400">Soul #{i + 1}</span>
                {souls.length > 1 && (
                  <button
                    onClick={() => setSouls((s) => s.filter((_, idx) => idx !== i))}
                    className="text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Full Name</label>
                  <input
                    className="input-field"
                    placeholder="Name"
                    value={soul.fullName}
                    onChange={(e) => updateSoul(i, "fullName", e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label">Status</label>
                  <select
                    className="input-field"
                    value={soul.status}
                    onChange={(e) => updateSoul(i, "status", e.target.value)}
                  >
                    <option value="">Select salvation status</option>
                    {SOUL_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Phone</label>
                  <input
                    className="input-field"
                    placeholder="Phone"
                    value={soul.phone}
                    onChange={(e) => updateSoul(i, "phone", e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label">Location / Area</label>
                  <input
                    className="input-field"
                    placeholder="Area"
                    value={soul.location}
                    onChange={(e) => updateSoul(i, "location", e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setSouls((s) => [...s, { ...emptySoul }])}
          className="w-full py-2.5 border-2 border-dashed border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 rounded-xl text-sm font-medium hover:bg-purple-50 dark:hover:bg-purple-900/20 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add another soul
        </button>

        <div>
          <label className="form-label">Scriptures Used (comma separated)</label>
          <input
            className="input-field"
            placeholder="e.g. Mark 16:15, Romans 1:16"
            value={scriptures}
            onChange={(e) => setScriptures(e.target.value)}
          />
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-gray-900 dark:text-slate-100">Follow-up Activities</h3>
          <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-3 py-1 rounded-full text-sm font-semibold">
            {followUps.filter((f) => hasValue(f.fullName) || hasValue(f.topic) || hasValue(f.scriptures)).length}
          </span>
        </div>

        <p className="text-xs text-gray-400 dark:text-slate-500">Optional.</p>

        <div className="space-y-3">
          {followUps.map((f, i) => (
            <div key={i} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                {followUps.length > 1 && (
                  <button
                    onClick={() => setFollowUps((p) => p.filter((_, idx) => idx !== i))}
                    className="text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="form-label">Full Name</label>
                  <input
                    className="input-field"
                    placeholder="Name"
                    value={f.fullName}
                    onChange={(e) => updateFollowUp(i, "fullName", e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label">Topic</label>
                  <input
                    className="input-field"
                    placeholder="Topic discussed"
                    value={f.topic}
                    onChange={(e) => updateFollowUp(i, "topic", e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label">Scriptures</label>
                  <input
                    className="input-field"
                    placeholder="Hebrews 10:24-25"
                    value={f.scriptures}
                    onChange={(e) => updateFollowUp(i, "scriptures", e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setFollowUps((p) => [...p, { ...emptyFollowUp }])}
          className="w-full py-2.5 border-2 border-dashed border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 rounded-xl text-sm font-medium hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add follow-up
        </button>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="font-bold text-gray-900 dark:text-slate-100">People Brought to Church</h3>
          <span
            className={cn(
              "px-3 py-1 rounded-full text-sm font-semibold",
              churchCounts >= 4
                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
            )}
          >
            {churchCounts} qualifying{churchCounts >= 4 ? " ✓" : " / 4 min"}
          </span>
        </div>

        <p className="text-xs text-gray-400 dark:text-slate-500">Optional.</p>

        <div className="space-y-3">
          {attendees.map((a, i) => (
            <div key={i} className="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400 w-6">#{i + 1}</span>
                <input
                  className="input-field flex-1"
                  placeholder="Full name"
                  value={a.fullName}
                  onChange={(e) => updateAttendee(i, "fullName", e.target.value)}
                />
                {attendees.length > 1 && (
                  <button
                    onClick={() => setAttendees((p) => p.filter((_, idx) => idx !== i))}
                    className="text-red-400 hover:text-red-600 flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <label
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 cursor-pointer select-none transition-all w-full",
                  a.olderThan12
                    ? "border-purple-400 bg-purple-50 dark:bg-purple-900/20"
                    : "border-gray-200 dark:border-slate-600"
                )}
              >
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-purple-600 flex-shrink-0"
                  checked={a.olderThan12}
                  onChange={(e) => updateAttendee(i, "olderThan12", e.target.checked)}
                />
                <span
                  className={cn(
                    "text-sm font-medium",
                    a.olderThan12
                      ? "text-purple-700 dark:text-purple-300"
                      : "text-gray-500 dark:text-slate-400"
                  )}
                >
                  {a.olderThan12
                    ? "✓ Older than 12 — counts toward qualification"
                    : "Tick if this person is older than 12"}
                </span>
              </label>

              <div className="flex flex-wrap gap-2 pl-2">
                {[
                  { field: "attendedTuesday", label: "Tuesday" },
                  { field: "attendedSunday", label: "Sunday" },
                  { field: "attendedSpecial", label: "Special" },
                ].map(({ field, label }) => (
                  <label
                    key={field}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors select-none",
                      a[field]
                        ? "border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                        : "border-gray-200 dark:border-slate-600 text-gray-500"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={a[field]}
                      onChange={(e) => updateAttendee(i, field, e.target.checked)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setAttendees((p) => [...p, { ...emptyAttendee }])}
          className="w-full py-2.5 border-2 border-dashed border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 rounded-xl text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add another person
        </button>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-900 dark:text-slate-100">Your Service Attendance</h3>
          <span className="text-xs text-red-400 font-semibold">Required</span>
        </div>

        {serviceAttendance.map((s, i) => (
          <div key={s.serviceType} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3">
            <p className="font-semibold text-gray-900 dark:text-slate-100 capitalize text-sm">
              {s.serviceType} Service
            </p>

            {frontDeskCheckIns[s.serviceType] && (
              <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-3 py-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                  Front desk recorded your check-in at <strong>{frontDeskCheckIns[s.serviceType].time}</strong>
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {[
                { val: true, label: "Yes, I attended" },
                { val: false, label: "No, I did not" },
              ].map(({ val, label }) => (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => updateSA(i, "attended", val)}
                  className={cn(
                    "py-2.5 rounded-xl border-2 text-sm font-medium transition-all",
                    s.attended === val
                      ? val
                        ? "border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                        : "border-red-300 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                      : "border-gray-200 dark:border-slate-600 text-gray-500 hover:border-gray-300"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {s.attended === true && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">
                    Your Reporting Time
                    {frontDeskCheckIns[s.serviceType] && (
                      <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-normal">
                        · recorded by front desk
                      </span>
                    )}
                  </label>
                  <input
                    type="time"
                    className={cn(
                      "input-field",
                      frontDeskCheckIns[s.serviceType] &&
                        "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700"
                    )}
                    value={s.reportingTime}
                    onChange={(e) => updateSA(i, "reportingTime", e.target.value)}
                    readOnly={!!frontDeskCheckIns[s.serviceType]}
                  />
                </div>

                <div>
                  <label className="form-label">Late reason (if any)</label>
                  <input
                    className="input-field"
                    placeholder="Leave blank if on time"
                    value={s.lateReason || ""}
                    onChange={(e) => updateSA(i, "lateReason", e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-900 dark:text-slate-100">Cell Meeting</h3>
          <span className="text-xs text-red-400 font-semibold">Required</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { val: true, label: "Yes, I attended" },
            { val: false, label: "No, I did not" },
          ].map(({ val, label }) => (
            <button
              key={String(val)}
              type="button"
              onClick={() => setDidAttendCell(val)}
              className={cn(
                "py-2.5 rounded-xl border-2 text-sm font-medium transition-all",
                didAttendCell === val
                  ? val
                    ? "border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                    : "border-red-300 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                  : "border-gray-200 dark:border-slate-600 text-gray-500 hover:border-gray-300"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {didAttendCell === true && (
          <div className="space-y-4">
            {cells.map((cell, i) => (
              <div key={i} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                    Cell {i + 1}
                  </p>
                  {cells.length > 1 && (
                    <button
                      onClick={() => setCells((p) => p.filter((_, idx) => idx !== i))}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="relative">
                  <label className="form-label">Cell Name</label>
                  <input
                    className="input-field"
                    placeholder="Name of your cell"
                    value={cell.cellName}
                    onChange={(e) => updateCell(i, "cellName", e.target.value)}
                    autoComplete="off"
                  />

                  {pastCellNames.length > 0 && cell.cellName === "" && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {pastCellNames.map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => updateCell(i, "cellName", name)}
                          className="px-2.5 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 rounded-lg text-xs font-medium hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}

                  {pastCellNames.length > 0 && cell.cellName.length > 0 && (() => {
                    const filtered = pastCellNames.filter(
                      (n) =>
                        n.toLowerCase().includes(cell.cellName.toLowerCase()) &&
                        n !== cell.cellName
                    );

                    return filtered.length > 0 ? (
                      <div className="absolute z-10 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg overflow-hidden">
                        {filtered.map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => updateCell(i, "cellName", name)}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    ) : null;
                  })()}
                </div>

                <div>
                  <label className="form-label">Meeting Day</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {DAYS.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() =>
                          updateCell(i, "meetingDays", cell.meetingDays[0] === day ? [] : [day])
                        }
                        className={cn(
                          "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                          cell.meetingDays[0] === day
                            ? "border-purple-400 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                            : "border-gray-200 dark:border-slate-600 text-gray-500 hover:border-purple-300"
                        )}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Time you reported</label>
                    <input
                      type="time"
                      className="input-field"
                      value={cell.reportTime}
                      onChange={(e) => updateCell(i, "reportTime", e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="form-label">Role played (if any)</label>
                    <input
                      className="input-field"
                      placeholder="e.g. Led worship, Taught"
                      value={cell.role}
                      onChange={(e) => updateCell(i, "role", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={() => setCells((p) => [...p, { ...emptyCell }])}
              className="w-full py-2.5 border-2 border-dashed border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 rounded-xl text-sm font-medium hover:bg-purple-50 dark:hover:bg-purple-900/20 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add another cell
            </button>
          </div>
        )}

        <div className="border-t border-gray-100 dark:border-slate-700 pt-4 space-y-4">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-900 dark:text-slate-100">
              Cell Prayer
            </h4>
            <span className="text-xs text-gray-400">
              Shares qualification with cell attendance
            </span>
          </div>

          <p className="text-xs text-gray-400 dark:text-slate-500">
            Did you pray with your cell for at least 2 hours this week?
          </p>

          <div className="grid grid-cols-2 gap-3">
            {[
              { val: true, label: "Yes, I prayed" },
              { val: false, label: "No, I did not" },
            ].map(({ val, label }) => (
              <button
                key={String(val)}
                type="button"
                onClick={() => setDidPrayWithCell(val)}
                className={cn(
                  "py-2.5 rounded-xl border-2 text-sm font-medium transition-all",
                  didPrayWithCell === val
                    ? val
                      ? "border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                      : "border-red-300 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                    : "border-gray-200 dark:border-slate-600 text-gray-500 hover:border-gray-300"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {didPrayWithCell === true && (
            <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-4">
              <div>
                <label className="form-label">Prayer day(s)</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {PRAYER_DAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => togglePrayerDay(day)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                        cellPrayerDays.includes(day)
                          ? "border-purple-400 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                          : "border-gray-200 dark:border-slate-600 text-gray-500 hover:border-purple-300"
                      )}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="form-label">Prayer start time</label>
                  <input
                    type="time"
                    className="input-field"
                    value={cellPrayerStartTime}
                    onChange={(e) => setCellPrayerStartTime(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label">Prayer end time</label>
                  <input
                    type="time"
                    className="input-field"
                    value={cellPrayerEndTime}
                    onChange={(e) => setCellPrayerEndTime(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label">Time you reported prayer</label>
                  <input
                    type="time"
                    className="input-field"
                    value={cellPrayerReportTime}
                    onChange={(e) => setCellPrayerReportTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="text-xs">
                {cellPrayerHours >= 2 ? (
                  <p className="text-green-600 dark:text-green-400 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    {cellPrayerHours.toFixed(1)} hours — qualifies
                  </p>
                ) : (
                  <p className="text-amber-500">
                    Minimum 2 hours required to qualify through cell prayer.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-900 dark:text-slate-100">Fellowship Prayer</h3>
          <span className="text-xs text-red-400 font-semibold">Required</span>
        </div>

        <div>
          <label className="form-label">Which fellowship do you belong to?</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {FELLOWSHIPS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFellowshipName(f)}
                className={cn(
                  "px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all",
                  fellowshipName === f
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                    : "border-gray-200 dark:border-slate-600 text-gray-500 hover:border-purple-300"
                )}
              >
                {f}
              </button>
            ))}
          </div>

          {fellowshipName === "Other" && (
            <input
              className="input-field mt-3"
              placeholder="Enter your fellowship name"
              value={fellowshipOther}
              onChange={(e) => setFellowshipOther(e.target.value)}
            />
          )}
        </div>

        <div>
          <label className="form-label">Did you pray in your fellowship this week?</label>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {[
              { val: true, label: "Yes, I prayed" },
              { val: false, label: "No, I did not" },
            ].map(({ val, label }) => (
              <button
                key={String(val)}
                type="button"
                onClick={() => setPrayedThisWeek(val)}
                className={cn(
                  "py-2.5 rounded-xl border-2 text-sm font-medium transition-all",
                  prayedThisWeek === val
                    ? val
                      ? "border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                      : "border-red-300 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                    : "border-gray-200 dark:border-slate-600 text-gray-500 hover:border-gray-300"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {prayedThisWeek === true && (
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
            <div>
              <label className="form-label">Day of prayer</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {PRAYER_DAYS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setPrayerDay(day)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                      prayerDay === day
                        ? "border-purple-400 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                        : "border-gray-200 dark:border-slate-600 text-gray-500 hover:border-purple-300"
                    )}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label">Time prayer started</label>
                <input
                  type="time"
                  className="input-field"
                  value={prayerStartTime}
                  onChange={(e) => setPrayerStartTime(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">Hours of prayer</label>
                <input
                  type="number"
                  min="0"
                  max="12"
                  step="0.5"
                  className="input-field"
                  placeholder="e.g. 2"
                  value={hoursOfPrayer}
                  onChange={(e) => setHoursOfPrayer(e.target.value)}
                />
              </div>
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
 disabled={loading || !portalOpen || (weekType === "past" && !weekDate)}
  className={cn(
    "flex items-center justify-center gap-2 font-medium px-4 py-2 rounded-lg transition-all",
    portalOpen && (weekType !== "past" || weekDate)
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

export default EvangelismForm;
