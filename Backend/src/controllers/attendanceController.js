import Attendance from "../models/attendanceModel.js";
import FrontDeskSession from "../models/frontDeskSessionModel.js";
import User from "../models/userModel.js";
import { sendFrontDeskReportEmail } from "../services/emailService.js";
import { createBulkNotification } from "../services/notificationService.js";
import { sendPushToMany } from "../services/pushService.js";

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

    const start = new Date(serviceStartTime);
    const autoClose = new Date(start.getTime() + 4 * 60 * 60 * 1000); // 4 hours

    // Close any previously open session
    await FrontDeskSession.updateMany({ isOpen: true }, { isOpen: false, closedAt: new Date(), closedBy: "auto" });

    const session = await FrontDeskSession.create({
      serviceType,
      specialServiceName: specialServiceName || "",
      serviceDate: new Date(serviceDate),
      serviceStartTime: start,
      autoCloseTime: autoClose,
      primarySupervisor: req.user._id,
      supervisorCheckInTime: new Date(),
      coSupervisors: coSupervisorId ? [coSupervisorId] : [],
      isOpen: true,
    });

    // Auto check-in the supervisor
    const { category, minutesBefore } = getTimingCategory(new Date(), start);
    await Attendance.create({
      worker: req.user._id,
      session: session._id,
      serviceType,
      serviceDate: new Date(serviceDate),
      checkInTime: new Date(),
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

    // Find by workerId or name
    const isId = /^\d+$/.test(identifier?.trim());
    const worker = isId
      ? await User.findOne({ workerId: identifier.trim(), status: "approved" })
      : await User.findOne({
          fullName: { $regex: identifier.trim(), $options: "i" },
          status: "approved",
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
    const session = await FrontDeskSession.findOne({ isOpen: true })
      .populate("primarySupervisor", "fullName workerId")
      .populate("coSupervisors", "fullName workerId")
      .sort({ createdAt: -1 });

    res.status(200).json({ session: session || null });
  } catch (error) { next(error); }
};

// ── Get session attendance list ───────────────────────────────────────────────
export const getSessionAttendance = async (req, res, next) => {
  try {
    const attendance = await Attendance.find({ session: req.params.sessionId })
      .populate("worker", "fullName workerId department")
      .populate("loggedBy", "fullName")
      .sort({ checkInTime: 1 });

    res.status(200).json({ attendance });
  } catch (error) { next(error); }
};

// ── Get attendance history ────────────────────────────────────────────────────
export const getAttendanceHistory = async (req, res, next) => {
  try {
    const { limit = 20, dateFrom, dateTo } = req.query;
    const filter = {};
    if (dateFrom || dateTo) {
      filter.serviceDate = {};
      if (dateFrom) filter.serviceDate.$gte = new Date(dateFrom);
      if (dateTo)   filter.serviceDate.$lte = new Date(dateTo);
    }

    const sessions = await FrontDeskSession.find(filter)
      .populate("primarySupervisor", "fullName workerId")
      .sort({ serviceDate: -1 })
      .limit(Number(limit));

    res.status(200).json({ sessions });
  } catch (error) { next(error); }
};

// ── Close session manually ────────────────────────────────────────────────────
export const closeSession = async (req, res, next) => {
  try {
    const session = await FrontDeskSession.findById(req.params.sessionId)
      .populate("primarySupervisor", "fullName workerId email")
      .populate("coSupervisors", "fullName workerId email");

    if (!session) return res.status(404).json({ message: "Session not found." });

    const stats = await computeStats(session._id);
    session.isOpen = false;
    session.closedAt = new Date();
    session.closedBy = "manual";
    session.stats = stats;
    await session.save();

    await sendReportToAdmins(session, stats);

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
    const admins = await User.find({
      status: "approved",
      role: { $in: ["pastor", "admin", "moderator"] },
    }).select("_id email fullName");

    const attendance = await Attendance.find({ session: session._id })
      .populate("worker", "fullName workerId department")
      .sort({ checkInTime: 1 });

    // Email
    await sendFrontDeskReportEmail(admins, session, stats, attendance, isAuto);

    // In-app notification
    const serviceLabel = `${session.serviceType.charAt(0).toUpperCase() + session.serviceType.slice(1)} Service`;
    const dateStr = new Date(session.serviceDate).toLocaleDateString("en-GH", { weekday: "long", day: "numeric", month: "long" });
    await createBulkNotification(admins.map((a) => a._id), {
      type: "general",
      title: `Front Desk Report - ${serviceLabel}`,
      message: `${dateStr}: ${stats.totalCheckedIn} workers checked in. ${stats.late} late. ${isAuto ? "Auto-closed after 4 hours." : ""}`,
      link: "/admin/attendance",
    });

    // Push notification
    await sendPushToMany(admins.map((a) => a._id), {
      title: `Front Desk Report - ${serviceLabel}`,
      body: `${stats.totalCheckedIn} workers checked in. ${stats.late} arrived late.`,
      url: "/admin/attendance",
    });
  } catch (err) {
    console.error("sendReportToAdmins error:", err.message);
  }
};

// ── Get single session with full stats ───────────────────────────────────────
export const getSessionReport = async (req, res, next) => {
  try {
    const session = await FrontDeskSession.findById(req.params.sessionId)
      .populate("primarySupervisor", "fullName workerId department")
      .populate("coSupervisors", "fullName workerId department");

    if (!session) return res.status(404).json({ message: "Session not found." });

    const attendance = await Attendance.find({ session: session._id })
      .populate("worker", "fullName workerId department")
      .populate("loggedBy", "fullName")
      .sort({ checkInTime: 1 });

    const stats = session.isOpen ? await computeStats(session._id) : session.stats;

    res.status(200).json({ session, attendance, stats });
  } catch (error) { next(error); }
};

// ── Search worker for check-in ───────────────────────────────────────────────
export const searchWorkerForCheckIn = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 1) return res.status(200).json({ workers: [] });

    const isId = /^\d+$/.test(q.trim());
    const workers = isId
      ? await User.find({ workerId: q.trim(), status: "approved" }).select("fullName workerId department").limit(5)
      : await User.find({ fullName: { $regex: q.trim(), $options: "i" }, status: "approved" }).select("fullName workerId department").limit(8);

    res.status(200).json({ workers });
  } catch (error) { next(error); }
};