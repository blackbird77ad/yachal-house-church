const startOfDay = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const setTime = (date, hours, minutes = 0, seconds = 0, ms = 0) => {
  const d = new Date(date);
  d.setUTCHours(hours, minutes, seconds, ms);
  return d;
};

export const normalizeWeekReference = (value) => {
  const d = value instanceof Date ? new Date(value) : new Date(value);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

export const isSameWeekReference = (a, b) => {
  if (!a || !b) return false;
  return normalizeWeekReference(a).getTime() === normalizeWeekReference(b).getTime();
};

export const getThisMonday = (input = new Date()) => {
  const now = new Date(input);
  const day = now.getUTCDay(); // Sun=0, Mon=1
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
};

export const getNextMonday = (input = new Date()) => {
  const monday = getThisMonday(input);
  monday.setUTCDate(monday.getUTCDate() + 7);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
};

export const getPreviousMonday = (input = new Date()) => {
  const monday = getThisMonday(input);
  monday.setUTCDate(monday.getUTCDate() - 7);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
};

/*
Correct rule:

A reporting week runs from:
  Monday 3:00 PM  -> next Monday 2:59 PM

Examples:
- Wed Apr 15 2026  => active window is Apr 13 3:00 PM -> Apr 20 2:59 PM
- Mon Apr 20 2026 2:00 PM => still same active window
- Mon Apr 20 2026 3:00 PM => new active window starts, ending Apr 27

The weekReference is ALWAYS the closing Monday of the active window.
*/
export const getPortalWeekReferenceForNow = (input = new Date()) => {
  const now = new Date(input);
  const thisMonday = getThisMonday(now);
  const thisMondayAt3pm = setTime(thisMonday, 15, 0, 0, 0);

  // Before Monday 3pm, we are still in the window that closes THIS Monday
  if (now < thisMondayAt3pm) {
    return thisMonday;
  }

  // From Monday 3pm onward, we are in the window that closes NEXT Monday
  return getNextMonday(now);
};

export const getPreviousPortalWeekReference = (input = new Date()) => {
  const current = getPortalWeekReferenceForNow(input);
  const prev = new Date(current);
  prev.setUTCDate(prev.getUTCDate() - 7);
  prev.setUTCHours(0, 0, 0, 0);
  return prev;
};

export const getSystemWeekWindowForWeekReference = (weekReference) => {
  const closingMonday = normalizeWeekReference(weekReference);

  const opensAt = new Date(closingMonday);
  opensAt.setUTCDate(opensAt.getUTCDate() - 7);
  opensAt.setUTCHours(15, 0, 0, 0); // previous Monday 3:00 PM Ghana time

  const closesAt = new Date(closingMonday);
  closesAt.setUTCHours(14, 59, 59, 999); // closing Monday 2:59:59 PM Ghana time

  return {
    weekReference: closingMonday,
    opensAt,
    closesAt,
  };
};

export const getPortalWindowForWeekReference = (weekReference) => {
  const closingMonday = normalizeWeekReference(weekReference);

  const opensAt = new Date(closingMonday);
  opensAt.setUTCDate(opensAt.getUTCDate() - 3);
  opensAt.setUTCHours(0, 0, 0, 0); // Friday 12:00 AM Ghana time

  const closesAt = new Date(closingMonday);
  closesAt.setUTCHours(14, 59, 59, 999); // closing Monday 2:59:59 PM Ghana time

  return {
    weekReference: closingMonday,
    opensAt,
    closesAt,
  };
};

export const getPortalWindowForNow = (input = new Date()) => {
  const weekReference = getPortalWeekReferenceForNow(input);
  return getPortalWindowForWeekReference(weekReference);
};

export const isWithinSubmissionWindow = (input = new Date()) => {
  const now = new Date(input);
  const { opensAt, closesAt } = getPortalWindowForNow(now);
  return now >= opensAt && now <= closesAt;
};

export const isWithinPortalWindow = (input = new Date()) => {
  return isWithinSubmissionWindow(input);
};

export const getNextOpenAt = (input = new Date()) => {
  const now = new Date(input);
  const currentWindow = getPortalWindowForNow(now);

  if (now < currentWindow.opensAt) {
    return currentWindow.opensAt;
  }

  const nextWeekReference = new Date(currentWindow.weekReference);
  nextWeekReference.setUTCDate(nextWeekReference.getUTCDate() + 7);

  return getPortalWindowForWeekReference(nextWeekReference).opensAt;
};

export const getWeekLabelRange = (weekReference) => {
  const { opensAt, closesAt } = getSystemWeekWindowForWeekReference(weekReference);
  return { opensAt, closesAt };
};
