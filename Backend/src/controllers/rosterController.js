import Roster from "../models/rosterModel.js";
import User from "../models/userModel.js";
import { getStoredWeekQualificationSnapshot } from "../services/qualificationService.js";
import {
  getEffectiveRosterWeekReference,
  getRankingWeekReferenceForRosterWeek,
} from "../services/metricsService.js";
import {
  getPortalWeekReferenceForNow,
  normalizeWeekReference,
} from "../utils/portalWeek.js";
import { createBulkNotification } from "../services/notificationService.js";
import { sendRosterPublishedEmail } from "../services/emailService.js";
import { sendPushToMany } from "../services/pushService.js";

const toDateWithTime = (serviceDate, serviceTime = "09:00") => {
  const [hours = "09", minutes = "00"] = String(serviceTime || "09:00").split(":");
  const value = new Date(serviceDate);
  value.setHours(Number(hours) || 0, Number(minutes) || 0, 0, 0);
  return value;
};

const buildRosterHeadline = (roster) => {
  const serviceLabel = roster.serviceType
    ? `${roster.serviceType.charAt(0).toUpperCase()}${roster.serviceType.slice(1)} Service`
    : "Roster";

  return roster.specialServiceName
    ? `${serviceLabel} - ${roster.specialServiceName}`
    : serviceLabel;
};

const serializeRosterForWorker = (roster, userId) => {
  const myAssignments = [];
  const slots = (roster.slots || []).map((slot) => {
    const assignments = (slot.assignments || []).map((assignment) => {
      const isMine =
        assignment.worker?._id?.toString() === userId.toString();

      if (isMine) {
        myAssignments.push({
          department: slot.department,
          subRole: slot.subRole || "",
          isCoordinator: !!assignment.isCoordinator,
        });
      }

      return {
        worker: assignment.worker,
        isCoordinator: !!assignment.isCoordinator,
        isMine,
      };
    });

    return {
      department: slot.department,
      subRole: slot.subRole || "",
      assignments,
    };
  });

  return {
    _id: roster._id,
    weekReference: roster.weekReference,
    serviceType: roster.serviceType,
    specialServiceName: roster.specialServiceName || "",
    serviceDate: roster.serviceDate,
    notes: roster.notes || "",
    publishedAt: roster.publishedAt,
    headline: buildRosterHeadline(roster),
    slots,
    myAssignments,
    isAssigned: myAssignments.length > 0,
  };
};

export const getRosterBuilderData = async (req, res, next) => {
  try {
    const { weekReference } = req.query;

    const rosterWeekReference = weekReference
      ? normalizeWeekReference(weekReference)
      : normalizeWeekReference(getPortalWeekReferenceForNow(new Date()));
    const rankingWeekReference = weekReference
      ? getRankingWeekReferenceForRosterWeek(rosterWeekReference)
      : getEffectiveRosterWeekReference(new Date());

    rosterWeekReference.setUTCHours(0, 0, 0, 0);
    rankingWeekReference.setUTCHours(0, 0, 0, 0);

    const { qualified, disqualified, noSubmission, ranking } =
      await getStoredWeekQualificationSnapshot(rankingWeekReference);

    const excludePastor = (list) => list.filter((m) => m.worker?.workerId !== "001");

    res.status(200).json({
      rosterData: {
        qualified: excludePastor(qualified),
        disqualified: excludePastor(disqualified),
        noSubmission: excludePastor(noSubmission),
        ranking: excludePastor(ranking),
      },
      rosterWeekReference,
      rankingWeekReference,
    });
  } catch (error) {
    next(error);
  }
};

export const createOrUpdateRoster = async (req, res, next) => {
  try {
    const {
      rosterId,
      weekReference,
      serviceType,
      serviceDate,
      serviceTime,
      specialServiceName,
      slots,
      notes,
    } = req.body;

    const normalizedWeekReference = normalizeWeekReference(weekReference);
    const normalizedServiceDate = toDateWithTime(serviceDate, serviceTime);

    let roster = rosterId ? await Roster.findById(rosterId) : null;

    if (rosterId && !roster) {
      return res.status(404).json({ message: "Roster not found." });
    }

    if (roster) {
      roster.weekReference = normalizedWeekReference;
      roster.serviceType = serviceType;
      roster.serviceDate = normalizedServiceDate;
      roster.specialServiceName = specialServiceName;
      roster.slots = slots;
      roster.notes = notes;
      if (roster.isPublished) {
        roster.needsRepublish = true;
      }
      await roster.save();
    } else {
      roster = await Roster.create({
        weekReference: normalizedWeekReference,
        serviceType,
        serviceDate: normalizedServiceDate,
        specialServiceName,
        slots,
        notes,
        createdBy: req.user._id,
      });
    }

    res.status(200).json({
      message: roster.isPublished
        ? "Roster updated. Republish to alert workers about the changes."
        : "Roster saved.",
      roster,
    });
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

    const isRepublish = roster.isPublished;

    roster.isPublished = true;
    roster.publishedAt = new Date();
    roster.publishedBy = req.user._id;
    roster.publishCount = (roster.publishCount || 0) + 1;
    roster.needsRepublish = false;
    await roster.save();

    const workerAssignments = {};
    roster.slots.forEach((slot) => {
      slot.assignments.forEach((assignment) => {
        const workerId = assignment.worker._id.toString();
        if (!workerAssignments[workerId]) {
          workerAssignments[workerId] = {
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

    const recipients = await User.find({ status: "approved" }).select(
      "_id email fullName notificationPreferences"
    );
    const inAppRecipients = recipients
      .filter((worker) => worker.notificationPreferences?.inApp !== false)
      .map((worker) => worker._id);
    const pushRecipients = recipients.map((worker) => worker._id);
    const emailRecipients = recipients.filter(
      (worker) => worker.email && worker.notificationPreferences?.email !== false
    );

    await createBulkNotification(inAppRecipients, {
      type: "roster-published",
      title: isRepublish ? "Duty roster has been updated" : "Duty roster has been published",
      message: isRepublish
        ? `${buildRosterHeadline(roster)} has been updated. Please check the roster page again because your assignment may have changed.`
        : `${buildRosterHeadline(roster)} has been published. Open the roster page to view the full assignment list.`,
      link: "/portal/roster",
      senderId: req.user._id,
    });

    await sendPushToMany(pushRecipients, {
      title: isRepublish ? "Roster updated" : "Roster published",
      body: isRepublish
        ? `${buildRosterHeadline(roster)} has changed. Check the roster page again.`
        : `${buildRosterHeadline(roster)} is now available on the portal.`,
      url: "/portal/roster",
    });

    for (const worker of emailRecipients) {
      await sendRosterPublishedEmail(
        worker,
        roster,
        workerAssignments[worker._id.toString()]?.assignments || [],
        { isRepublish }
      );
    }

    res.status(200).json({
      message: isRepublish
        ? "Roster republished and workers notified to check their assignments again."
        : "Roster published and workers notified.",
      roster,
      republished: isRepublish,
    });
  } catch (error) {
    next(error);
  }
};

export const getRosters = async (req, res, next) => {
  try {
    const {
      weekReference,
      serviceType,
      isPublished,
      page = 1,
      limit = 20,
    } = req.query;
    const filter = {};

    if (weekReference) filter.weekReference = new Date(weekReference);
    if (serviceType) filter.serviceType = serviceType;
    if (isPublished !== undefined) filter.isPublished = isPublished === "true";

    const skip = (Number(page) - 1) * Number(limit);
    const [rosters, total] = await Promise.all([
      Roster.find(filter)
        .populate("createdBy", "fullName")
        .populate("publishedBy", "fullName")
        .sort({ publishedAt: -1, serviceDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Roster.countDocuments(filter),
    ]);

    res.status(200).json({
      rosters,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
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
      slot.assignments.forEach((assignment) => {
        text += `  ${assignment.isCoordinator ? "[Coordinator] " : ""}${assignment.worker.fullName}\n`;
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
    const { page = 1, limit = 6 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [rosters, total] = await Promise.all([
      Roster.find({ isPublished: true })
        .sort({ publishedAt: -1, serviceDate: -1, createdAt: -1 })
        .populate("slots.assignments.worker", "fullName workerId department")
        .skip(skip)
        .limit(Number(limit)),
      Roster.countDocuments({ isPublished: true }),
    ]);

    res.status(200).json({
      rosters: rosters.map((roster) => serializeRosterForWorker(roster, req.user._id)),
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    next(error);
  }
};

export const resetRosterAssignments = async (req, res, next) => {
  try {
    const roster = await Roster.findById(req.params.rosterId);

    if (!roster) {
      return res.status(404).json({ message: "Roster not found." });
    }

    if (roster.isPublished) {
      return res.status(400).json({
        message: "Published rosters cannot be reset. Edit and republish instead.",
      });
    }

    roster.slots = (roster.slots || []).map((slot) => ({
      department: slot.department,
      subRole: slot.subRole || "",
      assignments: [],
    }));
    roster.needsRepublish = false;
    await roster.save();

    res.status(200).json({
      message: "Roster assignments cleared. You can start again.",
      roster,
    });
  } catch (error) {
    next(error);
  }
};
