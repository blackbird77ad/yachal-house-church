import { format, formatDistanceToNow, isValid, parseISO, startOfWeek, endOfWeek } from "date-fns";

export const formatDate = (date, pattern = "dd MMM yyyy") => {
  if (!date) return "N/A";
  const d = typeof date === "string" ? parseISO(date) : new Date(date);
  if (!isValid(d)) return "Invalid date";
  return format(d, pattern);
};

export const formatDateTime = (date) => {
  if (!date) return "N/A";
  const d = typeof date === "string" ? parseISO(date) : new Date(date);
  if (!isValid(d)) return "Invalid date";
  return format(d, "dd MMM yyyy, hh:mm a");
};

export const formatTime = (date) => {
  if (!date) return "N/A";
  const d = typeof date === "string" ? parseISO(date) : new Date(date);
  if (!isValid(d)) return "Invalid time";
  return format(d, "hh:mm a");
};

export const timeAgo = (date) => {
  if (!date) return "";
  const d = typeof date === "string" ? parseISO(date) : new Date(date);
  if (!isValid(d)) return "";
  return formatDistanceToNow(d, { addSuffix: true });
};

// Returns the closing Monday of the current portal week
// Portal week: Monday 3:00pm → next Monday 2:59pm
// Submission window: Friday midnight → Monday 2:59pm
// weekReference on all reports = the Monday that closes the window
export const getWeekReference = (now = new Date()) => {
  const d   = new Date(now);
  const day = d.getDay(); // 0=Sun, 1=Mon
  const diff = day === 0 ? -6 : 1 - day;
  const thisMonday = new Date(d);
  thisMonday.setDate(d.getDate() + diff);
  thisMonday.setHours(0, 0, 0, 0);
  const nextMonday = new Date(thisMonday);
  nextMonday.setDate(thisMonday.getDate() + 7);
  // Monday before 2:59pm → this Monday closes the current window
  if (day === 1 && d.getHours() < 15) return thisMonday;
  // All other times → next Monday closes the window
  return nextMonday;
};

// Returns the closing Monday of the PREVIOUS portal week (for arrears)
export const getPreviousWeekReference = () => {
  const current = getWeekReference();
  const prev = new Date(current);
  prev.setDate(prev.getDate() - 7);
  prev.setHours(0, 0, 0, 0);
  return prev;
};

export const getWeekLabel = (date) => {
  const d = new Date(date);
  const start = startOfWeek(d, { weekStartsOn: 1 });
  const end = endOfWeek(d, { weekStartsOn: 1 });
  return `${format(start, "dd MMM")} - ${format(end, "dd MMM yyyy")}`;
};

export const isPortalOpen = (portalStatus) => {
  return portalStatus?.isOpen === true;
};

export const formatWeekReference = (date) => {
  if (!date) return "N/A";
  return `Week of ${formatDate(date, "dd MMM yyyy")}`;
};