import User from "../models/userModel.js";
import Metrics from "../models/metricsModel.js";
import Attendance from "../models/attendanceModel.js";
import FrontDeskSession from "../models/frontDeskSessionModel.js";
import Notification from "../models/notificationModel.js";
import Permission from "../models/permissionModel.js";
import PushSubscription from "../models/pushSubscriptionModel.js";
import Report from "../models/reportModel.js";
import Roster from "../models/rosterModel.js";
import Branch from "../models/branchModel.js";
import { createBulkNotification, createNotification } from "../services/notificationService.js";
import { sendGenericNotificationEmail } from "../services/emailService.js";
import { sendPushToMany } from "../services/pushService.js";
import {
  ADMIN_ROLES,
  applyBranchScopeToUserFilter,
  assertCanAccessWorkerBranch,
  canAccessAllBranches,
  getAccessibleBranchIds,
  getBranchScopeMeta,
  isSuperAdminUser,
  normalizeBranchId,
} from "../utils/branchAccess.js";

const mergeNotificationPreferences = (existing = {}, incoming = {}) => ({
  email: existing?.email !== false,
  inApp: existing?.inApp !== false,
  push: existing?.push !== false,
  popup: existing?.popup !== false,
  ...incoming,
});

const getBranchLabel = (branch) => {
  if (!branch) return "No branch";
  return branch.name || branch.code || "Selected branch";
};

const getBranchId = (branch) =>
  branch?._id?.toString?.() || branch?.toString?.() || "";

const getActiveBranchForWorker = async (branchId) => {
  const normalizedBranchId = normalizeBranchId(branchId);
  if (!normalizedBranchId) return null;

  const branch = await Branch.findById(normalizedBranchId).select("_id name code status");
  if (!branch) {
    const error = new Error("Selected branch was not found.");
    error.statusCode = 400;
    throw error;
  }

  if (branch.status !== "active") {
    const error = new Error("Selected branch is suspended.");
    error.statusCode = 400;
    throw error;
  }

  return branch;
};

const getAdminsForBranchChange = async (...branchIds) => {
  const scopedBranchIds = [
    ...new Set(branchIds.map(normalizeBranchId).filter(Boolean)),
  ];
  const visibility = [
    { workerId: "001" },
    { canViewAllBranches: { $ne: false } },
  ];

  if (scopedBranchIds.length > 0) {
    visibility.push({ branch: { $in: scopedBranchIds } });
    visibility.push({ managedBranches: { $in: scopedBranchIds } });
  }

  return User.find({
    status: "approved",
    role: { $in: ADMIN_ROLES },
    $or: visibility,
  }).select("_id email fullName notificationPreferences");
};

const notifyWorkerBranchChange = async ({ worker, previousBranchId, nextBranch }) => {
  const previousBranch = previousBranchId
    ? await Branch.findById(previousBranchId).select("name code").lean()
    : null;
  const nextBranchId = getBranchId(nextBranch);
  const admins = await getAdminsForBranchChange(previousBranchId, nextBranchId);
  const previousLabel = getBranchLabel(previousBranch);
  const nextLabel = getBranchLabel(nextBranch);
  const workerLabel = `${worker.fullName} (${worker.workerId || "ID pending"})`;

  await createNotification(worker._id, {
    type: "general",
    title: "Branch updated",
    message: `Your current branch is now ${nextLabel}. Administration has been notified and can edit this if needed.`,
    link: "/portal/profile",
  });

  if (admins.length > 0) {
    const adminIds = admins.map((admin) => admin._id);
    const adminMessage = `${workerLabel} changed branch from ${previousLabel} to ${nextLabel}.`;

    await createBulkNotification(adminIds, {
      type: "general",
      title: "Worker branch changed",
      message: adminMessage,
      link: `/admin/workers/${worker._id}`,
      senderId: worker._id,
    });

    await sendPushToMany(adminIds, {
      title: "Worker branch changed",
      body: adminMessage,
      url: `/admin/workers/${worker._id}`,
    });

    await sendGenericNotificationEmail(admins, {
      subject: "Worker branch changed",
      title: "Worker branch changed",
      message: adminMessage,
      link: `/admin/workers/${worker._id}`,
      linkLabel: "Open Worker Profile",
    });
  }
};

export const getAllWorkers = async (req, res, next) => {
  try {
    const { status, department, role, isQualified, search, page = 1, limit = 15 } = req.query;
    // Allow high limit for dropdown lists (e.g. Reports page worker filter)
    const filter = applyBranchScopeToUserFilter(req, {});

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
      User.find(filter)
        .select("-password")
        .populate("branch", "name code status")
        .sort({ workerId: 1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      workers,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      branchScope: getBranchScopeMeta(req),
    });
  } catch (error) {
    next(error);
  }
};

export const getWorkerById = async (req, res, next) => {
  try {
    const worker = await User.findById(req.params.workerId)
      .select("-password")
      .populate("branch", "name code status");
    if (!worker) {
      return res.status(404).json({ message: "Worker not found." });
    }
    assertCanAccessWorkerBranch(req, worker);
    res.status(200).json({ worker });
  } catch (error) {
    next(error);
  }
};

export const getWorkerByWorkerId = async (req, res, next) => {
  try {
    const worker = await User.findOne({ workerId: req.params.workerId })
      .select("-password")
      .populate("branch", "name code status");
    if (!worker) {
      return res.status(404).json({ message: "No worker found with that ID." });
    }
    if (!canAccessAllBranches(req.user)) {
      assertCanAccessWorkerBranch(req, worker);
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

    const filter = {
      fullName: { $regex: name, $options: "i" },
      status: "approved",
    };

    if (!canAccessAllBranches(req.user)) {
      applyBranchScopeToUserFilter(req, filter);
    }

    const workers = await User.find(filter)
      .select("fullName workerId department role branch")
      .populate("branch", "name code status");

    res.status(200).json({ workers });
  } catch (error) {
    next(error);
  }
};

const resolveBranchUpdate = async (req, branchId) => {
  const normalizedBranchId = normalizeBranchId(branchId);

  if (!canAccessAllBranches(req.user)) {
    const accessibleBranchIds = getAccessibleBranchIds(req.user);
    if (accessibleBranchIds.length === 0) {
      const error = new Error("Your admin account is not assigned to a branch.");
      error.statusCode = 403;
      throw error;
    }
    if (normalizedBranchId && !accessibleBranchIds.includes(normalizedBranchId)) {
      const error = new Error("You can only assign workers to your branch.");
      error.statusCode = 403;
      throw error;
    }
    return normalizedBranchId || accessibleBranchIds[0];
  }

  if (!normalizedBranchId) return null;

  const branch = await Branch.findById(normalizedBranchId).select("_id status");
  if (!branch) {
    const error = new Error("Selected branch was not found.");
    error.statusCode = 400;
    throw error;
  }
  if (branch.status !== "active") {
    const error = new Error("Selected branch is suspended.");
    error.statusCode = 400;
    throw error;
  }

  return branch._id;
};

export const updateWorkerProfile = async (req, res, next) => {
  try {
    const {
      fullName,
      phone,
      department,
      isRotating,
      additionalDepartments,
      role,
      notificationPreferences,
      branchId,
      canViewAllBranches,
    } = req.body;

    const worker = await User.findById(req.params.workerId).select("-password");
    if (!worker) {
      return res.status(404).json({ message: "Worker not found." });
    }
    assertCanAccessWorkerBranch(req, worker);

    if (fullName) worker.fullName = fullName;
    if (phone) worker.phone = phone;
    if (department) worker.department = department;
    if (isRotating !== undefined) worker.isRotating = isRotating;
    if (additionalDepartments) worker.additionalDepartments = additionalDepartments;
    if (role && ["admin", "moderator", "worker"].includes(role)) worker.role = role;
    if (branchId !== undefined) {
      const nextBranchId = await resolveBranchUpdate(req, branchId);
      if (nextBranchId) {
        worker.branch = nextBranchId;
      } else {
        worker.branch = undefined;
      }
    }

    const isAdminRole = ADMIN_ROLES.includes(worker.role);
    if (isAdminRole && worker.branch) {
      worker.branchRole = "branch-admin";
      const managedBranches = new Set(
        (worker.managedBranches || []).map((managedBranchId) => String(managedBranchId))
      );
      managedBranches.add(String(worker.branch));
      worker.managedBranches = [...managedBranches];
    } else {
      worker.branchRole = "member";
      if (!isAdminRole) {
        worker.managedBranches = [];
      }
    }

    if (isSuperAdminUser(worker)) {
      worker.canViewAllBranches = true;
    } else if (isAdminRole) {
      const workerBranchId = getBranchId(worker.branch);
      worker.canViewAllBranches = canAccessAllBranches(req.user)
        ? !workerBranchId || canViewAllBranches !== false
        : false;
    } else {
      worker.canViewAllBranches = false;
    }
    if (notificationPreferences) {
      worker.notificationPreferences = mergeNotificationPreferences(
        worker.notificationPreferences,
        notificationPreferences
      );
    }

    await worker.save();
    await worker.populate("branch", "name code status");

    res.status(200).json({ message: "Profile updated successfully.", worker });
  } catch (error) {
    next(error);
  }
};

export const deleteWorker = async (req, res, next) => {
  try {
    const worker = await User.findById(req.params.workerId).select("fullName email workerId role branch");
    if (!worker) {
      return res.status(404).json({ message: "Worker not found." });
    }
    assertCanAccessWorkerBranch(req, worker);

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
    const worker = await User.findById(req.params.workerId).select("branch");
    if (!worker) {
      return res.status(404).json({ message: "Worker not found." });
    }
    assertCanAccessWorkerBranch(req, worker);

    if (weekReference) filter.weekReference = new Date(weekReference);

    const metrics = await Metrics.find(filter).sort({ weekReference: -1 });

    res.status(200).json({ metrics });
  } catch (error) {
    next(error);
  }
};

export const getMyProfile = async (req, res, next) => {
  try {
    const worker = await User.findById(req.user._id)
      .select("-password")
      .populate("branch", "name code status");
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
    const { fullName, phone, notificationPreferences, branchId } = req.body;
    const worker = await User.findById(req.user._id).select("-password");

    if (fullName) worker.fullName = fullName;
    if (phone) worker.phone = phone;

    const previousBranchId = getBranchId(worker.branch);
    let nextBranch = null;

    if (branchId !== undefined) {
      nextBranch = await getActiveBranchForWorker(branchId);
      if (nextBranch) {
        worker.branch = nextBranch._id;
      } else {
        worker.branch = undefined;
      }
    }

    if (notificationPreferences) {
      worker.notificationPreferences = mergeNotificationPreferences(
        worker.notificationPreferences,
        notificationPreferences
      );
    }

    await worker.save();
    await worker.populate("branch", "name code status");

    const nextBranchId = getBranchId(worker.branch);
    if (branchId !== undefined && previousBranchId !== nextBranchId) {
      await notifyWorkerBranchChange({
        worker,
        previousBranchId,
        nextBranch: worker.branch,
      });
    }

    res.status(200).json({ message: "Profile updated.", worker });
  } catch (error) {
    next(error);
  }
};
