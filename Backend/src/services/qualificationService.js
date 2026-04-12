import Metrics from "../models/metricsModel.js";
import User from "../models/userModel.js";
import Report from "../models/reportModel.js";

export const getQualifiedWorkers = async (weekReference) => {
  const metrics = await Metrics.find({
    weekReference,
    isLateSubmission: false,
    isQualified: true,
  })
    .populate("worker", "fullName workerId department isRotating additionalDepartments score")
    .sort({ totalScore: -1 });

  return metrics
    .filter((m) => m.worker && m.worker._id && m.worker?.workerId !== "001")
    .map((m) => ({
      worker: m.worker,
      totalScore: m.totalScore,
      qualificationBreakdown: m.qualificationBreakdown,
      submittedReport: true,
    }));
};

export const getDisqualifiedWorkersByCloseness = async (weekReference) => {
  const metrics = await Metrics.find({
    weekReference,
    isLateSubmission: false,
    isQualified: false,
  })
    .populate("worker", "fullName workerId department isRotating additionalDepartments score")
    .sort({ totalScore: -1 });

  return metrics
    .filter((m) => m.worker && m.worker._id && m.worker?.workerId !== "001")
    .map((m) => ({
      worker: m.worker,
      totalScore: m.totalScore,
      qualificationBreakdown: m.qualificationBreakdown,
      submittedReport: true,
      missingCriteria: Object.entries(m.qualificationBreakdown || {})
      .filter(([, passed]) => !passed)
      .map(([key]) => key),
  }));
};

export const getWorkersWithNoSubmission = async (weekReference) => {
  const workersWithMetrics = await Metrics.find({ weekReference, isLateSubmission: false }).distinct("worker");
  // Include ALL approved workers regardless of role (admins/mods/pastors also do evangelism)
  // Exclude pastor 001 and users without a workerId (not yet approved)
  const allWorkers = await User.find({
    status: "approved",
    workerId: { $exists: true, $nin: [null, "", "001"] },
  }).select("fullName workerId department role").lean();
  const filteredWorkers = allWorkers;
  return filteredWorkers
    .filter((w) => !workersWithMetrics.map(String).includes(String(w._id)))
    .map((w) => ({ worker: w, totalScore: 0, submittedReport: false, qualificationBreakdown: null }));
};

export const getAllWorkersQualificationStatus = async (weekReference) => {
  const qualified = await getQualifiedWorkers(weekReference);
  const disqualified = await getDisqualifiedWorkersByCloseness(weekReference);
  const noSubmission = await getWorkersWithNoSubmission(weekReference);
  return { qualified, disqualified, noSubmission };
};

export const getWorkersByDepartmentForRoster = async (weekReference) => {
  const { qualified, disqualified, noSubmission } = await getAllWorkersQualificationStatus(weekReference);

  const rosterData = {
    qualified,
    disqualified,
    noSubmission,
  };

  return rosterData;
};

export const getLateMetricsSummary = async (weekReference) => {
  return await Metrics.find({ weekReference, isLateSubmission: true })
    .populate("worker", "fullName workerId department");
};