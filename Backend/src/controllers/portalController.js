import PortalWindow from "../models/portalWindowModel.js";
import { getCurrentPortalState } from "../services/portalStateService.js";

export const getPortalStatus = async (req, res, next) => {
  try {
    const now = new Date();
    const {
      portal,
      isOpen,
      isManualOverride,
      isScheduledWindowOpen,
      isManuallyPaused,
      weekReference,
      systemWeek,
      scheduledWindow,
      opensAt,
      closesAt,
      nextOpenAt,
    } = await getCurrentPortalState(now, {
      populateOverride: true,
    });

    const override = portal
      ? {
          reason: portal.overrideReason || null,
          overriddenBy: portal.overriddenBy || null,
        }
      : null;

    let timeLeft = null;
    if (isOpen && closesAt) {
      const timeLeftMs = Math.max(0, new Date(closesAt).getTime() - now.getTime());
      timeLeft = {
        hours: Math.floor(timeLeftMs / (1000 * 60 * 60)),
        minutes: Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60)),
      };
    }

    if (!isOpen) {
      return res.status(200).json({
        isOpen: false,
        canSubmit: false,
        opensAt: null,
        closesAt: null,
        nextOpenAt,
        weekReference,
        portalWeekReference: portal?.weekReference || weekReference,
        isScheduledWindowOpen,
        isManualOverride,
        isManuallyPaused,
        systemWeek,
        scheduledWindow,
        override,
        message: isManuallyPaused
          ? "Submission is paused by admin."
          : "Submission is closed.",
      });
    }

    return res.status(200).json({
      isOpen: true,
      canSubmit: true,
      opensAt,
      closesAt,
      nextOpenAt,
      weekReference,
      portalWeekReference: portal?.weekReference || weekReference,
      timeLeft,
      isScheduledWindowOpen,
      isManualOverride,
      isManuallyPaused,
      systemWeek,
      scheduledWindow,
      override,
      message: timeLeft
        ? `Submission is open. Closes in ${timeLeft.hours}h ${timeLeft.minutes}m.`
        : "Submission is open.",
    });
  } catch (error) {
    next(error);
  }
};

export const getPortalHistory = async (req, res, next) => {
  try {
    const portals = await PortalWindow.find()
      .populate("overriddenBy", "fullName role")
      .sort({ createdAt: -1 })
      .limit(20);

    return res.status(200).json({ portals });
  } catch (error) {
    next(error);
  }
};
