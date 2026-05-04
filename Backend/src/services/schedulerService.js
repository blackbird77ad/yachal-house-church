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
  isValidEmailAddress,
  sendPortalOpenEmail,
  sendPortalDeadlineReminderEmail,
  sendPortalTwentyFourHourReminderEmail,
  sendQualificationResultsEmail,
  sendWeeklyFrontDeskSummaryEmail,
} from "./emailService.js";
import { createBulkNotification } from "./notificationService.js";
import {
  autoCloseExpiredSessions,
  replayRecentFrontDeskReportDispatches,
} from "../controllers/attendanceController.js";
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

const PROCESSING_STALE_MS = 15 * 60 * 1000;
const EMAIL_RETRY_INTERVAL_MS = 60 * 60 * 1000;
const PORTAL_COMMUNICATION_LOOKBACK_DAYS = 7;
const FRONT_DESK_REPORT_LOOKBACK_DAYS = 7;

const normalizeEmail = (value = "") => value.toString().trim().toLowerCase();
const formatFrontDeskServiceLabel = (session = {}) => {
  if (session?.serviceType === "special") {
    return session?.specialServiceName
      ? `Special Service - ${session.specialServiceName}`
      : "Special Service";
  }

  const rawType = session?.serviceType || "service";
  return `${rawType.charAt(0).toUpperCase()}${rawType.slice(1)} Service`;
};

const ensureAuditEntry = (container, key) => {
  if (!container[key]) {
    container[key] = {};
  }

  if (!Array.isArray(container[key].emailDeliveredTo)) {
    container[key].emailDeliveredTo = [];
  }

  return container[key];
};

const getPortalAuditEntry = (portal, key) => {
  portal.communicationAudit = portal.communicationAudit || {};
  return ensureAuditEntry(portal.communicationAudit, key);
};

const getPendingEmailRecipients = (recipients, auditEntry = {}) => {
  const delivered = new Set(
    (auditEntry.emailDeliveredTo || []).map((email) => normalizeEmail(email))
  );

  return recipients.filter(
    (recipient) => recipient?.email && !delivered.has(normalizeEmail(recipient.email))
  );
};

const shouldRetryEmailDispatch = (auditEntry = {}, now = new Date()) => {
  if (auditEntry.emailSentAt) {
    return false;
  }

  if (!auditEntry.lastAttemptAt) {
    return true;
  }

  return now.getTime() - new Date(auditEntry.lastAttemptAt).getTime() >= EMAIL_RETRY_INTERVAL_MS;
};

const updateAuditEmailDispatch = (
  auditEntry,
  summary,
  expectedRecipients,
  now = new Date()
) => {
  const delivered = new Set(
    (auditEntry.emailDeliveredTo || []).map((email) => normalizeEmail(email))
  );

  (summary?.deliveredTo || []).forEach((email) => {
    if (email) delivered.add(normalizeEmail(email));
  });

  auditEntry.emailDeliveredTo = [...delivered];
  auditEntry.emailAttempts = Number(auditEntry.emailAttempts || 0) + 1;
  auditEntry.lastAttemptAt = now;
  auditEntry.lastEmailError = summary?.ok
    ? null
    : summary?.errorMessages?.join(" | ") || "Email delivery failed.";

  if (getPendingEmailRecipients(expectedRecipients, auditEntry).length === 0) {
    auditEntry.emailSentAt = now;
    auditEntry.lastEmailError = null;
  }
};

const markAuditChannelSent = (auditEntry, channel, now = new Date()) => {
  const field = `${channel}SentAt`;
  if (!auditEntry[field]) {
    auditEntry[field] = now;
  }
};

const logEmailBatchIssues = (label, summary) => {
  if (summary && !summary.ok) {
    console.error(
      `${label}:`,
      summary.errorMessages?.join(" | ") ||
        `${summary.failedCount || 0} email(s) failed to send.`
    );
  }
};

const notificationExistsForRecipients = async (
  recipientIds,
  { title, link, since }
) => {
  if (!recipientIds.length) return false;

  return !!(await Notification.exists({
    recipient: { $in: recipientIds },
    title,
    link: link || null,
    createdAt: { $gte: since },
  }));
};

const ensureBulkNotificationDelivered = async ({
  auditEntry,
  recipientIds,
  payload,
  since,
}) => {
  if (auditEntry.inAppSentAt) return;

  if (recipientIds.length === 0) {
    auditEntry.inAppSentAt = new Date();
    return;
  }

  const alreadyExists = await notificationExistsForRecipients(recipientIds, {
    title: payload.title,
    link: payload.link,
    since,
  });

  if (!alreadyExists) {
    await createBulkNotification(recipientIds, payload);
  }

  auditEntry.inAppSentAt = new Date();
};

const ensurePushDispatch = async ({ auditEntry, recipientIds, payload }) => {
  if (auditEntry.pushSentAt) return;

  if (recipientIds.length > 0) {
    await sendPushToMany(recipientIds, payload);
  }

  auditEntry.pushSentAt = new Date();
};

const ensureEmailDispatch = async ({
  auditEntry,
  recipients,
  sendFn,
  label,
}) => {
  const emailRecipients = recipients.filter((recipient) => recipient?.email);
  const now = new Date();

  if (emailRecipients.length === 0) {
    if (!auditEntry.emailSentAt) {
      auditEntry.emailSentAt = now;
    }
    return;
  }

  if (!shouldRetryEmailDispatch(auditEntry, now)) {
    return;
  }

  const pendingRecipients = getPendingEmailRecipients(emailRecipients, auditEntry);

  if (pendingRecipients.length === 0) {
    auditEntry.emailSentAt = auditEntry.emailSentAt || now;
    auditEntry.lastEmailError = null;
    return;
  }

  const summary = await sendFn(pendingRecipients);
  updateAuditEmailDispatch(auditEntry, summary, emailRecipients, now);
  logEmailBatchIssues(label, summary);
};

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
    const emailWorkers = workers.filter((w) => isValidEmailAddress(w.email));

    await createBulkNotification(workers.map((w) => w._id), {
      type: "portal-open",
      title: "Report portal is now open",
      message: "You can now submit your weekly report. Portal closes Monday at 2:59pm.",
      link: "/portal/submit-report",
    });

    if (emailWorkers.length > 0) {
      const emailSummary = await sendPortalOpenEmail(emailWorkers);
      logEmailBatchIssues("Scheduler openPortal email delivery issue", emailSummary);
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
    const emailWorkers = workers.filter((w) => isValidEmailAddress(w.email));

    await createBulkNotification(workers.map((w) => w._id), {
      type: "portal-closing-soon",
      title: "Report deadline is today at 2:59pm",
      message:
        "Submit your report before 2:59pm today. If it is not submitted before the deadline, it will count against your qualification for the week.",
      link: "/portal/submit-report",
    });

    if (emailWorkers.length > 0) {
      const emailSummary = await sendPortalDeadlineReminderEmail(emailWorkers);
      logEmailBatchIssues("Scheduler deadline reminder email delivery issue", emailSummary);
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

const buildFrontDeskStatsFromAttendance = (records = []) => ({
  totalCheckedIn: records.length,
  early60Plus: records.filter((record) => record.timingCategory === "early-60plus").length,
  early30to60: records.filter((record) => record.timingCategory === "early-30to60").length,
  early15to30: records.filter((record) => record.timingCategory === "early-15to30").length,
  early0to15: records.filter((record) => record.timingCategory === "early-0to15").length,
  late: records.filter((record) => record.timingCategory === "late").length,
  onDuty: records.filter((record) => record.isOnDuty).length,
});

const buildWeeklyFrontDeskSummary = async (weekReference) => {
  const normalizedWeek = normalizeWeekReference(weekReference);
  const { opensAt, closesAt } = getSystemWeekWindowForWeekReference(normalizedWeek);

  const sessions = await FrontDeskSession.find({
    serviceDate: { $gte: opensAt, $lte: closesAt },
  })
    .populate("primarySupervisor", "fullName workerId")
    .sort({ serviceDate: 1, serviceStartTime: 1, createdAt: 1 });

  const sessionIds = sessions.map((session) => session._id);
  const attendanceRecords = sessionIds.length
    ? await Attendance.find({ session: { $in: sessionIds } })
        .select(
          "session worker checkInTime timingCategory isOnDuty verifiedByFrontDesk serviceDate"
        )
        .populate("worker", "fullName workerId department")
        .sort({ serviceDate: 1, checkInTime: 1 })
    : [];

  const attendanceBySession = new Map();
  attendanceRecords.forEach((record) => {
    const key = record.session?.toString();
    if (!key) return;
    if (!attendanceBySession.has(key)) {
      attendanceBySession.set(key, []);
    }
    attendanceBySession.get(key).push(record);
  });

  const sessionSummaries = sessions.map((session) => {
    const records = attendanceBySession.get(session._id.toString()) || [];
    const computedStats = buildFrontDeskStatsFromAttendance(records);
    const savedStats = session.closedAt ? session.stats || {} : computedStats;
    const workerCheckIns = records.filter(
      (record) => record.verifiedByFrontDesk === true && record.isOnDuty !== true
    ).length;

    return {
      sessionId: session._id.toString(),
      serviceType: session.serviceType,
      specialServiceName: session.specialServiceName || "",
      serviceLabel: formatFrontDeskServiceLabel(session),
      serviceDate: session.serviceDate,
      serviceStartTime: session.serviceStartTime,
      isOpen: session.isOpen,
      closedAt: session.closedAt,
      closedBy: session.closedBy,
      closeReason: session.closeReason || "",
      supervisorName: session.primarySupervisor?.fullName || "Unassigned",
      supervisorWorkerId: session.primarySupervisor?.workerId || "",
      totalCheckedIn: savedStats.totalCheckedIn ?? computedStats.totalCheckedIn,
      early60Plus: savedStats.early60Plus ?? computedStats.early60Plus,
      early30to60: savedStats.early30to60 ?? computedStats.early30to60,
      early15to30: savedStats.early15to30 ?? computedStats.early15to30,
      early0to15: savedStats.early0to15 ?? computedStats.early0to15,
      late: savedStats.late ?? computedStats.late,
      onDuty: savedStats.onDuty ?? computedStats.onDuty,
      workerCheckIns,
    };
  });

  const workerCheckIns = sessionSummaries.reduce(
    (sum, session) => sum + (session.workerCheckIns || 0),
    0
  );
  const totalCheckedIn = sessionSummaries.reduce(
    (sum, session) => sum + (session.totalCheckedIn || 0),
    0
  );

  return {
    weekReference: normalizedWeek,
    opensAt,
    closesAt,
    sessionCount: sessionSummaries.length,
    totalCheckedIn,
    workerCheckIns,
    hasUsableLogging: sessionSummaries.length > 0 && workerCheckIns > 0,
    sessions: sessionSummaries,
  };
};

const getDispatchSince = (portal, fallbackNow = new Date()) => {
  if (portal?.processedAt) {
    return new Date(new Date(portal.processedAt).getTime() - 15 * 60 * 1000);
  }

  return new Date(fallbackNow.getTime() - 24 * 60 * 60 * 1000);
};

const upsertPortalWindow = async (normalizedWeek, opensAt, closesAt) =>
  PortalWindow.findOneAndUpdate(
    { weekReference: normalizedWeek },
    {
      $setOnInsert: { weekReference: normalizedWeek },
      $set: {
        opensAt,
        closesAt,
        isOpen: false,
      },
    },
    { upsert: true, new: true }
  );

const claimPortalProcessing = async (normalizedWeek, opensAt, closesAt) => {
  await upsertPortalWindow(normalizedWeek, opensAt, closesAt);

  const staleCutoff = new Date(Date.now() - PROCESSING_STALE_MS);

  return PortalWindow.findOneAndUpdate(
    {
      weekReference: normalizedWeek,
      isProcessed: false,
      $or: [
        { processingStartedAt: { $exists: false } },
        { processingStartedAt: null },
        { processingStartedAt: { $lt: staleCutoff } },
      ],
    },
    {
      $set: {
        opensAt,
        closesAt,
        isOpen: false,
        processingStartedAt: new Date(),
      },
    },
    { new: true }
  );
};

const ensurePortalClosureCommunications = async (
  portal,
  weekReference,
  { replayWorkerClosureCommunications = false } = {}
) => {
  const normalizedWeek = normalizeWeekReference(weekReference);
  const dispatchSince = getDispatchSince(portal);
  const now = new Date();

  const allRecipients = await getApprovedRecipients();
  const allRecipientIds = allRecipients.map((recipient) => recipient._id);
  const portalClosedAudit = getPortalAuditEntry(portal, "portalClosed");
  const portalClosedNotification = {
    type: "portal-closed",
    title: "Portal is now closed",
    message:
      "The weekly submission window has closed. Reports not submitted before the deadline count against qualification for the week.",
    link: "/portal/my-reports",
  };

  await ensureBulkNotificationDelivered({
    auditEntry: portalClosedAudit,
    recipientIds: allRecipientIds,
    payload: portalClosedNotification,
    since: dispatchSince,
  });

  await ensurePushDispatch({
    auditEntry: portalClosedAudit,
    recipientIds: allRecipientIds,
    payload: {
      title: "Portal is now closed",
      body: "The weekly submission window has closed. View your reports in the portal.",
      url: "/portal/my-reports",
    },
  });

  portalClosedAudit.emailSentAt = portalClosedAudit.emailSentAt || now;
  portalClosedAudit.lastEmailError = null;

  const metrics = await Metrics.find({
    weekReference: normalizedWeek,
    isLateSubmission: false,
  })
    .populate("worker", "fullName workerId department")
    .sort({ totalScore: -1 });

  const qualified = metrics.filter((metric) => metric.isQualified);
  const disqualified = metrics.filter((metric) => !metric.isQualified);

  const leaderRecipients = await getAdminRecipients();
  const leaderRecipientIds = leaderRecipients.map((recipient) => recipient._id);
  const adminEmailRecipients = leaderRecipients.filter((recipient) =>
    isValidEmailAddress(recipient.email)
  );

  const qualificationAudit = getPortalAuditEntry(portal, "qualificationResults");
  qualificationAudit.qualifiedCount = qualified.length;
  qualificationAudit.disqualifiedCount = disqualified.length;

  const qualificationNotification = {
    type: "qualification-result",
    title: "Qualification results ready - Action required",
    message: `Qualification has been processed. ${qualified.length} qualified, ${disqualified.length} not qualified.`,
    link: "/admin/qualification",
  };

  await ensureBulkNotificationDelivered({
    auditEntry: qualificationAudit,
    recipientIds: leaderRecipientIds,
    payload: qualificationNotification,
    since: dispatchSince,
  });

  await ensureEmailDispatch({
    auditEntry: qualificationAudit,
    recipients: adminEmailRecipients,
    sendFn: (recipients) =>
      sendQualificationResultsEmail(recipients, qualified, disqualified),
    label: "Scheduler qualification email delivery issue",
  });

  await ensurePushDispatch({
    auditEntry: qualificationAudit,
    recipientIds: leaderRecipientIds,
    payload: {
      title: "Qualification results ready",
      body: `${qualified.length} qualified, ${disqualified.length} not qualified.`,
      url: "/admin/qualification",
    },
  });

  const frontDeskWeeklySummary = await buildWeeklyFrontDeskSummary(normalizedWeek);
  const frontDeskSummaryAudit = getPortalAuditEntry(portal, "frontDeskWeeklySummary");
  frontDeskSummaryAudit.sessionCount = frontDeskWeeklySummary.sessionCount;
  frontDeskSummaryAudit.workerCheckIns = frontDeskWeeklySummary.workerCheckIns;
  frontDeskSummaryAudit.hasUsableLogging = frontDeskWeeklySummary.hasUsableLogging;

  const frontDeskSummaryNotification = frontDeskWeeklySummary.hasUsableLogging
    ? {
        type: "general",
        title: "Weekly front desk attendance summary ready",
        message: `${frontDeskWeeklySummary.workerCheckIns} worker check-in(s) were logged across ${frontDeskWeeklySummary.sessionCount} service session(s) this system week.`,
        link: "/admin/attendance",
      }
    : {
        type: "general",
        title: "No front desk attendance data received this week",
        message:
          frontDeskWeeklySummary.sessionCount > 0
            ? `Front desk was opened for ${frontDeskWeeklySummary.sessionCount} service session(s), but no attendance data was received or supervised by the worker on front desk duty.`
            : "No attendance data was received or supervised by the worker on front desk duty this system week.",
        link: "/admin/attendance",
      };

  await ensureBulkNotificationDelivered({
    auditEntry: frontDeskSummaryAudit,
    recipientIds: leaderRecipientIds,
    payload: frontDeskSummaryNotification,
    since: dispatchSince,
  });

  await ensureEmailDispatch({
    auditEntry: frontDeskSummaryAudit,
    recipients: adminEmailRecipients,
    sendFn: (recipients) =>
      sendWeeklyFrontDeskSummaryEmail(recipients, frontDeskWeeklySummary),
    label: "Scheduler weekly front-desk summary email delivery issue",
  });

  await ensurePushDispatch({
    auditEntry: frontDeskSummaryAudit,
    recipientIds: leaderRecipientIds,
    payload: {
      title: frontDeskWeeklySummary.hasUsableLogging
        ? "Weekly front desk attendance summary ready"
        : "No front desk attendance data received",
      body: frontDeskWeeklySummary.hasUsableLogging
        ? `${frontDeskWeeklySummary.workerCheckIns} worker check-in(s) recorded across ${frontDeskWeeklySummary.sessionCount} service session(s).`
        : "No attendance data was received through front desk duty this system week.",
      url: "/admin/attendance",
    },
  });

  const noFrontDeskAudit = getPortalAuditEntry(portal, "noFrontDeskLogging");
  noFrontDeskAudit.required = !frontDeskWeeklySummary.hasUsableLogging;

  if (noFrontDeskAudit.required) {
    noFrontDeskAudit.inAppSentAt =
      noFrontDeskAudit.inAppSentAt || frontDeskSummaryAudit.inAppSentAt || null;
    noFrontDeskAudit.emailSentAt =
      noFrontDeskAudit.emailSentAt || frontDeskSummaryAudit.emailSentAt || null;
    noFrontDeskAudit.pushSentAt =
      noFrontDeskAudit.pushSentAt || frontDeskSummaryAudit.pushSentAt || null;
    noFrontDeskAudit.emailAttempts = Math.max(
      Number(noFrontDeskAudit.emailAttempts || 0),
      Number(frontDeskSummaryAudit.emailAttempts || 0)
    );
    noFrontDeskAudit.lastAttemptAt =
      frontDeskSummaryAudit.lastAttemptAt || noFrontDeskAudit.lastAttemptAt || null;
    noFrontDeskAudit.lastEmailError =
      frontDeskSummaryAudit.lastEmailError || noFrontDeskAudit.lastEmailError || null;
    noFrontDeskAudit.emailDeliveredTo = [
      ...new Set(
        [
          ...(noFrontDeskAudit.emailDeliveredTo || []),
          ...(frontDeskSummaryAudit.emailDeliveredTo || []),
        ].map((email) => normalizeEmail(email))
      ),
    ].filter(Boolean);
  } else {
    noFrontDeskAudit.lastEmailError = null;
  }

  portal.markModified("communicationAudit");
  await portal.save();

  console.log(
    `Scheduler: Communication audit synced for ${normalizedWeek.toDateString()} at ${now.toISOString()}`
  );
};

const processPortalClosureForWeek = async (weekReference, { source = "cron" } = {}) => {
  const now = new Date();
  const normalizedWeek = normalizeWeekReference(weekReference);
  const { opensAt, closesAt } = getPortalWindowForWeekReference(normalizedWeek);

  const claimedPortal = await claimPortalProcessing(normalizedWeek, opensAt, closesAt);

  if (!claimedPortal) {
    const existingPortal = await PortalWindow.findOne({ weekReference: normalizedWeek });

    if (existingPortal?.isProcessed) {
      await ensurePortalClosureCommunications(existingPortal, normalizedWeek, {
        replayWorkerClosureCommunications: false,
      });
    }

    return false;
  }

  try {
    await processWeeklyMetrics(normalizedWeek);

    claimedPortal.isProcessed = true;
    claimedPortal.processedAt = now;
    claimedPortal.processingStartedAt = null;
    await claimedPortal.save();
  } catch (error) {
    claimedPortal.processingStartedAt = null;
    await claimedPortal.save().catch(() => {});
    throw error;
  }

  try {
    await ensurePortalClosureCommunications(claimedPortal, normalizedWeek, {
      replayWorkerClosureCommunications: true,
    });
  } catch (communicationError) {
    console.error(
      "Scheduler portal closure communication sync error:",
      communicationError.message
    );
  }

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

const sendTwentyFourHourReminder = async () => {
  try {
    const workers = await getApprovedRecipients();
    const emailWorkers = workers.filter((w) => isValidEmailAddress(w.email));

    await createBulkNotification(workers.map((w) => w._id), {
      type: "portal-closing-soon",
      title: "Report portal closes in 24 hours",
      message:
        "The submission portal will close in 24 hours at Monday 2:59pm. Submit your report before the deadline.",
      link: "/portal/submit-report",
    });

    if (emailWorkers.length > 0) {
      const emailSummary = await sendPortalTwentyFourHourReminderEmail(emailWorkers);
      logEmailBatchIssues("Scheduler 24-hour reminder email delivery issue", emailSummary);
    }

    await sendPushToMany(workers.map((w) => w._id), {
      title: "Portal closes in 24 hours",
      body: "Submit your weekly report before Monday 2:59pm.",
      url: "/portal/submit-report",
    });

    console.log("Scheduler: 24-hour portal reminder sent");
  } catch (err) {
    console.error("Scheduler sendTwentyFourHourReminder error:", err.message);
  }
};

const replayRecentPortalCommunications = async () => {
  try {
    const lookbackStart = new Date();
    lookbackStart.setUTCDate(
      lookbackStart.getUTCDate() - PORTAL_COMMUNICATION_LOOKBACK_DAYS
    );
    lookbackStart.setUTCHours(0, 0, 0, 0);

    const processedPortals = await PortalWindow.find({
      isProcessed: true,
      weekReference: { $gte: lookbackStart },
    })
      .sort({ weekReference: -1 })
      .limit(3);

    for (const portal of processedPortals) {
      await ensurePortalClosureCommunications(portal, portal.weekReference, {
        replayWorkerClosureCommunications: false,
      });
    }
  } catch (err) {
    console.error("Scheduler replayRecentPortalCommunications error:", err.message);
  }
};

const replayRecentFrontDeskCommunications = async () => {
  try {
    await replayRecentFrontDeskReportDispatches();
  } catch (err) {
    console.error("Scheduler replayRecentFrontDeskCommunications error:", err.message);
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
  cron.schedule("59 14 * * 0", sendTwentyFourHourReminder, { timezone: "Africa/Accra" });
  cron.schedule("0 11 * * 1", sendClosingReminder, { timezone: "Africa/Accra" });
  cron.schedule("59 14 * * 1", closePortalAndProcess, { timezone: "Africa/Accra" });
  cron.schedule("*/15 * * * *", catchUpMissedPortalClosure, { timezone: "Africa/Accra" });
  cron.schedule("*/15 * * * *", replayRecentPortalCommunications, {
    timezone: "Africa/Accra",
  });
  cron.schedule("*/15 * * * *", replayRecentFrontDeskCommunications, {
    timezone: "Africa/Accra",
  });
  cron.schedule("*/15 * * * *", autoCloseExpiredSessions, { timezone: "Africa/Accra" });
  cron.schedule("0 3 * * 0", runCleanup, { timezone: "Africa/Accra" });
  console.log("Scheduler: Cron jobs initialized (Africa/Accra timezone)");
};

export const syncPortalStateOnStartup = async () => {
  try {
    const now = new Date();

    await catchUpMissedPortalClosure();
    await replayRecentPortalCommunications();
    await replayRecentFrontDeskCommunications();

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
