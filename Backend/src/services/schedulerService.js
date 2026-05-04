import cron from "node-cron";
import PortalWindow from "../models/portalWindowModel.js";
import Metrics from "../models/metricsModel.js";
import User from "../models/userModel.js";
import Notification from "../models/notificationModel.js";
import Roster from "../models/rosterModel.js";
import FrontDeskSession from "../models/frontDeskSessionModel.js";
import Attendance from "../models/attendanceModel.js";
import PushSubscription from "../models/pushSubscriptionModel.js";
import {
  ensureWeeklyMetricsFresh,
  processWeeklyMetrics,
} from "./metricsService.js";
import {
  sendPortalOpenEmail,
  sendPortalClosedEmail,
  sendPortalDeadlineReminderEmail,
  sendQualificationResultsEmail,
  sendNoFrontDeskLoggingAlertEmail,
} from "./emailService.js";
import { createBulkNotification } from "./notificationService.js";
import { autoCloseExpiredSessions } from "../controllers/attendanceController.js";
import { sendPushToMany } from "./pushService.js";
import {
  getPortalWeekReferenceForNow,
  getPreviousPortalWeekReference,
  getPortalWindowForWeekReference,
  getSystemWeekWindowForWeekReference,
  isWithinSubmissionWindow,
  normalizeWeekReference,
} from "../utils/portalWeek.js";

const getApprovedRecipients = async () =>
  User.find({ status: "approved" }).select("_id email fullName notificationPreferences");

const getAdminRecipients = async () =>
  User.find({
    status: "approved",
    role: { $in: ["pastor", "admin", "moderator"] },
  }).select("_id email fullName notificationPreferences");

const openPortal = async () => {
  try {
    const now = new Date();
    const weekReference = getPortalWeekReferenceForNow(now);
    const { opensAt, closesAt } = getPortalWindowForWeekReference(weekReference);

    let portal = await PortalWindow.findOne({ weekReference });

    if (!portal) {
      portal = await PortalWindow.create({
        weekReference,
        opensAt,
        closesAt,
        isOpen: true,
      });
    } else {
      portal.isOpen = true;
      portal.opensAt = opensAt;
      portal.closesAt = closesAt;
      await portal.save();
    }

    const workers = await getApprovedRecipients();
    const emailWorkers = workers.filter((w) => w.email);

    await createBulkNotification(workers.map((w) => w._id), {
      type: "portal-open",
      title: "Report portal is now open",
      message: "You can now submit your weekly report. Portal closes Monday at 2:59pm.",
      link: "/portal/submit-report",
    });

    if (emailWorkers.length > 0) {
      await sendPortalOpenEmail(emailWorkers);
    }

    await sendPushToMany(workers.map((w) => w._id), {
      title: "Portal is now open",
      body: "Submit your weekly report before Monday 2:59pm.",
      url: "/portal/submit-report",
    });

    console.log("Scheduler: Portal opened for", weekReference.toDateString());
  } catch (err) {
    console.error("Scheduler openPortal error:", err.message);
  }
};

const sendClosingReminder = async () => {
  try {
    const workers = await getApprovedRecipients();
    const emailWorkers = workers.filter((w) => w.email);

    await createBulkNotification(workers.map((w) => w._id), {
      type: "portal-closing-soon",
      title: "Report deadline is today at 2:59pm",
      message:
        "Submit your report before 2:59pm today. If it is not submitted before the deadline, it will count against your qualification for the week.",
      link: "/portal/submit-report",
    });

    if (emailWorkers.length > 0) {
      await sendPortalDeadlineReminderEmail(emailWorkers);
    }

    await sendPushToMany(workers.map((w) => w._id), {
      title: "Report deadline is today at 2:59pm",
      body: "Submit before 2:59pm. Missing the deadline affects weekly qualification.",
      url: "/portal/submit-report",
    });

    console.log("Scheduler: Deadline reminder sent");
  } catch (err) {
    console.error("Scheduler closingReminder error:", err.message);
  }
};

const summarizeFrontDeskUsageForWeek = async (weekReference) => {
  const { opensAt, closesAt } = getSystemWeekWindowForWeekReference(weekReference);

  const [sessionCount, workerCheckIns] = await Promise.all([
    FrontDeskSession.countDocuments({
      serviceDate: { $gte: opensAt, $lte: closesAt },
    }),
    Attendance.countDocuments({
      serviceDate: { $gte: opensAt, $lte: closesAt },
      verifiedByFrontDesk: true,
      isOnDuty: false,
    }),
  ]);

  return {
    sessionCount,
    workerCheckIns,
    hasUsableLogging: sessionCount > 0 && workerCheckIns > 0,
  };
};

const processPortalClosureForWeek = async (weekReference, { source = "cron" } = {}) => {
  const now = new Date();
  const normalizedWeek = normalizeWeekReference(weekReference);
  const { opensAt, closesAt } = getPortalWindowForWeekReference(normalizedWeek);

  let portal = await PortalWindow.findOne({ weekReference: normalizedWeek });

  if (!portal) {
    portal = await PortalWindow.create({
      weekReference: normalizedWeek,
      opensAt,
      closesAt,
      isOpen: false,
      isProcessed: false,
    });
  } else {
    portal.opensAt = opensAt;
    portal.closesAt = closesAt;
    portal.isOpen = false;
    await portal.save();
  }

  if (portal.isProcessed) {
    return false;
  }

  const allRecipients = await getApprovedRecipients();
  const emailRecipients = allRecipients.filter((recipient) => recipient.email);

  await createBulkNotification(allRecipients.map((recipient) => recipient._id), {
    type: "portal-closed",
    title: "Portal is now closed",
    message:
      "The weekly submission window has closed. Reports not submitted before the deadline count against qualification for the week.",
    link: "/portal/my-reports",
  });

  if (emailRecipients.length > 0) {
    await sendPortalClosedEmail(emailRecipients, "Weekly deadline reached.");
  }

  await processWeeklyMetrics(normalizedWeek);

  const metrics = await Metrics.find({
    weekReference: normalizedWeek,
    isLateSubmission: false,
  })
    .populate("worker", "fullName workerId department")
    .sort({ totalScore: -1 });

  const qualified = metrics.filter((m) => m.isQualified);
  const disqualified = metrics.filter((m) => !m.isQualified);

  const recipients = await getAdminRecipients();
  const adminEmailRecipients = recipients.filter(
    (recipient) => recipient.notificationPreferences?.email !== false && recipient.email
  );

  if (adminEmailRecipients.length > 0) {
    await sendQualificationResultsEmail(adminEmailRecipients, qualified, disqualified);
  }

  await createBulkNotification(recipients.map((recipient) => recipient._id), {
    type: "qualification-result",
    title: "Qualification results ready - Action required",
    message: `Qualification has been processed. ${qualified.length} qualified, ${disqualified.length} not qualified.`,
    link: "/admin/qualification",
  });

  await sendPushToMany(recipients.map((recipient) => recipient._id), {
    title: "Qualification results ready",
    body: `${qualified.length} qualified, ${disqualified.length} not qualified.`,
    url: "/admin/qualification",
  });

  const frontDeskUsage = await summarizeFrontDeskUsageForWeek(normalizedWeek);

  if (!frontDeskUsage.hasUsableLogging && recipients.length > 0) {
    if (adminEmailRecipients.length > 0) {
      await sendNoFrontDeskLoggingAlertEmail(adminEmailRecipients, normalizedWeek);
    }

    await createBulkNotification(recipients.map((recipient) => recipient._id), {
      type: "general",
      title: "No front desk logging recorded this week",
      message:
        "No usable front desk worker logging was recorded for the week. Attendance should be treated as incomplete while reviewing qualification and preparing roster.",
      link: "/admin/qualification",
    });

    await sendPushToMany(recipients.map((recipient) => recipient._id), {
      title: "No front desk logging recorded",
      body:
        "Attendance for the week is incomplete. Review qualification and roster with caution.",
      url: "/admin/qualification",
    });
  }

  portal.isProcessed = true;
  portal.processedAt = now;
  await portal.save();

  console.log(
    `Scheduler: Portal closed and metrics processed for ${normalizedWeek.toDateString()} (${source})`
  );

  return true;
};

const closePortalAndProcess = async () => {
  try {
    const weekReference = getPortalWeekReferenceForNow(new Date());
    await processPortalClosureForWeek(weekReference, { source: "cron" });
  } catch (err) {
    console.error("Scheduler closePortalAndProcess error:", err.message);
  }
};

const catchUpMissedPortalClosure = async () => {
  try {
    const now = new Date();

    if (isWithinSubmissionWindow(now)) {
      return;
    }

    const overdueWeekReference = getPreviousPortalWeekReference(now);
    const { closesAt } = getPortalWindowForWeekReference(overdueWeekReference);

    if (now <= closesAt) {
      return;
    }

    await processPortalClosureForWeek(overdueWeekReference, { source: "catch-up" });
  } catch (err) {
    console.error("Scheduler catchUpMissedPortalClosure error:", err.message);
  }
};

const runCleanup = async () => {
  try {
    const now = new Date();
    const sessionCutoff = new Date(now - 180 * 24 * 60 * 60 * 1000);
    const readNotificationCutoff = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const unreadNotificationCutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const rosterCutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const { deletedCount: sessionsDeleted } = await FrontDeskSession.deleteMany({
      isOpen: false,
      createdAt: { $lt: sessionCutoff },
    });

    const activeSessions = await FrontDeskSession.find({}).distinct("_id");
    const { deletedCount: attendanceDeleted } = await Attendance.deleteMany({
      session: { $nin: activeSessions },
      createdAt: { $lt: sessionCutoff },
    });

    const pushSubs = await PushSubscription.aggregate([
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$user", latestId: { $first: "$_id" }, allIds: { $push: "$_id" } } },
      { $match: { "allIds.1": { $exists: true } } },
    ]);

    for (const sub of pushSubs) {
      const toDelete = sub.allIds.filter((id) => id.toString() !== sub.latestId.toString());
      if (toDelete.length) {
        await PushSubscription.deleteMany({ _id: { $in: toDelete } });
      }
    }

    const [{ deletedCount: readNotificationsDeleted }, { deletedCount: unreadNotificationsDeleted }] =
      await Promise.all([
        Notification.deleteMany({
          isRead: true,
          readAt: { $lt: readNotificationCutoff },
        }),
        Notification.deleteMany({
          isRead: false,
          createdAt: { $lt: unreadNotificationCutoff },
        }),
      ]);

    const { deletedCount: rostersDeleted } = await Roster.deleteMany({
      isPublished: true,
      publishedAt: { $lt: rosterCutoff },
    });

    console.log(
      `Cleanup done: ${sessionsDeleted} sessions, ${attendanceDeleted} attendance records, ${readNotificationsDeleted} read notifications, ${unreadNotificationsDeleted} unread notifications removed, ${rostersDeleted} published rosters removed.`
    );
  } catch (err) {
    console.error("Cleanup error:", err.message);
  }
};

const refreshLiveQualification = async () => {
  try {
    const now = new Date();

    if (!isWithinSubmissionWindow(now)) {
      return;
    }

    const weekReference = getPortalWeekReferenceForNow(now);
    await ensureWeeklyMetricsFresh(weekReference, {
      maxAgeMinutes: 0,
      force: true,
    });

    console.log("Scheduler: Live qualification refreshed for", weekReference.toDateString());
  } catch (err) {
    console.error("Scheduler refreshLiveQualification error:", err.message);
  }
};

export const initScheduler = () => {
  cron.schedule("0 0 * * 5", openPortal, { timezone: "Africa/Accra" });
  cron.schedule("0 * * * *", refreshLiveQualification, { timezone: "Africa/Accra" });
  cron.schedule("0 10 * * 1", sendClosingReminder, { timezone: "Africa/Accra" });
  cron.schedule("0 12 * * 1", sendClosingReminder, { timezone: "Africa/Accra" });
  cron.schedule("59 14 * * 1", closePortalAndProcess, { timezone: "Africa/Accra" });
  cron.schedule("*/15 * * * *", catchUpMissedPortalClosure, { timezone: "Africa/Accra" });
  cron.schedule("*/15 * * * *", autoCloseExpiredSessions, { timezone: "Africa/Accra" });
  cron.schedule("0 3 * * 0", runCleanup, { timezone: "Africa/Accra" });
  console.log("Scheduler: Cron jobs initialized (Africa/Accra timezone)");
};

export const syncPortalStateOnStartup = async () => {
  try {
    const now = new Date();

    await catchUpMissedPortalClosure();

    if (!isWithinSubmissionWindow(now)) {
      console.log("Startup sync: Outside portal window");
      return;
    }

    const weekReference = getPortalWeekReferenceForNow(now);
    const { opensAt, closesAt } = getPortalWindowForWeekReference(weekReference);

    let existing = await PortalWindow.findOne({ weekReference });

    if (!existing) {
      await PortalWindow.create({
        weekReference,
        opensAt,
        closesAt,
        isOpen: true,
      });
      console.log("Startup sync: Portal window created and opened");
      return;
    }

    if (!existing.isOpen) {
      existing.isOpen = true;
      existing.opensAt = opensAt;
      existing.closesAt = closesAt;
      await existing.save();
      console.log("Startup sync: Portal reopened");
      return;
    }

    console.log("Startup sync: Portal already open");
  } catch (err) {
    console.error("Startup sync error:", err.message);
  }
};
