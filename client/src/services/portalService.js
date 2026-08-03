import axiosInstance from "../utils/axiosInstance";

const startOfGhanaDay = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const setGhanaTime = (date, hours, minutes = 0, seconds = 0, ms = 0) => {
  const d = new Date(date);
  d.setUTCHours(hours, minutes, seconds, ms);
  return d;
};

const getThisGhanaMonday = (input = new Date()) => {
  const now = new Date(input);
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = startOfGhanaDay(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  return monday;
};

const getPortalWeekReferenceForNow = (input = new Date()) => {
  const now = new Date(input);
  const thisMonday = getThisGhanaMonday(now);
  const thisMondayAt3pm = setGhanaTime(thisMonday, 15);

  if (now < thisMondayAt3pm) {
    return thisMonday;
  }

  const nextMonday = new Date(thisMonday);
  nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);
  return nextMonday;
};

const getPortalWindowForWeekReference = (weekReference) => {
  const closingMonday = startOfGhanaDay(weekReference);

  const opensAt = new Date(closingMonday);
  opensAt.setUTCDate(opensAt.getUTCDate() - 3);
  opensAt.setUTCHours(0, 0, 0, 0);

  const closesAt = new Date(closingMonday);
  closesAt.setUTCHours(14, 59, 59, 999);

  return {
    weekReference: closingMonday,
    opensAt,
    closesAt,
  };
};

const getNextOpenAt = (input = new Date()) => {
  const now = new Date(input);
  const currentWindow = getPortalWindowForWeekReference(
    getPortalWeekReferenceForNow(now)
  );

  if (now < currentWindow.opensAt) {
    return currentWindow.opensAt;
  }

  const nextWeekReference = new Date(currentWindow.weekReference);
  nextWeekReference.setUTCDate(nextWeekReference.getUTCDate() + 7);
  return getPortalWindowForWeekReference(nextWeekReference).opensAt;
};

export const getPortalStatusFallback = () => {
  const now = new Date();
  const currentWindow = getPortalWindowForWeekReference(
    getPortalWeekReferenceForNow(now)
  );
  const isOpen = now >= currentWindow.opensAt && now <= currentWindow.closesAt;
  const timeLeftMs = isOpen
    ? Math.max(0, currentWindow.closesAt.getTime() - now.getTime())
    : 0;

  return {
    isOpen,
    canSubmit: isOpen,
    statusUnavailable: true,
    opensAt: isOpen ? currentWindow.opensAt.toISOString() : null,
    closesAt: isOpen ? currentWindow.closesAt.toISOString() : null,
    nextOpenAt: getNextOpenAt(now).toISOString(),
    weekReference: currentWindow.weekReference.toISOString(),
    portalWeekReference: currentWindow.weekReference.toISOString(),
    timeLeft: isOpen
      ? {
          hours: Math.floor(timeLeftMs / (1000 * 60 * 60)),
          minutes: Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60)),
        }
      : null,
    message: isOpen
      ? "Portal status could not be refreshed. The schedule still allows submissions."
      : "Portal status could not be refreshed.",
  };
};

export const getPortalStatus = async () => {
  const response = await axiosInstance.get("/portal/status");
  return response.data;
};

export const getPortalStatusWithFallback = async () => {
  try {
    return await getPortalStatus();
  } catch {
    return getPortalStatusFallback();
  }
};

export const getPortalHistory = async () => {
  const response = await axiosInstance.get("/portal/history");
  return response.data;
};
