import { useState, useEffect, useRef, useMemo } from "react";
import {
  Plus,
  Minus,
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
import { useDraftInteraction } from "../../hooks/useDraftInteraction";
import axiosInstance from "../../utils/axiosInstance";
import { SOUL_STATUSES } from "../../utils/constants";
import { useToast, ToastContainer } from "../../components/common/Toast";
import {
  getFriendlyReportError,
  getNoDraftYetMessage,
  getReportSuccessMessage,
} from "../../utils/reportFeedback";
import {
  flushDraftAutosaveIfDue,
  REPORT_AUTOSAVE_DEBOUNCE_MS,
  REPORT_AUTOSAVE_INTERVAL_MS,
} from "../../utils/reportAutosave";
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
const emptyCellMeetingPerson = {
  fullName: "",
  olderThan12: false,
};
const createEmptyCellMeetingPerson = () => ({ ...emptyCellMeetingPerson });
const createEmptyCellMeetingGroup = () => ({
  cellName: "",
  attendanceStatus: null,
  people: [createEmptyCellMeetingPerson()],
});

const FELLOWSHIPS = ["Fellowship 1", "Fellowship 2", "Fellowship 3", "Other"];
const PRAYER_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MIN_CELL_MEETING_PEOPLE = 4;
const CELL_NAME_STORAGE_KEY = "yahal_evangelism_cell_names";
const CELL_ATTENDANCE_OPTIONS = [
  {
    value: "attended",
    label: "Yes, I attended",
    activeClass:
      "border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300",
  },
  {
    value: "not_attended",
    label: "No, I did not",
    activeClass:
      "border-red-300 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400",
  },
  {
    value: "not_applicable",
    label: "N/A - School on vacation (Campus Cell)",
    activeClass:
      "border-amber-300 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300",
  },
];
const CELL_PRAYER_OPTIONS = [
  {
    value: "prayed",
    label: "Yes, I prayed",
    activeClass:
      "border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300",
  },
  {
    value: "not_prayed",
    label: "No, I did not",
    activeClass:
      "border-red-300 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400",
  },
  {
    value: "not_applicable",
    label: "N/A - Clashed with another church program",
    activeClass:
      "border-amber-300 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300",
  },
];
const normalizeText = (value = "") =>
  (value ?? "").toString().trim().replace(/\s+/g, " ").toLowerCase();

const normalizePhone = (value = "") =>
  value.toString().replace(/[^\d]/g, "");

const hasValue = (value) => normalizeText(value).length > 0;

const normalizeCellCountValue = (value) => {
  const count = Number.parseInt(value, 10);
  return Number.isFinite(count) && count > 0 ? count : 1;
};

const normalizeCellAttendanceStatus = (value) => {
  if (value === true) return "attended";
  if (value === false) return "not_attended";

  const normalized = normalizeText(value).replace(/[\s-]+/g, "_");

  if (["attended", "yes", "yes_i_attended"].includes(normalized)) {
    return "attended";
  }

  if (["not_attended", "no", "no_i_did_not", "absent"].includes(normalized)) {
    return "not_attended";
  }

  if (["na", "n_a", "n/a", "not_applicable", "school_on_vacation"].includes(normalized)) {
    return "not_applicable";
  }

  return null;
};

const normalizeCellPrayerStatus = (cellPrayer = {}) => {
  const prayer = cellPrayer ?? {};
  const status = normalizeText(prayer.prayerStatus).replace(/[\s-]+/g, "_");

  if (["prayed", "yes", "yes_i_prayed"].includes(status)) return "prayed";
  if (["not_prayed", "no", "no_i_did_not"].includes(status)) return "not_prayed";
  if (["na", "n_a", "n/a", "not_applicable"].includes(status)) return "not_applicable";
  if (prayer.didPrayWithCell === true) return "prayed";
  if (prayer.didPrayWithCell === false) return "not_prayed";

  return null;
};

const isCellMeetingPersonAtLeast12 = (person = {}) => {
  if (person.olderThan12 === true) return true;
  if (person.ageRange === "above-12") return true;
  const age = Number(person.age);
  return Number.isFinite(age) && age >= 12;
};

const normalizeCellMeetingPerson = (person = {}) => ({
  fullName: person.fullName || "",
  olderThan12: isCellMeetingPersonAtLeast12(person),
});

const getStoredCellNames = () => {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(localStorage.getItem(CELL_NAME_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((name) => hasValue(name)) : [];
  } catch {
    return [];
  }
};

const mergeCellNames = (...nameLists) => {
  const names = new Map();

  nameLists.flat().forEach((name) => {
    const trimmed = name?.toString?.().trim();
    if (!trimmed) return;
    names.set(normalizeText(trimmed), trimmed);
  });

  return [...names.values()].slice(0, 20);
};

const normalizePeopleTakenToCellGroups = (groups = []) => {
  const normalizedGroups = groups
    .map((group) => {
      const people = Array.isArray(group.people)
        ? group.people.map(normalizeCellMeetingPerson)
        : [];

      return {
        cellName: group.cellName || "",
        attendanceStatus: normalizeCellAttendanceStatus(
          group.attendanceStatus ?? group.attended ?? group.didAttendCell
        ),
        people: people.length ? people : [createEmptyCellMeetingPerson()],
      };
    })
    .filter(
      (group) =>
        hasValue(group.cellName) ||
        group.attendanceStatus ||
        group.people.some((person) => hasValue(person.fullName))
    );

  return normalizedGroups.length ? normalizedGroups : [createEmptyCellMeetingGroup()];
};

const groupFlatPeopleTakenToCell = (people = [], fallbackCellName = "") => {
  const groups = new Map();

  people.forEach((person) => {
    const cellName = person.cellName || fallbackCellName || "";
    const key = normalizeText(cellName) || "__blank__";
    const existing =
      groups.get(key) || {
        cellName,
        attendanceStatus: null,
        people: [],
      };

    existing.people.push(normalizeCellMeetingPerson(person));
    groups.set(key, existing);
  });

  return normalizePeopleTakenToCellGroups([...groups.values()]);
};

const normalizeCellActivityGroupForUi = (group = {}) => {
  const people = Array.isArray(group.people)
    ? group.people.map(normalizeCellMeetingPerson)
    : [];

  return {
    cellName: group.cellName || "",
    attendanceStatus: normalizeCellAttendanceStatus(
      group.attendanceStatus ?? group.attended ?? group.didAttendCell
    ),
    people: people.length ? people : [createEmptyCellMeetingPerson()],
  };
};

const ensureCellActivityGroupCount = (groups = [], count = 1) => {
  const targetCount = normalizeCellCountValue(count);
  const nextGroups = groups.slice(0, targetCount).map(normalizeCellActivityGroupForUi);

  while (nextGroups.length < targetCount) {
    nextGroups.push(createEmptyCellMeetingGroup());
  }

  return nextGroups;
};

const buildCellActivityGroupsFromDraft = (cellData = {}) => {
  if (Array.isArray(cellData.cellActivityGroups) && cellData.cellActivityGroups.length) {
    return normalizePeopleTakenToCellGroups(cellData.cellActivityGroups);
  }

  const cellGroupsFromPeople = cellData.peopleTakenToCellGroups?.length
    ? normalizePeopleTakenToCellGroups(cellData.peopleTakenToCellGroups)
    : cellData.peopleTakenToCell?.length
    ? groupFlatPeopleTakenToCell(cellData.peopleTakenToCell, cellData.cells?.[0]?.cellName || "")
    : [];

  const cells = Array.isArray(cellData.cells) ? cellData.cells : [];
  const fallbackStatus =
    cellData.didAttendCell === true
      ? "attended"
      : cellData.didAttendCell === false
      ? "not_attended"
      : null;
  const groupCount = Math.max(cellGroupsFromPeople.length, cells.length, 1);

  return Array.from({ length: groupCount }, (_, index) => {
    const peopleGroup = cellGroupsFromPeople[index] || {};
    const cell = cells[index] || {};
    const status =
      normalizeCellAttendanceStatus(
        peopleGroup.attendanceStatus ?? cell.attendanceStatus ?? cell.attended
      ) || fallbackStatus;

    return {
      cellName: peopleGroup.cellName || cell.cellName || "",
      attendanceStatus: status,
      people: peopleGroup.people?.length
        ? peopleGroup.people
        : [createEmptyCellMeetingPerson()],
    };
  });
};

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

const parsePartnerValue = (value = "") => {
  const raw = value.toString().trim();

  if (!raw) {
    return {
      workerId: "",
      fullName: "",
      resolved: false,
    };
  }

  if (normalizeText(raw) === "none") {
    return {
      workerId: "None",
      fullName: "",
      resolved: true,
    };
  }

  const pairMatch =
    raw.match(/^(.*?)\s*\((\d+)\)$/) ||
    raw.match(/^(.*?)\s*-\s*(\d+)$/);

  if (pairMatch) {
    return {
      workerId: pairMatch[2].trim(),
      fullName: pairMatch[1].trim(),
      resolved: true,
    };
  }

  if (/^\d+$/.test(raw)) {
    return {
      workerId: raw,
      fullName: "",
      resolved: false,
    };
  }

  return {
    workerId: raw,
    fullName: "",
    resolved: false,
  };
};

const formatPartnerValue = (partner) => {
  const workerId = partner?.workerId?.trim?.() || "";
  const fullName = partner?.fullName?.trim?.() || "";

  if (normalizeText(workerId) === "none" || normalizeText(fullName) === "none") {
    return "None";
  }

  if (workerId && fullName && /^\d+$/.test(workerId)) {
    return `${fullName} (${workerId})`;
  }

  return workerId || fullName;
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
  const { hasInteracted, interactionProps, markInteracted } = useDraftInteraction();

  const [submitted, setSubmitted] = useState(false);
  const [duplicates, setDuplicates] = useState([]);

  const [partners, setPartners] = useState([
    { workerId: "", fullName: "", resolved: false, notFound: false, isSearching: false },
  ]);

  const [souls, setSouls] = useState([{ ...emptySoul }]);
  const [scriptures, setScriptures] = useState("");
  const [followUps, setFollowUps] = useState([{ ...emptyFollowUp }]);
  const [attendees, setAttendees] = useState([{ ...emptyAttendee }]);
  const [cellCount, setCellCount] = useState(1);
  const [peopleTakenToCellGroups, setPeopleTakenToCellGroups] = useState([
    createEmptyCellMeetingGroup(),
  ]);

  const [serviceAttendance, setServiceAttendance] = useState([
    { serviceType: "tuesday", attended: null, reportingTime: "", lateReason: "" },
    { serviceType: "sunday", attended: null, reportingTime: "", lateReason: "" },
  ]);

  const [cellPrayerStatus, setCellPrayerStatus] = useState(null);
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
  const [pastCellNames, setPastCellNames] = useState(() => getStoredCellNames());

  const [draftLoaded, setDraftLoaded] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState("idle");
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const partnerLookupTimers = useRef({});
  const lastSaveRef = useRef(0);
  const autoSaveRef = useRef(() => {});
  const frontDeskCheckInsRef = useRef(frontDeskCheckIns);
  const partnersRef = useRef(partners);

  useEffect(() => {
    frontDeskCheckInsRef.current = frontDeskCheckIns;
  }, [frontDeskCheckIns]);

  useEffect(() => {
    partnersRef.current = partners;
  }, [partners]);

  useEffect(() => {
    axiosInstance
      .get("/reports/my-cell-names")
      .then(({ data }) =>
        setPastCellNames((current) => mergeCellNames(current, data.cellNames || []))
      )
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

    const loadDraft = async () => {
      if (!mounted) return;
      setDraftLoaded(false);
      setHydrated(false);

      try {
        const { draft } = await fetchMyDraft({
          reportType: "evangelism",
          weekReference,
          weekType,
          weekDate,
        });

        if (!mounted) return;

        if (!draft) {
          setCellCount(1);
          setPeopleTakenToCellGroups([createEmptyCellMeetingGroup()]);
          setCellPrayerStatus(null);
          setCellPrayerDays([]);
          setCellPrayerStartTime("");
          setCellPrayerEndTime("");
          setCellPrayerReportTime("");
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
            draft.evangelismData.evangelismPartners.map((p) => {
              const parsedPartner = parsePartnerValue(p);
              return {
                workerId: parsedPartner.workerId,
                fullName: parsedPartner.fullName,
                resolved: parsedPartner.resolved,
                notFound: false,
                isSearching: false,
              };
            })
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
              fromFrontDesk: !!frontDeskCheckInsRef.current?.[s.serviceType],
            }))
          );
        }

        if (draft.cellData) {
          const draftCellGroups = buildCellActivityGroupsFromDraft(draft.cellData);
          const nextCellCount = normalizeCellCountValue(
            draft.cellData.numberOfCells || draftCellGroups.length
          );

          setCellCount(nextCellCount);
          setPeopleTakenToCellGroups(
            ensureCellActivityGroupCount(draftCellGroups, nextCellCount)
          );

          if (draft.cellData.cellPrayer) {
            setCellPrayerStatus(normalizeCellPrayerStatus(draft.cellData.cellPrayer));
            setCellPrayerDays(draft.cellData.cellPrayer.days || []);
            setCellPrayerStartTime(toTimeInputValue(draft.cellData.cellPrayer.startTime || ""));
            setCellPrayerEndTime(toTimeInputValue(draft.cellData.cellPrayer.endTime || ""));
            setCellPrayerReportTime(toTimeInputValue(draft.cellData.cellPrayer.reportTime || ""));
          } else {
            setCellPrayerStatus(null);
            setCellPrayerDays([]);
            setCellPrayerStartTime("");
            setCellPrayerEndTime("");
            setCellPrayerReportTime("");
          }
        } else {
          setCellCount(1);
          setPeopleTakenToCellGroups([createEmptyCellMeetingGroup()]);
          setCellPrayerStatus(null);
          setCellPrayerDays([]);
          setCellPrayerStartTime("");
          setCellPrayerEndTime("");
          setCellPrayerReportTime("");
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
      } catch {
        if (!mounted) return;
        setDraftLoaded(true);
        setHydrated(true);
      }
    };

    loadDraft();

    return () => {
      mounted = false;
    };
  }, [weekReference, weekType, weekDate, isEditMode, fetchMyDraft]);

  useEffect(() => {
    if (!draftLoaded) return;

    partnersRef.current.forEach(async (partner, index) => {
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

  const updateCellCount = (value) => {
    const nextCount = normalizeCellCountValue(value);
    markInteracted();
    setCellCount(nextCount);
    setPeopleTakenToCellGroups((groups) =>
      ensureCellActivityGroupCount(groups, nextCount)
    );
  };

  const adjustCellCount = (delta) => {
    updateCellCount(cellCount + delta);
  };

  const updatePeopleTakenToCellGroupName = (groupIndex, value) => {
    markInteracted();
    setPeopleTakenToCellGroups((groups) =>
      groups.map((group, idx) =>
        idx === groupIndex ? { ...group, cellName: value } : group
      )
    );
  };

  const updateCellActivityAttendance = (groupIndex, value) => {
    markInteracted();
    setPeopleTakenToCellGroups((groups) =>
      groups.map((group, idx) =>
        idx === groupIndex ? { ...group, attendanceStatus: value } : group
      )
    );
  };

  const updateCellMeetingPerson = (groupIndex, personIndex, key, value) => {
    markInteracted();
    setPeopleTakenToCellGroups((groups) =>
      groups.map((group, idx) =>
        idx === groupIndex
          ? {
              ...group,
              people: group.people.map((person, pIdx) =>
                pIdx === personIndex ? { ...person, [key]: value } : person
              ),
            }
          : group
      )
    );
  };

  const updateSA = (i, k, v) => {
    markInteracted();
    setServiceAttendance((p) => p.map((s, idx) => (idx === i ? { ...s, [k]: v } : s)));
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

  const visibleCellActivityGroups = useMemo(
    () => ensureCellActivityGroupCount(peopleTakenToCellGroups, cellCount),
    [peopleTakenToCellGroups, cellCount]
  );

  const nonEmptyPeopleTakenToCellGroups = useMemo(
    () =>
      visibleCellActivityGroups
        .map((group) => ({
          cellName: group.cellName || "",
          attendanceStatus: normalizeCellAttendanceStatus(group.attendanceStatus),
          people: (group.people || []).filter(
            (person) => hasValue(person.fullName) || person.olderThan12
          ),
        }))
        .filter(
          (group) =>
            hasValue(group.cellName) ||
            group.attendanceStatus ||
            group.people.length > 0
        ),
    [visibleCellActivityGroups]
  );

  const nonEmptyCellMeetingPeople = useMemo(
    () =>
      nonEmptyPeopleTakenToCellGroups.flatMap((group) =>
        group.people.map((person) => ({
          ...person,
          cellName: group.cellName,
        }))
      ),
    [nonEmptyPeopleTakenToCellGroups]
  );

  const qualifyingCellMeetingPeople = useMemo(
    () => nonEmptyCellMeetingPeople.filter(isCellMeetingPersonAtLeast12),
    [nonEmptyCellMeetingPeople]
  );

  const cellMeetingPeopleCount = qualifyingCellMeetingPeople.length;

  const attendedAnyCell = useMemo(
    () =>
      visibleCellActivityGroups.some(
        (group) => normalizeCellAttendanceStatus(group.attendanceStatus) === "attended"
      ),
    [visibleCellActivityGroups]
  );

  const hasInvalidCellMeetingPeople = useMemo(
    () =>
      nonEmptyPeopleTakenToCellGroups.some((group) =>
        group.people.some(
          (person) => !hasValue(group.cellName) || !hasValue(person.fullName)
        )
      ),
    [nonEmptyPeopleTakenToCellGroups]
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
    const cellActivitiesValid =
      cellCount > 0 &&
      visibleCellActivityGroups.every(
        (group) => hasValue(group.cellName) && !!normalizeCellAttendanceStatus(group.attendanceStatus)
      );
    const fellowshipValid = hasValue(fellowshipName);
    const fellowshipOtherValid =
      fellowshipName !== "Other" || hasValue(fellowshipOther);
    const fellowshipPrayerValid = prayedThisWeek !== null;

    const cellPrayerValid = !!cellPrayerStatus;

    return {
      partnersValid,
      serviceValid,
      cellAttendanceValid: cellActivitiesValid,
      cellMeetingPeopleValid: !hasInvalidCellMeetingPeople,
      fellowshipValid,
      fellowshipOtherValid,
      fellowshipPrayerValid,
      cellPrayerValid,
      minimalSubmitValid:
        partnersValid &&
        serviceValid &&
        cellActivitiesValid &&
        !hasInvalidCellMeetingPeople &&
        fellowshipValid &&
        fellowshipOtherValid &&
        fellowshipPrayerValid &&
        cellPrayerValid,
    };
  }, [
    partnerFilled,
    serviceAttendance,
    cellCount,
    visibleCellActivityGroups,
    hasInvalidCellMeetingPeople,
    fellowshipName,
    fellowshipOther,
    prayedThisWeek,
    cellPrayerStatus,
  ]);

  const buildPayload = () => ({
    reportType: "evangelism",
    weekType,
    weekDate,
    weekReference,   // always send the frontend-computed weekReference
    isEdit: isEditMode,
    draftStarted: hasInteracted,
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
        .map((p) => formatPartnerValue(p))
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
      numberOfCells: cellCount,
      didAttendCell: attendedAnyCell,
      cellActivityGroups: visibleCellActivityGroups.map((group) => ({
        cellName: (group.cellName || "").trim(),
        attendanceStatus: normalizeCellAttendanceStatus(group.attendanceStatus) || "",
        people: (group.people || [])
          .filter((person) => hasValue(person.fullName) || person.olderThan12)
          .map((person) => ({
            fullName: (person.fullName || "").trim(),
            olderThan12: person.olderThan12 === true,
          })),
      })),
      cells: visibleCellActivityGroups.map((group) => ({
        cellName: (group.cellName || "").trim(),
        attendanceStatus: normalizeCellAttendanceStatus(group.attendanceStatus) || "",
        attended: normalizeCellAttendanceStatus(group.attendanceStatus) === "attended",
        meetingDays: [],
        reportTime: "",
        role: "",
      })),
      peopleTakenToCellGroups: nonEmptyPeopleTakenToCellGroups.map((group) => ({
        cellName: group.cellName.trim(),
        attendanceStatus: normalizeCellAttendanceStatus(group.attendanceStatus) || "",
        people: group.people.map((person) => ({
          fullName: (person.fullName || "").trim(),
          olderThan12: person.olderThan12 === true,
        })),
      })),
      peopleTakenToCell: nonEmptyCellMeetingPeople.map((person) => ({
        fullName: (person.fullName || "").trim(),
        cellName: (person.cellName || "").trim(),
        olderThan12: person.olderThan12 === true,
      })),
      cellPrayer: {
        prayerStatus: cellPrayerStatus || "",
        didPrayWithCell: cellPrayerStatus === "prayed",
        days: cellPrayerStatus === "prayed" ? cellPrayerDays : [],
        startTime: cellPrayerStatus === "prayed" ? cellPrayerStartTime : "",
        endTime: cellPrayerStatus === "prayed" ? cellPrayerEndTime : "",
        reportTime: cellPrayerStatus === "prayed" ? cellPrayerReportTime : "",
        hours: cellPrayerStatus === "prayed" ? Math.max(cellPrayerHours, 2) : 0,
        notApplicableReason:
          cellPrayerStatus === "not_applicable"
            ? "Clashed with another church program"
            : "",
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
        "Cell activities required",
        "Enter each cell name and choose Yes, No, or N/A for attendance."
      );
      return false;
    }

    if (!sectionValidity.cellMeetingPeopleValid) {
      toast.warning(
        "Cell meeting people incomplete",
        "Type the cell name first, then add the name of each person taken to that cell."
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
        "Cell prayer required",
        "Choose Yes, No, or N/A for cell prayer."
      );
      return false;
    }

    return true;
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
      const payload = buildPayload();
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

      if (!silent && source === "manual") {
        toast.success(
          "Draft saved",
          getReportSuccessMessage(result, "Draft saved.")
        );
      }
    } catch (err) {
      const msg = getFriendlyReportError(err, { action: "draft" });
      console.error("Draft save failed:", err.response?.data || err);
      setAutoSaveState("error");
      if (!silent) {
        toast.error("Draft not saved", msg);
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

    const debounce = setTimeout(() => {
      autoSaveRef.current();
    }, REPORT_AUTOSAVE_DEBOUNCE_MS);

    const interval = setInterval(() => {
      autoSaveRef.current();
    }, REPORT_AUTOSAVE_INTERVAL_MS);

    const flushDraft = () => {
      flushDraftAutosaveIfDue(lastSaveRef, autoSaveRef);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushDraft();
      }
    };

    window.addEventListener("blur", flushDraft);
    window.addEventListener("pagehide", flushDraft);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearTimeout(debounce);
      clearInterval(interval);
      window.removeEventListener("blur", flushDraft);
      window.removeEventListener("pagehide", flushDraft);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [
    draftLoaded,
    hydrated,
    submitted,
    souls,
    partners,
    followUps,
    attendees,
    cellCount,
    peopleTakenToCellGroups,
    serviceAttendance,
    cellPrayerStatus,
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

  const handlePartnerLookup = (index, value) => {
    const val = value.trim();
    markInteracted();

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
      const result =
        isEditMode && existingReportId
          ? await handleEdit(existingReportId, buildPayload())
          : await handleSubmit(buildPayload());
      setSubmitted(true);
      toast.success(
        isEditMode ? "Report updated" : "Report submitted",
        getReportSuccessMessage(
          result,
          isEditMode ? "Evangelism report updated." : "Evangelism report submitted."
        )
      );
    } catch (err) {
      const msg = getFriendlyReportError(err, {
        action: isEditMode ? "update" : "submit",
      });
      const dups = err.response?.data?.duplicates || [];
      console.error("Submit failed:", err.response?.data || err);

      if (dups.length) {
        setDuplicates(dups);
        toast.error("Duplicate souls found", msg);
      } else {
        toast.error(isEditMode ? "Update not saved" : "Report not submitted", msg);
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
    <div className="space-y-6" {...interactionProps}>
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
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            Before leaving this page, press Save Draft Now below so your work stays stored even if submission is still pending.
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
            Submit only your personal evangelism. Do not include souls, church attendees, or cell meeting people belonging to your partner.
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
              • <strong>{d.soul}</strong> — submitted by <strong>{d.claimedBy}{d.claimedByWorkerId ? ` (${d.claimedByWorkerId})` : ""}</strong>
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
                    onClick={() => {
                      markInteracted();
                      setPartners((p) => p.filter((_, idx) => idx !== i));
                    }}
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
                  {partner.fullName} ({partner.workerId}) confirmed
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
            onClick={() => {
              markInteracted();
              setPartners((p) => [
                ...p,
                { workerId: "", fullName: "", resolved: false, notFound: false, isSearching: false },
              ]);
            }}
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
                    onClick={() => {
                      markInteracted();
                      setSouls((s) => s.filter((_, idx) => idx !== i));
                    }}
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
          onClick={() => {
            markInteracted();
            setSouls((s) => [...s, { ...emptySoul }]);
          }}
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
                    onClick={() => {
                      markInteracted();
                      setFollowUps((p) => p.filter((_, idx) => idx !== i));
                    }}
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
          onClick={() => {
            markInteracted();
            setFollowUps((p) => [...p, { ...emptyFollowUp }]);
          }}
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
                    onClick={() => {
                      markInteracted();
                      setAttendees((p) => p.filter((_, idx) => idx !== i));
                    }}
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
          onClick={() => {
            markInteracted();
            setAttendees((p) => [...p, { ...emptyAttendee }]);
          }}
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

      <div className="card p-5 space-y-5">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-900 dark:text-slate-100 uppercase">
            Cell Activities
          </h3>
          <span className="text-xs text-red-400 font-semibold">Required</span>
        </div>

        <div>
          <label className="form-label">How many Cells do you belong to?</label>
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={() => adjustCellCount(-1)}
              disabled={cellCount <= 1}
              className="w-10 h-10 rounded-xl border-2 border-gray-200 dark:border-slate-600 text-gray-500 hover:border-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
              aria-label="Decrease cell count"
            >
              <Minus className="w-4 h-4" />
            </button>
            <input
              type="number"
              min="1"
              inputMode="numeric"
              className="input-field w-24 text-center"
              value={cellCount}
              onChange={(e) => updateCellCount(e.target.value)}
            />
            <button
              type="button"
              onClick={() => adjustCellCount(1)}
              className="w-10 h-10 rounded-xl border-2 border-gray-200 dark:border-slate-600 text-gray-500 hover:border-cyan-300 flex items-center justify-center"
              aria-label="Increase cell count"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-4">
            {visibleCellActivityGroups.map((group, groupIndex) => (
              <div
                key={groupIndex}
                className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl space-y-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                    Cell Group {groupIndex + 1}
                  </p>
                  {cellCount > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        markInteracted();
                        setPeopleTakenToCellGroups((groups) =>
                          groups.filter((_, idx) => idx !== groupIndex)
                        );
                        setCellCount((count) => Math.max(1, count - 1));
                      }}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="relative">
                  <label className="form-label">Cell name</label>
                  <input
                    className="input-field"
                    placeholder="Type the cell name"
                    value={group.cellName}
                    onChange={(e) =>
                      updatePeopleTakenToCellGroupName(groupIndex, e.target.value)
                    }
                    autoComplete="off"
                  />

                  {pastCellNames.length > 0 && group.cellName === "" && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {pastCellNames.map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => updatePeopleTakenToCellGroupName(groupIndex, name)}
                          className="px-2.5 py-1 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-700 rounded-lg text-xs font-medium hover:bg-cyan-100 dark:hover:bg-cyan-900/40 transition-colors"
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}

                  {pastCellNames.length > 0 && group.cellName.length > 0 && (() => {
                    const filtered = pastCellNames.filter(
                      (name) =>
                        name.toLowerCase().includes(group.cellName.toLowerCase()) &&
                        name !== group.cellName
                    );

                    return filtered.length > 0 ? (
                      <div className="absolute z-10 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg overflow-hidden">
                        {filtered.map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => updatePeopleTakenToCellGroupName(groupIndex, name)}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors"
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    ) : null;
                  })()}
                </div>

                <div>
                  <label className="form-label">Did you attend this cell?</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                    {CELL_ATTENDANCE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          updateCellActivityAttendance(groupIndex, option.value)
                        }
                        className={cn(
                          "min-h-11 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all text-center",
                          group.attendanceStatus === option.value
                            ? option.activeClass
                            : "border-gray-200 dark:border-slate-600 text-gray-500 hover:border-cyan-300"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h4 className="font-semibold text-gray-900 dark:text-slate-100">
                      People taken to Cell
                    </h4>
                    <span
                      className={cn(
                        "px-3 py-1 rounded-full text-sm font-semibold",
                        cellMeetingPeopleCount >= MIN_CELL_MEETING_PEOPLE
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                          : "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300"
                      )}
                    >
                      {cellMeetingPeopleCount} qualifying
                      {cellMeetingPeopleCount >= MIN_CELL_MEETING_PEOPLE
                        ? " complete"
                        : ` / ${MIN_CELL_MEETING_PEOPLE} min`}
                    </span>
                  </div>

                  {group.people.map((person, personIndex) => (
                    <div
                      key={personIndex}
                      className="p-3 bg-white dark:bg-slate-900/40 rounded-xl space-y-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400 w-6">
                          #{personIndex + 1}
                        </span>
                        <input
                          className="input-field flex-1"
                          placeholder="Full name"
                          value={person.fullName}
                          onChange={(e) =>
                            updateCellMeetingPerson(
                              groupIndex,
                              personIndex,
                              "fullName",
                              e.target.value
                            )
                          }
                        />
                        {group.people.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              markInteracted();
                              setPeopleTakenToCellGroups((groups) =>
                                groups.map((item, idx) =>
                                  idx === groupIndex
                                    ? {
                                        ...item,
                                        people: item.people.filter(
                                          (_, pIdx) => pIdx !== personIndex
                                        ),
                                      }
                                    : item
                                )
                              );
                            }}
                            className="text-red-400 hover:text-red-600 flex-shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <label
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 cursor-pointer select-none transition-all w-full",
                          person.olderThan12
                            ? "border-cyan-400 bg-cyan-50 dark:bg-cyan-900/20"
                            : "border-gray-200 dark:border-slate-600"
                        )}
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-cyan-600 flex-shrink-0"
                          checked={person.olderThan12}
                          onChange={(e) =>
                            updateCellMeetingPerson(
                              groupIndex,
                              personIndex,
                              "olderThan12",
                              e.target.checked
                            )
                          }
                        />
                        <span
                          className={cn(
                            "text-sm font-medium",
                            person.olderThan12
                              ? "text-cyan-700 dark:text-cyan-300"
                              : "text-gray-500 dark:text-slate-400"
                          )}
                        >
                          {person.olderThan12
                            ? "Older than 12 - counts toward qualification"
                            : "Tick if this person is older than 12"}
                        </span>
                      </label>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    markInteracted();
                    setPeopleTakenToCellGroups((groups) =>
                      groups.map((item, idx) =>
                        idx === groupIndex
                          ? {
                              ...item,
                              people: [...item.people, createEmptyCellMeetingPerson()],
                            }
                          : item
                      )
                    );
                  }}
                  className="w-full py-2.5 border-2 border-dashed border-cyan-300 dark:border-cyan-700 text-cyan-600 dark:text-cyan-400 rounded-xl text-sm font-medium hover:bg-cyan-50 dark:hover:bg-cyan-900/20 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add another person
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => updateCellCount(cellCount + 1)}
            className="w-full py-2.5 border-2 border-dashed border-cyan-300 dark:border-cyan-700 text-cyan-600 dark:text-cyan-400 rounded-xl text-sm font-medium hover:bg-cyan-50 dark:hover:bg-cyan-900/20 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Another Cell (If Applicable)
          </button>
        </div>

        <div className="border-t border-gray-100 dark:border-slate-700 pt-4 space-y-4">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-900 dark:text-slate-100">
              Cell Prayer
            </h4>
            <span className="text-xs text-red-400 font-semibold">Required</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {CELL_PRAYER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  markInteracted();
                  setCellPrayerStatus(option.value);
                }}
                className={cn(
                  "min-h-11 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all text-center",
                  cellPrayerStatus === option.value
                    ? option.activeClass
                    : "border-gray-200 dark:border-slate-600 text-gray-500 hover:border-gray-300"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

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
                onClick={() => {
                  markInteracted();
                  setFellowshipName(f);
                }}
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
                onClick={() => {
                  markInteracted();
                  setPrayedThisWeek(val);
                }}
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
                    onClick={() => {
                      markInteracted();
                      setPrayerDay(day);
                    }}
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
  If Submit Report does not go through, the form will show the missing section. Press Save Draft Now before leaving so your work stays stored.
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
            {loading ? "Saving..." : "Save Draft Now"}
          </button>
        )}

        <button
          type="button"
          data-draft-ignore="true"
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
