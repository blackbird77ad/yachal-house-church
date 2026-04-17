import Metrics from "../models/metricsModel.js";
import User from "../models/userModel.js";
import { normalizeWeekReference } from "../utils/portalWeek.js";
import { processWeeklyMetrics } from "./metricsService.js";

const toPlainEnglishReasons = (breakdown = {}, metric = {}) => {
  const reasons = [];

  const qualifyingSouls =
    Number(metric.qualifyingSouls ?? metric.totalSouls ?? 0) || 0;
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

  if (!cellPrayerPassed) {
    reasons.push("Cell prayer did not reach at least 2 hours.");
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

  const attendeesDiff =
    (Number(b?.churchAttendeeCount) || 0) - (Number(a?.churchAttendeeCount) || 0);
  if (attendeesDiff !== 0) return attendeesDiff;

  const fellowshipDiff =
    (Number(b?.fellowshipHours) || 0) - (Number(a?.fellowshipHours) || 0);
  if (fellowshipDiff !== 0) return fellowshipDiff;

  return (a?.worker?.fullName || "").localeCompare(b?.worker?.fullName || "");
};

const workerSelectFields =
  "fullName workerId department isRotating additionalDepartments score role";

const buildNoSubmissionEntry = (worker) => ({
  worker,
  totalScore: 0,
  qualificationBreakdown: null,
  scoreBreakdown: null,
  isQualified: false,
  submittedReport: false,
  qualifyingSouls: 0,
  churchAttendeeCount: 0,
  fellowshipHours: 0,
  missingCriteria: [
    "No evangelism and follow-up report was submitted for this week.",
  ],
});

const buildMetricEntry = (metric) => ({
  worker: metric.worker,
  totalScore: metric.totalScore,
  qualificationBreakdown: metric.qualificationBreakdown,
  scoreBreakdown: metric.scoreBreakdown || null,
  isQualified: !!metric.isQualified,
  submittedReport: !!metric.reportSubmitted,
  qualifyingSouls: metric.qualifyingSouls || 0,
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

const loadApprovedWorkers = async () =>
  User.find({
    status: "approved",
  })
    .select(workerSelectFields)
    .lean();

const loadWeekMetrics = async (weekReference) =>
  Metrics.find({
    weekReference,
    isLateSubmission: false,
  })
    .populate("worker", workerSelectFields)
    .sort({
      totalScore: -1,
      qualifyingSouls: -1,
      churchAttendeeCount: -1,
      fellowshipHours: -1,
      updatedAt: 1,
      createdAt: 1,
    });

const buildMetricsByWorker = (metrics = []) => {
  const byWorker = new Map();
  metrics.forEach((metric) => {
    const workerId = metric?.worker?._id?.toString();
    if (!workerId || shouldExcludeWorker(metric.worker)) return;
    byWorker.set(workerId, metric);
  });
  return byWorker;
};

const loadCompleteQualificationSnapshot = async (weekReference) => {
  const week = normalizeWeekReference(weekReference);

  let [approvedWorkers, metrics] = await Promise.all([
    loadApprovedWorkers(),
    loadWeekMetrics(week),
  ]);

  const eligibleWorkers = approvedWorkers.filter((worker) => !shouldExcludeWorker(worker));
  const metricsEligibleWorkers = eligibleWorkers.filter((worker) => !!worker.workerId);
  let metricsByWorker = buildMetricsByWorker(metrics);

  if (metricsByWorker.size < metricsEligibleWorkers.length) {
    await processWeeklyMetrics(week);
    metrics = await loadWeekMetrics(week);
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

export const getQualifiedWorkers = async (weekReference) => {
  const { qualified } = await loadCompleteQualificationSnapshot(weekReference);
  return qualified;
};

export const getDisqualifiedWorkersByCloseness = async (weekReference) => {
  const { disqualified } = await loadCompleteQualificationSnapshot(weekReference);
  return disqualified;
};

export const getWorkersWithNoSubmission = async (weekReference) => {
  const { noSubmission } = await loadCompleteQualificationSnapshot(weekReference);
  return noSubmission;
};

export const getAllWorkersQualificationStatus = async (weekReference) =>
  loadCompleteQualificationSnapshot(weekReference);

export const getStoredWeekQualificationSnapshot = async (weekReference) => {
  const week = normalizeWeekReference(weekReference);
  const metrics = await loadWeekMetrics(week);

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

export const getWorkersByDepartmentForRoster = async (weekReference) => {
  const { qualified, disqualified, noSubmission } =
    await getAllWorkersQualificationStatus(weekReference);

  return {
    qualified,
    disqualified,
    noSubmission,
  };
};

export const getLateMetricsSummary = async (weekReference) => {
  return await Metrics.find({ weekReference, isLateSubmission: true })
    .populate("worker", "fullName workerId department")
    .sort({
      totalScore: -1,
      qualifyingSouls: -1,
      churchAttendeeCount: -1,
      fellowshipHours: -1,
      updatedAt: 1,
      createdAt: 1,
    });
};
