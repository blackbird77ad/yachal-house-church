import User from "../models/userModel.js";
import PortalWindow from "../models/portalWindowModel.js";
import Metrics from "../models/metricsModel.js";
import Report from "../models/reportModel.js";
import { createBulkNotification } from "../services/notificationService.js";
import { sendPortalOpenEmail } from "../services/emailService.js";

const getCurrentWeekReference = () => {
  // weekReference = the closing Monday of the current portal window
  // Portal opens Friday midnight, closes Monday 2:59pm
  // Reports submitted in that window all have weekReference = that Monday
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const getNextMonday259 = () => {
  const now = new Date();
  const day = now.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(14, 59, 0, 0);
  return nextMonday;
};

export const getDashboardSummary = async (req, res, next) => {
  try {
    const totalWorkers = await User.countDocuments({ status: "approved" });
    const pendingApprovals = await User.countDocuments({ status: "pending" });
    const qualifiedWorkers = await User.countDocuments({ status: "approved", isQualified: true });

    const now = new Date();
    const portalStatus = await PortalWindow.findOne({
      opensAt: { $lte: now },
      closesAt: { $gte: now },
      isOpen: true,
    });

    const weekReference = await getCurrentWeekReference();
    const submittedThisWeek = await Report.countDocuments({ weekReference, status: "submitted", isLateSubmission: false });
    const lateSubmissions = await Report.countDocuments({ status: "submitted", isLateSubmission: true });

    res.status(200).json({
      totalWorkers,
      pendingApprovals,
      qualifiedWorkers,
      portalOpen: !!portalStatus,
      submittedThisWeek,
      lateSubmissions,
    });
  } catch (error) {
    next(error);
  }
};

export const getPendingWorkers = async (req, res, next) => {
  try {
    const workers = await User.find({ status: "pending" }).select("-password").sort({ createdAt: 1 });
    res.status(200).json({ workers });
  } catch (error) {
    next(error);
  }
};

export const overridePortal = async (req, res, next) => {
  try {
    const { action, reason, customCloseAt } = req.body;

    if (!["open", "close"].includes(action)) {
      return res.status(400).json({ message: "Action must be open or close." });
    }

    const now = new Date();
    const weekReference = await getCurrentWeekReference();

    const closesAt = customCloseAt
      ? new Date(customCloseAt)
      : getNextMonday259();

    let portal = await PortalWindow.findOne({ weekReference });

    if (!portal) {
      portal = await PortalWindow.create({
        weekReference,
        opensAt: now,
        closesAt,
        isOpen: action === "open",
        overriddenBy: req.user._id,
        overrideReason: reason,
      });
    } else {
      portal.isOpen = action === "open";
      portal.overriddenBy = req.user._id;
      portal.overrideReason = reason;
      if (action === "open") {
        portal.opensAt = now;
        portal.closesAt = closesAt;
      }
      await portal.save();
    }

    if (action === "open") {
      const workers = await User.find({ status: "approved" }).select("_id email fullName");
      await createBulkNotification(workers.map((w) => w._id), {
        type: "portal-open",
        title: "Report portal is now open",
        message: "The admin has opened the portal. You can now submit your report.",
        link: "/portal/submit-report",
        senderId: req.user._id,
      });
      await sendPortalOpenEmail(workers);
    }

    res.status(200).json({
      message: `Portal has been ${action}ed successfully.`,
      portal,
    });
  } catch (error) {
    next(error);
  }
};

export const getLeaderboard = async (req, res, next) => {
  try {
    const { weekReference } = req.query;
    const week = weekReference ? new Date(weekReference) : await getCurrentWeekReference();

    const metrics = await Metrics.find({ weekReference: week, isLateSubmission: false })
      .populate("worker", "fullName workerId department score")
      .sort({ totalScore: -1 });

    res.status(200).json({ leaderboard: metrics });
  } catch (error) {
    next(error);
  }
};

export const createSpecialService = async (req, res, next) => {
  try {
    const { name, date } = req.body;
    res.status(201).json({ message: "Special service created.", service: { name, date } });
  } catch (error) {
    next(error);
  }
};

export const sendBulkNotification = async (req, res, next) => {
  try {
    const { title, message, link, targetRole } = req.body;
    const filter = { status: "approved" };
    if (targetRole && targetRole !== "all") filter.role = targetRole;

    const workers = await User.find(filter).select("_id");
    await createBulkNotification(workers.map((w) => w._id), {
      type: "general",
      title,
      message,
      link,
      senderId: req.user._id,
    });

    res.status(200).json({ message: `Notification sent to ${workers.length} workers.` });
  } catch (error) {
    next(error);
  }
};