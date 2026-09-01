import Metrics from "../models/metricsModel.js";
import User from "../models/userModel.js";
import { normalizeWeekReference } from "../utils/portalWeek.js";
import { normalizeBranchId } from "../utils/branchAccess.js";
import { processWeeklyMetrics } from "./metricsService.js";
import {
  attachServiceRoleQualification,
  getServiceRoleQualification,
} from "./serviceRoleQualificationService.js";

const MIN_CELL_MEETING_PEOPLE = 4;

const toPlainEnglishReasons = (breakdown = {}, metric = {}) => {
  const reasons = [];

  const qualifyingSouls =
    Number(metric.qualifyingSouls ?? metric.totalSouls ?? 0) || 0;
  const cellMeetingPeopleCount = Number(metric.cellMeetingPeopleCount ?? 0) || 0;
  const churchAttendeeCount = Number(metric.churchAttendeeCount ?? 0) || 0;
  const fellowshipHours = Number(metric.fellowshipHours ?? 0) || 0;

  const cellMeetingPassed =
    typeof breakdown.cellAttendanceQualified === "boolean"
      ? breakdown.cellAttendanceQualified
      : !!breakdown.cellQualified;

  const cellPrayerPassed =
    typeof breakdown.cellPrayerQualified === "boolean"
      ? breakdown.cellPrayerQualified
      : false;

  const hasCellMeetingPeopleCriterion =
    typeof breakdown.cellMeetingPeopleQualified === "boolean";

  if (!breakdown.soulsQualified) {
    reasons.push(
      qualifyingSouls > 0
        ? `Only ${qualifyingSouls} soul${qualifyingSouls === 1 ? "" : "s"} preached (minimum is 10).`
        : "No souls preached were counted for this week (minimum is 10)."
    );
  }

  if (!breakdown.tuesdayQualified) {
    reasons.push("Did not attend Tuesday service.");
  }

  if (!breakdown.sundayQualified) {
    reasons.push("Did not attend Sunday service.");
  }

  if (!breakdown.fellowshipQualified) {
    reasons.push(
      fellowshipHours > 0
        ? `Fellowship prayer was ${fellowshipHours} hour${fellowshipHours === 1 ? "" : "s"} (minimum is 2 hours).`
        : "Fellowship prayer was not recorded for at least 2 hours."
    );
  }

  if (!cellMeetingPassed) {
    reasons.push("Did not attend cell meeting.");
  }

  if (
    hasCellMeetingPeopleCriterion &&
    !breakdown.cellMeetingPeopleQualified
  ) {
    reasons.push(
      cellMeetingPeopleCount > 0
        ? `Only ${cellMeetingPeopleCount} qualifying person${cellMeetingPeopleCount === 1 ? "" : "s"} aged 12+ taken to cell meeting (minimum is ${MIN_CELL_MEETING_PEOPLE}).`
        : `No qualifying people aged 12+ were taken to cell meeting (minimum is ${MIN_CELL_MEETING_PEOPLE}).`
    );
  }

  if (!cellPrayerPassed) {
    reasons.push("Cell prayer was not marked as prayed.");
  }

  if (!breakdown.attendanceQualified) {
    reasons.push(
      churchAttendeeCount > 0
        ? `Only ${churchAttendeeCount} qualifying church attendee${churchAttendeeCount === 1 ? "" : "s"} recorded (minimum is 4).`
        : "No qualifying people aged 12+ were brought to church (minimum is 4)."
    );
  }

  return reasons;
};

export const compareQualificationRank = (a, b) => {
  const scoreDiff = (Number(b?.totalScore) || 0) - (Number(a?.totalScore) || 0);
  if (scoreDiff !== 0) return scoreDiff;

  const soulsDiff =
    (Number(b?.qualifyingSouls) || 0) - (Number(a?.qualifyingSouls) || 0);
  if (soulsDiff !== 0) return soulsDiff;

  const cellMeetingPeopleDiff =
    (Number(b?.cellMeetingPeopleCount) || 0) -
    (Number(a?.cellMeetingPeopleCount) || 0);
  if (cellMeetingPeopleDiff !== 0) return cellMeetingPeopleDiff;

  const attendeesDiff =
    (Number(b?.churchAttendeeCount) || 0) - (Number(a?.churchAttendeeCount) || 0);
  if (attendeesDiff !== 0) return attendeesDiff;

  const fellowshipDiff =
    (Number(b?.fellowshipHours) || 0) - (Number(a?.fellowshipHours) || 0);
  if (fellowshipDiff !== 0) return fellowshipDiff;

  return (a?.worker?.fullName || "").localeCompare(b?.worker?.fullName || "");
};

const workerSelectFields =
  "fullName workerId department branch isRotating additionalDepartments score role";

const getBranchIdFromWorker = (worker) =>
  worker?.branch?._id?.toString?.() || worker?.branch?.toString?.() || "";

const getBranchIdsFromOptions = (options = {}) => {
  const values = Array.isArray(options.branchIds)
    ? options.branchIds
    : [options.branchId];

  return [
    ...new Set(values.map(normalizeBranchId).filter(Boolean)),
  ];
};

const applyBranchFilter = (filter = {}, options = {}) => {
  const branchIds = getBranchIdsFromOptions(options);
  if (branchIds.length === 1) {
    filter.branch = branchIds[0];
  } else if (branchIds.length > 1) {
    filter.branch = { $in: branchIds };
  }
  return filter;
};

const workerMatchesBranches = (worker, branchIds = []) =>
  branchIds.length === 0 || branchIds.includes(getBranchIdFromWorker(worker));

const buildNoSubmissionEntry = (worker) => ({
  worker,
  totalScore: 0,
  qualificationBreakdown: null,
  scoreBreakdown: null,
  isQualified: false,
  submittedReport: false,
  qualifyingSouls: 0,
  mainChurchAttendeeCount: 0,
  cellMeetingPeopleCount: 0,
  churchAttendeeCount: 0,
  fellowshipHours: 0,
  missingCriteria: [
    "No evangelism and follow-up report was submitted for this week.",
  ],
  serviceRoleQualification: getServiceRoleQualification({}),
  serviceRoleCategory: "none",
});

const buildMetricEntry = (metric) =>
  attachServiceRoleQualification({
    worker: metric.worker,
    totalScore: metric.totalScore,
    qualificationBreakdown: metric.qualificationBreakdown,
    scoreBreakdown: metric.scoreBreakdown || null,
    isQualified: !!metric.isQualified,
    submittedReport: !!metric.reportSubmitted,
    qualifyingSouls: metric.qualifyingSouls || 0,
    mainChurchAttendeeCount:
      metric.mainChurchAttendeeCount ?? metric.churchAttendeeCount ?? 0,
    cellMeetingPeopleCount: metric.cellMeetingPeopleCount || 0,
    churchAttendeeCount: metric.churchAttendeeCount || 0,
    fellowshipHours: metric.fellowshipHours || 0,
    missingCriteria: metric.isQualified
      ? []
      : toPlainEnglishReasons(metric.qualificationBreakdown || {}, metric),
  });

const shouldExcludeWorker = (worker) => {
  if (!worker?._id) return true;
  return worker.workerId === "001";
};

const loadApprovedWorkers = async (options = {}) => {
  const filter = {
    status: "approved",
  };
  applyBranchFilter(filter, options);

  return User.find(filter)
    .select(workerSelectFields)
    .populate("branch", "name code status")
    .lean();
};

const loadWeekMetrics = async (weekReference, options = {}) => {
  const branchIds = getBranchIdsFromOptions(options);
  const metrics = await Metrics.find({
    weekReference,
    isLateSubmission: false,
  })
    .populate({
      path: "worker",
      select: workerSelectFields,
      populate: { path: "branch", select: "name code status" },
    })
    .sort({
      totalScore: -1,
      qualifyingSouls: -1,
      cellMeetingPeopleCount: -1,
      churchAttendeeCount: -1,
      fellowshipHours: -1,
      updatedAt: 1,
      createdAt: 1,
    });

  if (branchIds.length === 0) return metrics;

  return metrics.filter((metric) => workerMatchesBranches(metric.worker, branchIds));
};

const buildMetricsByWorker = (metrics = []) => {
  const byWorker = new Map();
  metrics.forEach((metric) => {
    const workerId = metric?.worker?._id?.toString();
    if (!workerId || shouldExcludeWorker(metric.worker)) return;
    byWorker.set(workerId, metric);
  });
  return byWorker;
};

const loadCompleteQualificationSnapshot = async (weekReference, options = {}) => {
  const week = normalizeWeekReference(weekReference);

  let [approvedWorkers, metrics] = await Promise.all([
    loadApprovedWorkers(options),
    loadWeekMetrics(week, options),
  ]);

  const eligibleWorkers = approvedWorkers.filter((worker) => !shouldExcludeWorker(worker));
  const metricsEligibleWorkers = eligibleWorkers.filter((worker) => !!worker.workerId);
  let metricsByWorker = buildMetricsByWorker(metrics);

  if (metricsByWorker.size < metricsEligibleWorkers.length) {
    await processWeeklyMetrics(week);
    metrics = await loadWeekMetrics(week, options);
    metricsByWorker = buildMetricsByWorker(metrics);
  }

  const qualified = [];
  const disqualified = [];
  const noSubmission = [];

  eligibleWorkers.forEach((worker) => {
    const metric = metricsByWorker.get(String(worker._id));

    if (!metric || !metric.reportSubmitted) {
      noSubmission.push(buildNoSubmissionEntry(worker));
      return;
    }

    const entry = buildMetricEntry(metric);
    if (metric.isQualified) {
      qualified.push(entry);
    } else {
      disqualified.push(entry);
    }
  });

  qualified.sort(compareQualificationRank);
  disqualified.sort(compareQualificationRank);
  noSubmission.sort((a, b) =>
    (a?.worker?.fullName || "").localeCompare(b?.worker?.fullName || "")
  );

  return {
    qualified,
    disqualified,
    noSubmission,
    ranking: [...qualified, ...disqualified, ...noSubmission],
  };
};

export const getQualifiedWorkers = async (weekReference, options = {}) => {
  const { qualified } = await loadCompleteQualificationSnapshot(weekReference, options);
  return qualified;
};

export const getDisqualifiedWorkersByCloseness = async (weekReference, options = {}) => {
  const { disqualified } = await loadCompleteQualificationSnapshot(weekReference, options);
  return disqualified;
};

export const getWorkersWithNoSubmission = async (weekReference, options = {}) => {
  const { noSubmission } = await loadCompleteQualificationSnapshot(weekReference, options);
  return noSubmission;
};

export const getAllWorkersQualificationStatus = async (weekReference, options = {}) =>
  loadCompleteQualificationSnapshot(weekReference, options);

export const getStoredWeekQualificationSnapshot = async (weekReference, options = {}) => {
  const week = normalizeWeekReference(weekReference);
  const metrics = await loadWeekMetrics(week, options);

  const qualified = [];
  const disqualified = [];
  const noSubmission = [];

  metrics.forEach((metric) => {
    if (shouldExcludeWorker(metric.worker)) return;

    if (!metric.reportSubmitted) {
      noSubmission.push(buildNoSubmissionEntry(metric.worker));
      return;
    }

    const entry = buildMetricEntry(metric);
    if (metric.isQualified) {
      qualified.push(entry);
    } else {
      disqualified.push(entry);
    }
  });

  qualified.sort(compareQualificationRank);
  disqualified.sort(compareQualificationRank);
  noSubmission.sort((a, b) =>
    (a?.worker?.fullName || "").localeCompare(b?.worker?.fullName || "")
  );

  return {
    qualified,
    disqualified,
    noSubmission,
    ranking: [...qualified, ...disqualified, ...noSubmission],
  };
};

export const getWorkersByDepartmentForRoster = async (weekReference, options = {}) => {
  const { qualified, disqualified, noSubmission } =
    await getAllWorkersQualificationStatus(weekReference, options);

  return {
    qualified,
    disqualified,
    noSubmission,
  };
};

export const getLateMetricsSummary = async (weekReference, options = {}) => {
  const branchIds = getBranchIdsFromOptions(options);
  const metrics = await Metrics.find({ weekReference, isLateSubmission: true })
    .populate({
      path: "worker",
      select: "fullName workerId department branch",
      populate: { path: "branch", select: "name code status" },
    })
    .sort({
      totalScore: -1,
      qualifyingSouls: -1,
      cellMeetingPeopleCount: -1,
      churchAttendeeCount: -1,
      fellowshipHours: -1,
      updatedAt: 1,
      createdAt: 1,
    });

  if (branchIds.length === 0) return metrics;

  return metrics.filter((metric) => workerMatchesBranches(metric.worker, branchIds));
};
