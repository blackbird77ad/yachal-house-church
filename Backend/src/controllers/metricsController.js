import Metrics from "../models/metricsModel.js";
import {
  ensureWeeklyMetricsFresh,
  processWeeklyMetrics,
} from "../services/metricsService.js";
import {
  getAllWorkersQualificationStatus,
  getQualifiedWorkers,
  getDisqualifiedWorkersByCloseness,
  getLateMetricsSummary,
  getWorkersWithNoSubmission,
} from "../services/qualificationService.js";
import { getPortalWeekReferenceForNow } from "../utils/portalWeek.js";

const getCurrentWeekReference = async () => {
  return getPortalWeekReferenceForNow();
};

export const getMyMetrics = async (req, res, next) => {
  try {
    const { weekReference } = req.query;
    const week = weekReference ? new Date(weekReference) : await getCurrentWeekReference();

    const metrics = await Metrics.findOne({
      worker: req.user._id,
      weekReference: week,
      isLateSubmission: false,
    });

    res.status(200).json({ metrics: metrics || null });
  } catch (error) {
    next(error);
  }
};

export const getMyMetricsHistory = async (req, res, next) => {
  try {
    const metrics = await Metrics.find({
      worker: req.user._id,
      isLateSubmission: false,
    })
      .sort({ weekReference: -1 })
      .limit(12);

    res.status(200).json({ metrics });
  } catch (error) {
    next(error);
  }
};

export const getAllMetrics = async (req, res, next) => {
  try {
    const { weekReference, isLateSubmission, dateFrom, dateTo } = req.query;
    const filter = {};

    if (weekReference) filter.weekReference = new Date(weekReference);
    if (isLateSubmission !== undefined && isLateSubmission !== "") {
      filter.isLateSubmission = isLateSubmission === "true";
    }

    if (dateFrom || dateTo) {
      filter.weekReference = {};
      if (dateFrom) filter.weekReference.$gte = new Date(dateFrom);
      if (dateTo) filter.weekReference.$lte = new Date(dateTo);
    }

    const metrics = await Metrics.find(filter)
      .populate("worker", "fullName workerId department score isQualified")
      .sort({ weekReference: -1, totalScore: -1 });

    res.status(200).json({ metrics });
  } catch (error) {
    next(error);
  }
};

export const getQualifiedList = async (req, res, next) => {
  try {
    const { weekReference } = req.query;
    const week = weekReference ? new Date(weekReference) : await getCurrentWeekReference();
    const qualified = await getQualifiedWorkers(week);
    res.status(200).json({ qualified });
  } catch (error) {
    next(error);
  }
};

export const getDisqualifiedList = async (req, res, next) => {
  try {
    const { weekReference } = req.query;
    const week = weekReference ? new Date(weekReference) : await getCurrentWeekReference();
    const disqualified = await getDisqualifiedWorkersByCloseness(week);
    res.status(200).json({ disqualified });
  } catch (error) {
    next(error);
  }
};

export const getLateMetrics = async (req, res, next) => {
  try {
    const { weekReference } = req.query;
    if (!weekReference) {
      return res.status(400).json({ message: "weekReference is required for late metrics." });
    }

    const summary = await getLateMetricsSummary(new Date(weekReference));
    res.status(200).json({ lateMetrics: summary });
  } catch (error) {
    next(error);
  }
};

export const triggerManualProcessing = async (req, res, next) => {
  try {
    const { weekReference } = req.body;
    if (!weekReference) {
      return res.status(400).json({ message: "weekReference is required." });
    }

    await processWeeklyMetrics(new Date(weekReference));
    res.status(200).json({ message: "Metrics processed successfully." });
  } catch (error) {
    next(error);
  }
};

export const getAllWorkersStatus = async (req, res, next) => {
  try {
    const { weekReference } = req.query;
    const week = weekReference ? new Date(weekReference) : await getCurrentWeekReference();

    await ensureWeeklyMetricsFresh(week, {
      maxAgeMinutes: 60,
    });

    const { qualified, disqualified, noSubmission, ranking } =
      await getAllWorkersQualificationStatus(week);

    const summary = {
      totalWorkers: qualified.length + disqualified.length + noSubmission.length,
      qualifiedCount: qualified.length,
      disqualifiedCount: disqualified.length,
      noSubmissionCount: noSubmission.length,
    };

    res.status(200).json({
      weekReference: week,
      qualified,
      almostQualified: disqualified,
      disqualified,
      noSubmission,
      ranking,
      summary,
    });
  } catch (error) {
    next(error);
  }
};
