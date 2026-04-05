import Report from "../models/reportModel.js";
import Metrics from "../models/metricsModel.js";
import Attendance from "../models/attendanceModel.js";
import Permission from "../models/permissionModel.js";
import User from "../models/userModel.js";

const MINIMUM_SOULS = 10;
const MINIMUM_FELLOWSHIP_HOURS = 2;
const MINIMUM_CELL_HOURS = 2;
const MINIMUM_SERVICE_ATTENDANCE = 4;

const calculateServiceAttendanceCounts = (churchAttendees) => {
  let tuesday = 0;
  let sunday = 0;
  let special = 0;

  churchAttendees.forEach((person) => {
    if (person.attendedTuesday) tuesday++;
    if (person.attendedSunday) sunday++;
    if (person.attendedSpecial) special++;
  });

  return { tuesday, sunday, special, total: tuesday + sunday + special };
};

const getWorkerAttendance = async (workerId, weekReference) => {
  const weekEnd = new Date(weekReference);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const records = await Attendance.find({
    worker: workerId,
    serviceDate: { $gte: weekReference, $lt: weekEnd },
  });

  const attendance = {
    tuesday: { attended: false, reportingTime: null, arrivalTime: null, verifiedByFrontDesk: false, late: false, permissionSought: false, permissionOutcome: "n/a" },
    sunday: { attended: false, reportingTime: null, arrivalTime: null, verifiedByFrontDesk: false, late: false, permissionSought: false, permissionOutcome: "n/a" },
    special: { attended: false, reportingTime: null, arrivalTime: null, verifiedByFrontDesk: false, late: false, permissionSought: false, permissionOutcome: "n/a" },
  };

  records.forEach((record) => {
    const type = record.serviceType;
    attendance[type].attended = true;
    attendance[type].reportingTime = record.checkInTime;
    attendance[type].verifiedByFrontDesk = record.verifiedByFrontDesk;
    attendance[type].late = record.isLate;
  });

  const permissions = await Permission.find({
    worker: workerId,
    serviceDate: { $gte: weekReference, $lt: weekEnd },
  });

  permissions.forEach((perm) => {
    const type = perm.serviceType;
    attendance[type].permissionSought = true;
    attendance[type].permissionOutcome = perm.status === "showed-up" ? "showed-up" : perm.status === "did-not-show" ? "did-not-show" : "pending";
  });

  return attendance;
};

export const processWeeklyMetrics = async (weekReference) => {
  const workers = await User.find({ status: "approved" });

  for (const worker of workers) {
    const reports = await Report.find({
      submittedBy: worker._id,
      weekReference,
      status: "submitted",
      isLateSubmission: false,
    });

    const evangelismReport = reports.find((r) => r.reportType === "evangelism");
    const fellowshipReport = reports.find((r) => r.reportType === "fellowship-prayer");
    const cellReport = reports.find((r) => r.reportType === "cell");

    const soulsCount = evangelismReport?.evangelismData?.totalSouls || 0;

    const serviceAttendanceCounts = evangelismReport
      ? calculateServiceAttendanceCounts(evangelismReport.churchAttendees || [])
      : { tuesday: 0, sunday: 0, special: 0, total: 0 };

    const fellowshipHours = fellowshipReport?.fellowshipPrayerData?.duration || 0;
    const fellowshipVerified = !!fellowshipReport;

    const cellHours = cellReport?.cellData?.didAttend ? 2 : 0;
    const cellVerified = !!cellReport;

    const workerAttendance = await getWorkerAttendance(worker._id, weekReference);

    const reportSubmitted = reports.length > 0;

    const soulsQualified = soulsCount >= MINIMUM_SOULS;
    const fellowshipQualified = fellowshipHours >= MINIMUM_FELLOWSHIP_HOURS && fellowshipVerified;
    const cellQualified = cellHours >= MINIMUM_CELL_HOURS && cellVerified;
    const attendanceQualified = serviceAttendanceCounts.total >= MINIMUM_SERVICE_ATTENDANCE;
    const reportQualified = reportSubmitted;

    const isQualified = soulsQualified && fellowshipQualified && cellQualified && attendanceQualified && reportQualified;

    let totalScore = 0;
    if (soulsQualified) totalScore += 20;
    if (fellowshipQualified) totalScore += 20;
    if (cellQualified) totalScore += 20;
    if (attendanceQualified) totalScore += 20;
    if (reportQualified) totalScore += 20;
    totalScore += Math.min(soulsCount - MINIMUM_SOULS, 10);

    await Metrics.findOneAndUpdate(
      { worker: worker._id, weekReference, isLateSubmission: false },
      {
        soulsCount,
        fellowshipPrayerHours: fellowshipHours,
        fellowshipPrayerVerified: fellowshipVerified,
        cellPrayerHours: cellHours,
        cellPrayerVerified: cellVerified,
        serviceAttendanceCounts,
        workerAttendance,
        reportSubmitted,
        submittedOnTime: reportSubmitted,
        totalScore,
        isQualified,
        qualificationBreakdown: {
          soulsQualified,
          fellowshipQualified,
          cellQualified,
          attendanceQualified,
          reportQualified,
        },
        processedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    await User.findByIdAndUpdate(worker._id, { score: totalScore, isQualified });
  }
};

export const processLateMetrics = async (workerId, weekReference) => {
  const reports = await Report.find({
    submittedBy: workerId,
    weekReference,
    status: "submitted",
    isLateSubmission: true,
  });

  const evangelismReport = reports.find((r) => r.reportType === "evangelism");
  const soulsCount = evangelismReport?.evangelismData?.totalSouls || 0;

  await Metrics.findOneAndUpdate(
    { worker: workerId, weekReference, isLateSubmission: true },
    {
      soulsCount,
      reportSubmitted: reports.length > 0,
      submittedOnTime: false,
      processedAt: new Date(),
    },
    { upsert: true, new: true }
  );
};