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

export const getWeekReference = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

export const getPreviousWeekReference = () => {
  const current = getWeekReference();
  const prev = new Date(current);
  prev.setDate(prev.getDate() - 7);
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