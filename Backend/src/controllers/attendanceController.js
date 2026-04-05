import Attendance from "../models/attendanceModel.js";
import FrontDeskSession from "../models/frontDeskSessionModel.js";
import User from "../models/userModel.js";

export const createSession = async (req, res, next) => {
  try {
    const { serviceType, specialServiceName, serviceDate, serviceStartTime, estimatedEndTime, coWorkerId, lateThresholdMinutes } = req.body;

    const start = new Date(serviceStartTime);
    const end = new Date(estimatedEndTime);
    const autoClose = new Date(start.getTime() + 2 * 60 * 60 * 1000);

    const session = await FrontDeskSession.create({
      primaryWorker: req.user._id,
      coWorkers: coWorkerId ? [coWorkerId] : [],
      serviceType,
      specialServiceName,
      serviceDate: new Date(serviceDate),
      serviceStartTime: start,
      estimatedEndTime: end,
      autoCloseTime: autoClose,
      lateThresholdMinutes: lateThresholdMinutes || 0,
      isOpen: true,
    });

    await Attendance.create({
      worker: req.user._id,
      session: session._id,
      serviceType,
      serviceDate: new Date(serviceDate),
      checkInTime: new Date(),
      isOnDuty: true,
      verifiedByFrontDesk: true,
      isLate: new Date() > start,
      loggedBy: req.user._id,
    });

    res.status(201).json({ message: "Front desk session created.", session });
  } catch (error) {
    next(error);
  }
};

export const joinSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const session = await FrontDeskSession.findById(sessionId);
    if (!session || !session.isOpen) {
      return res.status(404).json({ message: "Session not found or already closed." });
    }

    if (!session.coWorkers.includes(req.user._id)) {
      session.coWorkers.push(req.user._id);
      await session.save();
    }

    const existing = await Attendance.findOne({ worker: req.user._id, session: sessionId });
    if (!existing) {
      await Attendance.create({
        worker: req.user._id,
        session: session._id,
        serviceType: session.serviceType,
        serviceDate: session.serviceDate,
        checkInTime: new Date(),
        isOnDuty: true,
        verifiedByFrontDesk: true,
        isLate: new Date() > session.serviceStartTime,
        loggedBy: req.user._id,
      });
    }

    res.status(200).json({ message: "Joined session successfully.", session });
  } catch (error) {
    next(error);
  }
};

export const checkInWorker = async (req, res, next) => {
  try {
    const { workerId, sessionId, isOnDuty } = req.body;

    const session = await FrontDeskSession.findById(sessionId);
    if (!session || !session.isOpen) {
      return res.status(400).json({ message: "Session is not open." });
    }

    const worker = await User.findOne({ workerId, status: "approved" });
    if (!worker) {
      return res.status(404).json({ message: "No approved worker found with that ID." });
    }

    const existing = await Attendance.findOne({ worker: worker._id, session: sessionId });
    if (existing) {
      return res.status(400).json({
        message: `${worker.fullName} has already been checked in.`,
        worker: { fullName: worker.fullName, workerId: worker.workerId },
      });
    }

    const now = new Date();
    const isLate = now > new Date(session.serviceStartTime.getTime() + session.lateThresholdMinutes * 60 * 1000);

    const attendance = await Attendance.create({
      worker: worker._id,
      session: sessionId,
      serviceType: session.serviceType,
      serviceDate: session.serviceDate,
      checkInTime: now,
      isOnDuty: isOnDuty || false,
      isLate,
      verifiedByFrontDesk: true,
      loggedBy: req.user._id,
    });

    res.status(201).json({
      message: `Attendance recorded for ${worker.fullName} at ${now.toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" })}.`,
      worker: { fullName: worker.fullName, workerId: worker.workerId, department: worker.department },
      attendance,
    });
  } catch (error) {
    next(error);
  }
};

export const manualCheckIn = async (req, res, next) => {
  try {
    const { workerId, sessionId, manualTime, isOnDuty } = req.body;

    const session = await FrontDeskSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: "Session not found." });
    }

    const worker = await User.findOne({ workerId, status: "approved" });
    if (!worker) {
      return res.status(404).json({ message: "No approved worker found with that ID." });
    }

    const existing = await Attendance.findOne({ worker: worker._id, session: sessionId });
    if (existing) {
      return res.status(400).json({ message: `${worker.fullName} already has an attendance record for this session.` });
    }

    const attendance = await Attendance.create({
      worker: worker._id,
      session: sessionId,
      serviceType: session.serviceType,
      serviceDate: session.serviceDate,
      checkInTime: new Date(),
      isOnDuty: isOnDuty || false,
      isLate: true,
      verifiedByFrontDesk: false,
      manualEntry: true,
      manualTime,
      loggedBy: req.user._id,
    });

    res.status(201).json({
      message: `Manual attendance recorded for ${worker.fullName}. Marked as not verified by front desk.`,
      worker: { fullName: worker.fullName, workerId: worker.workerId },
      attendance,
    });
  } catch (error) {
    next(error);
  }
};

export const getSessionAttendance = async (req, res, next) => {
  try {
    const attendance = await Attendance.find({ session: req.params.sessionId })
      .populate("worker", "fullName workerId department")
      .sort({ checkInTime: 1 });

    res.status(200).json({ attendance });
  } catch (error) {
    next(error);
  }
};

export const getActiveSession = async (req, res, next) => {
  try {
    const session = await FrontDeskSession.findOne({ isOpen: true })
      .populate("primaryWorker", "fullName workerId")
      .populate("coWorkers", "fullName workerId")
      .sort({ createdAt: -1 });

    res.status(200).json({ session: session || null });
  } catch (error) {
    next(error);
  }
};

export const closeSession = async (req, res, next) => {
  try {
    const session = await FrontDeskSession.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ message: "Session not found." });
    }

    session.isOpen = false;
    session.closedAt = new Date();
    await session.save();

    res.status(200).json({ message: "Session closed successfully." });
  } catch (error) {
    next(error);
  }
};