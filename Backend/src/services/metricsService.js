import Report from "../models/reportModel.js";
import Metrics from "../models/metricsModel.js";
import User from "../models/userModel.js";

const CRITERIA = {
  MIN_SOULS:            10,  // souls preached to (no age filter - removed)
  MIN_FELLOWSHIP_HOURS: 2,   // hours of fellowship prayer
  MIN_ATTENDANCE:       4,   // church attendees older than 12 who attended a service
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const getWeekRef = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

// All souls count toward the 10 minimum (age filter removed from soul form)
const countQualifyingSouls = (evangelismData) => {
  return evangelismData?.souls?.length || 0;
};

// Count church attendees ticked as olderThan12 across all services attended
const countQualifyingAttendees = (churchAttendees) => {
  if (!churchAttendees?.length) return 0;
  return churchAttendees.filter((a) => a.olderThan12 === true).length;
};

// Count attendance from front-desk verified records + church attendees
const countServiceAttendance = (report) => {
  let count = 0;

  // Service attendance from attendance records
  if (report.serviceAttendance?.length) {
    count += report.serviceAttendance.filter((s) => s.attended).length;
  }

  // Church attendees ticked olderThan12 per service they attended
  if (report.churchAttendees?.length) {
    const qualifying = report.churchAttendees.filter((a) => a.olderThan12 === true);
    qualifying.forEach((a) => {
      if (a.attendedTuesday) count++;
      if (a.attendedSunday) count++;
      if (a.attendedSpecial) count++;
    });
  }

  return count;
};

// Fellowship hours from new schema (hoursOfPrayer field)
const getFellowshipHours = (report) => {
  if (!report.fellowshipPrayerData?.prayedThisWeek) return 0;
  return report.fellowshipPrayerData.hoursOfPrayer || 0;
};

// Cell: attended at least one cell = qualifies (boolean)
const didAttendCell = (report) => {
  return report.cellData?.didAttendCell === true && (report.cellData?.cells?.length || 0) > 0;
};

// ── Core processing ───────────────────────────────────────────────────────────
export const processWeeklyMetrics = async (weekReference) => {
  const week = weekReference instanceof Date ? weekReference : new Date(weekReference);

  // ── Step 1: Get ALL approved workers (excluding pastor 001) ──────────────
  const allWorkers = await User.find({
    status: "approved",
    workerId: { $ne: "001" },
  }).select("_id fullName workerId department");

  // ── Step 2: Get all submitted reports for this week ──────────────────────
  const reports = await Report.find({
    weekReference: week,
    status: "submitted",
    isLateSubmission: false,
  }).populate("submittedBy", "fullName workerId department _id");

  // Group reports by worker ID
  const byWorker = {};
  for (const report of reports) {
    if (!report.submittedBy) continue;
    const wId = report.submittedBy._id.toString();
    if (!byWorker[wId]) {
      byWorker[wId] = { worker: report.submittedBy, reports: [] };
    }
    byWorker[wId].reports.push(report);
  }

  // ── Step 3: Process EVERY worker — submitted or not ─────────────────────
  for (const worker of allWorkers) {
    const wId = worker._id.toString();
    const workerReports = byWorker[wId]?.reports || [];
    const reportSubmitted = workerReports.length > 0;

    let totalSouls = 0;
    let qualifyingSouls = 0;
    let fellowshipHours = 0;
    let attendedCell = false;
    let serviceAttendance = 0;

    for (const r of workerReports) {
      if (r.reportType === "evangelism") {
        totalSouls        += r.evangelismData?.souls?.length || 0;
        qualifyingSouls   += countQualifyingSouls(r.evangelismData);
        serviceAttendance += countServiceAttendance(r);
        // Cell and fellowship are now inside the evangelism report
        fellowshipHours   += getFellowshipHours(r);
        if (didAttendCell(r)) attendedCell = true;
      }
      // Legacy support for separate report types
      if (r.reportType === "fellowship-prayer") {
        fellowshipHours += getFellowshipHours(r);
      }
      if (r.reportType === "cell") {
        if (r.cellData?.didAttendCell) attendedCell = true;
      }
    }

    const soulsQualified      = qualifyingSouls >= CRITERIA.MIN_SOULS;
    const fellowshipQualified = fellowshipHours >= CRITERIA.MIN_FELLOWSHIP_HOURS;
    const cellQualified       = attendedCell;       // attended at least 1 cell = qualifies
    const attendanceQualified = serviceAttendance >= CRITERIA.MIN_ATTENDANCE;
    const reportQualified     = reportSubmitted;

    const qualificationBreakdown = {
      soulsQualified,       // 10+ souls preached to
      fellowshipQualified,  // 2+ hours fellowship prayer
      cellQualified,        // attended cell meeting
      attendanceQualified,  // 4+ people 12+ brought to church
      reportQualified,      // submitted report
    };

    // Must meet ALL 5 criteria to be fully qualified
    const isQualified =
      soulsQualified &&
      fellowshipQualified &&
      cellQualified &&
      attendanceQualified &&
      reportQualified;

    // Score: each criterion = 20 points = 100 total
    const passedCount = Object.values(qualificationBreakdown).filter(Boolean).length;
    const totalScore  = passedCount * 20; // 20 per criterion, max 100

    await Metrics.findOneAndUpdate(
      { worker: worker._id, weekReference: week, isLateSubmission: false },
      {
        worker:                worker._id,
        weekReference:         week,
        isLateSubmission:      false,
        totalSouls,
        qualifyingSouls,
        fellowshipHours,
        attendedCell,
        serviceAttendance,
        isQualified,
        qualificationBreakdown,
        totalScore,
        reportSubmitted,
      },
      { upsert: true, new: true }
    );

    // Keep worker's own isQualified flag in sync
    await User.findByIdAndUpdate(worker._id, { isQualified, score: totalScore });
  }
};

// Process late submission metrics for a single worker
export const processLateMetrics = async (userId, weekReference) => {
  const week = weekReference instanceof Date ? weekReference : new Date(weekReference);

  const reports = await Report.find({
    submittedBy: userId,
    weekReference: week,
    status: "submitted",
    isLateSubmission: true,
  });

  if (!reports.length) return;

  const worker = await User.findById(userId).select("fullName workerId department");
  if (!worker || worker.workerId === "001") return;

  let totalSouls = 0;
  let qualifyingSouls = 0;
  let fellowshipHours = 0;
  let attendedCell = false;
  let serviceAttendance = 0;

  for (const r of reports) {
    if (r.reportType === "evangelism") {
      totalSouls += r.evangelismData?.souls?.length || 0;
      qualifyingSouls += countQualifyingSouls(r.evangelismData);
      serviceAttendance += countServiceAttendance(r);
      fellowshipHours += getFellowshipHours(r);
      if (didAttendCell(r)) attendedCell = true;
    }
    if (r.reportType === "fellowship-prayer") { fellowshipHours += getFellowshipHours(r); }
    if (r.reportType === "cell") { if (r.cellData?.didAttendCell) attendedCell = true; }
  }

  const qualificationBreakdown = {
    soulsQualified:      qualifyingSouls >= CRITERIA.MIN_SOULS,
    fellowshipQualified: fellowshipHours >= CRITERIA.MIN_FELLOWSHIP_HOURS,
    cellQualified:       attendedCell,
    attendanceQualified: serviceAttendance >= CRITERIA.MIN_ATTENDANCE,
    reportQualified:     true,
  };

  const isQualified = Object.values(qualificationBreakdown).every(Boolean);
  const passedCount = Object.values(qualificationBreakdown).filter(Boolean).length;
  const totalScore  = passedCount * 20;

  await Metrics.findOneAndUpdate(
    { worker: userId, weekReference: week, isLateSubmission: true },
    {
      worker: userId,
      weekReference: week,
      isLateSubmission: true,
      totalSouls,
      qualifyingSouls,
      fellowshipHours,
      cellHours,
      serviceAttendance,
      isQualified,
      qualificationBreakdown,
      totalScore,
      reportSubmitted: true,
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