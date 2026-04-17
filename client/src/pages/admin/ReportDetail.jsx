import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { getReportById } from "../../services/reportService";
import Loader from "../../components/common/Loader";
import { formatDate, formatDateTime, getWeekLabel } from "../../utils/formatDate";
import { REPORT_TYPES, SOUL_STATUSES } from "../../utils/constants";

// ── Print styles injected once ────────────────────────────────────────────────
const PRINT_STYLE = `
@media print {
  body * { visibility: hidden !important; }
  #report-print-area, #report-print-area * { visibility: visible !important; }
  #report-print-area {
    position: fixed !important;
    top: 0; left: 0;
    width: 100%;
    background: white !important;
    color: black !important;
    font-family: Georgia, serif !important;
    padding: 24px !important;
  }
  .no-print { display: none !important; }
  @page { margin: 18mm; size: A4 portrait; }
}
`;

// ── Reusable print components ─────────────────────────────────────────────────
const Section = ({ title, children }) => (
  <div style={{ marginBottom: 20 }}>
    <div style={{ borderBottom: "2px solid #1e1b4b", marginBottom: 10, paddingBottom: 4 }}>
      <span style={{ fontSize: 13, fontWeight: "bold", color: "#1e1b4b", textTransform: "uppercase", letterSpacing: 1 }}>
        {title}
      </span>
    </div>
    {children}
  </div>
);

const Field = ({ label, value, full }) => {
  if (!value && value !== 0) return null;
  return (
    <div style={{ display: full ? "block" : "inline-block", width: full ? "100%" : "auto", marginRight: 24, marginBottom: 8, verticalAlign: "top" }}>
      <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11, color: "#111827", fontWeight: 500 }}>{value}</div>
    </div>
  );
};

const Row = ({ cells }) => (
  <div style={{ display: "flex", gap: 0, marginBottom: 6 }}>
    {cells.map(({ w, val, bold }, i) => (
      <div key={i} style={{ flex: w || 1, fontSize: 10, color: bold ? "#111" : "#374151", fontWeight: bold ? 600 : 400, paddingRight: 8 }}>
        {val || "—"}
      </div>
    ))}
  </div>
);

const TableHead = ({ cols }) => (
  <div style={{ display: "flex", backgroundColor: "#1e1b4b", color: "white", padding: "4px 8px", marginBottom: 2, borderRadius: 2 }}>
    {cols.map(({ label, w }, i) => (
      <div key={i} style={{ flex: w || 1, fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </div>
    ))}
  </div>
);

const Divider = () => <div style={{ borderBottom: "1px solid #e5e7eb", margin: "14px 0" }} />;

// ── Report type renderers ─────────────────────────────────────────────────────
const EvangelismContent = ({ report }) => {
  const { evangelismData: ev, churchAttendees, serviceAttendance, cellData, fellowshipPrayerData, followUpData } = report;
  const soulLabel = (status) => SOUL_STATUSES?.find((s) => s.value === status)?.label || status;

  return (
    <>
      {/* Service attendance */}
      {serviceAttendance?.length > 0 && (
        <Section title="Service Attendance">
          <div style={{ display: "flex", gap: 20 }}>
            {serviceAttendance.map((s, i) => (
              <div key={i} style={{ fontSize: 11 }}>
                <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{s.serviceType}</span>
                {" — "}
                <span style={{ color: s.attended ? "#15803d" : "#b91c1c" }}>{s.attended ? "Attended" : "Absent"}</span>
                {s.reportingTime && <span style={{ color: "#6b7280" }}> · {s.reportingTime}</span>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Souls */}
      {ev?.souls?.length > 0 && (
        <Section title={`Souls Preached To (${ev.souls.length})`}>
          <TableHead cols={[{ label: "#", w: 0.3 }, { label: "Full Name", w: 2 }, { label: "Status", w: 1.5 }, { label: "Location", w: 1.5 }, { label: "Phone", w: 1.5 }]} />
          {ev.souls.map((s, i) => (
            <div key={i} style={{ display: "flex", padding: "3px 8px", backgroundColor: i % 2 === 0 ? "#f9fafb" : "white" }}>
              {[{ w: 0.3, val: i + 1 }, { w: 2, val: s.fullName, bold: true }, { w: 1.5, val: soulLabel(s.status) }, { w: 1.5, val: s.location }, { w: 1.5, val: s.phone || "Not shared" }].map(({ w, val, bold }, j) => (
                <div key={j} style={{ flex: w, fontSize: 10, color: bold ? "#111" : "#374151", fontWeight: bold ? 600 : 400, paddingRight: 8 }}>{val}</div>
              ))}
            </div>
          ))}
          {ev.scriptures?.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 10, color: "#6b7280" }}>
              Scriptures: {ev.scriptures.join(", ")}
            </div>
          )}
        </Section>
      )}

      {/* Partners */}
      {ev?.evangelismPartners?.length > 0 && (
        <Section title="Evangelism Partners">
          <div style={{ fontSize: 11 }}>{ev.evangelismPartners.join(", ")}</div>
        </Section>
      )}

      {/* People brought to church */}
      {churchAttendees?.length > 0 && (
        <Section title={`People Brought to Church (${churchAttendees.length})`}>
          <TableHead cols={[{ label: "Name", w: 2 }, { label: "12+ Years", w: 1 }, { label: "Tuesday", w: 1 }, { label: "Sunday", w: 1 }, { label: "Special", w: 1 }]} />
          {churchAttendees.map((a, i) => (
            <div key={i} style={{ display: "flex", padding: "3px 8px", backgroundColor: i % 2 === 0 ? "#f9fafb" : "white" }}>
              {[
                { w: 2, val: a.fullName, bold: true },
                { w: 1, val: a.olderThan12 ? "Yes" : "No" },
                { w: 1, val: a.attendedTuesday ? "Yes" : "—" },
                { w: 1, val: a.attendedSunday ? "Yes" : "—" },
                { w: 1, val: a.attendedSpecial ? "Yes" : "—" },
              ].map(({ w, val, bold }, j) => (
                <div key={j} style={{ flex: w, fontSize: 10, color: bold ? "#111" : "#374151", fontWeight: bold ? 600 : 400, paddingRight: 8 }}>{val}</div>
              ))}
            </div>
          ))}
        </Section>
      )}

      {/* Cell */}
      {cellData && (
        <Section title="Cell Meeting Attendance">
          <Field label="Attended Cell" value={cellData.didAttendCell ? "Yes" : "No"} />
          {cellData.didAttendCell && cellData.cells?.map((c, i) => (
            <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 4, padding: 8, marginTop: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4, color: "#1e1b4b" }}>Cell {i + 1}</div>
              <Field label="Cell Name" value={c.cellName} />
              <Field label="Meeting Days" value={c.meetingDays?.join(", ")} />
              <Field label="Time Reported" value={c.reportTime} />
              <Field label="Role Played" value={c.role} />
            </div>
          ))}
        </Section>
      )}

      {/* Fellowship */}
      {fellowshipPrayerData && (
        <Section title="Fellowship Prayer">
          <Field label="Fellowship" value={fellowshipPrayerData.fellowshipName} />
          <Field label="Prayed This Week" value={fellowshipPrayerData.prayedThisWeek ? "Yes" : "No"} />
          <Field label="Prayer Day" value={fellowshipPrayerData.prayerDay} />
          <Field label="Start Time" value={fellowshipPrayerData.prayerStartTime} />
          <Field label="Hours Prayed" value={fellowshipPrayerData.hoursOfPrayer != null ? `${fellowshipPrayerData.hoursOfPrayer} hrs` : null} />
        </Section>
      )}

      {/* Follow ups */}
      {followUpData?.followUps?.length > 0 && (
        <Section title={`Follow-Ups (${followUpData.followUps.length})`}>
          <TableHead cols={[{ label: "#", w: 0.3 }, { label: "Name", w: 2 }, { label: "Location", w: 1.5 }, { label: "Phone", w: 1.5 }, { label: "Status", w: 1.5 }]} />
          {followUpData.followUps.map((f, i) => (
            <div key={i} style={{ display: "flex", padding: "3px 8px", backgroundColor: i % 2 === 0 ? "#f9fafb" : "white" }}>
              {[{ w: 0.3, val: i + 1 }, { w: 2, val: f.fullName, bold: true }, { w: 1.5, val: f.location }, { w: 1.5, val: f.phone }, { w: 1.5, val: f.status }].map(({ w, val, bold }, j) => (
                <div key={j} style={{ flex: w, fontSize: 10, color: bold ? "#111" : "#374151", fontWeight: bold ? 600 : 400, paddingRight: 8 }}>{val}</div>
              ))}
            </div>
          ))}
        </Section>
      )}
    </>
  );
};

const ProductionContent = ({ report }) => {
  const p = report.productionData || {};
  const depts = [
    { label: "Prayer",               value: p.prayer },
    { label: "Song Ministration",    value: p.songMinistration },
    { label: "Media",                value: p.media },
    { label: "Ushering",             value: p.ushering },
    { label: "Front Desk",           value: p.frontDesk },
    { label: "Service Coordination", value: p.serviceCoordination },
    { label: "Brief Writing",        value: p.briefWriting },
    { label: "Security",             value: p.security },
    { label: "Sunday School",        value: p.sundaySchool },
    { label: "Other Departments",    value: p.otherDepartment },
  ].filter((d) => d.value);

  return (
    <>
      <Section title="Service Details">
        <Field label="Service Type"        value={p.meeting} />
        <Field label="Date"                value={p.meetingDate ? formatDate(p.meetingDate) : null} />
        <Field label="Coordinator Report Time" value={p.reportingTime} />
      </Section>

      {depts.length > 0 && (
        <Section title="Department Assignments">
          {depts.map((d, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>{d.label}</div>
              <div style={{ fontSize: 11, color: "#111827" }}>{d.value}</div>
            </div>
          ))}
        </Section>
      )}

      {p.preService && (
        <Section title="Pre-Service Worker Reporting Times">
          {p.preService.oneHourPlus && <><Field label="1 hour or more before service" value={p.preService.oneHourPlus} full /></>}
          {p.preService.thirtyMins  && <><Field label="30 minutes before service"     value={p.preService.thirtyMins}  full /></>}
          {p.preService.fifteenMins && <><Field label="15 minutes before service"     value={p.preService.fifteenMins} full /></>}
        </Section>
      )}

      {p.duringService?.lateDuty && (
        <Section title="Late Reporting During Service">
          <Field label="Workers who reported late" value={p.duringService.lateDuty} full />
        </Section>
      )}

      {(p.permissionsSought || p.observations || p.challenges || p.suggestions) && (
        <Section title="Permissions, Observations and Remarks">
          {p.permissionsSought && <Field label="Permissions Sought"        value={p.permissionsSought} full />}
          {p.observations      && <Field label="Observations and Comments" value={p.observations}      full />}
          {p.challenges        && <Field label="Challenges"                value={p.challenges}        full />}
          {p.suggestions       && <Field label="Suggestions"               value={p.suggestions}       full />}
        </Section>
      )}
    </>
  );
};

const CellReportContent = ({ report }) => {
  const d = report.cellReportData || {};
  const activities = { teaching: "Teaching", prayer: "Prayer Meeting", "holy-ghost": "Holy Ghost Meeting", other: "Other" };

  return (
    <>
      <Section title="Cell Details">
        <Field label="Cell Name"       value={d.cellName} />
        <Field label="Location"        value={d.location} />
        <Field label="Meeting Day"     value={d.meetingDay} />
        <Field label="Meeting Time"    value={d.meetingTime} />
        <Field label="Total Attendance" value={d.totalAttendance != null ? String(d.totalAttendance) : null} />
      </Section>

      <Section title="Coordinator">
        <Field label="Coordinator"        value={d.coordinatorName} />
        <Field label="Time Reported"      value={d.coordinatorReportTime} />
        <Field label="Role"               value={d.coordinatorRole} />
        <Divider />
        <Field label="Co-coordinator"     value={d.coCoordinatorName} />
        <Field label="Time Reported"      value={d.coCoordinatorReportTime} />
        <Field label="Role"               value={d.coCoordinatorRole} />
      </Section>

      {d.members?.length > 0 && (
        <Section title={`Members Present (${d.members.length})`}>
          <TableHead cols={[{ label: "#", w: 0.3 }, { label: "Full Name", w: 2 }, { label: "Time Reported", w: 1.5 }, { label: "Role Played", w: 1.5 }]} />
          {d.members.map((m, i) => (
            <div key={i} style={{ display: "flex", padding: "3px 8px", backgroundColor: i % 2 === 0 ? "#f9fafb" : "white" }}>
              {[{ w: 0.3, val: i + 1 }, { w: 2, val: m.fullName, bold: true }, { w: 1.5, val: m.reportingTime || "—" }, { w: 1.5, val: m.role || "—" }].map(({ w, val, bold }, j) => (
                <div key={j} style={{ flex: w, fontSize: 10, color: bold ? "#111" : "#374151", fontWeight: bold ? 600 : 400, paddingRight: 8 }}>{val}</div>
              ))}
            </div>
          ))}
        </Section>
      )}

      {d.attendees?.length > 0 && (
        <Section title={`New Converts / Visitors (${d.attendees.length})`}>
          <TableHead cols={[{ label: "#", w: 0.3 }, { label: "Full Name", w: 2 }, { label: "Location", w: 1.5 }, { label: "Phone", w: 1.5 }]} />
          {d.attendees.map((a, i) => (
            <div key={i} style={{ display: "flex", padding: "3px 8px", backgroundColor: i % 2 === 0 ? "#f9fafb" : "white" }}>
              {[{ w: 0.3, val: i + 1 }, { w: 2, val: a.fullName, bold: true }, { w: 1.5, val: a.location || "—" }, { w: 1.5, val: a.phone || "—" }].map(({ w, val, bold }, j) => (
                <div key={j} style={{ flex: w, fontSize: 10, color: bold ? "#111" : "#374151", fontWeight: bold ? 600 : 400, paddingRight: 8 }}>{val}</div>
              ))}
            </div>
          ))}
        </Section>
      )}

      {d.activityType && (
        <Section title="Cell Activity">
          <Field label="Activity Type" value={activities[d.activityType] || d.activityType} />
          {d.activityType === "other" && <Field label="Description" value={d.activityOther} full />}
          {d.activityType === "teaching" && d.topics?.map((t, i) => (
            <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 4, padding: 8, marginTop: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 10, marginBottom: 4 }}>Topic {i + 1}</div>
              <Field label="Title"        value={t.title} />
              <Field label="Duration"     value={t.duration} />
              <Field label="Bible Verses" value={t.verses} />
            </div>
          ))}
          {(d.activityType === "prayer" || d.activityType === "holy-ghost") && (
            <>
              <Field label="Duration"     value={d.activityDuration} />
              <Field label="Bible Verses" value={d.activityVerses} />
            </>
          )}
        </Section>
      )}

      {d.remarks && (
        <Section title="Comments / Remarks / Observations">
          <div style={{ fontSize: 11, lineHeight: 1.6, color: "#374151" }}>{d.remarks}</div>
        </Section>
      )}
    </>
  );
};

const BriefContent = ({ report }) => {
  const b = report.briefData || {};
  return (
    <>
      <Section title="Service Details">
        <Field label="Service"       value={b.meeting} />
        <Field label="Date"          value={b.meetingDate ? formatDate(b.meetingDate) : null} />
        <Field label="Reported Time" value={b.reportingTime} />
      </Section>
      {[
        { label: "Workers on duty — 1 hour before",     value: b.workerHourBefore },
        { label: "Workers on duty — 30 minutes before", value: b.workerThirtyMins },
        { label: "Workers after service",               value: b.workerAfterService },
        { label: "Permissions Sought",                  value: b.permissionsSought },
        { label: "Late Workers",                        value: b.lateWorkers },
        { label: "Observations",                        value: b.observations },
        { label: "Challenges",                          value: b.challenges },
        { label: "Suggestions",                         value: b.suggestions },
      ].filter((f) => f.value).map((f, i) => (
        <Section key={i} title={f.label}>
          <div style={{ fontSize: 11, lineHeight: 1.6, color: "#374151" }}>
            {Array.isArray(f.value) ? f.value.join(", ") : f.value}
          </div>
        </Section>
      ))}
    </>
  );
};

const DepartmentalContent = ({ report }) => {
  const d = report.departmentalData || {};
  return (
    <>
      <Section title="Department Details">
        <Field
          label="Department"
          value={d.department === "other" ? d.otherDepartment : d.department}
        />
        <Field
          label="Service"
          value={d.service === "other" ? d.otherService : d.service}
        />
        <Field label="Date"       value={d.serviceDate ? formatDate(d.serviceDate) : null} />
      </Section>
      {d.attendees?.length > 0 && (
        <Section title={`Attendees (${d.attendees.length})`}>
          <TableHead cols={[{ label: "#", w: 0.3 }, { label: "Name", w: 2 }, { label: "Arrival Time", w: 1.5 }]} />
          {d.attendees.map((a, i) => (
            <div key={i} style={{ display: "flex", padding: "3px 8px", backgroundColor: i % 2 === 0 ? "#f9fafb" : "white" }}>
              {[{ w: 0.3, val: i + 1 }, { w: 2, val: a.workerId ? `${a.name} (${a.workerId})` : a.name, bold: true }, { w: 1.5, val: a.time || "—" }].map(({ w, val, bold }, j) => (
                <div key={j} style={{ flex: w, fontSize: 10, color: bold ? "#111" : "#374151", fontWeight: bold ? 600 : 400, paddingRight: 8 }}>{val}</div>
              ))}
            </div>
          ))}
        </Section>
      )}
      {d.lateness?.length > 0 && (
        <Section title={`Lateness (${d.lateness.length})`}>
          <TableHead cols={[{ label: "#", w: 0.3 }, { label: "Name", w: 2 }, { label: "Permission Time", w: 1.5 }]} />
          {d.lateness.map((a, i) => (
            <div key={i} style={{ display: "flex", padding: "3px 8px", backgroundColor: i % 2 === 0 ? "#f9fafb" : "white" }}>
              {[{ w: 0.3, val: i + 1 }, { w: 2, val: a.workerId ? `${a.name} (${a.workerId})` : a.name, bold: true }, { w: 1.5, val: a.time || "—" }].map(({ w, val, bold }, j) => (
                <div key={j} style={{ flex: w, fontSize: 10, color: bold ? "#111" : "#374151", fontWeight: bold ? 600 : 400, paddingRight: 8 }}>{val}</div>
              ))}
            </div>
          ))}
        </Section>
      )}
      {d.absentees?.length > 0 && (
        <Section title={`Absentees (${d.absentees.length})`}>
          <TableHead cols={[{ label: "#", w: 0.3 }, { label: "Name", w: 2 }, { label: "Permission Time", w: 1.5 }]} />
          {d.absentees.map((a, i) => (
            <div key={i} style={{ display: "flex", padding: "3px 8px", backgroundColor: i % 2 === 0 ? "#f9fafb" : "white" }}>
              {[{ w: 0.3, val: i + 1 }, { w: 2, val: a.workerId ? `${a.name} (${a.workerId})` : a.name, bold: true }, { w: 1.5, val: a.time || "—" }].map(({ w, val, bold }, j) => (
                <div key={j} style={{ flex: w, fontSize: 10, color: bold ? "#111" : "#374151", fontWeight: bold ? 600 : 400, paddingRight: 8 }}>{val}</div>
              ))}
            </div>
          ))}
        </Section>
      )}
      {d.teamAssignments?.length > 0 && (
        <Section title={`Team Assignments (${d.teamAssignments.length})`}>
          <TableHead cols={[{ label: "#", w: 0.3 }, { label: "Name", w: 2 }, { label: "Assignment", w: 1.8 }]} />
          {d.teamAssignments.map((a, i) => (
            <div key={i} style={{ display: "flex", padding: "3px 8px", backgroundColor: i % 2 === 0 ? "#f9fafb" : "white" }}>
              {[{ w: 0.3, val: i + 1 }, { w: 2, val: a.workerId ? `${a.name} (${a.workerId})` : a.name, bold: true }, { w: 1.8, val: a.assignment || "—" }].map(({ w, val, bold }, j) => (
                <div key={j} style={{ flex: w, fontSize: 10, color: bold ? "#111" : "#374151", fontWeight: bold ? 600 : 400, paddingRight: 8 }}>{val}</div>
              ))}
            </div>
          ))}
        </Section>
      )}
      {d.convertsToChurch?.length > 0 && (
        <Section title={`Converts / Disciples To Church (${d.convertsToChurch.length})`}>
          <TableHead cols={[{ label: "#", w: 0.3 }, { label: "Name", w: 2 }, { label: "Count", w: 1 }]} />
          {d.convertsToChurch.map((a, i) => (
            <div key={i} style={{ display: "flex", padding: "3px 8px", backgroundColor: i % 2 === 0 ? "#f9fafb" : "white" }}>
              {[{ w: 0.3, val: i + 1 }, { w: 2, val: a.workerId ? `${a.name} (${a.workerId})` : a.name, bold: true }, { w: 1, val: a.count ?? 0 }].map(({ w, val, bold }, j) => (
                <div key={j} style={{ flex: w, fontSize: 10, color: bold ? "#111" : "#374151", fontWeight: bold ? 600 : 400, paddingRight: 8 }}>{val}</div>
              ))}
            </div>
          ))}
        </Section>
      )}
      {d.convertsToCell?.length > 0 && (
        <Section title={`Converts / Disciples To Cell / Fellowship (${d.convertsToCell.length})`}>
          <TableHead cols={[{ label: "#", w: 0.3 }, { label: "Name", w: 2 }, { label: "Count", w: 1 }]} />
          {d.convertsToCell.map((a, i) => (
            <div key={i} style={{ display: "flex", padding: "3px 8px", backgroundColor: i % 2 === 0 ? "#f9fafb" : "white" }}>
              {[{ w: 0.3, val: i + 1 }, { w: 2, val: a.workerId ? `${a.name} (${a.workerId})` : a.name, bold: true }, { w: 1, val: a.count ?? 0 }].map(({ w, val, bold }, j) => (
                <div key={j} style={{ flex: w, fontSize: 10, color: bold ? "#111" : "#374151", fontWeight: bold ? 600 : 400, paddingRight: 8 }}>{val}</div>
              ))}
            </div>
          ))}
        </Section>
      )}
      {d.childrenRegister?.length > 0 && (
        <Section title={`Children Register (${d.childrenRegister.length})`}>
          <TableHead cols={[{ label: "#", w: 0.3 }, { label: "Child", w: 1.6 }, { label: "Brought By", w: 1.8 }, { label: "Time", w: 1 }]} />
          {d.childrenRegister.map((a, i) => (
            <div key={i} style={{ display: "flex", padding: "3px 8px", backgroundColor: i % 2 === 0 ? "#f9fafb" : "white" }}>
              {[{ w: 0.3, val: i + 1 }, { w: 1.6, val: a.childName, bold: true }, { w: 1.8, val: a.broughtBy || "—" }, { w: 1, val: a.time || "—" }].map(({ w, val, bold }, j) => (
                <div key={j} style={{ flex: w, fontSize: 10, color: bold ? "#111" : "#374151", fontWeight: bold ? 600 : 400, paddingRight: 8 }}>{val}</div>
              ))}
            </div>
          ))}
        </Section>
      )}
      {(d.activities || d.comments) && (
        <Section title="Activity Report">
          {d.activities && <Field label="Activities / Details / Observations" value={d.activities} full />}
          {d.comments && <Field label="Comments" value={d.comments} full />}
        </Section>
      )}
      {d.qualifyingWorkers?.length > 0 && (
        <Section title={`People Who Qualify To Work (${d.qualifyingWorkers.length})`}>
          <div style={{ fontSize: 11, lineHeight: 1.6, color: "#374151" }}>
            {d.qualifyingWorkers.join(", ")}
          </div>
        </Section>
      )}
    </>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const ReportDetail = () => {
  const { reportId } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReportById(reportId)
      .then(({ report: r }) => setReport(r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [reportId]);

  const handlePrint = () => {
    // Open a clean print page in a new tab — works on desktop and mobile
    const printWindow = window.open("", "_blank");
    const el = document.getElementById("report-print-area");
    if (!el || !printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${typeName} — ${workerName}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: Georgia, serif;
            font-size: 11pt;
            color: #111;
            background: white;
            padding: 18mm;
            max-width: 210mm;
            margin: 0 auto;
          }
          @media print {
            body { padding: 0; }
            @page { margin: 18mm; size: A4 portrait; }
          }
          @media screen {
            body { padding: 24px; }
            .print-btn {
              position: fixed; top: 16px; right: 16px;
              background: #1e1b4b; color: white;
              border: none; border-radius: 8px;
              padding: 10px 20px; font-size: 14px;
              cursor: pointer; font-family: sans-serif;
              box-shadow: 0 2px 8px rgba(0,0,0,0.2);
              z-index: 999;
            }
          }
          @media print { .print-btn { display: none; } }
        </style>
      </head>
      <body>
        <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
        ${el.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) return <Loader text="Loading report..." />;
  if (!report)  return <div className="card p-8 text-center text-gray-400">Report not found.</div>;

  const typeName   = REPORT_TYPES.find((t) => t.value === report.reportType)?.label || report.reportType;
  const weekLabel  = report.weekReference ? getWeekLabel(new Date(report.weekReference)) : "N/A";
  const workerName = report.submittedBy?.fullName || "Unknown";
  const workerId   = report.submittedBy?.workerId || "";

  const renderContent = () => {
    switch (report.reportType) {
      case "evangelism":   return <EvangelismContent   report={report} />;
      case "production":   return <ProductionContent   report={report} />;
      case "cell":         return <CellReportContent   report={report} />;
      case "brief":        return <BriefContent        report={report} />;
      case "departmental": return <DepartmentalContent report={report} />;
      default:             return <div style={{ fontSize: 11, color: "#6b7280" }}>No detailed view available for this report type.</div>;
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Inject print styles */}
      <style>{PRINT_STYLE}</style>

      {/* Screen nav — hidden when printing */}
      <div className="no-print flex items-center gap-4">
        <Link to="/admin/reports" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="section-title">{typeName}</h1>
          <p className="section-subtitle">{workerName} — {weekLabel}</p>
        </div>
        <button onClick={handlePrint} className="btn-primary flex items-center gap-2 text-sm">
          <Printer className="w-4 h-4" /> Print / Save as PDF
        </button>
      </div>

      {/* ── Printable area ─────────────────────────────────────────────────── */}
      <div id="report-print-area" style={{ backgroundColor: "white", color: "black", fontFamily: "Georgia, serif", padding: 0 }}>

        {/* Header */}
        <div style={{ borderBottom: "3px solid #1e1b4b", paddingBottom: 12, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: 2, marginBottom: 4 }}>
                Yachal House Church
              </div>
              <div style={{ fontSize: 20, fontWeight: "bold", color: "#1e1b4b", marginBottom: 2 }}>
                {typeName}
              </div>
              <div style={{ fontSize: 10, color: "#6b7280" }}>{weekLabel}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>{workerName}</div>
              <div style={{ fontSize: 10, color: "#6b7280" }}>Worker ID: {workerId}</div>
              {report.submittedAt && (
                <div style={{ fontSize: 10, color: "#6b7280" }}>Submitted: {formatDateTime(report.submittedAt)}</div>
              )}
              <div style={{ marginTop: 4 }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                  backgroundColor: report.isLateSubmission ? "#fef3c7" : "#dcfce7",
                  color: report.isLateSubmission ? "#92400e" : "#15803d",
                }}>
                  {report.isLateSubmission ? "Arrears Submission" : "Submitted on Time"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        {renderContent()}

        {/* Footer */}
        <div style={{ borderTop: "1px solid #e5e7eb", marginTop: 24, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 9, color: "#9ca3af" }}>Yachal House Church Management System</span>
          <span style={{ fontSize: 9, color: "#9ca3af" }}>
            Generated {new Date().toLocaleDateString("en-GH", { day: "numeric", month: "long", year: "numeric" })}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ReportDetail;
