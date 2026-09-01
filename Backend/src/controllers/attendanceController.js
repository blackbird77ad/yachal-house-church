import Attendance from "../models/attendanceModel.js";
import FrontDeskSession from "../models/frontDeskSessionModel.js";
import Notification from "../models/notificationModel.js";
import User from "../models/userModel.js";
import {
  isValidEmailAddress,
  sendFrontDeskReportEmail,
  sendGenericNotificationEmail,
} from "../services/emailService.js";
import { createBulkNotification } from "../services/notificationService.js";
import { sendPushToMany } from "../services/pushService.js";
import {
  ADMIN_ROLES,
  assertCanAccessBranch,
  canAccessAllBranches,
  getAccessibleBranchIds,
  getBranchScopeMeta,
  getUserBranchId,
  normalizeBranchId,
  resolveBranchScope,
} from "../utils/branchAccess.js";

const FRONT_DESK_EMAIL_RETRY_INTERVAL_MS = 60 * 60 * 1000;
const FRONT_DESK_REPORT_LOOKBACK_DAYS = 7;
const FRONT_DESK_INACTIVITY_MS = 4 * 60 * 60 * 1000;

const normalizeEmail = (value = "") => value.toString().trim().toLowerCase();
const getNextAutoCloseTime = (activityTime = new Date()) =>
  new Date(new Date(activityTime).getTime() + FRONT_DESK_INACTIVITY_MS);

const getSessionBranchId = (session) =>
  session?.branch?._id?.toString?.() || session?.branch?.toString?.() || "";

const isAdminLevelUser = (user) => ADMIN_ROLES.includes(user?.role);

const resolveSessionBranchIdForWrite = (req) => {
  const requestedBranchId = normalizeBranchId(req.body?.branchId || req.query?.branchId);

  if (canAccessAllBranches(req.user)) {
    return requestedBranchId || null;
  }

  const accessibleBranchIds = getAccessibleBranchIds(req.user);

  if (requestedBranchId) {
    assertCanAccessBranch(req, requestedBranchId);
    return requestedBranchId;
  }

  if (accessibleBranchIds.length > 0) {
    return accessibleBranchIds[0];
  }

  return getUserBranchId(req.user) || null;
};

const assertCanAccessSession = (req, session) => {
  const sessionBranchId = getSessionBranchId(session);
  if (!sessionBranchId || canAccessAllBranches(req.user)) return;

  if (isAdminLevelUser(req.user)) {
    assertCanAccessBranch(req, sessionBranchId);
    return;
  }

  if (getUserBranchId(req.user) !== sessionBranchId) {
    const error = new Error("You can only access front desk sessions for your branch.");
    error.statusCode = 403;
    throw error;
  }
};

const getActiveSessionFilter = (req) => {
  const requestedBranchId = normalizeBranchId(req.query?.branchId);
  const filter = { isOpen: true };

  if (canAccessAllBranches(req.user)) {
    if (requestedBranchId) filter.branch = requestedBranchId;
    return filter;
  }

  if (isAdminLevelUser(req.user)) {
    const accessibleBranchIds = getAccessibleBranchIds(req.user);
    if (requestedBranchId) {
      assertCanAccessBranch(req, requestedBranchId);
      filter.branch = requestedBranchId;
    } else if (accessibleBranchIds.length > 1) {
      filter.branch = { $in: accessibleBranchIds };
    } else if (accessibleBranchIds.length === 1) {
      filter.branch = accessibleBranchIds[0];
    } else {
      filter.branch = "000000000000000000000000";
    }
    return filter;
  }

  const userBranchId = getUserBranchId(req.user);
  filter.$or = [
    { branch: { $exists: false } },
    { branch: null },
  ];

  if (userBranchId) {
    filter.$or.push({ branch: userBranchId });
  }

  return filter;
};

const applyAttendanceBranchScope = (req, filter = {}) => {
  const scope = resolveBranchScope(req);

  if (scope.branchIds?.length > 1) {
    filter.branch = { $in: scope.branchIds };
  } else if (scope.branchId) {
    filter.branch = scope.branchId;
  }

  return { filter, scope };
};

const getPendingEmailRecipients = (recipients, deliveredTo = []) => {
  const delivered = new Set(deliveredTo.map((email) => normalizeEmail(email)));
  return recipients.filter(
    (recipient) => recipient?.email && !delivered.has(normalizeEmail(recipient.email))
  );
};

const shouldRetryReportEmail = (dispatch = {}, now = new Date()) => {
  if (dispatch.emailSentAt) return false;
  if (!dispatch.lastAttemptAt) return true;

  return now.getTime() - new Date(dispatch.lastAttemptAt).getTime() >= FRONT_DESK_EMAIL_RETRY_INTERVAL_MS;
};

const updateReportDispatchEmail = (dispatch, summary, expectedRecipients, now = new Date()) => {
  const delivered = new Set((dispatch.emailDeliveredTo || []).map((email) => normalizeEmail(email)));

  (summary?.deliveredTo || []).forEach((email) => {
    if (email) delivered.add(normalizeEmail(email));
  });

  dispatch.emailDeliveredTo = [...delivered];
  dispatch.emailAttempts = Number(dispatch.emailAttempts || 0) + 1;
  dispatch.lastAttemptAt = now;
  dispatch.lastEmailError = summary?.ok
    ? null
    : summary?.errorMessages?.join(" | ") || "Front desk email delivery failed.";

  if (getPendingEmailRecipients(expectedRecipients, dispatch.emailDeliveredTo).length === 0) {
    dispatch.emailSentAt = now;
    dispatch.lastEmailError = null;
  }
};

const notificationExistsForAdmins = async (recipientIds, title, link, since) => {
  if (!recipientIds.length) return false;

  return !!(await Notification.exists({
    recipient: { $in: recipientIds },
    title,
    link: link || null,
    createdAt: { $gte: since },
  }));
};

// ── Timing helper ─────────────────────────────────────────────────────────────
const getTimingCategory = (checkInTime, serviceStartTime) => {
  const diffMs = new Date(serviceStartTime) - new Date(checkInTime);
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins >= 60)  return { category: "early-60plus",   minutesBefore: diffMins };
  if (diffMins >= 30)  return { category: "early-30to60",   minutesBefore: diffMins };
  if (diffMins >= 15)  return { category: "early-15to30",   minutesBefore: diffMins };
  if (diffMins >= 0)   return { category: "early-0to15",    minutesBefore: diffMins };
  return                      { category: "late",            minutesBefore: diffMins };
};

// ── Compute and save session stats ────────────────────────────────────────────
const computeStats = async (sessionId) => {
  const records = await Attendance.find({ session: sessionId });
  const stats = {
    totalCheckedIn: records.length,
    early60Plus:    records.filter((r) => r.timingCategory === "early-60plus").length,
    early30to60:    records.filter((r) => r.timingCategory === "early-30to60").length,
    early15to30:    records.filter((r) => r.timingCategory === "early-15to30").length,
    early0to15:     records.filter((r) => r.timingCategory === "early-0to15").length,
    late:           records.filter((r) => r.timingCategory === "late").length,
    onDuty:         records.filter((r) => r.isOnDuty).length,
  };
  return stats;
};

// ── Create session ────────────────────────────────────────────────────────────
export const createSession = async (req, res, next) => {
  try {
    const { serviceType, specialServiceName, serviceDate, serviceStartTime, coSupervisorId } = req.body;
    const sessionBranchId = resolveSessionBranchIdForWrite(req);

    const openTime = new Date();
    const start = new Date(serviceStartTime);
    const autoClose = getNextAutoCloseTime(openTime);

    // Close any previously open session and dispatch its report before replacing it.
    const openSessionFilter = { isOpen: true };
    if (sessionBranchId) {
      openSessionFilter.branch = sessionBranchId;
    } else {
      openSessionFilter.$or = [{ branch: { $exists: false } }, { branch: null }];
    }

    const openSessions = await FrontDeskSession.find(openSessionFilter)
      .populate("primarySupervisor", "fullName workerId email")
      .populate("coSupervisors", "fullName workerId email");

    for (const existingSession of openSessions) {
      const stats = await computeStats(existingSession._id);
      existingSession.isOpen = false;
      existingSession.closedAt = openTime;
      existingSession.closedBy = "force";
      existingSession.closeReason = "Superseded by a new front desk session.";
      existingSession.stats = stats;
      await existingSession.save();
      await sendReportToAdmins(existingSession, stats, false);
    }

    const { isDeputy, deputyFor } = req.body;

    const session = await FrontDeskSession.create({
      branch: sessionBranchId || undefined,
      serviceType,
      specialServiceName: specialServiceName || "",
      serviceDate: new Date(serviceDate),
      serviceStartTime: start,
      autoCloseTime: autoClose,
      lastActivityAt: openTime,
      primarySupervisor: req.user._id,
      supervisorCheckInTime: openTime,
      coSupervisors: coSupervisorId ? [coSupervisorId] : [],
      isOpen: true,
      isDeputy: isDeputy || false,
      deputyFor: deputyFor || null,
    });

    // If deputy, notify admins immediately
    if (isDeputy && deputyFor) {
      try {
        const adminFilter = {
          status: "approved",
          role: { $in: ["pastor", "admin", "moderator"] },
        };

        if (sessionBranchId) {
          adminFilter.$or = [
            { canViewAllBranches: { $ne: false } },
            { branch: sessionBranchId },
            { managedBranches: sessionBranchId },
          ];
        }

        const admins = await User.find(adminFilter).select("_id email fullName");

        await createBulkNotification(admins.map((a) => a._id), {
          type: "general",
          title: "Deputy front desk duty",
          message: `${req.user.fullName} (${req.user.workerId}) is covering front desk duty for ${deputyFor} who could not attend.`,
          link: "/admin/attendance",
        });
        await sendPushToMany(admins.map((admin) => admin._id), {
          title: "Deputy front desk duty",
          body: `${req.user.fullName} is covering front desk duty for ${deputyFor}.`,
          url: "/admin/attendance",
        });
        await sendGenericNotificationEmail(admins, {
          subject: "Deputy front desk duty notice",
          title: "Deputy front desk duty",
          message: `${req.user.fullName} (${req.user.workerId}) is covering front desk duty for ${deputyFor} who could not attend.`,
          link: "/admin/attendance",
          linkLabel: "View Attendance",
        });
      } catch {}
    }

    // Auto check-in the supervisor
    const { category, minutesBefore } = getTimingCategory(openTime, start);
    await Attendance.create({
      worker: req.user._id,
      session: session._id,
      branch: sessionBranchId || undefined,
      serviceType,
      serviceDate: new Date(serviceDate),
      checkInTime: openTime,
      timingCategory: category,
      minutesBeforeService: minutesBefore,
      isOnDuty: true,
      verifiedByFrontDesk: true,
      loggedBy: req.user._id,
    });

    res.status(201).json({ message: "Front desk session opened.", session });
  } catch (error) { next(error); }
};

// ── Check in a worker ─────────────────────────────────────────────────────────
export const checkInWorker = async (req, res, next) => {
  try {
    const { identifier, sessionId, isOnDuty, notes } = req.body;

    const session = await FrontDeskSession.findById(sessionId);
    if (!session || !session.isOpen) {
      return res.status(400).json({ message: "Front desk session is not open." });
    }
    assertCanAccessSession(req, session);
    const sessionBranchId = getSessionBranchId(session);

    // Find by workerId or name
    const isId = /^\d+$/.test(identifier?.trim());
    const workerFilter = { status: "approved" };
    if (sessionBranchId) {
      workerFilter.branch = sessionBranchId;
    }

    const worker = isId
      ? await User.findOne({ ...workerFilter, workerId: identifier.trim() })
      : await User.findOne({
          ...workerFilter,
          fullName: { $regex: identifier.trim(), $options: "i" },
        });

    if (!worker) {
      return res.status(404).json({ message: "No approved worker found. Check the ID or name." });
    }

    const existing = await Attendance.findOne({ worker: worker._id, session: sessionId });
    if (existing) {
      return res.status(400).json({
        message: `${worker.fullName} is already checked in at ${new Date(existing.checkInTime).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" })}.`,
        alreadyCheckedIn: true,
        worker: { fullName: worker.fullName, workerId: worker.workerId },
      });
    }

    const now = new Date();
    const { category, minutesBefore } = getTimingCategory(now, session.serviceStartTime);

    const attendance = await Attendance.create({
      worker: worker._id,
      session: sessionId,
      branch: sessionBranchId || undefined,
      serviceType: session.serviceType,
      serviceDate: session.serviceDate,
      checkInTime: now,
      timingCategory: category,
      minutesBeforeService: minutesBefore,
      isOnDuty: isOnDuty || false,
      verifiedByFrontDesk: true,
      loggedBy: req.user._id,
      notes: notes || "",
    });

    session.lastActivityAt = now;
    session.autoCloseTime = getNextAutoCloseTime(now);
    await session.save();

    const timeStr = now.toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" });
    const timingMsg =
      category === "late"
        ? `Late by ${Math.abs(minutesBefore)} min`
        : `${minutesBefore} min before service`;

    res.status(201).json({
      message: `${worker.fullName} checked in at ${timeStr} (${timingMsg}).`,
      worker: { fullName: worker.fullName, workerId: worker.workerId, department: worker.department },
      attendance,
      timingCategory: category,
    });
  } catch (error) { next(error); }
};

// ── Get active session ────────────────────────────────────────────────────────
export const getActiveSession = async (req, res, next) => {
  try {
    const session = await FrontDeskSession.findOne(getActiveSessionFilter(req))
      .populate("branch", "name code status")
      .populate("primarySupervisor", "fullName workerId")
      .populate("coSupervisors", "fullName workerId")
      .sort({ createdAt: -1 });

    res.status(200).json({ session: session || null });
  } catch (error) { next(error); }
};

// ── Get session attendance list ───────────────────────────────────────────────
export const getSessionAttendance = async (req, res, next) => {
  try {
    const session = await FrontDeskSession.findById(req.params.sessionId).select("branch");
    if (!session) {
      return res.status(404).json({ message: "Session not found." });
    }
    assertCanAccessSession(req, session);

    const attendance = await Attendance.find({ session: req.params.sessionId })
      .populate("worker", "fullName workerId department branch")
      .populate("loggedBy", "fullName")
      .sort({ checkInTime: 1 });

    res.status(200).json({ attendance });
  } catch (error) { next(error); }
};

// ── Get attendance history ────────────────────────────────────────────────────
export const getAttendanceHistory = async (req, res, next) => {
  try {
    const { limit = 15, page = 1, dateFrom, dateTo } = req.query;
    const filter = {};
    if (dateFrom || dateTo) {
      filter.serviceDate = {};
      if (dateFrom) filter.serviceDate.$gte = new Date(dateFrom);
      if (dateTo)   filter.serviceDate.$lte = new Date(dateTo);
    }
    const { filter: scopedFilter, scope } = applyAttendanceBranchScope(req, filter);

    const skip = (Number(page) - 1) * Number(limit);
    const [sessions, total] = await Promise.all([
      FrontDeskSession.find(scopedFilter)
        .populate("branch", "name code status")
        .populate("primarySupervisor", "fullName workerId")
        .sort({ serviceDate: -1 })
        .skip(skip)
        .limit(Number(limit)),
      FrontDeskSession.countDocuments(scopedFilter),
    ]);

    res.status(200).json({
      sessions,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      branchScope: getBranchScopeMeta(req, scope),
    });
  } catch (error) { next(error); }
};

// ── Close session manually ────────────────────────────────────────────────────
export const closeSession = async (req, res, next) => {
  try {
    const { force, closeReason } = req.body;
    const isAdminLevel = ["pastor", "admin", "moderator"].includes(req.user?.role);

    const session = await FrontDeskSession.findById(req.params.sessionId)
      .populate("primarySupervisor", "fullName workerId email")
      .populate("coSupervisors", "fullName workerId email");

    if (!session) return res.status(404).json({ message: "Session not found." });
    assertCanAccessSession(req, session);

    // If already closed
    if (!session.isOpen) {
      return res.status(400).json({ message: "This session is already closed." });
    }

    const stats = await computeStats(session._id);
    session.isOpen = false;
    session.closedAt = new Date();
    session.closedBy = force ? "force" : "manual";
    session.closeReason = closeReason || null;
    session.stats = stats;

    // If session has no supervisor (old data), set the closing user
    if (!session.primarySupervisor) {
      session.primarySupervisor = req.user._id;
      session.supervisorCheckInTime = session.createdAt || new Date();
    }

    await session.save();

    await sendReportToAdmins(session, stats, false);

    res.status(200).json({ message: "Session closed. Report sent to admin team.", stats });
  } catch (error) { next(error); }
};

// ── Auto close after 4 hours (called by scheduler) ───────────────────────────
export const autoCloseExpiredSessions = async () => {
  try {
    const now = new Date();
    const expiredSessions = await FrontDeskSession.find({
      isOpen: true,
      autoCloseTime: { $lte: now },
    })
      .populate("primarySupervisor", "fullName workerId email")
      .populate("coSupervisors", "fullName workerId email");

    for (const session of expiredSessions) {
      const stats = await computeStats(session._id);
      session.isOpen = false;
      session.closedAt = now;
      session.closedBy = "auto";
      session.stats = stats;
      await session.save();

      await sendReportToAdmins(session, stats, true);
    }

    if (expiredSessions.length > 0) {
      console.log(`Auto-closed ${expiredSessions.length} expired front desk session(s)`);
    }
  } catch (err) {
    console.error("autoCloseExpiredSessions error:", err.message);
  }
};

// ── Send report to admin/mod/pastor ──────────────────────────────────────────
const sendReportToAdmins = async (session, stats, isAuto = false) => {
  try {
    session.reportDispatch = session.reportDispatch || {};
    if (!Array.isArray(session.reportDispatch.emailDeliveredTo)) {
      session.reportDispatch.emailDeliveredTo = [];
    }

    const sessionBranchId = getSessionBranchId(session);
    const adminFilter = {
      status: "approved",
      role: { $in: ["pastor", "admin", "moderator"] },
    };

    if (sessionBranchId) {
      adminFilter.$or = [
        { canViewAllBranches: { $ne: false } },
        { branch: sessionBranchId },
        { managedBranches: sessionBranchId },
      ];
    }

    const admins = await User.find(adminFilter).select("_id email fullName");
    const adminIds = admins.map((admin) => admin._id);
    const emailAdmins = admins.filter((admin) => isValidEmailAddress(admin.email));

    const attendance = await Attendance.find({ session: session._id })
      .populate("worker", "fullName workerId department")
      .sort({ checkInTime: 1 });

    const serviceLabel = `${session.serviceType.charAt(0).toUpperCase() + session.serviceType.slice(1)} Service`;
    const dateStr = new Date(session.serviceDate).toLocaleDateString("en-GH", { weekday: "long", day: "numeric", month: "long" });
    const notificationPayload = {
      type: "general",
      title: `Front Desk Report - ${serviceLabel}`,
      message: `${dateStr}: ${stats.totalCheckedIn} workers checked in. ${stats.late} late. ${isAuto ? "Auto-closed after 4 hours of inactivity." : ""}`,
      link: "/admin/attendance",
    };
    const dispatchSince = new Date(
      (session.closedAt || session.createdAt || new Date()).getTime() - 15 * 60 * 1000
    );

    if (!session.reportDispatch.notificationSentAt) {
      const alreadyExists = await notificationExistsForAdmins(
        adminIds,
        notificationPayload.title,
        notificationPayload.link,
        dispatchSince
      );

      if (!alreadyExists && adminIds.length > 0) {
        await createBulkNotification(adminIds, notificationPayload);
      }

      session.reportDispatch.notificationSentAt = new Date();
    }

    if (emailAdmins.length > 0 && shouldRetryReportEmail(session.reportDispatch, new Date())) {
      const pendingEmailAdmins = getPendingEmailRecipients(
        emailAdmins,
        session.reportDispatch.emailDeliveredTo || []
      );

      if (pendingEmailAdmins.length > 0) {
        const emailSummary = await sendFrontDeskReportEmail(
          pendingEmailAdmins,
          session,
          stats,
          attendance,
          isAuto
        );

        updateReportDispatchEmail(
          session.reportDispatch,
          emailSummary,
          emailAdmins,
          new Date()
        );
      } else {
        session.reportDispatch.emailSentAt =
          session.reportDispatch.emailSentAt || new Date();
        session.reportDispatch.lastEmailError = null;
      }
    }

    if (!session.reportDispatch.pushSentAt && adminIds.length > 0) {
      await sendPushToMany(adminIds, {
      title: `Front Desk Report - ${serviceLabel}`,
      body: `${stats.totalCheckedIn} workers checked in. ${stats.late} arrived late.`,
      url: "/admin/attendance",
      });
      session.reportDispatch.pushSentAt = new Date();
    }

    session.markModified("reportDispatch");
    await session.save();
  } catch (err) {
    console.error("sendReportToAdmins error:", err.message);
  }
};

export const replayRecentFrontDeskReportDispatches = async () => {
  try {
    const lookbackStart = new Date();
    lookbackStart.setUTCDate(
      lookbackStart.getUTCDate() - FRONT_DESK_REPORT_LOOKBACK_DAYS
    );
    lookbackStart.setUTCHours(0, 0, 0, 0);

    const sessions = await FrontDeskSession.find({
      isOpen: false,
      serviceDate: { $gte: lookbackStart },
    }).sort({ serviceDate: -1 });

    for (const session of sessions) {
      const needsReplay =
        !session.reportDispatch?.notificationSentAt ||
        !session.reportDispatch?.pushSentAt ||
        !session.reportDispatch?.emailSentAt;

      if (!needsReplay) continue;

      const stats = session.stats || (await computeStats(session._id));
      await sendReportToAdmins(session, stats, session.closedBy === "auto");
    }
  } catch (err) {
    console.error("replayRecentFrontDeskReportDispatches error:", err.message);
  }
};

// ── Get single session with full stats ───────────────────────────────────────
export const getSessionReport = async (req, res, next) => {
  try {
    const session = await FrontDeskSession.findById(req.params.sessionId)
      .populate("branch", "name code status")
      .populate("primarySupervisor", "fullName workerId department")
      .populate("coSupervisors", "fullName workerId department");

    if (!session) return res.status(404).json({ message: "Session not found." });
    assertCanAccessSession(req, session);

    const attendance = await Attendance.find({ session: session._id })
      .populate("worker", "fullName workerId department branch")
      .populate("loggedBy", "fullName")
      .sort({ checkInTime: 1 });

    const stats = session.isOpen ? await computeStats(session._id) : session.stats;

    res.status(200).json({ session, attendance, stats });
  } catch (error) { next(error); }
};

// ── Search worker for check-in ───────────────────────────────────────────────
export const searchWorkerForCheckIn = async (req, res, next) => {
  try {
    const { q, sessionId } = req.query;
    if (!q || q.length < 1) return res.status(200).json({ workers: [] });

    const workerFilter = { status: "approved" };

    if (sessionId) {
      const session = await FrontDeskSession.findById(sessionId).select("branch");
      if (!session) {
        return res.status(404).json({ message: "Session not found." });
      }
      assertCanAccessSession(req, session);
      const sessionBranchId = getSessionBranchId(session);
      if (sessionBranchId) workerFilter.branch = sessionBranchId;
    } else if (!canAccessAllBranches(req.user)) {
      const accessibleBranchIds = getAccessibleBranchIds(req.user);
      if (accessibleBranchIds.length > 1) {
        workerFilter.branch = { $in: accessibleBranchIds };
      } else if (accessibleBranchIds.length === 1) {
        workerFilter.branch = accessibleBranchIds[0];
      } else {
        workerFilter.branch = "000000000000000000000000";
      }
    }

    const isId = /^\d+$/.test(q.trim());
    const workers = isId
      ? await User.find({ ...workerFilter, workerId: q.trim() }).select("fullName workerId department branch").limit(5)
      : await User.find({ ...workerFilter, fullName: { $regex: q.trim(), $options: "i" } }).select("fullName workerId department branch").limit(8);

    res.status(200).json({ workers });
  } catch (error) { next(error); }
};

// Worker fetches their own front-desk check-ins for the current week
// Used by the evangelism form to pre-fill service attendance times
export const getMyWeekAttendance = async (req, res, next) => {
  try {
    const { weekStart } = req.query;

    // Default to current week Monday
    let monday;
    if (weekStart) {
      monday = new Date(weekStart);
    } else {
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      monday = new Date(now.setDate(diff));
      monday.setHours(0, 0, 0, 0);
    }

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const records = await Attendance.find({
      worker:      req.user._id,
      serviceDate: { $gte: monday, $lte: sunday },
    }).select("serviceType checkInTime timingCategory serviceDate").lean();

    // Return as a map: { tuesday: "07:30", sunday: "09:15" }
    const checkIns = {};
    for (const r of records) {
      const time = new Date(r.checkInTime).toLocaleTimeString("en-GH", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Africa/Accra",
      });
      checkIns[r.serviceType] = {
        time,          // "07:30"
        timingCategory: r.timingCategory,
        serviceDate: r.serviceDate,
      };
    }

    res.status(200).json({ checkIns });
  } catch (error) {
    next(error);
  }
};

