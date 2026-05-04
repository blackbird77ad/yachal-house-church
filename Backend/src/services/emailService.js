import { resendClient as resend } from "../config/resend.js";
import { env } from "../config/env.js";

const FROM = env.resendFrom || "noreply@yachalhousegh.com";
const APP_URL = env.clientUrl || "https://yachalhousegh.com";
const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const escapeHtml = (value = "") =>
  value
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const resolveAppLink = (link = "") => {
  if (!link) return APP_URL;
  if (/^https?:\/\//i.test(link)) return link;
  return `${APP_URL}${link.startsWith("/") ? link : `/${link}`}`;
};

export const isValidEmailAddress = (value = "") =>
  EMAIL_ADDRESS_PATTERN.test(value.toString().trim());

const formatFrontDeskSessionLabel = (session = {}) => {
  if (session?.serviceType === "special") {
    return session?.specialServiceName
      ? `Special Service - ${session.specialServiceName}`
      : "Special Service";
  }

  const rawType = session?.serviceType || "service";
  return `${rawType.charAt(0).toUpperCase()}${rawType.slice(1)} Service`;
};

const send = async ({ to, subject, html }) => {
  try {
    const response = await resend.emails.send({
      from: `Yachal House <${FROM}>`,
      to,
      subject,
      html,
    });

    const apiError =
      response?.error?.message ||
      response?.error ||
      null;

    if (apiError) {
      console.error(`Email send error to ${to}:`, apiError);
      return {
        ok: false,
        to,
        error: String(apiError),
        response,
      };
    }

    return {
      ok: true,
      to,
      id: response?.data?.id || response?.id || null,
      response,
    };
  } catch (err) {
    console.error(`Email send error to ${to}:`, err.message);
    return {
      ok: false,
      to,
      error: err.message,
    };
  }
};

const normalizeEmailRecipients = (recipients) => {
  const list = Array.isArray(recipients) ? recipients : [recipients];

  return list.filter((recipient) => {
    const email = recipient?.email?.toString?.().trim?.() || "";
    if (!email) return false;

    if (!isValidEmailAddress(email)) {
      console.warn(`Skipping invalid email address: ${email}`);
      return false;
    }

    return true;
  });
};

const isQuotaError = (error = "") => {
  const normalized = String(error || "").toLowerCase();
  return (
    normalized.includes("daily email sending quota") ||
    normalized.includes("daily_quota_exceeded") ||
    normalized.includes("monthly_quota_exceeded")
  );
};

const summarizeBatchResults = (results = []) => {
  const failed = results.filter((result) => !result.ok);

  return {
    ok: failed.length === 0,
    results,
    sentCount: results.filter((result) => result.ok).length,
    failedCount: failed.length,
    deliveredTo: results
      .filter((result) => result.ok && result.to)
      .map((result) => String(result.to).toLowerCase()),
    errorMessages: failed.map((result) =>
      result.to ? `${result.to}: ${result.error}` : result.error
    ),
  };
};

const sendEmailBatch = async (recipients, buildMessage) => {
  const recipientList = normalizeEmailRecipients(recipients);
  const deliveries = [];

  for (let index = 0; index < recipientList.length; index += 1) {
    const recipient = recipientList[index];
    const message = buildMessage(recipient);
    const result = await send({ to: recipient.email, ...message });
    deliveries.push(result);

    if (isQuotaError(result?.error)) {
      const remainingRecipients = recipientList.slice(index + 1);
      remainingRecipients.forEach((pendingRecipient) => {
        deliveries.push({
          ok: false,
          to: pendingRecipient.email,
          error: "Email sending paused after quota was reached.",
        });
      });
      break;
    }
  }

  return summarizeBatchResults(deliveries);
};

const LOGO_URL = "https://yachalhousegh.com/yahal.png";

const base = (content) => `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;max-width:560px;">

      <!-- Header with logo -->
      <tr><td style="background:#1e0a3c;padding:24px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align:middle;">
              <img
                src="${LOGO_URL}"
                alt="Yachal House"
                width="54"
                height="54"
                style="display:block;border-radius:10px;object-fit:cover;"
              />
            </td>
            <td style="vertical-align:middle;padding-left:14px;">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:0.3px;">Yachal House</p>
              <p style="margin:3px 0 0;color:#c4b5fd;font-size:12px;">Ridge, Accra · yachalhousegh.com</p>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Body -->
      <tr><td style="padding:32px;">${content}</td></tr>

      <!-- Footer -->
      <tr><td style="background:#f3f4f6;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
        <img src="${LOGO_URL}" alt="" width="28" height="28" style="border-radius:6px;margin-bottom:8px;display:block;margin-left:auto;margin-right:auto;" />
        <p style="margin:0;color:#6b7280;font-size:12px;font-weight:600;">Yachal House Church Management System</p>
        <p style="margin:4px 0 0;color:#9ca3af;font-size:11px;">Impacting the world with HOPE</p>
        <p style="margin:8px 0 0;"><a href="${APP_URL}" style="color:#6d28d9;font-size:11px;text-decoration:none;">${APP_URL}</a></p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;

export const sendAccountApprovedEmail = async (worker) => {
  return send({
    to: worker.email,
    subject: "Your Yachal House account has been approved",
    html: base(`
      <h2 style="margin:0 0 16px;color:#1f2937;font-size:22px;">Welcome, ${worker.fullName}!</h2>
      <p style="color:#374151;font-size:15px;line-height:1.6;">Your Yachal House worker account has been approved. Your permanent Worker ID has been assigned.</p>
      <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:20px;margin:24px 0;text-align:center;">
        <p style="margin:0 0 4px;color:#6b7280;font-size:13px;">Your Worker ID</p>
        <p style="margin:0;color:#4c1d95;font-size:36px;font-weight:bold;letter-spacing:4px;">${worker.workerId}</p>
        <p style="margin:8px 0 0;color:#6b7280;font-size:12px;">Keep this ID safe. You will need it for front desk check-in.</p>
      </div>
      <p style="color:#374151;font-size:15px;line-height:1.6;">You can now sign in at the link below using the email and password you registered with.</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${APP_URL}/login" style="background:#4c1d95;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">Sign In Now</a>
      </div>
    `),
  });
};

export const sendAccountCreatedEmail = async (worker, tempPassword) => {
  return send({
    to: worker.email,
    subject: "Your Yachal House account is ready",
    html: base(`
      <h2 style="margin:0 0 16px;color:#1f2937;font-size:22px;">Welcome to Yachal House, ${worker.fullName}!</h2>
      <p style="color:#374151;font-size:15px;line-height:1.6;">Your worker account has been created by the admin team. Here are your login details.</p>
      <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:20px;margin:24px 0;">
        <table width="100%" cellpadding="6">
          <tr><td style="color:#6b7280;font-size:13px;width:140px;">Worker ID</td><td style="font-weight:bold;color:#4c1d95;font-size:18px;letter-spacing:2px;">${worker.workerId}</td></tr>
          <tr><td style="color:#6b7280;font-size:13px;">Email</td><td style="color:#1f2937;">${worker.email}</td></tr>
          <tr><td style="color:#6b7280;font-size:13px;">Temporary Password</td><td style="font-weight:bold;color:#1f2937;letter-spacing:1px;">${tempPassword}</td></tr>
        </table>
      </div>
      <p style="color:#dc2626;font-size:14px;font-weight:bold;">Please change your password after your first login.</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${APP_URL}/login" style="background:#4c1d95;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">Sign In Now</a>
      </div>
    `),
  });
};

export const sendBulkAccountCreatedEmail = async (worker, tempPassword) => {
  await sendAccountCreatedEmail(worker, tempPassword);
};

export const sendAccountSuspendedEmail = async (worker) => {
  return send({
    to: worker.email,
    subject: "Your Yachal House account has been suspended",
    html: base(`
      <h2 style="margin:0 0 16px;color:#1f2937;font-size:22px;">Account Suspended</h2>
      <p style="color:#374151;font-size:15px;line-height:1.6;">Dear ${worker.fullName}, your Yachal House worker account has been suspended.</p>
      <p style="color:#374151;font-size:15px;line-height:1.6;">If you believe this is an error or need clarification, please contact your admin team directly.</p>
      <p style="color:#374151;font-size:15px;line-height:1.6;">Phone: +233 544 600 600</p>
      <p style="color:#374151;font-size:15px;line-height:1.6;">Email: yachalhouse@gmail.com</p>
    `),
  });
};

export const sendPortalOpenEmail = async (workers) => {
  return sendEmailBatch(workers, (worker) => ({
    subject: "Report portal is now open",
    html: base(`
        <h2 style="margin:0 0 16px;color:#1f2937;font-size:22px;">Portal is Open</h2>
        <p style="color:#374151;font-size:15px;line-height:1.6;">Dear ${worker.fullName}, the Yachal House report submission portal is now open.</p>
        <p style="color:#374151;font-size:15px;line-height:1.6;">You can submit your weekly report until <strong>Monday at 2:59pm</strong>. Your drafts are saved automatically.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${APP_URL}/portal/submit-report" style="background:#4c1d95;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">Submit Report</a>
        </div>
      `),
  }));
};

export const sendPortalClosingEmail = async (workers) => {
  return sendEmailBatch(workers, (worker) => ({
    subject: "Reminder: Portal closes at 2:59pm today",
    html: base(`
        <h2 style="margin:0 0 16px;color:#1f2937;font-size:22px;">Portal Closing Today</h2>
        <p style="color:#374151;font-size:15px;line-height:1.6;">Dear ${worker.fullName}, this is a reminder that the report submission portal closes today at <strong>2:59pm Ghana time</strong>.</p>
        <p style="color:#374151;font-size:15px;line-height:1.6;">If you have not submitted your report yet, please do so now. The portal will reopen on <strong>Friday at midnight</strong>.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${APP_URL}/portal/submit-report" style="background:#dc2626;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">Submit Now</a>
        </div>
      `),
  }));
};

export const sendPortalTwentyFourHourReminderEmail = async (workers) => {
  return sendEmailBatch(workers, (worker) => ({
    subject: "Reminder: Portal closes in 24 hours",
    html: base(`
        <h2 style="margin:0 0 16px;color:#1f2937;font-size:22px;">Portal Closes In 24 Hours</h2>
        <p style="color:#374151;font-size:15px;line-height:1.6;">Dear ${worker.fullName}, this is a reminder that the report submission portal will close in <strong>24 hours</strong>.</p>
        <p style="color:#374151;font-size:15px;line-height:1.6;">The deadline is <strong>Monday at 2:59pm Ghana time</strong>. If you have not submitted your report yet, please do so before the deadline.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${APP_URL}/portal/submit-report" style="background:#b45309;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">Open Portal</a>
        </div>
      `),
  }));
};

export const sendPortalClosedEmail = async (workers, reason = "") => {
  return sendEmailBatch(workers, (worker) => ({
    subject: "Report portal is now closed",
    html: base(`
        <h2 style="margin:0 0 16px;color:#1f2937;font-size:22px;">Portal Closed</h2>
        <p style="color:#374151;font-size:15px;line-height:1.6;">Dear ${worker.fullName}, the Yachal House report submission portal is now closed.</p>
        <p style="color:#374151;font-size:15px;line-height:1.6;">Saved drafts remain available, but reports not submitted before the deadline count against weekly qualification.</p>
        ${reason ? `<p style="color:#6b7280;font-size:14px;line-height:1.6;">Reason: ${reason}</p>` : ""}
        <div style="text-align:center;margin:24px 0;">
          <a href="${APP_URL}/portal/my-reports" style="background:#111827;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">View My Reports</a>
        </div>
      `),
  }));
};

export const sendPortalDeadlineReminderEmail = async (workers) => {
  return sendEmailBatch(workers, (worker) => ({
    subject: "Reminder: report deadline is Monday 2:59pm",
    html: base(`
        <h2 style="margin:0 0 16px;color:#1f2937;font-size:22px;">Submission Deadline Reminder</h2>
        <p style="color:#374151;font-size:15px;line-height:1.6;">Dear ${worker.fullName}, the report portal closes today at <strong>Monday 2:59pm Ghana time</strong>.</p>
        <p style="color:#374151;font-size:15px;line-height:1.6;">If your report is not submitted before the deadline, it will count against your qualification for the week.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${APP_URL}/portal/submit-report" style="background:#dc2626;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">Submit Report</a>
        </div>
      `),
  }));
};

export const sendQualificationResultsEmail = async (recipients, qualifiedList, disqualifiedList) => {
  const formatList = (list, qualified) => list.map((m, i) =>
    `<tr style="background:${i % 2 === 0 ? "#ffffff" : "#f9fafb"};">
      <td style="padding:8px 12px;font-size:14px;color:#374151;">${i + 1}</td>
      <td style="padding:8px 12px;font-size:14px;color:#1f2937;font-weight:${i < 3 ? "bold" : "normal"};">${m.worker?.fullName || "Unknown"}</td>
      <td style="padding:8px 12px;font-size:14px;color:#6b7280;">${m.worker?.workerId || ""}</td>
      <td style="padding:8px 12px;font-size:14px;font-weight:bold;color:${qualified ? "#065f46" : "#991b1b"};">${m.totalScore || 0} pts</td>
    </tr>`
  ).join("");

  const html = base(`
    <h2 style="margin:0 0 8px;color:#1f2937;font-size:22px;">Weekly Qualification Results</h2>
    <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">Processed Monday at 2:59pm</p>
    <h3 style="color:#065f46;font-size:16px;margin:0 0 12px;">Qualified Workers (${qualifiedList.length})</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d1fae5;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <tr style="background:#d1fae5;"><th style="padding:8px 12px;text-align:left;font-size:13px;color:#065f46;">#</th><th style="padding:8px 12px;text-align:left;font-size:13px;color:#065f46;">Name</th><th style="padding:8px 12px;text-align:left;font-size:13px;color:#065f46;">ID</th><th style="padding:8px 12px;text-align:left;font-size:13px;color:#065f46;">Score</th></tr>
      ${qualifiedList.length > 0 ? formatList(qualifiedList, true) : '<tr><td colspan="4" style="padding:12px;text-align:center;color:#6b7280;font-size:14px;">No qualified workers this week.</td></tr>'}
    </table>
    <h3 style="color:#991b1b;font-size:16px;margin:0 0 12px;">Not Qualified (${disqualifiedList.length})</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #fee2e2;border-radius:8px;overflow:hidden;">
      <tr style="background:#fee2e2;"><th style="padding:8px 12px;text-align:left;font-size:13px;color:#991b1b;">#</th><th style="padding:8px 12px;text-align:left;font-size:13px;color:#991b1b;">Name</th><th style="padding:8px 12px;text-align:left;font-size:13px;color:#991b1b;">ID</th><th style="padding:8px 12px;text-align:left;font-size:13px;color:#991b1b;">Score</th></tr>
      ${disqualifiedList.length > 0 ? formatList(disqualifiedList, false) : '<tr><td colspan="4" style="padding:12px;text-align:center;color:#6b7280;font-size:14px;">All workers qualified this week.</td></tr>'}
    </table>
    <div style="text-align:center;margin:28px 0 0;">
      <a href="${APP_URL}/admin/qualification" style="background:#4c1d95;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block;margin:0 6px 12px;">View Qualification List</a>
      <a href="${APP_URL}/admin/roster" style="background:#111827;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block;margin:0 6px 12px;">Prepare Roster</a>
    </div>
  `);

  return sendEmailBatch(recipients, () => ({
    subject: "Weekly Qualification Results",
    html,
  }));
};

export const sendNoFrontDeskLoggingAlertEmail = async (recipients, weekReference) => {
  const weekLabel = new Date(weekReference).toLocaleDateString("en-GH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const html = base(`
    <h2 style="margin:0 0 12px;color:#1f2937;font-size:22px;">No Front Desk Logging Recorded</h2>
    <p style="color:#374151;font-size:15px;line-height:1.6;">No attendance data was received or supervised by the worker on front desk duty for the reporting week that closed on <strong>${weekLabel}</strong>.</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;">Workers had to enter their own service reporting time inside the evangelism and follow-up report. Attendance for that week should be treated as incomplete and not fully accurate.</p>
    <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:8px;padding:16px;margin:24px 0;">
      <p style="margin:0;color:#9a3412;font-size:14px;font-weight:600;">Follow-up note</p>
      <p style="margin:8px 0 0;color:#7c2d12;font-size:14px;line-height:1.6;">If no worker was assigned to front desk, or the front desk team did not use the login system throughout the week, qualification review and roster preparation should be checked with that limitation in mind.</p>
    </div>
    <div style="text-align:center;margin:24px 0 0;">
      <a href="${APP_URL}/admin/qualification" style="background:#4c1d95;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block;margin:0 6px 12px;">View Qualification List</a>
      <a href="${APP_URL}/admin/roster" style="background:#111827;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block;margin:0 6px 12px;">Prepare Roster</a>
    </div>
  `);

  return sendEmailBatch(recipients, () => ({
    subject: "No Front Desk Logging Recorded This Week",
    html,
  }));
};

export const sendWeeklyFrontDeskSummaryEmail = async (recipients, weeklySummary = {}) => {
  const sessions = Array.isArray(weeklySummary.sessions) ? weeklySummary.sessions : [];
  const hasUsableLogging = !!weeklySummary.hasUsableLogging;
  const opensAtLabel = weeklySummary.opensAt
    ? new Date(weeklySummary.opensAt).toLocaleString("en-GH", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const closesAtLabel = weeklySummary.closesAt
    ? new Date(weeklySummary.closesAt).toLocaleString("en-GH", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const sessionRows = sessions
    .map((session, index) => {
      const serviceLabel = escapeHtml(formatFrontDeskSessionLabel(session));
      const dateLabel = session.serviceDate
        ? new Date(session.serviceDate).toLocaleString("en-GH", {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Unknown date";

      let statusLabel = "Closed manually";
      if (session.isOpen) {
        statusLabel = "Still open at weekly close";
      } else if (session.closedBy === "auto") {
        statusLabel = "Auto-closed after inactivity";
      } else if (session.closedBy === "force") {
        statusLabel = "Force closed";
      }

      const supervisorLabel = session.supervisorWorkerId
        ? `${session.supervisorName} (${session.supervisorWorkerId})`
        : session.supervisorName || "Unassigned";
      const loggingNote =
        session.workerCheckIns > 0
          ? `${session.workerCheckIns} worker check-in(s) recorded`
          : "No worker attendance data captured";

      return `
        <tr style="background:${index % 2 === 0 ? "#ffffff" : "#f9fafb"};">
          <td style="padding:8px 10px;font-size:13px;color:#374151;">${index + 1}</td>
          <td style="padding:8px 10px;font-size:13px;color:#111827;font-weight:600;">${serviceLabel}</td>
          <td style="padding:8px 10px;font-size:13px;color:#4b5563;">${dateLabel}</td>
          <td style="padding:8px 10px;font-size:13px;color:#4b5563;">${escapeHtml(supervisorLabel)}</td>
          <td style="padding:8px 10px;font-size:13px;color:#111827;font-weight:600;">${session.totalCheckedIn || 0}</td>
          <td style="padding:8px 10px;font-size:13px;color:#111827;">${session.late || 0}</td>
          <td style="padding:8px 10px;font-size:12px;color:${session.workerCheckIns > 0 ? "#065f46" : "#991b1b"};">${loggingNote}</td>
          <td style="padding:8px 10px;font-size:12px;color:#6b7280;">${statusLabel}</td>
        </tr>
      `;
    })
    .join("");

  const intro = hasUsableLogging
    ? `<p style="color:#374151;font-size:15px;line-height:1.6;">Front desk attendance has been grouped for the completed system week. ${weeklySummary.workerCheckIns || 0} worker check-in(s) were recorded across ${weeklySummary.sessionCount || 0} service session(s).</p>`
    : `<p style="color:#374151;font-size:15px;line-height:1.6;">No attendance data was received or supervised by the worker on front desk duty during this completed system week.</p>`;

  const noDataPanel = !hasUsableLogging
    ? `
      <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:8px;padding:16px;margin:20px 0;">
        <p style="margin:0;color:#9a3412;font-size:14px;font-weight:700;">Attendance warning</p>
        <p style="margin:8px 0 0;color:#7c2d12;font-size:14px;line-height:1.6;">${
          sessions.length > 0
            ? `Front desk was opened for ${sessions.length} service session(s), but no usable worker attendance records were captured through the login system.`
            : "No front desk session was opened for this system week."
        }</p>
        <p style="margin:8px 0 0;color:#7c2d12;font-size:14px;line-height:1.6;">Qualification review and roster preparation should be checked with that limitation in mind.</p>
      </div>
    `
    : "";

  const html = base(`
    <h2 style="margin:0 0 8px;color:#1f2937;font-size:22px;">${
      hasUsableLogging
        ? "Weekly Front Desk Attendance Summary"
        : "No Front Desk Attendance Data Received"
    }</h2>
    <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">System week: <strong>${opensAtLabel}</strong> to <strong>${closesAtLabel}</strong></p>
    ${intro}

    <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:18px;margin:24px 0;">
      <table width="100%" cellpadding="6" cellspacing="0">
        <tr>
          <td style="font-size:13px;color:#6b7280;width:180px;">Front desk sessions</td>
          <td style="font-size:16px;font-weight:700;color:#111827;">${weeklySummary.sessionCount || 0}</td>
        </tr>
        <tr>
          <td style="font-size:13px;color:#6b7280;">Worker check-ins recorded</td>
          <td style="font-size:16px;font-weight:700;color:${hasUsableLogging ? "#065f46" : "#991b1b"};">${weeklySummary.workerCheckIns || 0}</td>
        </tr>
        <tr>
          <td style="font-size:13px;color:#6b7280;">Total attendance rows</td>
          <td style="font-size:16px;font-weight:700;color:#111827;">${weeklySummary.totalCheckedIn || 0}</td>
        </tr>
      </table>
    </div>

    ${noDataPanel}

    ${
      sessions.length > 0
        ? `
      <h3 style="font-size:16px;color:#1f2937;margin:0 0 12px;">Service-by-service summary</h3>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
        <tr style="background:#f3f4f6;">
          <th style="padding:8px 10px;text-align:left;font-size:12px;color:#6b7280;">#</th>
          <th style="padding:8px 10px;text-align:left;font-size:12px;color:#6b7280;">Service</th>
          <th style="padding:8px 10px;text-align:left;font-size:12px;color:#6b7280;">Date</th>
          <th style="padding:8px 10px;text-align:left;font-size:12px;color:#6b7280;">Supervisor</th>
          <th style="padding:8px 10px;text-align:left;font-size:12px;color:#6b7280;">Total</th>
          <th style="padding:8px 10px;text-align:left;font-size:12px;color:#6b7280;">Late</th>
          <th style="padding:8px 10px;text-align:left;font-size:12px;color:#6b7280;">Logging</th>
          <th style="padding:8px 10px;text-align:left;font-size:12px;color:#6b7280;">Status</th>
        </tr>
        ${sessionRows}
      </table>
    `
        : ""
    }

    <div style="text-align:center;margin:24px 0 0;">
      <a href="${APP_URL}/admin/attendance" style="background:#4c1d95;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block;margin:0 6px 12px;">View Attendance</a>
      <a href="${APP_URL}/admin/qualification" style="background:#111827;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block;margin:0 6px 12px;">View Qualification</a>
    </div>
  `);

  return sendEmailBatch(recipients, () => ({
    subject: hasUsableLogging
      ? "Weekly Front Desk Attendance Summary"
      : "No Front Desk Attendance Data Received This Week",
    html,
  }));
};

export const sendGenericNotificationEmail = async (
  recipients,
  {
    subject,
    title,
    message,
    link,
    linkLabel = "Open System",
  } = {}
) => {
  const recipientList = normalizeEmailRecipients(recipients);
  const safeSubject = escapeHtml(subject || title || "Yachal House Notification");
  const safeTitle = escapeHtml(title || subject || "Notification");
  const safeMessage = escapeHtml(message || "You have a new notification in Yachal House.");
  const safeLinkLabel = escapeHtml(linkLabel || "Open System");
  const resolvedLink = resolveAppLink(link);

  return sendEmailBatch(recipientList, (recipient) => {
    const safeName = escapeHtml(recipient.fullName || "Worker");

    return {
      subject: safeSubject,
      html: base(`
        <h2 style="margin:0 0 16px;color:#1f2937;font-size:22px;">${safeTitle}</h2>
        <p style="color:#374151;font-size:15px;line-height:1.6;">Dear ${safeName},</p>
        <p style="color:#374151;font-size:15px;line-height:1.6;">${safeMessage}</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${resolvedLink}" style="background:#4c1d95;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">${safeLinkLabel}</a>
        </div>
      `),
    };
  });
};

export const sendRosterPublishedEmail = async (
  workers,
  roster,
  assignments = [],
  { isRepublish = false } = {}
) => {
  const recipientList = Array.isArray(workers) ? workers : [workers];
  const serviceLabel = roster?.serviceType
    ? `${roster.serviceType.charAt(0).toUpperCase()}${roster.serviceType.slice(1)} Service`
    : "Duty Roster";
  const dateLabel = roster?.serviceDate
    ? new Date(roster.serviceDate).toLocaleString("en-GH", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Upcoming service";

  const assignmentLines = Array.isArray(assignments)
    ? assignments
        .map(
          (assignment) =>
            `<li style="margin:0 0 6px;">${assignment.department?.replace(/-/g, " ")}${assignment.subRole ? ` (${assignment.subRole})` : ""}${assignment.isCoordinator ? " - Coordinator" : ""}</li>`
        )
        .join("")
    : "";

  for (const worker of recipientList) {
    if (!worker?.email) continue;

    await send({
      to: worker.email,
      subject: isRepublish
        ? "Your duty roster has been updated"
        : "Your duty roster has been published",
      html: base(`
        <h2 style="margin:0 0 16px;color:#1f2937;font-size:22px;">${isRepublish ? "Roster Updated" : "Roster Published"}</h2>
        <p style="color:#374151;font-size:15px;line-height:1.6;">Dear ${worker.fullName}, ${isRepublish ? "the duty roster has been updated. Please check the portal again because your assignment may have changed." : "the duty roster for the upcoming service has been published. Check the portal to see your assignment."}</p>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:20px 0;">
          <p style="margin:0 0 6px;color:#111827;font-size:14px;font-weight:bold;">${serviceLabel}</p>
          <p style="margin:0 0 6px;color:#4b5563;font-size:14px;">Service date: ${dateLabel}</p>
          ${roster?.specialServiceName ? `<p style="margin:0 0 6px;color:#4b5563;font-size:14px;">Special service: ${roster.specialServiceName}</p>` : ""}
          ${roster?.notes ? `<p style="margin:0;color:#4b5563;font-size:14px;">Notes: ${roster.notes}</p>` : ""}
        </div>
        ${assignmentLines ? `
          <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:16px;margin:20px 0;">
            <p style="margin:0 0 10px;color:#4c1d95;font-size:14px;font-weight:bold;">Your current assignment${assignments.length > 1 ? "s" : ""}</p>
            <ul style="margin:0;padding-left:18px;color:#374151;font-size:14px;line-height:1.6;">
              ${assignmentLines}
            </ul>
          </div>
        ` : `
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:20px 0;">
            <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;">You do not currently have a department assignment on this roster, but you can still open the portal to view the full published roster.</p>
          </div>
        `}
        <div style="text-align:center;margin:24px 0;">
          <a href="${APP_URL}/portal/roster" style="background:#4c1d95;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">View Full Roster</a>
        </div>
      `),
    });
  }
};

export const sendPasswordResetRequestEmail = async (admins, worker) => {
  return sendEmailBatch(admins, () => ({
    subject: `Password reset request from ${worker.fullName}`,
    html: base(`
        <h2 style="margin:0 0 16px;color:#1f2937;font-size:22px;">Password Reset Request</h2>
        <p style="color:#374151;font-size:15px;line-height:1.6;">The following worker has requested a password reset:</p>
        <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:16px;margin:20px 0;">
          <p style="margin:0 0 4px;"><strong>Name:</strong> ${worker.fullName}</p>
          <p style="margin:0 0 4px;"><strong>Email:</strong> ${worker.email}</p>
          <p style="margin:0;"><strong>Worker ID:</strong> ${worker.workerId || "Not yet assigned"}</p>
        </div>
        <p style="color:#374151;font-size:15px;line-height:1.6;">Please log in to the admin dashboard and reset their password from the Workers section.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${APP_URL}/admin/workers" style="background:#4c1d95;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">Go to Workers</a>
        </div>
      `),
  }));
};

export const sendFrontDeskReportEmail = async (recipients, session, stats, attendance, isAuto = false) => {
  const serviceLabel = formatFrontDeskSessionLabel(session);
  const safeServiceLabel = escapeHtml(serviceLabel);
  const dateStr = new Date(session.serviceDate).toLocaleDateString("en-GH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const startTime = new Date(session.serviceStartTime).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" });
  const closedTime = session.closedAt ? new Date(session.closedAt).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" }) : "N/A";
  const supervisorCheckIn = session.supervisorCheckInTime ? new Date(session.supervisorCheckInTime).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" }) : "N/A";
  const deputyLine = session.isDeputy && session.deputyFor
    ? `<tr><td style="padding:4px 0;font-size:13px;color:#6b7280;width:160px;">Deputy Cover</td><td style="font-size:14px;font-weight:600;color:#b45309;">${session.primarySupervisor?.fullName || "Unknown"} covered for ${session.deputyFor}</td></tr>`
    : "";

  const timingRows = [
    { label: "60+ mins early",   value: stats.early60Plus,  color: "#065f46" },
    { label: "30-60 mins early", value: stats.early30to60,  color: "#0369a1" },
    { label: "15-30 mins early", value: stats.early15to30,  color: "#6d28d9" },
    { label: "0-15 mins early",  value: stats.early0to15,   color: "#92400e" },
    { label: "Late (after start)", value: stats.late,       color: "#991b1b" },
  ].map((row) => `
    <tr>
      <td style="padding:8px 12px;font-size:14px;color:#374151;">${row.label}</td>
      <td style="padding:8px 12px;font-size:16px;font-weight:bold;color:${row.color};">${row.value}</td>
    </tr>
  `).join("");

  const workerRows = attendance.slice(0, 30).map((a, i) => {
    const t = new Date(a.checkInTime).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" });
    const bg = i % 2 === 0 ? "#ffffff" : "#f9fafb";
    const badge = a.timingCategory === "late" ? "🔴 Late" : a.timingCategory === "early-60plus" ? "🟢 60+ early" : "🟡 On time";
    return `<tr style="background:${bg};">
      <td style="padding:6px 10px;font-size:13px;">${i + 1}</td>
      <td style="padding:6px 10px;font-size:13px;font-weight:500;">${a.worker?.fullName || "Unknown"}</td>
      <td style="padding:6px 10px;font-size:13px;color:#6b7280;">${a.worker?.workerId || ""}</td>
      <td style="padding:6px 10px;font-size:13px;">${t}</td>
      <td style="padding:6px 10px;font-size:12px;">${badge}</td>
    </tr>`;
  }).join("");

  const html = base(`
    <h2 style="margin:0 0 4px;color:#1f2937;font-size:22px;">Front Desk Report</h2>
    <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">${safeServiceLabel} - ${dateStr}${isAuto ? " (Auto-closed after 4 hours of inactivity)" : ""}</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="padding:4px 0;font-size:13px;color:#6b7280;width:160px;">Service Start Time</td>
        <td style="font-size:14px;font-weight:600;color:#1f2937;">${startTime}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;font-size:13px;color:#6b7280;">Session Closed</td>
        <td style="font-size:14px;font-weight:600;color:#1f2937;">${closedTime}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;font-size:13px;color:#6b7280;">Supervisor</td>
        <td style="font-size:14px;font-weight:600;color:#1f2937;">${session.primarySupervisor?.fullName || "N/A"} (arrived ${supervisorCheckIn})</td>
      </tr>
    </table>

    <h3 style="font-size:16px;color:#1f2937;margin:0 0 12px;">Attendance Summary</h3>
    <div style="background:#f5f3ff;border-radius:8px;padding:16px;text-align:center;margin-bottom:20px;">
      <p style="margin:0;font-size:40px;font-weight:bold;color:#4c1d95;">${stats.totalCheckedIn}</p>
      <p style="margin:4px 0 0;color:#6b7280;font-size:13px;">Total Workers Checked In</p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <tr style="background:#f3f4f6;">
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;">Timing</th>
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;">Count</th>
      </tr>
      ${timingRows}
    </table>

    ${attendance.length > 0 ? `
    <h3 style="font-size:16px;color:#1f2937;margin:0 0 12px;">Worker Check-in List</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <tr style="background:#f3f4f6;">
        <th style="padding:6px 10px;text-align:left;font-size:12px;color:#6b7280;">#</th>
        <th style="padding:6px 10px;text-align:left;font-size:12px;color:#6b7280;">Name</th>
        <th style="padding:6px 10px;text-align:left;font-size:12px;color:#6b7280;">ID</th>
        <th style="padding:6px 10px;text-align:left;font-size:12px;color:#6b7280;">Time</th>
        <th style="padding:6px 10px;text-align:left;font-size:12px;color:#6b7280;">Status</th>
      </tr>
      ${workerRows}
      ${attendance.length > 30 ? `<tr><td colspan="5" style="padding:8px;text-align:center;font-size:12px;color:#6b7280;">... and ${attendance.length - 30} more. View full report in the dashboard.</td></tr>` : ""}
    </table>
    ` : ""}

    <div style="text-align:center;margin:20px 0 0;">
      <a href="${APP_URL}/admin/attendance" style="background:#4c1d95;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">View Full Report</a>
    </div>
  `);

  return sendEmailBatch(recipients, () => ({
    subject: `Front Desk Report - ${serviceLabel}, ${dateStr}`,
    html,
  }));
};
