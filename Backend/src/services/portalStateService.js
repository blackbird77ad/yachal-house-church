import PortalWindow from "../models/portalWindowModel.js";
import {
  getNextOpenAt,
  getPortalWeekReferenceForNow,
  getPortalWindowForWeekReference,
  getSystemWeekWindowForWeekReference,
  isWithinSubmissionWindow,
} from "../utils/portalWeek.js";

export const getCurrentPortalState = async (
  now = new Date(),
  { populateOverride = false } = {}
) => {
  const weekReference = getPortalWeekReferenceForNow(now);
  const systemWeek = getSystemWeekWindowForWeekReference(weekReference);
  const scheduledWindow = getPortalWindowForWeekReference(weekReference);
  const isScheduledWindowOpen = isWithinSubmissionWindow(now);

  let query = PortalWindow.findOne({ weekReference });
  if (populateOverride) {
    query = query.populate("overriddenBy", "fullName role");
  }

  const portal = await query;

  const portalCurrentlyOpen =
    !!portal &&
    portal.isOpen === true &&
    new Date(portal.opensAt) <= now &&
    new Date(portal.closesAt) >= now;

  const portalExtendsScheduledWindow =
    portalCurrentlyOpen &&
    new Date(portal.closesAt).getTime() > scheduledWindow.closesAt.getTime();

  const isManuallyPaused = !!portal && portal.isOpen === false && !isScheduledWindowOpen;

  const isOpen = isScheduledWindowOpen || portalCurrentlyOpen;

  const isManualOverride =
    !!portal &&
    (!!portal.overrideReason ||
      !!portal.overriddenBy ||
      new Date(portal.opensAt).getTime() !== scheduledWindow.opensAt.getTime() ||
      new Date(portal.closesAt).getTime() !== scheduledWindow.closesAt.getTime());

  return {
    portal,
    isOpen,
    isManuallyPaused,
    isManualOverride,
    isScheduledWindowOpen,
    weekReference,
    systemWeek,
    scheduledWindow,
    opensAt:
      isScheduledWindowOpen
        ? scheduledWindow.opensAt
        : portalCurrentlyOpen
        ? portal.opensAt
        : null,
    closesAt:
      portalExtendsScheduledWindow
        ? portal.closesAt
        : isScheduledWindowOpen
        ? scheduledWindow.closesAt
        : portalCurrentlyOpen
        ? portal.closesAt
        : null,
    nextOpenAt: getNextOpenAt(now),
  };
};
