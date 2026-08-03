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
  const day = d.getUTCDay(); // 0=Sun, 1=Mon
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
};

const getNextMonday = (now = new Date()) => {
  const monday = getThisMonday(now);
  monday.setUTCDate(monday.getUTCDate() + 7);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
};

// Returns the closing Monday of the active portal week in Ghana time.
export const getWeekReference = (now = new Date()) => {
  const d = new Date(now);
  const thisMonday = getThisMonday(d);
  const thisMondayAt3pm = new Date(thisMonday);
  thisMondayAt3pm.setUTCHours(15, 0, 0, 0);

  if (d < thisMondayAt3pm) {
    return thisMonday;
  }

  return getNextMonday(d);
};

export const getPreviousWeekReference = (now = new Date()) => {
  const current = getWeekReference(now);
  const prev = new Date(current);
  prev.setUTCDate(prev.getUTCDate() - 7);
  prev.setUTCHours(0, 0, 0, 0);
  return prev;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const formatGhanaWeekDate = (date, includeYear = false) => {
  const day = WEEKDAYS[date.getUTCDay()];
  const dateNumber = String(date.getUTCDate()).padStart(2, "0");
  const month = MONTHS[date.getUTCMonth()];
  const year = includeYear ? ` ${date.getUTCFullYear()}` : "";

  return `${day} ${dateNumber} ${month}${year}`;
};

export const getWeekLabel = (date) => {
  const closing = toDate(date);
  if (!closing) return "N/A";

  closing.setUTCHours(0, 0, 0, 0);

  const opening = new Date(closing);
  opening.setUTCDate(closing.getUTCDate() - 7);

  return `${formatGhanaWeekDate(opening)} 3:00pm - ${formatGhanaWeekDate(
    closing,
    true
  )} 2:59pm`;
};

export const isPortalOpen = (portalStatus) => {
  return portalStatus?.isOpen === true;
};

export const formatWeekReference = (date) => {
  const d = toDate(date);
  if (!d) return "N/A";
  d.setUTCHours(0, 0, 0, 0);
  return `Week of ${formatGhanaWeekDate(d, true)}`;
};
