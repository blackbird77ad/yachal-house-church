import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import Branch from "../models/branchModel.js";
import { env } from "../config/env.js";
import { createBulkNotification, createNotification } from "../services/notificationService.js";
import {
  sendAccountApprovedEmail,
  sendAccountCreatedEmail,
  sendBulkAccountCreatedEmail,
  sendAccountSuspendedEmail,
  sendGenericNotificationEmail,
  sendPasswordResetLinkEmail,
} from "../services/emailService.js";
import { sendPushToMany } from "../services/pushService.js";
import {
  ADMIN_ROLES,
  SUPER_ADMIN_WORKER_ID,
  assertCanAccessWorkerBranch,
  canAccessAllBranches,
  getAccessibleBranchIds,
  getUserBranchId,
  normalizeBranchId,
} from "../utils/branchAccess.js";

const generateToken = (id) =>
  jwt.sign({ id }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

const PASSWORD_RESET_EXPIRES_MS = 60 * 60 * 1000;
const PASSWORD_RESET_REQUEST_MESSAGE =
  "If that email belongs to an account, a secure reset link has been sent. Admins will be notified after the password is reset.";

const hashPasswordResetToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const getActiveBranch = async (branchId) => {
  const normalizedBranchId = normalizeBranchId(branchId);
  if (!normalizedBranchId) return null;

  const branch = await Branch.findById(normalizedBranchId).select("_id name status");
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

const resolveAssignableBranchId = async (req, branchId) => {
  if (!canAccessAllBranches(req.user)) {
    const accessibleBranchIds = getAccessibleBranchIds(req.user);
    const requestedBranchId = normalizeBranchId(branchId);

    if (accessibleBranchIds.length === 0) {
      const error = new Error("Your admin account is not assigned to a branch.");
      error.statusCode = 403;
      throw error;
    }

    if (requestedBranchId && !accessibleBranchIds.includes(requestedBranchId)) {
      const error = new Error("You can only assign workers to your branch.");
      error.statusCode = 403;
      throw error;
    }

    return requestedBranchId || accessibleBranchIds[0];
  }

  const branch = await getActiveBranch(branchId);
  return branch?._id || null;
};

const getAdminRecipientsForBranch = async (branchId) => {
  const visibility = [
    { workerId: SUPER_ADMIN_WORKER_ID },
    { canViewAllBranches: { $ne: false } },
  ];

  if (branchId) {
    visibility.push({ branch: branchId });
    visibility.push({ managedBranches: branchId });
  }

  return User.find({
    status: "approved",
    role: { $in: ADMIN_ROLES },
    $or: visibility,
  }).select("_id email fullName notificationPreferences");
};

const serializeAuthUser = (user) => ({
  _id: user._id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  status: user.status,
  workerId: user.workerId,
  department: user.department,
  branch: user.branch || null,
  managedBranches: user.managedBranches || [],
  branchRole: user.branchRole || "member",
  canViewAllBranches: canAccessAllBranches(user),
  mustChangePassword: user.mustChangePassword || false,
  notificationPreferences: user.notificationPreferences,
});

export const generateWorkerId = async () => {
  // Worker ID 001 is reserved for the pastor
  const reserved = ["001"];
  let digits = 3;
  let id;
  let exists = true;
  while (exists) {
    const max = Math.pow(10, digits) - 1;
    const min = Math.pow(10, digits - 1);
    const num = Math.floor(Math.random() * (max - min + 1)) + min;
    id = String(num).padStart(digits, "0");
    if (reserved.includes(id)) continue;
    exists = await User.findOne({ workerId: id });
    if (exists && num === max) digits++;
  }
  return id;
};

export const register = async (req, res, next) => {
  try {
    const { fullName, email, password, phone, branchId } = req.body;
    if (!fullName?.trim() || !email?.trim() || !password) {
      return res.status(400).json({
        message: "Full name, email, and password are required.",
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(400).json({ message: "An account with this email already exists." });

    const branch = await getActiveBranch(branchId);
    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({
      fullName, email: email.toLowerCase().trim(),
      password: hashed, phone, status: "pending", role: "worker",
      branch: branch?._id || undefined,
      canViewAllBranches: false,
    });

    // Notify all admin/mod/pastor of new registration
    try {
      const admins = await getAdminRecipientsForBranch(branch?._id);

      if (admins.length > 0) {
        await createBulkNotification(admins.map((a) => a._id), {
          type: "general",
          title: "New worker registration",
          message: `${fullName} has registered and is awaiting approval${branch ? ` for ${branch.name}` : ""}.`,
          link: "/admin/workers",
        });

        await sendPushToMany(admins.map((admin) => admin._id), {
          title: "New worker registration",
          body: `${fullName} has registered and is awaiting approval${branch ? ` for ${branch.name}` : ""}.`,
          url: "/admin/workers",
        });

        await sendGenericNotificationEmail(admins, {
          subject: "New worker registration awaiting approval",
          title: "New worker registration",
          message: `${fullName} has registered and is awaiting approval${branch ? ` for ${branch.name}` : ""}.`,
          link: "/admin/workers",
          linkLabel: "Review Workers",
        });
      }
    } catch (notifErr) {
      console.error("Registration notification error:", notifErr.message);
    }

    res.status(201).json({
      message: "Registration successful. Your account is pending approval.",
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        status: user.status,
        branch: branch || null,
      },
    });
  } catch (error) { next(error); }
};

export const login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ message: "Email or Worker ID and password are required." });
    }

    const normalizedIdentifier = identifier.toString().trim();
    const isEmail = normalizedIdentifier.includes("@");
    const user = isEmail
      ? await User.findOne({ email: normalizedIdentifier.toLowerCase() })
      : await User.findOne({ workerId: normalizedIdentifier });

    if (!user) return res.status(401).json({ message: "Invalid credentials. Check your email or Worker ID and password." });

    // Pending workers cannot log in - they must be approved first
    if (user.status === "pending") {
      return res.status(403).json({ message: "Your account is pending approval. Please wait for admin confirmation." });
    }
    if (user.status === "suspended") {
      return res.status(403).json({ message: "Your account has been suspended. Contact your admin." });
    }

    const storedPassword = user.password || "";
    const looksHashed = /^\$2[aby]\$\d{2}\$/.test(storedPassword);

    let isMatch = false;
    if (looksHashed) {
      isMatch = await bcrypt.compare(password, storedPassword);
    } else if (storedPassword) {
      isMatch = password === storedPassword;

      // Backfill legacy plain-text passwords the next time the user logs in.
      if (isMatch) {
        user.password = await bcrypt.hash(password, 12);
      }
    }

    if (!isMatch) return res.status(401).json({ message: "Invalid credentials. Check your email or Worker ID and password." });

    user.lastLogin = new Date();
    await user.save();
    await user.populate("branch", "name code status");
    await user.populate("managedBranches", "name code status");

    res.status(200).json({
      token: generateToken(user._id),
      user: serializeAuthUser(user),
    });
  } catch (error) { next(error); }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password")
      .populate("branch", "name code status")
      .populate("managedBranches", "name code status");
    res.status(200).json({ user: serializeAuthUser(user) });
  } catch (error) { next(error); }
};

export const approveWorker = async (req, res, next) => {
  try {
    const worker = await User.findById(req.params.workerId);
    if (!worker) return res.status(404).json({ message: "Worker not found." });
    if (worker.status === "approved") return res.status(400).json({ message: "Worker is already approved." });
    assertCanAccessWorkerBranch(req, worker);

    const assignedBranchId = await resolveAssignableBranchId(
      req,
      req.body?.branchId || worker.branch
    );
    if (assignedBranchId && !worker.branch) {
      worker.branch = assignedBranchId;
    }

    // Only assign workerId if they don't have one yet
    if (!worker.workerId) {
      worker.workerId = await generateWorkerId();
    }
    worker.status = "approved";
    worker.approvedBy = req.user._id;
    worker.approvedAt = new Date();
    await worker.save();

    await sendAccountApprovedEmail(worker);
    await createNotification(worker._id, {
      type: "account-approved",
      title: "Your account has been approved",
      message: `Welcome to Yachal House. Your Worker ID is ${worker.workerId}. Keep it safe for front desk check-in.`,
      link: "/portal/dashboard",
      senderId: req.user._id,
    });
    await sendPushToMany([worker._id], {
      title: "Account approved",
      body: `Your account is now active. Worker ID: ${worker.workerId}.`,
      url: "/portal/dashboard",
    });
    await worker.populate("branch", "name code status");

    res.status(200).json({ message: `${worker.fullName} approved. Worker ID: ${worker.workerId}`, worker });
  } catch (error) { next(error); }
};

export const adminCreateWorker = async (req, res, next) => {
  try {
    const { fullName, email, phone, department, role, password, branchId, canViewAllBranches } = req.body;
    if (!fullName || !email) return res.status(400).json({ message: "Full name and email are required." });
    if (!password || password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(400).json({ message: "An account with this email already exists." });

    const assignedBranchId = await resolveAssignableBranchId(req, branchId);
    const nextRole = ["admin", "moderator", "worker"].includes(role) ? role : "worker";
    const isAdminRole = ADMIN_ROLES.includes(nextRole);
    const nextCanViewAllBranches = isAdminRole
      ? canAccessAllBranches(req.user) && (!assignedBranchId || canViewAllBranches !== false)
      : false;
    const hashed = await bcrypt.hash(password, 12);
    const workerId = await generateWorkerId();

    const worker = await User.create({
      fullName, email: email.toLowerCase().trim(), phone, department,
      role: nextRole, password: hashed,
      status: "approved", workerId,
      branch: assignedBranchId || undefined,
      managedBranches: isAdminRole && assignedBranchId ? [assignedBranchId] : [],
      branchRole: isAdminRole && assignedBranchId ? "branch-admin" : "member",
      canViewAllBranches: nextCanViewAllBranches,
      mustChangePassword: true,
      approvedBy: req.user._id, approvedAt: new Date(),
    });

    await sendAccountCreatedEmail(worker, password);
    await createNotification(worker._id, {
      type: "account-approved",
      title: "Your Yachal House account is ready",
      message: `Your Worker ID is ${workerId}. Check your email for login details. Change your password on first login.`,
      link: "/portal/dashboard",
      senderId: req.user._id,
    });
    await sendPushToMany([worker._id], {
      title: "Your account is ready",
      body: `Worker ID ${workerId}. Check your email for login details.`,
      url: "/portal/dashboard",
    });

    res.status(201).json({
      message: `Account created for ${fullName}. Worker ID: ${workerId}.`,
      worker: {
        _id: worker._id,
        fullName,
        email: worker.email,
        workerId,
        status: "approved",
        role: worker.role,
        branch: worker.branch || null,
        managedBranches: worker.managedBranches || [],
        branchRole: worker.branchRole,
        canViewAllBranches: worker.canViewAllBranches,
      },
    });
  } catch (error) { next(error); }
};

export const adminBulkCreateWorkers = async (req, res, next) => {
  try {
    const { workers } = req.body;
    if (!Array.isArray(workers) || workers.length === 0) {
      return res.status(400).json({ message: "Provide an array of workers." });
    }

    const results = { created: [], skipped: [] };

    for (const w of workers) {
      if (!w.email) { results.skipped.push("(no email)"); continue; }
      const existing = await User.findOne({ email: w.email.toLowerCase().trim() });
      if (existing) { results.skipped.push(w.email); continue; }
      if (!w.password || w.password.length < 6) { results.skipped.push(`${w.email} (invalid password)`); continue; }

      const assignedBranchId = await resolveAssignableBranchId(req, w.branchId);
      const nextRole = ["admin", "moderator", "worker"].includes(w.role) ? w.role : "worker";
      const isAdminRole = ADMIN_ROLES.includes(nextRole);
      const nextCanViewAllBranches = isAdminRole
        ? canAccessAllBranches(req.user) && (!assignedBranchId || w.canViewAllBranches !== false)
        : false;
      const hashed = await bcrypt.hash(w.password, 12);
      const workerId = await generateWorkerId();
      const fullName = w.fullName || w.email.split("@")[0].replace(/[._\-+]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();

      const worker = await User.create({
        fullName, email: w.email.toLowerCase().trim(),
        phone: w.phone || "", department: w.department || "unassigned",
        role: nextRole, password: hashed,
        status: "approved", workerId,
        branch: assignedBranchId || undefined,
        managedBranches: isAdminRole && assignedBranchId ? [assignedBranchId] : [],
        branchRole: isAdminRole && assignedBranchId ? "branch-admin" : "member",
        canViewAllBranches: nextCanViewAllBranches,
        mustChangePassword: true,
        approvedBy: req.user._id, approvedAt: new Date(),
      });

      await sendBulkAccountCreatedEmail(worker, w.password);
      await createNotification(worker._id, {
        type: "account-approved",
        title: "Your Yachal House account is ready",
        message: `Your Worker ID is ${workerId}. Check your email for login details. Change your password on first login.`,
        link: "/portal/dashboard",
        senderId: req.user._id,
      });
      await sendPushToMany([worker._id], {
        title: "Your account is ready",
        body: `Worker ID ${workerId}. Check your email for login details.`,
        url: "/portal/dashboard",
      });
      results.created.push({
        fullName: worker.fullName,
        email: worker.email,
        workerId,
        role: worker.role,
        department: worker.department,
        branch: worker.branch || null,
        managedBranches: worker.managedBranches || [],
        branchRole: worker.branchRole,
        canViewAllBranches: worker.canViewAllBranches,
      });
    }

    res.status(201).json({
      message: `${results.created.length} workers created. ${results.skipped.length} skipped.`,
      results,
    });
  } catch (error) { next(error); }
};

export const suspendWorker = async (req, res, next) => {
  try {
    const worker = await User.findById(req.params.workerId);
    if (!worker) return res.status(404).json({ message: "Worker not found." });
    assertCanAccessWorkerBranch(req, worker);
    worker.status = "suspended";
    await worker.save();

    await sendAccountSuspendedEmail(worker);
    await createNotification(worker._id, {
      type: "account-suspended",
      title: "Your account has been suspended",
      message: "Your account has been suspended. Please contact your admin for more information.",
      senderId: req.user._id,
    });
    await sendPushToMany([worker._id], {
      title: "Account suspended",
      body: "Your Yachal House account has been suspended.",
      url: "/login",
    });
    res.status(200).json({ message: `${worker.fullName} has been suspended.` });
  } catch (error) { next(error); }
};

export const reinstateWorker = async (req, res, next) => {
  try {
    const worker = await User.findById(req.params.workerId);
    if (!worker) return res.status(404).json({ message: "Worker not found." });
    assertCanAccessWorkerBranch(req, worker);
    worker.status = "approved";
    await worker.save();

    await createNotification(worker._id, {
      type: "account-approved",
      title: "Your account has been reinstated",
      message: "Your account access has been restored. You can now log in.",
      link: "/portal/dashboard",
      senderId: req.user._id,
    });
    await sendPushToMany([worker._id], {
      title: "Account reinstated",
      body: "Your account access has been restored.",
      url: "/portal/dashboard",
    });
    await sendGenericNotificationEmail(worker, {
      subject: "Your Yachal House account has been reinstated",
      title: "Account reinstated",
      message: "Your account access has been restored. You can now log in.",
      link: "/portal/dashboard",
      linkLabel: "Open Portal",
    });
    res.status(200).json({ message: `${worker.fullName} has been reinstated.` });
  } catch (error) { next(error); }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: "Current password is incorrect." });

    user.password = await bcrypt.hash(newPassword, 12);
    user.mustChangePassword = false;
    await user.save();

    res.status(200).json({ message: "Password changed successfully." });
  } catch (error) { next(error); }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const normalizedEmail = email?.toString().toLowerCase().trim();

    if (!normalizedEmail) {
      return res.status(400).json({ message: "Email is required." });
    }

    const worker = await User.findOne({ email: normalizedEmail });
    if (!worker) {
      return res.status(200).json({ message: PASSWORD_RESET_REQUEST_MESSAGE });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    worker.passwordResetToken = hashPasswordResetToken(resetToken);
    worker.passwordResetExpires = new Date(Date.now() + PASSWORD_RESET_EXPIRES_MS);
    await worker.save({ validateBeforeSave: false });

    await sendPasswordResetLinkEmail(worker, resetToken);

    res.status(200).json({ message: PASSWORD_RESET_REQUEST_MESSAGE });
  } catch (error) { next(error); }
};

export const resetPasswordWithToken = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password, newPassword } = req.body;
    const nextPassword = password || newPassword;

    if (!token) {
      return res.status(400).json({ message: "Reset token is required." });
    }

    if (!nextPassword || nextPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const worker = await User.findOne({
      passwordResetToken: hashPasswordResetToken(token),
      passwordResetExpires: { $gt: new Date() },
    });

    if (!worker) {
      return res.status(400).json({ message: "Reset link is invalid or expired. Request a new password reset link." });
    }

    worker.password = await bcrypt.hash(nextPassword, 12);
    worker.mustChangePassword = false;
    worker.passwordResetToken = undefined;
    worker.passwordResetExpires = undefined;
    await worker.save();

    try {
      const admins = await getAdminRecipientsForBranch(worker.branch);

      if (admins.length > 0) {
        const adminIds = admins.map((admin) => admin._id);
        const workerLabel = `${worker.fullName} (ID: ${worker.workerId || "pending"})`;

        await createBulkNotification(adminIds, {
          type: "general",
          title: "Worker password reset completed",
          message: `${workerLabel} reset their password using the email reset link.`,
          link: `/admin/workers/${worker._id}`,
          senderId: null,
        });

        await sendPushToMany(adminIds, {
          title: "Worker password reset completed",
          body: `${worker.fullName} reset their password.`,
          url: `/admin/workers/${worker._id}`,
        });

        await sendGenericNotificationEmail(admins, {
          subject: "Worker password reset completed",
          title: "Worker password reset completed",
          message: `${workerLabel} reset their password using the email reset link.`,
          link: `/admin/workers/${worker._id}`,
          linkLabel: "Open Worker Profile",
        });
      }
    } catch (notificationError) {
      console.error("Password reset admin notification error:", notificationError.message);
    }

    res.status(200).json({
      message: "Password reset successfully. Admins have been notified.",
    });
  } catch (error) { next(error); }
};

// Admin resets a worker's password - generates temp, emails worker AND returns it so admin can also copy/share
export const adminResetPassword = async (req, res, next) => {
  try {
    const worker = await User.findById(req.params.workerId);
    if (!worker) return res.status(404).json({ message: "Worker not found." });
    assertCanAccessWorkerBranch(req, worker);

    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let tempPassword = "";
    for (let i = 0; i < 10; i++) tempPassword += chars[Math.floor(Math.random() * chars.length)];

    worker.password = await bcrypt.hash(tempPassword, 12);
    worker.mustChangePassword = true;
    await worker.save();

    // Email worker
    await sendAccountCreatedEmail(worker, tempPassword);

    // Notify the resetting admin
    await createNotification(req.user._id, {
      type: "general",
      title: "Password reset successful",
      message: `Password for ${worker.fullName} has been reset. Temporary password: ${tempPassword}`,
      link: `/admin/workers/${worker._id}`,
    });
    await sendPushToMany([req.user._id], {
      title: "Password reset successful",
      body: `Password for ${worker.fullName} has been reset.`,
      url: `/admin/workers/${worker._id}`,
    });
    await sendGenericNotificationEmail(req.user, {
      subject: "Password reset completed",
      title: "Password reset successful",
      message: `Password for ${worker.fullName} has been reset. Open the worker profile to view the result in the system.`,
      link: `/admin/workers/${worker._id}`,
      linkLabel: "Open Worker Profile",
    });

    res.status(200).json({
      message: `Password reset for ${worker.fullName}. Temporary password sent to ${worker.email}.`,
      tempPassword, // Return to admin so they can also share it manually
      workerEmail: worker.email,
      workerName: worker.fullName,
    });
  } catch (error) { next(error); }
};
