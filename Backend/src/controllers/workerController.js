import User from "../models/userModel.js";
import Metrics from "../models/metricsModel.js";

export const getAllWorkers = async (req, res, next) => {
  try {
    const { status, department, role, isQualified, search, page = 1, limit = 15 } = req.query;
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
    if (notificationPreferences) worker.notificationPreferences = notificationPreferences;

    await worker.save();

    res.status(200).json({ message: "Profile updated successfully.", worker });
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
    const worker = await User.findById(req.user._id);

    if (fullName) worker.fullName = fullName;
    if (phone) worker.phone = phone;
    if (notificationPreferences) worker.notificationPreferences = notificationPreferences;

    await worker.save();

    res.status(200).json({ message: "Profile updated.", worker });
  } catch (error) {
    next(error);
  }
};