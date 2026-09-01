import Metrics from "../models/metricsModel.js";
import User from "../models/userModel.js";
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
import { getServiceRoleQualificationWeeks } from "../services/serviceRoleQualificationService.js";
import { getPortalWeekReferenceForNow } from "../utils/portalWeek.js";
import {
  applyBranchScopeToUserFilter,
  getBranchScopeMeta,
  resolveBranchScope,
} from "../utils/branchAccess.js";

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
    const branchScope = resolveBranchScope(req);

    if (weekReference) filter.weekReference = new Date(weekReference);
    if (isLateSubmission !== undefined && isLateSubmission !== "") {
      filter.isLateSubmission = isLateSubmission === "true";
    }

    if (dateFrom || dateTo) {
      filter.weekReference = {};
      if (dateFrom) filter.weekReference.$gte = new Date(dateFrom);
      if (dateTo) filter.weekReference.$lte = new Date(dateTo);
    }

    if (branchScope.branchIds?.length) {
      filter.worker = {
        $in: await User.find(applyBranchScopeToUserFilter(req, {})).distinct("_id"),
      };
    }

    const metrics = await Metrics.find(filter)
      .populate({
        path: "worker",
        select: "fullName workerId department branch score isQualified",
        populate: { path: "branch", select: "name code status" },
      })
      .sort({ weekReference: -1, totalScore: -1 });

    res.status(200).json({ metrics, branchScope: getBranchScopeMeta(req, branchScope) });
  } catch (error) {
    next(error);
  }
};

export const getQualifiedList = async (req, res, next) => {
  try {
    const { weekReference } = req.query;
    const week = weekReference ? new Date(weekReference) : await getCurrentWeekReference();
    const branchScope = resolveBranchScope(req);
    const qualified = await getQualifiedWorkers(week, {
      branchId: branchScope.branchId,
      branchIds: branchScope.branchIds,
    });
    res.status(200).json({ qualified, branchScope: getBranchScopeMeta(req, branchScope) });
  } catch (error) {
    next(error);
  }
};

export const getDisqualifiedList = async (req, res, next) => {
  try {
    const { weekReference } = req.query;
    const week = weekReference ? new Date(weekReference) : await getCurrentWeekReference();
    const branchScope = resolveBranchScope(req);
    const disqualified = await getDisqualifiedWorkersByCloseness(week, {
      branchId: branchScope.branchId,
      branchIds: branchScope.branchIds,
    });
    res.status(200).json({ disqualified, branchScope: getBranchScopeMeta(req, branchScope) });
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

    const branchScope = resolveBranchScope(req);
    const summary = await getLateMetricsSummary(new Date(weekReference), {
      branchId: branchScope.branchId,
      branchIds: branchScope.branchIds,
    });
    res.status(200).json({ lateMetrics: summary, branchScope: getBranchScopeMeta(req, branchScope) });
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

    const branchScope = resolveBranchScope(req);
    const { qualified, disqualified, noSubmission, ranking } =
      await getAllWorkersQualificationStatus(week, {
        branchId: branchScope.branchId,
        branchIds: branchScope.branchIds,
      });

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
      branchScope: getBranchScopeMeta(req, branchScope),
    });
  } catch (error) {
    next(error);
  }
};

export const getServiceRoleQualificationHistory = async (req, res, next) => {
  try {
    const { weekReference, dateFrom, dateTo, isLateSubmission } = req.query;
    const branchScope = resolveBranchScope(req);
    const weeks = await getServiceRoleQualificationWeeks({
      weekReference,
      dateFrom,
      dateTo,
      isLateSubmission: isLateSubmission === "true",
      branchId: branchScope.branchId,
      branchIds: branchScope.branchIds,
    });

    res.status(200).json({ weeks, branchScope: getBranchScopeMeta(req, branchScope) });
  } catch (error) {
    next(error);
  }
};
