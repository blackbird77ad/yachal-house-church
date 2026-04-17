import Report from "../models/reportModel.js";
import Metrics from "../models/metricsModel.js";
import User from "../models/userModel.js";
import {
  getPortalWeekReferenceForNow,
  getPortalWindowForWeekReference,
  normalizeWeekReference,
} from "../utils/portalWeek.js";

const CRITERIA = {
  MIN_SOULS: 10,
  MIN_FELLOWSHIP_HOURS: 2,
  MIN_CHURCH_ATTENDEES: 4,
  MIN_CELL_PRAYER_HOURS: 2,
};

const WEIGHTS = {
  souls: 30,
  tuesday: 10,
  sunday: 10,
  fellowship: 10,
  cellAttendance: 10,
  cellPrayer: 10,
  attendees: 20,
};

const normalizeWeek = (value) => {
  return normalizeWeekReference(value);
};

const isSameNormalizedWeek = (a, b) =>
  normalizeWeek(a).getTime() === normalizeWeek(b).getTime();

const getAuthoritativeOnTimeWeekReference = (report) => {
  if (report?.submittedAt) {
    return normalizeWeek(getPortalWeekReferenceForNow(report.submittedAt));
  }

  if (report?.createdAt) {
    return normalizeWeek(getPortalWeekReferenceForNow(report.createdAt));
  }

  if (report?.weekReference) {
    return normalizeWeek(report.weekReference);
  }

  return null;
};

const countTotalSouls = (evangelismData) =>
  evangelismData?.totalSouls ||
  evangelismData?.souls?.length ||
  0;

const countQualifyingSouls = (evangelismData) =>
  evangelismData?.qualifyingSouls ||
  evangelismData?.souls?.filter((s) => !s.age || s.age >= 12).length ||
  evangelismData?.souls?.length ||
  0;

const countChurchAttendees = (report) => {
  if (!report.churchAttendees?.length) return 0;

  return report.churchAttendees.filter(
    (attendee) =>
      attendee.olderThan12 === true &&
      (attendee.attendedTuesday ||
        attendee.attendedSunday ||
        attendee.attendedSpecial)
  ).length;
};

const getFellowshipHours = (report) => {
  if (!report.fellowshipPrayerData?.prayedThisWeek) return 0;
  return Number(report.fellowshipPrayerData.hoursOfPrayer || 0);
};

const didAttendCellMeeting = (report) => {
  if (report.cellData?.didAttendCell === true) return true;
  if (report.cellData?.didAttend === true) return true;
  return false;
};

const didPrayWithCellForTwoHours = (report) => {
  const cellPrayer = report.cellData?.cellPrayer;
  if (
    cellPrayer?.didPrayWithCell === true &&
    Number(cellPrayer?.hours || 0) >= CRITERIA.MIN_CELL_PRAYER_HOURS
  ) {
    return true;
  }
  return false;
};

const getServiceAttendance = (report) => {
  let tuesday = false;
  let sunday = false;

  if (report.serviceAttendance?.length) {
    const tue = report.serviceAttendance.find((s) => s.serviceType === "tuesday");
    const sun = report.serviceAttendance.find((s) => s.serviceType === "sunday");
    if (tue?.attended === true) tuesday = true;
    if (sun?.attended === true) sunday = true;
  }

  return { tuesday, sunday };
};

const roundScore = (value) => Number(value.toFixed(2));

const computeSoulsScore = (qualifyingSouls) => {
  const perSoul = WEIGHTS.souls / CRITERIA.MIN_SOULS;
  return roundScore(Math.min(qualifyingSouls * perSoul, WEIGHTS.souls));
};

const computeAttendeesScore = (churchAttendeeCount) => {
  const perPerson = WEIGHTS.attendees / CRITERIA.MIN_CHURCH_ATTENDEES;
  return roundScore(Math.min(churchAttendeeCount * perPerson, WEIGHTS.attendees));
};

const buildQualificationBreakdown = ({
  qualifyingSouls,
  attendedTuesday,
  attendedSunday,
  fellowshipHours,
  attendedCellMeeting,
  prayedWithCellTwoHours,
  churchAttendeeCount,
}) => ({
  soulsQualified: qualifyingSouls >= CRITERIA.MIN_SOULS,
  tuesdayQualified: attendedTuesday,
  sundayQualified: attendedSunday,
  fellowshipQualified: fellowshipHours >= CRITERIA.MIN_FELLOWSHIP_HOURS,
  cellAttendanceQualified: attendedCellMeeting,
  cellPrayerQualified: prayedWithCellTwoHours,
  attendanceQualified: churchAttendeeCount >= CRITERIA.MIN_CHURCH_ATTENDEES,
});

const buildScoreBreakdown = ({
  qualifyingSouls,
  attendedTuesday,
  attendedSunday,
  fellowshipHours,
  attendedCellMeeting,
  prayedWithCellTwoHours,
  churchAttendeeCount,
}) => ({
  soulsScore: computeSoulsScore(qualifyingSouls),
  tuesdayScore: attendedTuesday ? WEIGHTS.tuesday : 0,
  sundayScore: attendedSunday ? WEIGHTS.sunday : 0,
  fellowshipScore:
    fellowshipHours >= CRITERIA.MIN_FELLOWSHIP_HOURS ? WEIGHTS.fellowship : 0,
  cellAttendanceScore: attendedCellMeeting ? WEIGHTS.cellAttendance : 0,
  cellPrayerScore: prayedWithCellTwoHours ? WEIGHTS.cellPrayer : 0,
  attendeesScore: computeAttendeesScore(churchAttendeeCount),
});

const computeTotalScore = (scoreBreakdown) =>
  roundScore(
    scoreBreakdown.soulsScore +
      scoreBreakdown.tuesdayScore +
      scoreBreakdown.sundayScore +
      scoreBreakdown.fellowshipScore +
      scoreBreakdown.cellAttendanceScore +
      scoreBreakdown.cellPrayerScore +
      scoreBreakdown.attendeesScore
  );

const getMetricSnapshotFromReport = (report) => {
  if (!report) {
    return {
      totalSouls: 0,
      qualifyingSouls: 0,
      fellowshipHours: 0,
      attendedCellMeeting: false,
      prayedWithCellTwoHours: false,
      churchAttendeeCount: 0,
      attendedTuesday: false,
      attendedSunday: false,
      reportSubmitted: false,
    };
  }

  const serviceAttendance = getServiceAttendance(report);

  return {
    totalSouls: countTotalSouls(report.evangelismData),
    qualifyingSouls: countQualifyingSouls(report.evangelismData),
    fellowshipHours: getFellowshipHours(report),
    attendedCellMeeting: didAttendCellMeeting(report),
    prayedWithCellTwoHours: didPrayWithCellForTwoHours(report),
    churchAttendeeCount: countChurchAttendees(report),
    attendedTuesday: serviceAttendance.tuesday,
    attendedSunday: serviceAttendance.sunday,
    reportSubmitted: true,
  };
};

export const getEffectiveRosterWeekReference = (now = new Date()) => {
  const rosterWeek = normalizeWeek(getPortalWeekReferenceForNow(now));
  return getRankingWeekReferenceForRosterWeek(rosterWeek);
};

export const getRankingWeekReferenceForRosterWeek = (rosterWeekReference) => {
  const rosterWeek = normalizeWeek(rosterWeekReference);
  const rankingWeek = new Date(rosterWeek);
  rankingWeek.setUTCDate(rankingWeek.getUTCDate() - 7);
  rankingWeek.setUTCHours(0, 0, 0, 0);
  return rankingWeek;
};

export const ensureWeeklyMetricsFresh = async (
  weekReference,
  { maxAgeMinutes = 60, force = false } = {}
) => {
  const week = normalizeWeek(weekReference);
  const freshnessCutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  const submissionWindow = getPortalWindowForWeekReference(week);

  const [latestMetric, hasSubmittedReports] = await Promise.all([
    Metrics.findOne({ weekReference: week, isLateSubmission: false })
      .select("processedAt updatedAt")
      .sort({ processedAt: -1, updatedAt: -1 })
      .lean(),
    Report.exists({
      reportType: "evangelism",
      status: "submitted",
      isLateSubmission: false,
      $or: [
        { weekReference: week },
        {
          submittedAt: {
            $gte: submissionWindow.opensAt,
            $lte: submissionWindow.closesAt,
          },
        },
        {
          submittedAt: { $exists: false },
          createdAt: {
            $gte: submissionWindow.opensAt,
            $lte: submissionWindow.closesAt,
          },
        },
      ],
    }),
  ]);

  if (!force && !latestMetric && !hasSubmittedReports) {
    return false;
  }

  const lastProcessedAt = latestMetric?.processedAt || latestMetric?.updatedAt || null;
  const isFresh =
    !force &&
    lastProcessedAt &&
    new Date(lastProcessedAt).getTime() >= freshnessCutoff.getTime();

  if (isFresh) {
    return false;
  }

  await processWeeklyMetrics(week);
  return true;
};

export const processWeeklyMetrics = async (weekReference) => {
  const week = normalizeWeek(weekReference);

  if (isNaN(week.getTime())) {
    throw new Error(`Invalid weekReference: ${weekReference}`);
  }

  const allWorkers = await User.find({
    status: "approved",
    workerId: { $nin: [null, "", "001"] },
  }).select("_id fullName workerId department");

  const submissionWindow = getPortalWindowForWeekReference(week);
  const candidateReports = await Report.find({
    reportType: "evangelism",
    status: "submitted",
    isLateSubmission: false,
    $or: [
      { weekReference: week },
      {
        submittedAt: {
          $gte: submissionWindow.opensAt,
          $lte: submissionWindow.closesAt,
        },
      },
      {
        submittedAt: { $exists: false },
        createdAt: {
          $gte: submissionWindow.opensAt,
          $lte: submissionWindow.closesAt,
        },
      },
    ],
  }).populate("submittedBy", "fullName workerId department _id");

  const reports = [];
  const weekReferenceRepairs = [];

  for (const report of candidateReports) {
    const authoritativeWeek = getAuthoritativeOnTimeWeekReference(report);
    if (!authoritativeWeek) continue;

    const storedWeek = report.weekReference
      ? normalizeWeek(report.weekReference)
      : null;

    if (!storedWeek || !isSameNormalizedWeek(storedWeek, authoritativeWeek)) {
      weekReferenceRepairs.push({
        updateOne: {
          filter: { _id: report._id },
          update: { weekReference: authoritativeWeek },
        },
      });
    }

    if (isSameNormalizedWeek(authoritativeWeek, week)) {
      reports.push(report);
    }
  }

  if (weekReferenceRepairs.length > 0) {
    await Report.bulkWrite(weekReferenceRepairs);
  }

  const byWorker = {};
  for (const report of reports) {
    if (!report.submittedBy?._id) continue;
    const workerId = report.submittedBy._id.toString();
    const existing = byWorker[workerId];

    if (
      !existing ||
      new Date(report.submittedAt || report.createdAt) >
        new Date(existing.submittedAt || existing.createdAt)
    ) {
      byWorker[workerId] = report;
    }
  }

  for (const worker of allWorkers) {
    const id = worker._id.toString();
    const workerReport = byWorker[id] || null;
    const {
      totalSouls,
      qualifyingSouls,
      fellowshipHours,
      attendedCellMeeting,
      prayedWithCellTwoHours,
      churchAttendeeCount,
      attendedTuesday,
      attendedSunday,
      reportSubmitted,
    } = getMetricSnapshotFromReport(workerReport);

    const qualificationBreakdown = buildQualificationBreakdown({
      qualifyingSouls,
      attendedTuesday,
      attendedSunday,
      fellowshipHours,
      attendedCellMeeting,
      prayedWithCellTwoHours,
      churchAttendeeCount,
    });

    const scoreBreakdown = buildScoreBreakdown({
      qualifyingSouls,
      attendedTuesday,
      attendedSunday,
      fellowshipHours,
      attendedCellMeeting,
      prayedWithCellTwoHours,
      churchAttendeeCount,
    });

    const totalScore = computeTotalScore(scoreBreakdown);
    const isQualified = totalScore >= 100;

    await Metrics.findOneAndUpdate(
      { worker: worker._id, weekReference: week, isLateSubmission: false },
      {
        worker: worker._id,
        weekReference: week,
        isLateSubmission: false,
        totalSouls,
        qualifyingSouls,
        fellowshipHours,
        attendedCell: attendedCellMeeting,
        attendedCellMeeting,
        cellPrayerHours: prayedWithCellTwoHours ? CRITERIA.MIN_CELL_PRAYER_HOURS : 0,
        cellPrayerVerified: prayedWithCellTwoHours,
        prayedWithCellTwoHours,
        attendedTuesday,
        attendedSunday,
        churchAttendeeCount,
        reportSubmitted,
        isQualified,
        qualificationBreakdown,
        scoreBreakdown,
        totalScore,
        processedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    await User.findByIdAndUpdate(worker._id, {
      isQualified,
      score: totalScore,
    });
  }
};

export const processLateMetrics = async (userId, weekReference) => {
  const week = normalizeWeek(weekReference);

  const report = await Report.findOne({
    submittedBy: userId,
    weekReference: week,
    reportType: "evangelism",
    status: "submitted",
    isLateSubmission: true,
  }).sort({ submittedAt: -1, createdAt: -1 });

  if (!report) return;

  const worker = await User.findById(userId).select("fullName workerId department");
  if (!worker || worker.workerId === "001") return;

  const {
    totalSouls,
    qualifyingSouls,
    fellowshipHours,
    attendedCellMeeting,
    prayedWithCellTwoHours,
    churchAttendeeCount,
    attendedTuesday,
    attendedSunday,
  } = getMetricSnapshotFromReport(report);

  const qualificationBreakdown = buildQualificationBreakdown({
    qualifyingSouls,
    attendedTuesday,
    attendedSunday,
    fellowshipHours,
    attendedCellMeeting,
    prayedWithCellTwoHours,
    churchAttendeeCount,
  });

  const scoreBreakdown = buildScoreBreakdown({
    qualifyingSouls,
    attendedTuesday,
    attendedSunday,
    fellowshipHours,
    attendedCellMeeting,
    prayedWithCellTwoHours,
    churchAttendeeCount,
  });

  const totalScore = computeTotalScore(scoreBreakdown);
  const isQualified = totalScore >= 100;

  await Metrics.findOneAndUpdate(
    { worker: userId, weekReference: week, isLateSubmission: true },
    {
      worker: userId,
      weekReference: week,
      isLateSubmission: true,
      totalSouls,
      qualifyingSouls,
      fellowshipHours,
      attendedCell: attendedCellMeeting,
      attendedCellMeeting,
      cellPrayerHours: prayedWithCellTwoHours ? CRITERIA.MIN_CELL_PRAYER_HOURS : 0,
      cellPrayerVerified: prayedWithCellTwoHours,
      prayedWithCellTwoHours,
      attendedTuesday,
      attendedSunday,
      churchAttendeeCount,
      reportSubmitted: true,
      isQualified,
      qualificationBreakdown,
      scoreBreakdown,
      totalScore,
      processedAt: new Date(),
    },
    { upsert: true, new: true }
  );
};

export const getLateMetricsSummary = async (weekReference) => {
  const week = normalizeWeek(weekReference);
  return Metrics.find({ weekReference: week, isLateSubmission: true })
    .populate("worker", "fullName workerId department")
    .sort({ totalScore: -1 });
};
