import Report from "../models/reportModel.js";
import Metrics from "../models/metricsModel.js";
import User from "../models/userModel.js";

// ── Criteria & weights ────────────────────────────────────────────────────────
const CRITERIA = {
  MIN_SOULS:            10,  // 30pts
  MIN_FELLOWSHIP_HOURS: 2,   // 10pts
  MIN_CHURCH_ATTENDEES: 4,   // 20pts
  // Tuesday service:   10pts (attended = qualifies)
  // Sunday service:    10pts (attended = qualifies)
  // Cell meeting:      20pts (attended = qualifies)
};

const WEIGHTS = {
  souls:       30,
  tuesday:     10,
  sunday:      10,
  fellowship:  10,
  cell:        20,
  attendees:   20,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const countQualifyingSouls = (evangelismData) =>
  evangelismData?.souls?.length || 0;

const countChurchAttendees = (report) => {
  if (!report.churchAttendees?.length) return 0;
  let count = 0;
  const qualifying = report.churchAttendees.filter((a) => a.olderThan12 === true);
  qualifying.forEach((a) => {
    if (a.attendedTuesday) count++;
    if (a.attendedSunday)  count++;
    if (a.attendedSpecial) count++;
  });
  return count;
};

const getFellowshipHours = (report) => {
  if (!report.fellowshipPrayerData?.prayedThisWeek) return 0;
  return report.fellowshipPrayerData.hoursOfPrayer || 0;
};

const didAttendCell = (report) =>
  report.cellData?.didAttendCell === true;

const getServiceAttendance = (report) => {
  let tuesday = false;
  let sunday  = false;
  if (report.serviceAttendance?.length) {
    const tue = report.serviceAttendance.find((s) => s.serviceType === "tuesday");
    const sun = report.serviceAttendance.find((s) => s.serviceType === "sunday");
    if (tue?.attended === true) tuesday = true;
    if (sun?.attended === true) sunday  = true;
  }
  return { tuesday, sunday };
};

const computeScore = (q) => (
  (q.soulsQualified      ? WEIGHTS.souls      : 0) +
  (q.tuesdayQualified    ? WEIGHTS.tuesday    : 0) +
  (q.sundayQualified     ? WEIGHTS.sunday     : 0) +
  (q.fellowshipQualified ? WEIGHTS.fellowship : 0) +
  (q.cellQualified       ? WEIGHTS.cell       : 0) +
  (q.attendanceQualified ? WEIGHTS.attendees  : 0)
);

// ── Process ALL workers for a given week ─────────────────────────────────────
export const processWeeklyMetrics = async (weekReference) => {
  const week = weekReference instanceof Date ? weekReference : new Date(weekReference);

  const allWorkers = await User.find({
    status:   "approved",
    workerId: { $nin: [null, "", "001"] },
  }).select("_id fullName workerId department");

  const reports = await Report.find({
    weekReference:    week,
    status:           "submitted",
    isLateSubmission: false,
  }).populate("submittedBy", "fullName workerId department _id");

  // Group reports by worker
  const byWorker = {};
  for (const r of reports) {
    if (!r.submittedBy) continue;
    const id = r.submittedBy._id.toString();
    if (!byWorker[id]) byWorker[id] = { worker: r.submittedBy, reports: [] };
    byWorker[id].reports.push(r);
  }

  for (const worker of allWorkers) {
    const id             = worker._id.toString();
    const workerReports  = byWorker[id]?.reports || [];
    const reportSubmitted = workerReports.length > 0;

    let totalSouls          = 0;
    let qualifyingSouls     = 0;
    let fellowshipHours     = 0;
    let attendedCell        = false;
    let churchAttendeeCount = 0;
    let attendedTuesday     = false;
    let attendedSunday      = false;

    for (const r of workerReports) {
      if (r.reportType === "evangelism") {
        const souls = countQualifyingSouls(r.evangelismData);
        totalSouls          += souls;
        qualifyingSouls     += souls;
        churchAttendeeCount += countChurchAttendees(r);
        fellowshipHours     += getFellowshipHours(r);
        if (didAttendCell(r)) attendedCell = true;
        const sa = getServiceAttendance(r);
        if (sa.tuesday) attendedTuesday = true;
        if (sa.sunday)  attendedSunday  = true;
      }
      // Legacy separate report types
      if (r.reportType === "fellowship-prayer") fellowshipHours += getFellowshipHours(r);
      if (r.reportType === "cell" && r.cellData?.didAttendCell) attendedCell = true;
    }

    const qualificationBreakdown = {
      soulsQualified:      qualifyingSouls     >= CRITERIA.MIN_SOULS,
      tuesdayQualified:    attendedTuesday,
      sundayQualified:     attendedSunday,
      fellowshipQualified: fellowshipHours     >= CRITERIA.MIN_FELLOWSHIP_HOURS,
      cellQualified:       attendedCell,
      attendanceQualified: churchAttendeeCount >= CRITERIA.MIN_CHURCH_ATTENDEES,
    };

    const totalScore  = computeScore(qualificationBreakdown);
    const isQualified = totalScore === 100;

    await Metrics.findOneAndUpdate(
      { worker: worker._id, weekReference: week, isLateSubmission: false },
      {
        worker: worker._id, weekReference: week, isLateSubmission: false,
        totalSouls, qualifyingSouls, fellowshipHours,
        attendedCell, attendedTuesday, attendedSunday,
        churchAttendeeCount, reportSubmitted,
        isQualified, qualificationBreakdown, totalScore,
        processedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    await User.findByIdAndUpdate(worker._id, { isQualified, score: totalScore });
  }
};

// ── Process late submission for a single worker ───────────────────────────────
export const processLateMetrics = async (userId, weekReference) => {
  const week = weekReference instanceof Date ? weekReference : new Date(weekReference);

  const reports = await Report.find({
    submittedBy: userId, weekReference: week,
    status: "submitted", isLateSubmission: true,
  });
  if (!reports.length) return;

  const worker = await User.findById(userId).select("fullName workerId department");
  if (!worker || worker.workerId === "001") return;

  let totalSouls          = 0;
  let qualifyingSouls     = 0;
  let fellowshipHours     = 0;
  let attendedCell        = false;
  let churchAttendeeCount = 0;
  let attendedTuesday     = false;
  let attendedSunday      = false;

  for (const r of reports) {
    if (r.reportType === "evangelism") {
      const souls = countQualifyingSouls(r.evangelismData);
      totalSouls          += souls;
      qualifyingSouls     += souls;
      churchAttendeeCount += countChurchAttendees(r);
      fellowshipHours     += getFellowshipHours(r);
      if (didAttendCell(r)) attendedCell = true;
      const sa = getServiceAttendance(r);
      if (sa.tuesday) attendedTuesday = true;
      if (sa.sunday)  attendedSunday  = true;
    }
    if (r.reportType === "fellowship-prayer") fellowshipHours += getFellowshipHours(r);
    if (r.reportType === "cell" && r.cellData?.didAttendCell) attendedCell = true;
  }

  const qualificationBreakdown = {
    soulsQualified:      qualifyingSouls     >= CRITERIA.MIN_SOULS,
    tuesdayQualified:    attendedTuesday,
    sundayQualified:     attendedSunday,
    fellowshipQualified: fellowshipHours     >= CRITERIA.MIN_FELLOWSHIP_HOURS,
    cellQualified:       attendedCell,
    attendanceQualified: churchAttendeeCount >= CRITERIA.MIN_CHURCH_ATTENDEES,
  };

  const totalScore  = computeScore(qualificationBreakdown);
  const isQualified = totalScore === 100;

  await Metrics.findOneAndUpdate(
    { worker: userId, weekReference: week, isLateSubmission: true },
    {
      worker: userId, weekReference: week, isLateSubmission: true,
      totalSouls, qualifyingSouls, fellowshipHours,
      attendedCell, attendedTuesday, attendedSunday,
      churchAttendeeCount, reportSubmitted: true,
      isQualified, qualificationBreakdown, totalScore,
      processedAt: new Date(),
    },
    { upsert: true, new: true }
  );
};

export const getLateMetricsSummary = async (weekReference) => {
  const week = weekReference instanceof Date ? weekReference : new Date(weekReference);
  return Metrics.find({ weekReference: week, isLateSubmission: true })
    .populate("worker", "fullName workerId department")
    .sort({ totalScore: -1 });
};