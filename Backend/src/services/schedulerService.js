import cron from "node-cron";
import PortalWindow from "../models/portalWindowModel.js";
import Metrics from "../models/metricsModel.js";
import { processWeeklyMetrics } from "./metricsService.js";
import { sendPortalOpenEmail, sendPortalClosingEmail, sendQualificationResultsEmail } from "./emailService.js";
import { createBulkNotification } from "./notificationService.js";
import User from "../models/userModel.js";
import { sendPushToMany } from "./pushService.js";

const getThisWeekMonday = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const getNextWeekMonday = () => {
  const monday = getThisWeekMonday();
  monday.setDate(monday.getDate() + 7);
  return monday;
};

const getNextMonday259pm = () => {
  const monday = getNextWeekMonday();
  monday.setHours(14, 59, 0, 0);
  return monday;
};

const openPortal = async () => {
  try {
    const now = new Date();
    const weekReference = getNextWeekMonday();
    const closesAt = getNextMonday259pm();
    const existing = await PortalWindow.findOne({ weekReference });
    if (existing) {
      existing.isOpen = true;
      existing.opensAt = now;
      existing.closesAt = closesAt;
      await existing.save();
    } else {
      await PortalWindow.create({ weekReference, opensAt: now, closesAt, isOpen: true });
    }
    const workers = await User.find({ status: "approved" }).select("_id email fullName");
    await createBulkNotification(workers.map((w) => w._id), {
      type: "portal-open",
      title: "Report portal is now open",
      message: "You can now submit your weekly report. Portal closes Monday at 2:59pm.",
      link: "/portal/submit-report",
    });
    await sendPortalOpenEmail(workers);
    await sendPushToMany(workers.map((w) => w._id), {
      title: "Portal is now open",
      body: "Submit your weekly report before Monday 2:59pm.",
      url: "/portal/submit-report",
    });
    console.log("Scheduler: Portal opened for week of", weekReference.toDateString());
  } catch (err) { console.error("Scheduler openPortal error:", err.message); }
};

// Monday 12pm reminder
const sendClosingReminder = async () => {
  try {
    const workers = await User.find({ status: "approved" }).select("_id email fullName");
    await createBulkNotification(workers.map((w) => w._id), {
      type: "portal-closing-soon",
      title: "Portal closes in 3 hours",
      message: "The portal closes today at 2:59pm. Submit your report now if you have not done so. The portal reopens on Friday.",
      link: "/portal/submit-report",
    });
    await sendPortalClosingEmail(workers);
    await sendPushToMany(workers.map((w) => w._id), {
      title: "Portal closes in 3 hours",
      body: "Submit your report now. Portal closes at 2:59pm today.",
      url: "/portal/submit-report",
    });
    console.log("Scheduler: Monday 12pm closing reminder sent");
  } catch (err) { console.error("Scheduler closingReminder error:", err.message); }
};

const closePortalAndProcess = async () => {
  try {
    const weekReference = getThisWeekMonday();
    const portal = await PortalWindow.findOne({ weekReference });
    if (portal) {
      portal.isOpen = false;
      portal.isProcessed = true;
      portal.processedAt = new Date();
      await portal.save();
    }
    await processWeeklyMetrics(weekReference);

    // Fetch results and email admin/mod/pastor
    const metrics = await Metrics.find({ weekReference, isLateSubmission: false })
      .populate("worker", "fullName workerId department")
      .sort({ totalScore: -1 });

    const qualified = metrics.filter((m) => m.isQualified);
    const disqualified = metrics.filter((m) => !m.isQualified);

    const recipients = await User.find({ status: "approved", role: { $in: ["pastor", "admin", "moderator"] } }).select("email fullName");
    await sendQualificationResultsEmail(recipients, qualified, disqualified);

    // Notify all workers results are ready (no details - just that processing is done)
    const allWorkers = await User.find({ status: "approved" }).select("_id");
    await createBulkNotification(allWorkers.map((w) => w._id), {
      type: "qualification-result",
      title: "Weekly reports processed",
      message: "This week's report submission window has closed. Check your notifications for updates.",
      link: "/portal/dashboard",
    });

    console.log("Scheduler: Portal closed and metrics processed. Results emailed to admin team.");
  } catch (err) { console.error("Scheduler closePortalAndProcess error:", err.message); }
};

export const initScheduler = () => {
  cron.schedule("0 0 * * 5", openPortal, { timezone: "Africa/Accra" });         // Friday midnight
  cron.schedule("0 12 * * 1", sendClosingReminder, { timezone: "Africa/Accra" }); // Monday 12pm
  cron.schedule("59 14 * * 1", closePortalAndProcess, { timezone: "Africa/Accra" }); // Monday 2:59pm
  console.log("Scheduler: Cron jobs initialized (Africa/Accra timezone)");
};

export const syncPortalStateOnStartup = async () => {
  try {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const isWithinWindow =
      (day === 5 && hour >= 0) || day === 6 || day === 0 ||
      (day === 1 && (hour < 14 || (hour === 14 && minute < 59)));

    if (isWithinWindow) {
      const weekReference = day === 1 ? getThisWeekMonday() : getNextWeekMonday();
      const closesAt = new Date(getNextWeekMonday());
      if (day === 1) { closesAt.setDate(closesAt.getDate() - 7); }
      closesAt.setHours(14, 59, 0, 0);
      const existing = await PortalWindow.findOne({ weekReference });
      if (!existing) {
        await PortalWindow.create({ weekReference, opensAt: now, closesAt, isOpen: true });
        console.log("Startup sync: Portal window created and opened");
      } else if (!existing.isOpen) {
        existing.isOpen = true;
        await existing.save();
        console.log("Startup sync: Portal reopened");
      } else {
        console.log("Startup sync: Portal already open");
      }
    } else {
      console.log("Startup sync: Outside portal window");
    }
  } catch (err) { console.error("Startup sync error:", err.message); }
};