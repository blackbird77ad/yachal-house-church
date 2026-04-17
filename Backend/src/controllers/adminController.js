import User from "../models/userModel.js";
import PortalWindow from "../models/portalWindowModel.js";
import Report from "../models/reportModel.js";
import Metrics from "../models/metricsModel.js";
import { createBulkNotification } from "../services/notificationService.js";
import { getCurrentPortalState } from "../services/portalStateService.js";
import {
  ensureWeeklyMetricsFresh,
} from "../services/metricsService.js";
import {
  getAllWorkersQualificationStatus,
} from "../services/qualificationService.js";
import {
  sendPortalOpenEmail,
  sendPortalClosedEmail,
} from "../services/emailService.js";
import {
  getPortalWeekReferenceForNow,
  getPortalWindowForWeekReference,
  isWithinSubmissionWindow,
  normalizeWeekReference,
} from "../utils/portalWeek.js";

const getCurrentWeekReference = () => getPortalWeekReferenceForNow();
const ADMIN_ROLES = ["pastor", "admin", "moderator"];
const DEFAULT_LEADERBOARD_LIMIT = 10;
const DASHBOARD_LEADERBOARD_LIMIT = 20;
const DASHBOARD_METRIC_REFRESH_MINUTES = 30;

const getLeaderboardData = async (weekReference, limit = DEFAULT_LEADERBOARD_LIMIT) => {
  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LEADERBOARD_LIMIT, 1), 100);
  const qualificationStatus = await getAllWorkersQualificationStatus(weekReference);

  return {
    ...qualificationStatus,
    leaderboard: qualificationStatus.ranking.slice(0, safeLimit),
  };
};

const getApprovedPortalRecipients = async () =>
  User.find({ status: "approved" }).select("_id email fullName role");

const notifyOtherAdminsOfPortalAction = async (actor, action, reason, closesAt = null) => {
  const admins = await User.find({
    status: "approved",
    role: { $in: ADMIN_ROLES },
    _id: { $ne: actor._id },
  }).select("_id");

  if (!admins.length) return;

  const whenText = closesAt ? ` New close time: ${new Date(closesAt).toLocaleString()}.` : "";

  await createBulkNotification(
    admins.map((admin) => admin._id),
    {
      type: "general",
      title: "Portal updated manually",
      message: `${actor.fullName} ${action} the portal outside the automatic schedule. Reason: ${reason}.${whenText}`,
      link: "/admin/portal",
    }
  );
};

export const getDashboardSummary = async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    const now = new Date();
    const submissionWeekReference = getCurrentWeekReference();
    const qualificationWeekReference = submissionWeekReference;
    const submissionWindow = getPortalWindowForWeekReference(submissionWeekReference);

    let metricsFreshened = false;

    try {
      metricsFreshened = await ensureWeeklyMetricsFresh(qualificationWeekReference, {
        maxAgeMinutes: DASHBOARD_METRIC_REFRESH_MINUTES,
      });
    } catch (error) {
      console.error("Dashboard metric refresh failed:", error.message);
    }

    const [
      totalWorkers,
      pendingApprovals,
      portalStatus,
      submittedThisWeek,
      draftReportsThisWeek,
      lateSubmissions,
      qualificationStatus,
      latestQualificationMetric,
    ] = await Promise.all([
      User.countDocuments({ status: "approved" }),
      User.countDocuments({ status: "pending" }),
      getCurrentPortalState(now),

      Report.countDocuments({
        status: "submitted",
        isLateSubmission: false,
        $or: [
          { weekReference: submissionWeekReference },
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

      Report.countDocuments({
        status: "draft",
        isLateSubmission: false,
        weekReference: submissionWeekReference,
      }),

      Report.countDocuments({
        weekReference: submissionWeekReference,
        status: "submitted",
        isLateSubmission: true,
      }),

      getAllWorkersQualificationStatus(qualificationWeekReference),

      Metrics.findOne({
        weekReference: qualificationWeekReference,
        isLateSubmission: false,
      })
        .select("processedAt updatedAt")
        .sort({ processedAt: -1, updatedAt: -1 })
        .lean(),
    ]);

    const qualifiedWorkers = qualificationStatus?.qualified?.length || 0;
    const almostQualifiedWorkers = qualificationStatus?.disqualified?.length || 0;
    const noReportWorkers = qualificationStatus?.noSubmission?.length || 0;
    const qualificationSnapshotCount = qualificationStatus?.ranking?.length || 0;
    const leaderboard = (qualificationStatus?.ranking || []).slice(
      0,
      DASHBOARD_LEADERBOARD_LIMIT
    );

    res.status(200).json({
      weekReference: submissionWeekReference,
      submissionWeekReference,
      qualificationWeekReference,
      totalWorkers,
      pendingApprovals,
      qualifiedWorkers,
      portalOpen: !!portalStatus?.isOpen,
      submittedThisWeek,
      draftReportsThisWeek,
      lateSubmissions,
      leaderboard,
      almostQualifiedWorkers,
      noReportWorkers,
      qualificationSnapshotCount,
      qualificationUpdatedAt:
        latestQualificationMetric?.processedAt ||
        latestQualificationMetric?.updatedAt ||
        null,
      metricsFreshened,
    });
  } catch (error) {
    next(error);
  }
};

export const getPendingWorkers = async (req, res, next) => {
  try {
    const workers = await User.find({ status: "pending" })
      .select("-password")
      .sort({ createdAt: 1 });

    res.status(200).json({ workers });
  } catch (error) {
    next(error);
  }
};

export const overridePortal = async (req, res, next) => {
  try {
    const { action, reason, customCloseAt } = req.body;

    if (!["open", "close", "extend"].includes(action)) {
      return res.status(400).json({
        message: "Action must be open, close or extend.",
      });
    }

    if (!reason?.trim()) {
      return res.status(400).json({ message: "Reason is required." });
    }

    const now = new Date();
    const isScheduledWindowOpen = isWithinSubmissionWindow(now);
    const weekReference = getCurrentWeekReference();
    const defaultWindow = getPortalWindowForWeekReference(weekReference);

    const parsedCustomClose = customCloseAt ? new Date(customCloseAt) : null;
    if (parsedCustomClose && Number.isNaN(parsedCustomClose.getTime())) {
      return res.status(400).json({
        message: "Custom close time is invalid.",
      });
    }

    if (
      (action === "open" || action === "extend") &&
      parsedCustomClose &&
      parsedCustomClose <= now
    ) {
      return res.status(400).json({
        message: "Custom close time must be in the future.",
      });
    }

    let portal = await PortalWindow.findOne({ weekReference });

    if (!portal) {
      portal = new PortalWindow({
        weekReference,
        opensAt: defaultWindow.opensAt,
        closesAt: defaultWindow.closesAt,
        isOpen: false,
      });
    }

    if (action === "close") {
      if (isScheduledWindowOpen) {
        return res.status(400).json({
          message:
            "The weekly Friday-to-Monday submission window cannot be closed manually while it is active.",
        });
      }

      await PortalWindow.updateMany(
        { isOpen: true },
        {
          $set: {
            isOpen: false,
            overriddenBy: req.user._id,
            overrideReason: reason,
          },
        }
      );

      try {
        const allWorkers = await getApprovedPortalRecipients();
        await createBulkNotification(allWorkers.map((w) => w._id), {
          type: "portal-closed",
          title: "Portal is now closed",
          message:
            "Report submission has been paused by admin. Your saved drafts are still available.",
          link: "/portal/my-reports",
        });

        const emailWorkers = allWorkers.filter((worker) => worker.email);
        if (emailWorkers.length > 0) {
          await sendPortalClosedEmail(emailWorkers, `Paused by ${req.user.fullName}. ${reason}`);
        }

        await notifyOtherAdminsOfPortalAction(req.user, "closed", reason);
      } catch {}

      return res.status(200).json({ message: "Submission has been paused." });
    }

    if (action === "extend") {
      if (!parsedCustomClose) {
        return res.status(400).json({
          message: "New close time is required to extend.",
        });
      }

      let activePortal = await PortalWindow.findOne({ weekReference });

      if (!activePortal && isScheduledWindowOpen) {
        activePortal = new PortalWindow({
          weekReference,
          opensAt: defaultWindow.opensAt,
          closesAt: defaultWindow.closesAt,
          isOpen: true,
        });
      }

      if (!activePortal || (!activePortal.isOpen && !isScheduledWindowOpen)) {
        return res.status(400).json({
          message: "There is no active submission window to extend.",
        });
      }

      activePortal.isOpen = true;
      activePortal.closesAt = parsedCustomClose;
      activePortal.overriddenBy = req.user._id;
      activePortal.overrideReason = reason;
      await activePortal.save();

      const recipients = await getApprovedPortalRecipients();
      await createBulkNotification(
        recipients.map((worker) => worker._id),
        {
          type: "portal-open",
          title: "Portal closing time extended",
          message: `The report portal deadline has been extended. New close time: ${parsedCustomClose.toLocaleString()}.`,
          link: "/portal/submit-report",
        }
      );
      await notifyOtherAdminsOfPortalAction(
        req.user,
        "extended",
        reason,
        parsedCustomClose
      );

      return res.status(200).json({
        message: "Submission close time updated.",
        portal: activePortal,
      });
    }

    await PortalWindow.updateMany(
      { isOpen: true, weekReference: { $ne: weekReference } },
      {
        $set: {
          isOpen: false,
          overriddenBy: req.user._id,
          overrideReason: `Closed while opening the current system week: ${reason}`,
        },
      }
    );

    portal.isOpen = true;
    portal.opensAt = now;
    portal.closesAt = parsedCustomClose || defaultWindow.closesAt;
    portal.overriddenBy = req.user._id;
    portal.overrideReason = reason;
    await portal.save();

    const workers = await getApprovedPortalRecipients();
    const emailWorkers = workers.filter((w) => w.email);

    await createBulkNotification(
      workers.map((w) => w._id),
      {
        type: "portal-open",
        title: "Report portal is now open",
        message:
          "The admin has opened the portal. You can now submit your report.",
        link: "/portal/submit-report",
      }
    );

    if (emailWorkers.length > 0) {
      await sendPortalOpenEmail(emailWorkers);
    }

    await notifyOtherAdminsOfPortalAction(req.user, "opened", reason, portal.closesAt);

    return res.status(200).json({
      message: "Submission has been enabled.",
      portal,
    });
  } catch (error) {
    next(error);
  }
};

export const cleanupPortalRecords = async (req, res, next) => {
  try {
    const portals = await PortalWindow.find().sort({
      weekReference: -1,
      createdAt: -1,
    });

    if (!portals.length) {
      return res.status(200).json({ message: "No portal records found." });
    }

    const seenWeeks = new Set();
    const duplicatesToDelete = [];

    for (const portal of portals) {
      const weekKey = new Date(portal.weekReference).toISOString();

      if (!seenWeeks.has(weekKey)) {
        seenWeeks.add(weekKey);
        continue;
      }

      if (portal.isOpen) {
        portal.isOpen = false;
        portal.overriddenBy = req.user._id;
        portal.overrideReason = "Closed during duplicate portal cleanup";
        await portal.save();
      }

      duplicatesToDelete.push(portal._id);
    }

    if (duplicatesToDelete.length > 0) {
      await PortalWindow.deleteMany({
        _id: { $in: duplicatesToDelete },
      });
    }

    const openPortals = await PortalWindow.find({ isOpen: true }).sort({
      weekReference: -1,
      createdAt: -1,
    });

    if (openPortals.length > 1) {
      const portalToKeep = openPortals[0];

      for (let i = 1; i < openPortals.length; i++) {
        openPortals[i].isOpen = false;
        openPortals[i].overriddenBy = req.user._id;
        openPortals[i].overrideReason =
          "Force-closed during portal cleanup";
        await openPortals[i].save();
      }

      return res.status(200).json({
        message: "Portal records cleaned successfully.",
        deletedDuplicates: duplicatesToDelete.length,
        keptOpenPortalId: portalToKeep._id,
      });
    }

    return res.status(200).json({
      message: "Portal records cleaned successfully.",
      deletedDuplicates: duplicatesToDelete.length,
      keptOpenPortalId: openPortals[0]?._id || null,
    });
  } catch (error) {
    next(error);
  }
};

export const getLeaderboard = async (req, res, next) => {
  try {
    const { weekReference, limit } = req.query;
    const week = weekReference
      ? normalizeWeekReference(weekReference)
      : getCurrentWeekReference();
    await ensureWeeklyMetricsFresh(week, {
      maxAgeMinutes: 60,
    });
    const leaderboardData = await getLeaderboardData(week, limit);

    res.status(200).json({
      qualificationWeekReference: week,
      leaderboard: leaderboardData.leaderboard,
      qualified: leaderboardData.qualified,
      almostQualified: leaderboardData.disqualified,
      noSubmission: leaderboardData.noSubmission,
    });
  } catch (error) {
    next(error);
  }
};

export const createSpecialService = async (req, res, next) => {
  try {
    const { name, date } = req.body;

    res.status(201).json({
      message: "Special service created.",
      service: { name, date },
    });
  } catch (error) {
    next(error);
  }
};

export const sendBulkNotification = async (req, res, next) => {
  try {
    const { title, message, link, targetRole } = req.body;

    const filter = { status: "approved" };
    if (targetRole && targetRole !== "all") {
      filter.role = targetRole;
    }

    const workers = await User.find(filter).select("_id");

    await createBulkNotification(
      workers.map((w) => w._id),
      {
        type: "general",
        title,
        message,
        link,
        senderId: req.user._id,
      }
    );

    res.status(200).json({
      message: `Notification sent to ${workers.length} workers.`,
    });
  } catch (error) {
    next(error);
  }
};
// Safe repair: only fix submitted on-time reports that were assigned
// to the wrong system week. Late/arrears reports intentionally belong
// to an older week, so they are skipped.
export const fixReportWeekReferences = async (req, res, next) => {
  try {
    const reports = await Report.find({
      status: "submitted",
      isLateSubmission: false,
    }).lean();
    let fixed = 0;
    let skipped = 0;
    let alreadyCorrect = 0;

    for (const r of reports) {
      if (!r.submittedAt) {
        skipped++;
        continue;
      }

      const correctWeek = normalizeWeekReference(
        getPortalWeekReferenceForNow(r.submittedAt)
      );
      const storedWeek = r.weekReference
        ? normalizeWeekReference(r.weekReference)
        : null;

      if (storedWeek && storedWeek.getTime() === correctWeek.getTime()) {
        alreadyCorrect++;
        continue;
      }

      await Report.updateOne(
        { _id: r._id },
        { weekReference: correctWeek }
      );
      fixed++;
    }

    res.status(200).json({
      message: `Repair complete. Fixed ${fixed} on-time reports. Skipped ${skipped}. Left ${alreadyCorrect} already correct.`,
      fixed,
      skipped,
      alreadyCorrect,
      skippedLateReports: "Late and arrears reports were intentionally not changed.",
    });
  } catch (error) {
    next(error);
  }
};
