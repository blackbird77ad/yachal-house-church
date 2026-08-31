import User from "../models/userModel.js";
import Metrics from "../models/metricsModel.js";
import Attendance from "../models/attendanceModel.js";
import FrontDeskSession from "../models/frontDeskSessionModel.js";
import Notification from "../models/notificationModel.js";
import Permission from "../models/permissionModel.js";
import PushSubscription from "../models/pushSubscriptionModel.js";
import Report from "../models/reportModel.js";
import Roster from "../models/rosterModel.js";

const mergeNotificationPreferences = (existing = {}, incoming = {}) => ({
  email: existing?.email !== false,
  inApp: existing?.inApp !== false,
  push: existing?.push !== false,
  popup: existing?.popup !== false,
  ...incoming,
});

export const getAllWorkers = async (req, res, next) => {
  try {
    const { status, department, role, isQualified, search, page = 1, limit = 15 } = req.query;
    // Allow high limit for dropdown lists (e.g. Reports page worker filter)
    const filter = {};

    if (status) filter.status = status;
    if (department) filter.department = department;
    if (role) filter.role = role;
    if (isQualified !== undefined) filter.isQualified = isQualified === "true";
    if (search) filter.$or = [
      { fullName: { $regex: search, $options: "i" } },
      { email:    { $regex: search, $options: "i" } },
      { workerId: { $regex: search, $options: "i" } },
    ];

    const skip = (Number(page) - 1) * Number(limit);
    const [workers, total] = await Promise.all([
      User.find(filter).select("-password").sort({ workerId: 1 }).skip(skip).limit(Number(limit)),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      workers,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    next(error);
  }
};

export const getWorkerById = async (req, res, next) => {
  try {
    const worker = await User.findById(req.params.workerId).select("-password");
    if (!worker) {
      return res.status(404).json({ message: "Worker not found." });
    }
    res.status(200).json({ worker });
  } catch (error) {
    next(error);
  }
};

export const getWorkerByWorkerId = async (req, res, next) => {
  try {
    const worker = await User.findOne({ workerId: req.params.workerId }).select("-password");
    if (!worker) {
      return res.status(404).json({ message: "No worker found with that ID." });
    }
    res.status(200).json({ worker });
  } catch (error) {
    next(error);
  }
};

export const searchWorkersByName = async (req, res, next) => {
  try {
    const { name } = req.query;
    if (!name) {
      return res.status(400).json({ message: "Please provide a name to search." });
    }

    const workers = await User.find({
      fullName: { $regex: name, $options: "i" },
      status: "approved",
    }).select("fullName workerId department role");

    res.status(200).json({ workers });
  } catch (error) {
    next(error);
  }
};

export const updateWorkerProfile = async (req, res, next) => {
  try {
    const { fullName, phone, department, isRotating, additionalDepartments, role, notificationPreferences } = req.body;

    const worker = await User.findById(req.params.workerId).select("-password");
    if (!worker) {
      return res.status(404).json({ message: "Worker not found." });
    }

    if (fullName) worker.fullName = fullName;
    if (phone) worker.phone = phone;
    if (department) worker.department = department;
    if (isRotating !== undefined) worker.isRotating = isRotating;
    if (additionalDepartments) worker.additionalDepartments = additionalDepartments;
    if (role && ["admin", "moderator", "worker"].includes(role)) worker.role = role;
    if (notificationPreferences) {
      worker.notificationPreferences = mergeNotificationPreferences(
        worker.notificationPreferences,
        notificationPreferences
      );
    }

    await worker.save();

    res.status(200).json({ message: "Profile updated successfully.", worker });
  } catch (error) {
    next(error);
  }
};

export const deleteWorker = async (req, res, next) => {
  try {
    const worker = await User.findById(req.params.workerId).select("fullName email workerId role");
    if (!worker) {
      return res.status(404).json({ message: "Worker not found." });
    }

    if (String(worker._id) === String(req.user._id)) {
      return res.status(400).json({ message: "You cannot delete your own account." });
    }

    if (worker.role === "pastor" || worker.workerId === "001") {
      return res.status(400).json({ message: "The reserved pastor account cannot be deleted." });
    }

    const workerId = worker._id;

    const [
      reports,
      metrics,
      attendance,
      permissions,
      notifications,
      pushSubscriptions,
    ] = await Promise.all([
      Report.deleteMany({ submittedBy: workerId }),
      Metrics.deleteMany({ worker: workerId }),
      Attendance.deleteMany({ worker: workerId }),
      Permission.deleteMany({ worker: workerId }),
      Notification.deleteMany({ recipient: workerId }),
      PushSubscription.deleteMany({ user: workerId }),
    ]);

    await Promise.all([
      Attendance.updateMany({ loggedBy: workerId }, { $unset: { loggedBy: "" } }),
      FrontDeskSession.updateMany(
        { primarySupervisor: workerId },
        { $unset: { primarySupervisor: "", supervisorCheckInTime: "" } }
      ),
      FrontDeskSession.updateMany({ coSupervisors: workerId }, { $pull: { coSupervisors: workerId } }),
      Notification.updateMany({ sender: workerId }, { $unset: { sender: "" } }),
      Permission.updateMany({ coordinator: workerId }, { $unset: { coordinator: "" } }),
      Permission.updateMany({ outcomeUpdatedBy: workerId }, { $unset: { outcomeUpdatedBy: "" } }),
      Roster.updateMany(
        { "slots.assignments.worker": workerId },
        {
          $pull: { "slots.$[].assignments": { worker: workerId } },
          $set: { needsRepublish: true },
        }
      ),
      Roster.updateMany({ publishedBy: workerId }, { $unset: { publishedBy: "" } }),
      User.updateMany({ approvedBy: workerId }, { $unset: { approvedBy: "" } }),
    ]);

    await User.deleteOne({ _id: workerId });

    res.status(200).json({
      message: `${worker.fullName} has been permanently deleted.`,
      deleted: {
        reports: reports.deletedCount || 0,
        metrics: metrics.deletedCount || 0,
        attendance: attendance.deletedCount || 0,
        permissions: permissions.deletedCount || 0,
        notifications: notifications.deletedCount || 0,
        pushSubscriptions: pushSubscriptions.deletedCount || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getWorkerMetrics = async (req, res, next) => {
  try {
    const { weekReference } = req.query;
    const filter = { worker: req.params.workerId };

    if (weekReference) filter.weekReference = new Date(weekReference);

    const metrics = await Metrics.find(filter).sort({ weekReference: -1 });

    res.status(200).json({ metrics });
  } catch (error) {
    next(error);
  }
};

export const getMyProfile = async (req, res, next) => {
  try {
    const worker = await User.findById(req.user._id).select("-password");
    const recentMetrics = await Metrics.find({ worker: req.user._id, isLateSubmission: false })
      .sort({ weekReference: -1 })
      .limit(4);

    res.status(200).json({ worker, recentMetrics });
  } catch (error) {
    next(error);
  }
};

export const updateMyProfile = async (req, res, next) => {
  try {
    const { fullName, phone, notificationPreferences } = req.body;
    const worker = await User.findById(req.user._id).select("-password");

    if (fullName) worker.fullName = fullName;
    if (phone) worker.phone = phone;
    if (notificationPreferences) {
      worker.notificationPreferences = mergeNotificationPreferences(
        worker.notificationPreferences,
        notificationPreferences
      );
    }

    await worker.save();

    res.status(200).json({ message: "Profile updated.", worker });
  } catch (error) {
    next(error);
  }
};
