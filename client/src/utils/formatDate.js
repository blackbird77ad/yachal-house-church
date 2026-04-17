import { format, formatDistanceToNow, isValid, parseISO } from "date-fns";

const toDate = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return isValid(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = parseISO(value);
    if (isValid(parsed)) return parsed;

    const fallback = new Date(value);
    return isValid(fallback) ? fallback : null;
  }

  const fallback = new Date(value);
  return isValid(fallback) ? fallback : null;
};

export const formatDate = (date, pattern = "dd MMM yyyy") => {
  const d = toDate(date);
  if (!d) return "N/A";
  return format(d, pattern);
};

export const formatDateTime = (date) => {
  const d = toDate(date);
  if (!d) return "N/A";
  return format(d, "dd MMM yyyy, hh:mm a");
};

export const formatTime = (date) => {
  const d = toDate(date);
  if (!d) return "N/A";
  return format(d, "hh:mm a");
};

export const timeAgo = (date) => {
  const d = toDate(date);
  if (!d) return "";
  return formatDistanceToNow(d, { addSuffix: true });
};

const getThisMonday = (now = new Date()) => {
  const d = new Date(now);
  const day = d.getDay(); // 0=Sun, 1=Mon
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const getNextMonday = (now = new Date()) => {
  const monday = getThisMonday(now);
  monday.setDate(monday.getDate() + 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

// Returns the closing Monday of the ACTIVE portal week.
// Correct rule:
// - Before Monday 3:00pm => current active week closes THIS Monday
// - From Monday 3:00pm onward => current active week closes NEXT Monday
export const getWeekReference = (now = new Date()) => {
  const d = new Date(now);
  const thisMonday = getThisMonday(d);
  const thisMondayAt3pm = new Date(thisMonday);
  thisMondayAt3pm.setHours(15, 0, 0, 0);

  if (d < thisMondayAt3pm) {
    return thisMonday;
  }

  return getNextMonday(d);
};

// Previous active portal week closing Monday
export const getPreviousWeekReference = (now = new Date()) => {
  const current = getWeekReference(now);
  const prev = new Date(current);
  prev.setDate(prev.getDate() - 7);
  prev.setHours(0, 0, 0, 0);
  return prev;
};

export const getWeekLabel = (date) => {
  const closing = toDate(date);
  if (!closing) return "N/A";

  closing.setHours(0, 0, 0, 0);

  const opening = new Date(closing);
  opening.setDate(closing.getDate() - 7);

  return `${format(opening, "EEE dd MMM")} 3:00pm – ${format(
    closing,
    "EEE dd MMM yyyy"
  )} 2:59pm`;
};

export const isPortalOpen = (portalStatus) => {
  return portalStatus?.isOpen === true;
};

export const formatWeekReference = (date) => {
  const d = toDate(date);
  if (!d) return "N/A";
  return `Week of ${format(d, "dd MMM yyyy")}`;
};