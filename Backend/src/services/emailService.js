import { resendClient as resend } from "../config/resend.js";
import { env } from "../config/env.js";

const FROM = env.resendFrom || "noreply@yachalhousegh.com";
const APP_URL = env.clientUrl || "https://yachalhousegh.com";

const send = async ({ to, subject, html }) => {
  try {
    await resend.emails.send({ from: `Yachal House <${FROM}>`, to, subject, html });
  } catch (err) {
    console.error("Email send error:", err.message);
  }
};

const base = (content) => `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <tr><td style="background:#1e0a3c;padding:24px 32px;">
        <p style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;">Yachal House</p>
        <p style="margin:4px 0 0;color:#c4b5fd;font-size:13px;">Ridge, Accra, Ghana</p>
      </td></tr>
      <tr><td style="padding:32px;">${content}</td></tr>
      <tr><td style="background:#f3f4f6;padding:16px 32px;text-align:center;">
        <p style="margin:0;color:#9ca3af;font-size:12px;">Yachal House Church Management System</p>
        <p style="margin:4px 0 0;color:#9ca3af;font-size:12px;">${APP_URL}</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

export const sendAccountApprovedEmail = async (worker) => {
  await send({
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
  await send({
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
  await send({
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
  for (const worker of workers) {
    await send({
      to: worker.email,
      subject: "Report portal is now open",
      html: base(`
        <h2 style="margin:0 0 16px;color:#1f2937;font-size:22px;">Portal is Open</h2>
        <p style="color:#374151;font-size:15px;line-height:1.6;">Dear ${worker.fullName}, the Yachal House report submission portal is now open.</p>
        <p style="color:#374151;font-size:15px;line-height:1.6;">You can submit your weekly report until <strong>Monday at 2:59pm</strong>. Your drafts are saved automatically.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${APP_URL}/portal/submit-report" style="background:#4c1d95;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">Submit Report</a>
        </div>
      `),
    });
  }
};

export const sendPortalClosingEmail = async (workers) => {
  for (const worker of workers) {
    await send({
      to: worker.email,
      subject: "Reminder: Portal closes at 2:59pm today",
      html: base(`
        <h2 style="margin:0 0 16px;color:#1f2937;font-size:22px;">Portal Closing Today</h2>
        <p style="color:#374151;font-size:15px;line-height:1.6;">Dear ${worker.fullName}, this is a reminder that the report submission portal closes today at <strong>2:59pm Ghana time</strong>.</p>
        <p style="color:#374151;font-size:15px;line-height:1.6;">If you have not submitted your report yet, please do so now. The portal will reopen on <strong>Friday at midnight</strong>.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${APP_URL}/portal/submit-report" style="background:#dc2626;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">Submit Now</a>
        </div>
      `),
    });
  }
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
      <a href="${APP_URL}/admin/qualification" style="background:#4c1d95;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">View Full Results</a>
    </div>
  `);

  for (const r of recipients) {
    await send({ to: r.email, subject: "Weekly Qualification Results", html });
  }
};

export const sendRosterPublishedEmail = async (workers) => {
  for (const worker of workers) {
    await send({
      to: worker.email,
      subject: "Your duty roster has been published",
      html: base(`
        <h2 style="margin:0 0 16px;color:#1f2937;font-size:22px;">Roster Published</h2>
        <p style="color:#374151;font-size:15px;line-height:1.6;">Dear ${worker.fullName}, the duty roster for the upcoming service has been published. Check the portal to see your assignment.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${APP_URL}/portal/dashboard" style="background:#4c1d95;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">View Dashboard</a>
        </div>
      `),
    });
  }
};

export const sendPasswordResetRequestEmail = async (admins, worker) => {
  for (const admin of admins) {
    await send({
      to: admin.email,
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
    });
  }
};

export const sendFrontDeskReportEmail = async (recipients, session, stats, attendance, isAuto = false) => {
  const serviceLabel = session.serviceType.charAt(0).toUpperCase() + session.serviceType.slice(1);
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
    <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">${serviceLabel} Service - ${dateStr}${isAuto ? " (Auto-closed after 4 hours)" : ""}</p>

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

  for (const r of recipients) {
    await send({ to: r.email, subject: `Front Desk Report - ${serviceLabel} Service, ${dateStr}`, html });
  }
};