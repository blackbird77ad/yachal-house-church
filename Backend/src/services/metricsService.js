import Report from "../models/reportModel.js";
import Metrics from "../models/metricsModel.js";
import User from "../models/userModel.js";

const CRITERIA = {
  MIN_SOULS:            4,   // must be aged 12+
  MIN_FELLOWSHIP_HOURS: 2,
  MIN_CELL_HOURS:       2,
  MIN_ATTENDANCE:       4,
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

// Count souls aged 12+ from evangelism data
const countQualifyingSouls = (evangelismData) => {
  if (!evangelismData?.souls?.length) return 0;
  return evangelismData.souls.filter(
    (s) => !s.age || s.age >= 12
  ).length;
};

// Count church attendees aged 12+ across all services
const countQualifyingAttendees = (churchAttendees) => {
  if (!churchAttendees?.length) return 0;
  return churchAttendees.filter((a) => !a.age || a.age >= 12).length;
};

// Count attendance from front-desk verified records + church attendees
const countServiceAttendance = (report) => {
  let count = 0;

  // Service attendance from attendance records
  if (report.serviceAttendance?.length) {
    count += report.serviceAttendance.filter((s) => s.attended).length;
  }

  // Church attendees (people brought to church) aged 12+ per service
  if (report.churchAttendees?.length) {
    const qualifying = report.churchAttendees.filter((a) => !a.age || a.age >= 12);
    qualifying.forEach((a) => {
      if (a.attendedTuesday) count++;
      if (a.attendedSunday) count++;
      if (a.attendedSpecial) count++;
    });
  }

  return count;
};

// Compute fellowship hours from fellowshipPrayerData
const getFellowshipHours = (report) => {
  if (!report.fellowshipPrayerData?.duration) return 0;
  return report.fellowshipPrayerData.duration / 60; // duration stored in minutes
};

// Compute cell hours from cellData
const getCellHours = (report) => {
  if (!report.cellData?.didAttend) return 0;
  // Cell meeting assumed 2 hours if attended - adjust if you store duration
  return 2;
};

// ── Core processing ───────────────────────────────────────────────────────────
export const processWeeklyMetrics = async (weekReference) => {
  const week = weekReference instanceof Date ? weekReference : new Date(weekReference);

  const reports = await Report.find({
    weekReference: week,
    status: "submitted",
    isLateSubmission: false,
  }).populate("submittedBy", "fullName workerId department _id");

  // Group by worker
  const byWorker = {};
  for (const report of reports) {
    if (!report.submittedBy) continue;
    const wId = report.submittedBy._id.toString();
    if (!byWorker[wId]) {
      byWorker[wId] = { worker: report.submittedBy, reports: [] };
    }
    byWorker[wId].reports.push(report);
  }

  for (const [workerId, { worker, reports: workerReports }] of Object.entries(byWorker)) {
    // Skip pastor (001)
    if (worker.workerId === "001") continue;

    let totalSouls = 0;
    let qualifyingSouls = 0;
    let fellowshipHours = 0;
    let cellHours = 0;
    let serviceAttendance = 0;
    let reportSubmitted = true;

    for (const r of workerReports) {
      if (r.reportType === "evangelism") {
        totalSouls += r.evangelismData?.souls?.length || 0;
        qualifyingSouls += countQualifyingSouls(r.evangelismData);
        serviceAttendance += countServiceAttendance(r);
      }
      if (r.reportType === "fellowship-prayer") {
        fellowshipHours += getFellowshipHours(r);
      }
      if (r.reportType === "cell") {
        cellHours += getCellHours(r);
      }
    }

    const soulsQualified = qualifyingSouls >= CRITERIA.MIN_SOULS;
    const fellowshipQualified = fellowshipHours >= CRITERIA.MIN_FELLOWSHIP_HOURS;
    const cellQualified = cellHours >= CRITERIA.MIN_CELL_HOURS;
    const attendanceQualified = serviceAttendance >= CRITERIA.MIN_ATTENDANCE;
    const reportQualified = reportSubmitted;

    const qualificationBreakdown = {
      soulsQualified,
      fellowshipQualified,
      cellQualified,
      attendanceQualified,
      reportQualified,
    };

    const isQualified =
      soulsQualified &&
      fellowshipQualified &&
      cellQualified &&
      attendanceQualified &&
      reportQualified;

    const passedCount = Object.values(qualificationBreakdown).filter(Boolean).length;
    const totalScore = Math.round((passedCount / 5) * 100);

    await Metrics.findOneAndUpdate(
      { worker: worker._id, weekReference: week, isLateSubmission: false },
      {
        worker: worker._id,
        weekReference: week,
        isLateSubmission: false,
        totalSouls,
        qualifyingSouls,
        fellowshipHours,
        cellHours,
        serviceAttendance,
        isQualified,
        qualificationBreakdown,
        totalScore,
        reportSubmitted,
      },
      { upsert: true, new: true }
    );

    // Update worker's isQualified flag
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
  let cellHours = 0;
  let serviceAttendance = 0;

  for (const r of reports) {
    if (r.reportType === "evangelism") {
      totalSouls += r.evangelismData?.souls?.length || 0;
      qualifyingSouls += countQualifyingSouls(r.evangelismData);
      serviceAttendance += countServiceAttendance(r);
    }
    if (r.reportType === "fellowship-prayer") {
      fellowshipHours += getFellowshipHours(r);
    }
    if (r.reportType === "cell") {
      cellHours += getCellHours(r);
    }
  }

  const qualificationBreakdown = {
    soulsQualified: qualifyingSouls >= CRITERIA.MIN_SOULS,
    fellowshipQualified: fellowshipHours >= CRITERIA.MIN_FELLOWSHIP_HOURS,
    cellQualified: cellHours >= CRITERIA.MIN_CELL_HOURS,
    attendanceQualified: serviceAttendance >= CRITERIA.MIN_ATTENDANCE,
    reportQualified: true,
  };

  const isQualified = Object.values(qualificationBreakdown).every(Boolean);
  const passedCount = Object.values(qualificationBreakdown).filter(Boolean).length;
  const totalScore = Math.round((passedCount / 5) * 100);

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