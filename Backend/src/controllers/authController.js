import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import { env } from "../config/env.js";
import { createNotification } from "../services/notificationService.js";
import {
  sendAccountApprovedEmail,
  sendAccountCreatedEmail,
  sendBulkAccountCreatedEmail,
  sendAccountSuspendedEmail,
  sendPasswordResetRequestEmail,
} from "../services/emailService.js";

const generateToken = (id) =>
  jwt.sign({ id }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

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
    const { fullName, email, password, phone } = req.body;
    if (!fullName?.trim() || !email?.trim() || !password) {
      return res.status(400).json({
        message: "Full name, email, and password are required.",
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(400).json({ message: "An account with this email already exists." });

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({
      fullName, email: email.toLowerCase().trim(),
      password: hashed, phone, status: "pending", role: "worker",
    });

    // Notify all admin/mod/pastor of new registration
    try {
      const admins = await User.find({
        status: "approved",
        role: { $in: ["pastor", "admin", "moderator"] },
      }).select("_id");

      if (admins.length > 0) {
        const { createBulkNotification } = await import("../services/notificationService.js");
        await createBulkNotification(admins.map((a) => a._id), {
          type: "general",
          title: "New worker registration",
          message: `${fullName} has registered and is awaiting approval.`,
          link: "/admin/workers",
        });
      }
    } catch (notifErr) {
      console.error("Registration notification error:", notifErr.message);
    }

    res.status(201).json({
      message: "Registration successful. Your account is pending approval.",
      user: { _id: user._id, fullName: user.fullName, email: user.email, status: user.status },
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

    res.status(200).json({
      token: generateToken(user._id),
      user: {
        _id: user._id, fullName: user.fullName, email: user.email,
        role: user.role, status: user.status, workerId: user.workerId,
        department: user.department,
        mustChangePassword: user.mustChangePassword || false,
        notificationPreferences: user.notificationPreferences,
      },
    });
  } catch (error) { next(error); }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    res.status(200).json({ user });
  } catch (error) { next(error); }
};

export const approveWorker = async (req, res, next) => {
  try {
    const worker = await User.findById(req.params.workerId);
    if (!worker) return res.status(404).json({ message: "Worker not found." });
    if (worker.status === "approved") return res.status(400).json({ message: "Worker is already approved." });

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

    res.status(200).json({ message: `${worker.fullName} approved. Worker ID: ${worker.workerId}`, worker });
  } catch (error) { next(error); }
};

export const adminCreateWorker = async (req, res, next) => {
  try {
    const { fullName, email, phone, department, role, password } = req.body;
    if (!fullName || !email) return res.status(400).json({ message: "Full name and email are required." });
    if (!password || password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(400).json({ message: "An account with this email already exists." });

    const hashed = await bcrypt.hash(password, 12);
    const workerId = await generateWorkerId();

    const worker = await User.create({
      fullName, email: email.toLowerCase().trim(), phone, department,
      role: role || "worker", password: hashed,
      status: "approved", workerId,
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

    res.status(201).json({
      message: `Account created for ${fullName}. Worker ID: ${workerId}.`,
      worker: { _id: worker._id, fullName, email: worker.email, workerId, status: "approved", role: worker.role },
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

      const hashed = await bcrypt.hash(w.password, 12);
      const workerId = await generateWorkerId();
      const fullName = w.fullName || w.email.split("@")[0].replace(/[._\-+]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();

      const worker = await User.create({
        fullName, email: w.email.toLowerCase().trim(),
        phone: w.phone || "", department: w.department || "unassigned",
        role: w.role || "worker", password: hashed,
        status: "approved", workerId,
        mustChangePassword: true,
        approvedBy: req.user._id, approvedAt: new Date(),
      });

      await sendBulkAccountCreatedEmail(worker, w.password);
      results.created.push({ fullName: worker.fullName, email: worker.email, workerId, role: worker.role, department: worker.department });
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
    worker.status = "suspended";
    await worker.save();

    await sendAccountSuspendedEmail(worker);
    await createNotification(worker._id, {
      type: "account-suspended",
      title: "Your account has been suspended",
      message: "Your account has been suspended. Please contact your admin for more information.",
      senderId: req.user._id,
    });
    res.status(200).json({ message: `${worker.fullName} has been suspended.` });
  } catch (error) { next(error); }
};

export const reinstateWorker = async (req, res, next) => {
  try {
    const worker = await User.findById(req.params.workerId);
    if (!worker) return res.status(404).json({ message: "Worker not found." });
    worker.status = "approved";
    await worker.save();

    await createNotification(worker._id, {
      type: "account-approved",
      title: "Your account has been reinstated",
      message: "Your account access has been restored. You can now log in.",
      link: "/portal/dashboard",
      senderId: req.user._id,
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
    const worker = await User.findOne({ email: email?.toLowerCase().trim() });
    if (!worker) return res.status(404).json({ message: "No account found with that email." });

    const admins = await User.find({
      status: "approved",
      role: { $in: ["pastor", "admin", "moderator"] },
    }).select("_id email fullName");

    await sendPasswordResetRequestEmail(admins, worker);

    for (const admin of admins) {
      await createNotification(admin._id, {
        type: "general",
        title: "Password reset requested",
        message: `${worker.fullName} (ID: ${worker.workerId || "pending"}) has requested a password reset.`,
        link: `/admin/workers/${worker._id}`,
        senderId: null,
      });
    }

    res.status(200).json({ message: "Your request has been sent to the admin team. They will reset your password and contact you." });
  } catch (error) { next(error); }
};

// Admin resets a worker's password - generates temp, emails worker AND returns it so admin can also copy/share
export const adminResetPassword = async (req, res, next) => {
  try {
    const worker = await User.findById(req.params.workerId);
    if (!worker) return res.status(404).json({ message: "Worker not found." });

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

    res.status(200).json({
      message: `Password reset for ${worker.fullName}. Temporary password sent to ${worker.email}.`,
      tempPassword, // Return to admin so they can also share it manually
      workerEmail: worker.email,
      workerName: worker.fullName,
    });
  } catch (error) { next(error); }
};
