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
} from "../services/emailService.js";

const generateToken = (id) =>
  jwt.sign({ id }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

export const generateWorkerId = async () => {
  let digits = 3;
  let id;
  let exists = true;
  while (exists) {
    const max = Math.pow(10, digits) - 1;
    const min = Math.pow(10, digits - 1);
    const num = Math.floor(Math.random() * (max - min + 1)) + min;
    id = String(num).padStart(digits, "0");
    exists = await User.findOne({ workerId: id });
    if (exists && num === max) digits++;
  }
  return id;
};

const generateTempPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#";
  let pass = "";
  for (let i = 0; i < 10; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  return pass;
};

export const register = async (req, res, next) => {
  try {
    const { fullName, email, password, phone } = req.body;
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(400).json({ message: "An account with this email already exists." });
    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({
      fullName, email: email.toLowerCase().trim(),
      password: hashed, phone, status: "pending", role: "worker",
    });
    res.status(201).json({
      message: "Registration successful. Your account is pending approval.",
      user: { _id: user._id, fullName: user.fullName, email: user.email, status: user.status },
    });
  } catch (error) { next(error); }
};

// Login with email OR worker ID
export const login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ message: "Email or Worker ID and password are required." });
    }

    const isEmail = identifier.includes("@");
    const user = isEmail
      ? await User.findOne({ email: identifier.toLowerCase().trim() })
      : await User.findOne({ workerId: identifier.trim() });

    if (!user) return res.status(401).json({ message: "Invalid credentials. Check your email or Worker ID and password." });
    if (user.status === "pending") return res.status(403).json({ message: "Your account is pending approval. Please wait for admin confirmation." });
    if (user.status === "suspended") return res.status(403).json({ message: "Your account has been suspended. Contact your admin." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials. Check your email or Worker ID and password." });

    user.lastLogin = new Date();
    await user.save();

    res.status(200).json({
      token: generateToken(user._id),
      user: {
        _id: user._id, fullName: user.fullName, email: user.email,
        role: user.role, status: user.status, workerId: user.workerId,
        department: user.department, notificationPreferences: user.notificationPreferences,
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

    worker.status = "approved";
    if (!worker.workerId) worker.workerId = await generateWorkerId();
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

// Generate Worker ID for existing approved worker who has none
export const generateIdForWorker = async (req, res, next) => {
  try {
    const worker = await User.findById(req.params.workerId);
    if (!worker) return res.status(404).json({ message: "Worker not found." });
    if (worker.workerId) return res.status(400).json({ message: "Worker already has a permanent ID." });

    worker.workerId = await generateWorkerId();
    await worker.save();

    await createNotification(worker._id, {
      type: "account-approved",
      title: "Your Worker ID has been assigned",
      message: `Your permanent Worker ID is ${worker.workerId}. Keep it safe for front desk check-in.`,
      link: "/portal/dashboard",
      senderId: req.user._id,
    });

    await sendAccountApprovedEmail(worker);

    res.status(200).json({
      message: `Worker ID ${worker.workerId} assigned to ${worker.fullName}.`,
      worker: { _id: worker._id, fullName: worker.fullName, workerId: worker.workerId },
    });
  } catch (error) { next(error); }
};

// Admin creates single worker
export const adminCreateWorker = async (req, res, next) => {
  try {
    const { fullName, email, phone, department, role } = req.body;
    if (!fullName || !email) return res.status(400).json({ message: "Full name and email are required." });

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(400).json({ message: "An account with this email already exists." });

    const tempPassword = generateTempPassword();
    const hashed = await bcrypt.hash(tempPassword, 12);
    const workerId = await generateWorkerId();

    const worker = await User.create({
      fullName, email: email.toLowerCase().trim(), phone: phone || "",
      department: department || "unassigned",
      role: role || "worker",
      password: hashed, status: "approved", workerId,
      approvedBy: req.user._id, approvedAt: new Date(),
    });

    await sendAccountCreatedEmail(worker, tempPassword);
    await createNotification(worker._id, {
      type: "account-approved",
      title: "Your Yachal House account is ready",
      message: `Your Worker ID is ${workerId}. Check your email for login details.`,
      link: "/portal/dashboard",
      senderId: req.user._id,
    });

    res.status(201).json({
      message: `Account created for ${fullName}. Worker ID: ${workerId}. Credentials sent to ${email}.`,
      worker: { _id: worker._id, fullName, email: worker.email, workerId, status: "approved" },
      tempPassword,
    });
  } catch (error) { next(error); }
};

// Admin bulk creates workers - plain email list, no JSON required
export const adminBulkCreateWorkers = async (req, res, next) => {
  try {
    const { emails, defaultDepartment, defaultRole } = req.body;
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ message: "Provide an array of email addresses." });
    }

    const results = { created: [], skipped: [] };

    for (const rawEmail of emails) {
      const email = rawEmail.trim().toLowerCase();
      if (!email) continue;
      const existing = await User.findOne({ email });
      if (existing) { results.skipped.push(email); continue; }

      if (!w.password || w.password.length < 6) {
        results.skipped.push(`${w.email} (no valid password)`);
        continue;
      }
      const tempPassword = w.password;
      const hashed = await bcrypt.hash(tempPassword, 12);
      const workerId = await generateWorkerId();
      const fullName = email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

      const worker = await User.create({
        fullName, email,
        department: defaultDepartment || "unassigned",
        role: defaultRole || "worker",
        password: hashed, status: "approved", workerId,
        approvedBy: req.user._id, approvedAt: new Date(),
      });

      await sendBulkAccountCreatedEmail(worker, tempPassword);
      results.created.push({ fullName: worker.fullName, email, workerId, tempPassword });
    }

    res.status(201).json({
      message: `${results.created.length} workers created. ${results.skipped.length} skipped (email already exists).`,
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
      message: "Your account has been suspended. Please contact your admin.",
      senderId: req.user._id,
    });
    res.status(200).json({ message: `${worker.fullName} suspended.` });
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
      message: "Your account access has been restored.",
      link: "/portal/dashboard",
      senderId: req.user._id,
    });
    res.status(200).json({ message: `${worker.fullName} reinstated.` });
  } catch (error) { next(error); }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: "Current password is incorrect." });
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.status(200).json({ message: "Password changed successfully." });
  } catch (error) { next(error); }
};

// Get workers without Worker ID
export const getWorkersWithoutId = async (req, res, next) => {
  try {
    const workers = await User.find({
      $or: [{ workerId: null }, { workerId: "" }, { workerId: { $exists: false } }]
    }).select("-password").sort({ createdAt: 1 });
    res.status(200).json({ workers, count: workers.length });
  } catch (error) { next(error); }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const worker = await User.findOne({ email });
    if (!worker) return res.status(404).json({ message: "No account found with that email." });

    // Notify all admin/mod/pastor to reset for this worker
    const admins = await User.find({ status: "approved", role: { $in: ["pastor", "admin", "moderator"] } }).select("_id email fullName");
    const { createBulkNotification } = await import("../services/notificationService.js");
    await createBulkNotification(admins.map((a) => a._id), {
      type: "general",
      title: "Password reset requested",
      message: `${worker.fullName} (ID: ${worker.workerId || "pending"}) has requested a password reset. Go to Workers to reset their password.`,
      link: "/admin/workers",
    });

    // Email admins
    const { sendPasswordResetRequestEmail } = await import("../services/emailService.js");
    await sendPasswordResetRequestEmail(admins, worker);

    res.status(200).json({ message: "Your request has been sent to the admin team. They will reset your password and contact you." });
  } catch (error) { next(error); }
};

export const adminResetPassword = async (req, res, next) => {
  try {
    const worker = await User.findById(req.params.workerId);
    if (!worker) return res.status(404).json({ message: "Worker not found." });

    const tempPassword = Math.random().toString(36).slice(-8) + "A1";
    worker.password = await bcrypt.hash(tempPassword, 12);
    await worker.save();

    const { sendAccountCreatedEmail } = await import("../services/emailService.js");
    await sendAccountCreatedEmail(worker, tempPassword);

    res.status(200).json({ message: `Password reset for ${worker.fullName}. New credentials sent to ${worker.email}.` });
  } catch (error) { next(error); }
};