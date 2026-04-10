import Roster from "../models/rosterModel.js";
import { getWorkersByDepartmentForRoster, getQualifiedWorkers, getDisqualifiedWorkersByCloseness, getWorkersWithNoSubmission } from "../services/qualificationService.js";
import { createBulkNotification } from "../services/notificationService.js";
import { sendRosterPublishedEmail } from "../services/emailService.js";
import User from "../models/userModel.js";

const getCurrentWeekReference = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

export const getRosterBuilderData = async (req, res, next) => {
  try {
    const { weekReference } = req.query;
    const weekRef = weekReference ? new Date(weekReference) : (() => {
      const now = new Date();
      const day = now.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diff);
      monday.setHours(0, 0, 0, 0);
      return monday;
    })();

    const [qualified, disqualified, noSubmission] = await Promise.all([
      getQualifiedWorkers(weekRef),
      getDisqualifiedWorkersByCloseness(weekRef),
      getWorkersWithNoSubmission(weekRef),
    ]);

    // Exclude pastor (workerId 001) from all categories
    const excludePastor = (list) => list.filter((m) => m.worker?.workerId !== "001");

    res.status(200).json({
      rosterData: {
        qualified: excludePastor(qualified),
        disqualified: excludePastor(disqualified),
        noSubmission: excludePastor(noSubmission),
      }
    });
  } catch (error) {
    next(error);
  }
};


export const createOrUpdateRoster = async (req, res, next) => {
  try {
    const { weekReference, serviceType, serviceDate, specialServiceName, slots, notes } = req.body;

    let roster = await Roster.findOne({ weekReference: new Date(weekReference), serviceType });

    if (roster && roster.isPublished) {
      return res.status(400).json({ message: "This roster has already been published and cannot be edited." });
    }

    if (roster) {
      roster.slots = slots;
      roster.notes = notes;
      roster.specialServiceName = specialServiceName;
      await roster.save();
    } else {
      roster = await Roster.create({
        weekReference: new Date(weekReference),
        serviceType,
        serviceDate: new Date(serviceDate),
        specialServiceName,
        slots,
        notes,
        createdBy: req.user._id,
      });
    }

    res.status(200).json({ message: "Roster saved.", roster });
  } catch (error) {
    next(error);
  }
};

export const publishRoster = async (req, res, next) => {
  try {
    const roster = await Roster.findById(req.params.rosterId).populate({
      path: "slots.assignments.worker",
      select: "fullName email workerId department",
    });

    if (!roster) {
      return res.status(404).json({ message: "Roster not found." });
    }

    if (roster.isPublished) {
      return res.status(400).json({ message: "Roster is already published." });
    }

    roster.isPublished = true;
    roster.publishedAt = new Date();
    roster.publishedBy = req.user._id;
    await roster.save();

    const workerAssignments = {};
    roster.slots.forEach((slot) => {
      slot.assignments.forEach((assignment) => {
        const workerId = assignment.worker._id.toString();
        if (!workerAssignments[workerId]) {
          workerAssignments[workerId] = {
            worker: assignment.worker,
            assignments: [],
          };
        }
        workerAssignments[workerId].assignments.push({
          department: slot.department,
          subRole: slot.subRole,
          isCoordinator: assignment.isCoordinator,
        });
      });
    });

    const workerIds = Object.keys(workerAssignments);

    await createBulkNotification(workerIds, {
      type: "roster-published",
      title: "Duty roster has been published",
      message: "Your assignment for the upcoming service has been posted. Check your dashboard.",
      link: "/portal/dashboard",
      senderId: req.user._id,
    });

    for (const id of workerIds) {
      const { worker, assignments } = workerAssignments[id];
      await sendRosterPublishedEmail(worker, assignments);
    }

    res.status(200).json({ message: "Roster published and workers notified.", roster });
  } catch (error) {
    next(error);
  }
};

export const getRosters = async (req, res, next) => {
  try {
    const { weekReference, serviceType, isPublished } = req.query;
    const filter = {};

    if (weekReference) filter.weekReference = new Date(weekReference);
    if (serviceType) filter.serviceType = serviceType;
    if (isPublished !== undefined) filter.isPublished = isPublished === "true";

    const rosters = await Roster.find(filter)
      .populate("createdBy", "fullName")
      .populate("publishedBy", "fullName")
      .sort({ createdAt: -1 });

    res.status(200).json({ rosters });
  } catch (error) {
    next(error);
  }
};

export const getRosterById = async (req, res, next) => {
  try {
    const roster = await Roster.findById(req.params.rosterId)
      .populate("slots.assignments.worker", "fullName workerId department")
      .populate("createdBy", "fullName")
      .populate("publishedBy", "fullName");

    if (!roster) {
      return res.status(404).json({ message: "Roster not found." });
    }

    res.status(200).json({ roster });
  } catch (error) {
    next(error);
  }
};

export const getWhatsAppText = async (req, res, next) => {
  try {
    const roster = await Roster.findById(req.params.rosterId)
      .populate("slots.assignments.worker", "fullName workerId");

    if (!roster) {
      return res.status(404).json({ message: "Roster not found." });
    }

    const serviceDate = new Date(roster.serviceDate).toDateString();
    let text = `*YAHAL HOUSE DUTY ROSTER*\n`;
    text += `*Service:* ${roster.serviceType.toUpperCase()}${roster.specialServiceName ? ` - ${roster.specialServiceName}` : ""}\n`;
    text += `*Date:* ${serviceDate}\n`;
    if (roster.notes) text += `*Note:* ${roster.notes}\n`;
    text += `\n`;

    roster.slots.forEach((slot) => {
      text += `*${slot.department.toUpperCase().replace(/-/g, " ")}*${slot.subRole ? ` (${slot.subRole})` : ""}\n`;
      slot.assignments.forEach((a) => {
        text += `  ${a.isCoordinator ? "[Coordinator] " : ""}${a.worker.fullName}\n`;
      });
      text += `\n`;
    });

    text += `_Yahal House Church Management System_`;

    res.status(200).json({ text });
  } catch (error) {
    next(error);
  }
};

export const getMyAssignment = async (req, res, next) => {
  try {
    const roster = await Roster.findOne({ isPublished: true })
      .sort({ createdAt: -1 })
      .populate("slots.assignments.worker", "fullName workerId department");

    if (!roster) return res.status(200).json({ roster: null });

    const myAssignments = [];
    roster.slots.forEach((slot) => {
      const mine = slot.assignments.find(
        (a) => a.worker?._id?.toString() === req.user._id.toString()
      );
      if (mine) {
        myAssignments.push({
          department: slot.department,
          isCoordinator: mine.isCoordinator,
        });
      }
    });

    res.status(200).json({
      roster: {
        _id: roster._id,
        serviceType: roster.serviceType,
        serviceDate: roster.serviceDate,
        notes: roster.notes,
        publishedAt: roster.publishedAt,
        myAssignments,
      },
    });
  } catch (error) {
    next(error);
  }
};