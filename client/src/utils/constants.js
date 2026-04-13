export const ROLES = {
  PASTOR: "pastor",
  ADMIN: "admin",
  MODERATOR: "moderator",
  WORKER: "worker",
};

export const ADMIN_ROLES = [ROLES.PASTOR, ROLES.ADMIN, ROLES.MODERATOR];

export const REPORT_TYPES = [
  { value: "evangelism", label: "Evangelism and Follow-up" },
  { value: "cell", label: "Cell Report" },
  { value: "production", label: "Production Report" },
  { value: "fellowship-prayer", label: "Fellowship Prayer Report" },
  { value: "brief", label: "Brief Report" },
  { value: "departmental", label: "Departmental Report" },
];

export const SERVICE_TYPES = [
  { value: "tuesday", label: "Tuesday Service" },
  { value: "sunday", label: "Sunday Service" },
  { value: "special", label: "Special Service" },
];

export const DEPARTMENTS = [
  { value: "song-ministration", label: "Song Ministration" },
  { value: "media", label: "Media" },
  { value: "security", label: "Security" },
  { value: "sunday-school", label: "Sunday School" },
  { value: "ushering", label: "Ushering" },
  { value: "projection", label: "Projection" },
  { value: "brief-writing", label: "Brief Writing" },
  { value: "production", label: "Production" },
  { value: "service-coordination", label: "Service Coordination" },
  { value: "front-desk", label: "Front Desk" },
  { value: "evangelism", label: "Evangelism" },
  { value: "cell", label: "Cell" },
  { value: "unassigned", label: "Unassigned" },
];

export const SOUL_STATUSES = [
  { value: "saved", label: "Got saved" },
  { value: "filled", label: "Got saved and filled" },
  { value: "saved-not-filled", label: "Got saved but not yet filled" },
  { value: "already-saved", label: "Already saved and filled" },
  { value: "already-saved-not-filled", label: "Already saved but not yet filled" },
];

export const NOTIFICATION_TYPES = {
  PORTAL_OPEN: "portal-open",
  PORTAL_CLOSING_SOON: "portal-closing-soon",
  PORTAL_CLOSED: "portal-closed",
  REPORT_SUBMITTED: "report-submitted",
  ACCOUNT_APPROVED: "account-approved",
  ACCOUNT_SUSPENDED: "account-suspended",
  ROSTER_PUBLISHED: "roster-published",
  PERMISSION_REQUEST: "permission-request",
  QUALIFICATION_RESULT: "qualification-result",
  GENERAL: "general",
};

export const QUALIFICATION_CRITERIA = {
  MIN_SOULS:            10, // 30pts — souls preached to
  MIN_FELLOWSHIP_HOURS: 2,  // 10pts — hours of fellowship prayer
  MIN_CHURCH_ATTENDEES: 4,  // 20pts — people 12+ brought to church
  // Tuesday service:  10pts — worker attended
  // Sunday service:   10pts — worker attended
  // Cell meeting:     20pts — worker attended at least once (boolean)
  // Total:           100pts — all must pass to fully qualify
};

export const PORTAL_SCHEDULE = {
  OPENS: "Friday midnight",
  CLOSES: "Monday 2:59pm",
  TIMEZONE: "Africa/Accra",
};

export const WORKER_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  SUSPENDED: "suspended",
};