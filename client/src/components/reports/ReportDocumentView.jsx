import { Link } from "react-router-dom";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { formatDate, formatDateTime, getWeekLabel } from "../../utils/formatDate";
import { getReportTypeLabel, SOUL_STATUSES } from "../../utils/constants";
import { REPORT_PRINT_AREA_ID } from "../../utils/reportPdf";

const PRINT_STYLE = `
@media screen {
  #report-print-area {
    max-width: 960px !important;
    margin: 0 auto !important;
    padding: 24px 28px !important;
    border: 1px solid #e5e7eb !important;
    border-radius: 14px !important;
    box-shadow: 0 14px 34px rgba(15, 23, 42, 0.07) !important;
  }
}

@media print {
  html, body {
    background: white !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  body * {
    visibility: hidden !important;
  }

  #report-print-area,
  #report-print-area * {
    visibility: visible !important;
  }

  #report-print-area {
    position: static !important;
    width: auto !important;
    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    background: white !important;
    color: black !important;
    font-family: Arial, Helvetica, sans-serif !important;
    box-sizing: border-box !important;
    overflow: visible !important;
    color-scheme: light !important;
  }

  #report-print-area,
  #report-print-area * {
    overflow-wrap: break-word !important;
    word-break: break-word !important;
    white-space: normal !important;
  }

  .no-print {
    display: none !important;
  }

  @page {
    size: A4 portrait;
    margin: 14mm 12mm 14mm 12mm;
  }
}
`;

const textBlockStyle = {
  fontSize: 11,
  lineHeight: 1.7,
  color: "#374151",
  textAlign: "justify",
  overflowWrap: "break-word",
  wordBreak: "break-word",
};

const cardStyle = {
  fontSize: 11,
  padding: "8px 10px",
  border: "1px solid #dbe3ee",
  borderRadius: 8,
  backgroundColor: "#ffffff",
};

const Section = ({ title, children }) => (
  <div
    style={{
      marginBottom: 20,
      border: "1px solid #dbe3ee",
      borderRadius: 10,
      padding: 12,
      backgroundColor: "#ffffff",
      breakInside: "avoid",
      pageBreakInside: "avoid",
    }}
  >
    <div style={{ borderBottom: "1px solid #cbd5e1", marginBottom: 10, paddingBottom: 6 }}>
      <span
        style={{
          fontSize: 12,
          fontWeight: "bold",
          color: "#111827",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {title}
      </span>
    </div>
    {children}
  </div>
);

const Field = ({ label, value, full }) => {
  if (!value && value !== 0) return null;

  return (
    <div
      style={{
        display: "inline-block",
        width: full ? "100%" : "calc(50% - 10px)",
        minWidth: full ? "100%" : 220,
        marginRight: full ? 0 : 10,
        marginBottom: 10,
        verticalAlign: "top",
        maxWidth: "100%",
        padding: "8px 10px",
        border: "1px solid #dbe3ee",
        borderRadius: 8,
        backgroundColor: "#ffffff",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          fontSize: 9,
          color: "#6b7280",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#111827",
          fontWeight: 500,
          lineHeight: 1.65,
          textAlign: full ? "justify" : "left",
          overflowWrap: "break-word",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
};

const TableHead = ({ cols }) => (
  <div
    style={{
      display: "flex",
      alignItems: "stretch",
      backgroundColor: "#f1f5f9",
      color: "#111827",
      padding: "8px 10px",
      marginBottom: 0,
      borderRadius: 8,
      border: "1px solid #cbd5e1",
      width: "100%",
      boxSizing: "border-box",
    }}
  >
    {cols.map(({ label, w }, index) => (
      <div
        key={index}
        style={{
          flex: w || 1,
          fontSize: 8.5,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          paddingRight: 8,
          minWidth: 0,
          overflowWrap: "break-word",
          wordBreak: "break-word",
        }}
      >
        {label}
      </div>
    ))}
  </div>
);

const TableRow = ({ cols, index }) => (
  <div
    style={{
      display: "flex",
      alignItems: "stretch",
      padding: "8px 10px",
      backgroundColor: index % 2 === 0 ? "#f9fafb" : "white",
      borderLeft: "1px solid #e5e7eb",
      borderRight: "1px solid #e5e7eb",
      borderBottom: "1px solid #e5e7eb",
      width: "100%",
      boxSizing: "border-box",
    }}
  >
    {cols.map(({ w, val, bold }, colIndex) => (
      <div
        key={colIndex}
        style={{
          flex: w || 1,
          minWidth: 0,
          fontSize: 10,
          color: bold ? "#111827" : "#374151",
          fontWeight: bold ? 600 : 400,
          paddingRight: 8,
          overflowWrap: "break-word",
          wordBreak: "break-word",
        }}
      >
        {val || "-"}
      </div>
    ))}
  </div>
);

const Divider = () => <div style={{ borderTop: "1px solid #e5e7eb", margin: "10px 0" }} />;

const TextBlock = ({ children }) => <div style={textBlockStyle}>{children}</div>;

const EvangelismContent = ({ report }) => {
  const {
    evangelismData = {},
    churchAttendees = [],
    serviceAttendance = [],
    cellData,
    fellowshipPrayerData,
    followUpData,
  } = report;
  const soulLabel = (status) => SOUL_STATUSES?.find((item) => item.value === status)?.label || status;
  const peopleTakenToCell = cellData?.peopleTakenToCell || [];
  const ageLabel = (person = {}) => {
    if (person.ageRange === "under-12") return "Under 12";
    if (person.ageRange === "above-12") return "Above 12";
    if (person.ageRange === "typed" && person.age != null) return `${person.age} years`;
    if (person.olderThan12) return "Above 12";
    return "I don't know yet";
  };

  return (
    <>
      {serviceAttendance.length > 0 && (
        <Section title="Service Attendance">
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {serviceAttendance.map((item, index) => (
              <div key={index} style={cardStyle}>
                <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{item.serviceType}</span>
                {" - "}
                <span style={{ color: item.attended ? "#15803d" : "#b91c1c" }}>
                  {item.attended ? "Attended" : "Absent"}
                </span>
                {item.reportingTime && <span style={{ color: "#6b7280" }}> | {item.reportingTime}</span>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {evangelismData.souls?.length > 0 && (
        <Section title={`Souls Preached To (${evangelismData.souls.length})`}>
          <TableHead
            cols={[
              { label: "#", w: 0.3 },
              { label: "Full Name", w: 2 },
              { label: "Status", w: 1.5 },
              { label: "Location", w: 1.5 },
              { label: "Phone", w: 1.5 },
            ]}
          />
          {evangelismData.souls.map((item, index) => (
            <TableRow
              key={index}
              index={index}
              cols={[
                { w: 0.3, val: index + 1 },
                { w: 2, val: item.fullName, bold: true },
                { w: 1.5, val: soulLabel(item.status) },
                { w: 1.5, val: item.location },
                { w: 1.5, val: item.phone || "Not shared" },
              ]}
            />
          ))}
          {evangelismData.scriptures?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <TextBlock>Scriptures: {evangelismData.scriptures.join(", ")}</TextBlock>
            </div>
          )}
        </Section>
      )}

      {evangelismData.evangelismPartners?.length > 0 && (
        <Section title="Evangelism Partners">
          <TextBlock>{evangelismData.evangelismPartners.join(", ")}</TextBlock>
        </Section>
      )}

      {churchAttendees.length > 0 && (
        <Section title={`People Brought to Church (${churchAttendees.length})`}>
          <TableHead
            cols={[
              { label: "Name", w: 2 },
              { label: "12+ Years", w: 1 },
              { label: "Tuesday", w: 1 },
              { label: "Sunday", w: 1 },
              { label: "Special", w: 1 },
            ]}
          />
          {churchAttendees.map((item, index) => (
            <TableRow
              key={index}
              index={index}
              cols={[
                { w: 2, val: item.fullName, bold: true },
                { w: 1, val: item.olderThan12 ? "Yes" : "No" },
                { w: 1, val: item.attendedTuesday ? "Yes" : "-" },
                { w: 1, val: item.attendedSunday ? "Yes" : "-" },
                { w: 1, val: item.attendedSpecial ? "Yes" : "-" },
              ]}
            />
          ))}
        </Section>
      )}

      {cellData && (
        <Section title="Cell Meeting Attendance">
          <Field label="Attended Cell" value={cellData.didAttendCell ? "Yes" : "No"} />
          {cellData.didAttendCell &&
            cellData.cells?.map((item, index) => (
              <div
                key={index}
                style={{
                  border: "1px solid #dbe3ee",
                  borderRadius: 8,
                  padding: 10,
                  marginTop: 8,
                  backgroundColor: "#ffffff",
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 8, color: "#111827" }}>
                  Cell {index + 1}
                </div>
                <Field label="Cell Name" value={item.cellName} />
                <Field label="Meeting Days" value={item.meetingDays?.join(", ")} />
                <Field label="Time Reported" value={item.reportTime} />
                <Field label="Role Played" value={item.role} />
              </div>
            ))}
        </Section>
      )}

      {peopleTakenToCell.length > 0 && (
        <Section title={`People Taken to Cell Meeting (${peopleTakenToCell.length})`}>
          <TableHead
            cols={[
              { label: "#", w: 0.3 },
              { label: "Name", w: 2 },
              { label: "Contact", w: 1.5 },
              { label: "Age", w: 1.5 },
            ]}
          />
          {peopleTakenToCell.map((item, index) => (
            <TableRow
              key={index}
              index={index}
              cols={[
                { w: 0.3, val: index + 1 },
                { w: 2, val: item.fullName, bold: true },
                { w: 1.5, val: item.contact || "Not shared" },
                { w: 1.5, val: ageLabel(item) },
              ]}
            />
          ))}
        </Section>
      )}

      {fellowshipPrayerData && (
        <Section title="Fellowship Prayer">
          <Field label="Fellowship" value={fellowshipPrayerData.fellowshipName} />
          <Field label="Prayed This Week" value={fellowshipPrayerData.prayedThisWeek ? "Yes" : "No"} />
          <Field label="Prayer Day" value={fellowshipPrayerData.prayerDay} />
          <Field label="Start Time" value={fellowshipPrayerData.prayerStartTime} />
          <Field
            label="Hours Prayed"
            value={
              fellowshipPrayerData.hoursOfPrayer != null
                ? `${fellowshipPrayerData.hoursOfPrayer} hrs`
                : null
            }
          />
        </Section>
      )}

      {followUpData?.followUps?.length > 0 && (
        <Section title={`Follow-Ups (${followUpData.followUps.length})`}>
          <TableHead
            cols={[
              { label: "#", w: 0.3 },
              { label: "Name", w: 2 },
              { label: "Location", w: 1.5 },
              { label: "Phone", w: 1.5 },
              { label: "Status", w: 1.5 },
            ]}
          />
          {followUpData.followUps.map((item, index) => (
            <TableRow
              key={index}
              index={index}
              cols={[
                { w: 0.3, val: index + 1 },
                { w: 2, val: item.fullName, bold: true },
                { w: 1.5, val: item.location },
                { w: 1.5, val: item.phone },
                { w: 1.5, val: item.status },
              ]}
            />
          ))}
        </Section>
      )}
    </>
  );
};

const ProductionContent = ({ report }) => {
  const data = report.productionData || {};
  const departments = [
    { label: "Prayer", value: data.prayer },
    { label: "Song Ministration", value: data.songMinistration },
    { label: "Media", value: data.media },
    { label: "Ushering", value: data.ushering },
    { label: "Front Desk", value: data.frontDesk },
    { label: "Service Coordination", value: data.serviceCoordination },
    { label: "Brief Writing", value: data.briefWriting },
    { label: "Security", value: data.security },
    { label: "Sunday School", value: data.sundaySchool },
    { label: "Other Departments", value: data.otherDepartment },
  ].filter((item) => item.value);

  return (
    <>
      <Section title="Service Details">
        <Field label="Service Type" value={data.meeting} />
        <Field label="Date" value={data.meetingDate ? formatDate(data.meetingDate) : null} />
        <Field label="Coordinator Report Time" value={data.reportingTime} />
      </Section>

      {departments.length > 0 && (
        <Section title="Department Assignments">
          {departments.map((item, index) => (
            <div key={index} style={{ marginBottom: 8 }}>
              <div
                style={{
                  fontSize: 9,
                  color: "#6b7280",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {item.label}
              </div>
              <TextBlock>{item.value}</TextBlock>
            </div>
          ))}
        </Section>
      )}

      {data.preService && (
        <Section title="Pre-Service Worker Reporting Times">
          {data.preService.oneHourPlus && (
            <Field label="1 hour or more before service" value={data.preService.oneHourPlus} full />
          )}
          {data.preService.thirtyMins && (
            <Field label="30 minutes before service" value={data.preService.thirtyMins} full />
          )}
          {data.preService.fifteenMins && (
            <Field label="15 minutes before service" value={data.preService.fifteenMins} full />
          )}
        </Section>
      )}

      {data.duringService?.lateDuty && (
        <Section title="Late Reporting During Service">
          <Field label="Workers who reported late" value={data.duringService.lateDuty} full />
        </Section>
      )}

      {(data.permissionsSought || data.observations || data.challenges || data.suggestions) && (
        <Section title="Permissions, Observations and Remarks">
          {data.permissionsSought && <Field label="Permissions Sought" value={data.permissionsSought} full />}
          {data.observations && <Field label="Observations and Comments" value={data.observations} full />}
          {data.challenges && <Field label="Challenges" value={data.challenges} full />}
          {data.suggestions && <Field label="Suggestions" value={data.suggestions} full />}
        </Section>
      )}
    </>
  );
};

const CellReportContent = ({ report }) => {
  const data = report.cellReportData || {};
  const activityLabels = {
    teaching: "Teaching",
    prayer: "Prayer Meeting",
    "holy-ghost": "Holy Ghost Meeting",
    other: "Other",
  };

  return (
    <>
      <Section title="Cell Details">
        <Field label="Cell Name" value={data.cellName} />
        <Field label="Location" value={data.location} />
        <Field label="Meeting Day" value={data.meetingDay} />
        <Field label="Meeting Time" value={data.meetingTime} />
        <Field
          label="Total Attendance"
          value={data.totalAttendance != null ? String(data.totalAttendance) : null}
        />
      </Section>

      <Section title="Coordinator">
        <Field label="Coordinator" value={data.coordinatorName} />
        <Field label="Time Reported" value={data.coordinatorReportTime} />
        <Field label="Role" value={data.coordinatorRole} />
        {data.coCoordinatorName && (
          <>
            <Divider />
            <Field label="Co-coordinator" value={data.coCoordinatorName} />
            <Field label="Time Reported" value={data.coCoordinatorReportTime} />
            <Field label="Role" value={data.coCoordinatorRole} />
          </>
        )}
      </Section>

      {data.members?.length > 0 && (
        <Section title={`Members Present (${data.members.length})`}>
          <TableHead
            cols={[
              { label: "#", w: 0.3 },
              { label: "Full Name", w: 2 },
              { label: "Time Reported", w: 1.5 },
              { label: "Role Played", w: 1.5 },
            ]}
          />
          {data.members.map((item, index) => (
            <TableRow
              key={index}
              index={index}
              cols={[
                { w: 0.3, val: index + 1 },
                { w: 2, val: item.fullName, bold: true },
                { w: 1.5, val: item.reportingTime || "-" },
                { w: 1.5, val: item.role || "-" },
              ]}
            />
          ))}
        </Section>
      )}

      {data.attendees?.length > 0 && (
        <Section title={`New Converts / Visitors (${data.attendees.length})`}>
          <TableHead
            cols={[
              { label: "#", w: 0.3 },
              { label: "Full Name", w: 2 },
              { label: "Location", w: 1.5 },
              { label: "Phone", w: 1.5 },
            ]}
          />
          {data.attendees.map((item, index) => (
            <TableRow
              key={index}
              index={index}
              cols={[
                { w: 0.3, val: index + 1 },
                { w: 2, val: item.fullName, bold: true },
                { w: 1.5, val: item.location || "-" },
                { w: 1.5, val: item.phone || "-" },
              ]}
            />
          ))}
        </Section>
      )}

      {data.activityType && (
        <Section title="Cell Activity">
          <Field label="Activity Type" value={activityLabels[data.activityType] || data.activityType} />
          {data.activityType === "other" && <Field label="Description" value={data.activityOther} full />}
          {data.activityType === "teaching" &&
            data.topics?.map((item, index) => (
              <div
                key={index}
                style={{
                  border: "1px solid #dbe3ee",
                  borderRadius: 8,
                  padding: 10,
                  marginTop: 8,
                  backgroundColor: "#ffffff",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 10, marginBottom: 8 }}>Topic {index + 1}</div>
                <Field label="Title" value={item.title} />
                <Field label="Duration" value={item.duration} />
                <Field label="Bible Verses" value={item.verses} />
              </div>
            ))}
          {(data.activityType === "prayer" || data.activityType === "holy-ghost") && (
            <>
              <Field label="Duration" value={data.activityDuration} />
              <Field label="Bible Verses" value={data.activityVerses} />
            </>
          )}
        </Section>
      )}

      {data.remarks && (
        <Section title="Comments / Remarks / Observations">
          <TextBlock>{data.remarks}</TextBlock>
        </Section>
      )}
    </>
  );
};

const BriefContent = ({ report }) => {
  const data = report.briefData || {};
  const sections = [
    { label: "Workers on duty - 1 hour before", value: data.workerHourBefore },
    { label: "Workers on duty - 30 minutes before", value: data.workerThirtyMins },
    { label: "Workers after service", value: data.workerAfterService },
    { label: "Permissions Sought", value: data.permissionsSought },
    { label: "Late Workers", value: data.lateWorkers },
    { label: "Observations", value: data.observations },
    { label: "Challenges", value: data.challenges },
    { label: "Suggestions", value: data.suggestions },
  ].filter((item) => item.value);

  return (
    <>
      <Section title="Service Details">
        <Field label="Service" value={data.meeting} />
        <Field label="Date" value={data.meetingDate ? formatDate(data.meetingDate) : null} />
        <Field label="Reported Time" value={data.reportingTime} />
      </Section>

      {sections.map((item, index) => (
        <Section key={index} title={item.label}>
          <TextBlock>{Array.isArray(item.value) ? item.value.join(", ") : item.value}</TextBlock>
        </Section>
      ))}
    </>
  );
};

const DepartmentalContent = ({ report }) => {
  const data = report.departmentalData || {};
  const workerLabel = (item) => (item.workerId ? `${item.name} (${item.workerId})` : item.name);

  return (
    <>
      <Section title="Department Details">
        <Field label="Department" value={data.department === "other" ? data.otherDepartment : data.department} />
        <Field label="Service / Meeting" value={data.service === "other" ? data.otherService : data.service} />
        <Field label="Date of Submission" value={data.serviceDate ? formatDate(data.serviceDate) : null} />
      </Section>

      {data.attendees?.length > 0 && (
        <Section title={`Attendees (${data.attendees.length})`}>
          <TableHead
            cols={[
              { label: "#", w: 0.3 },
              { label: "Worker", w: 2 },
              { label: "Arrival Time", w: 1.2 },
            ]}
          />
          {data.attendees.map((item, index) => (
            <TableRow
              key={index}
              index={index}
              cols={[
                { w: 0.3, val: index + 1 },
                { w: 2, val: workerLabel(item), bold: true },
                { w: 1.2, val: item.time || "-" },
              ]}
            />
          ))}
        </Section>
      )}

      {data.lateness?.length > 0 && (
        <Section title={`Lateness (${data.lateness.length})`}>
          <TableHead
            cols={[
              { label: "#", w: 0.3 },
              { label: "Worker", w: 2 },
              { label: "Permission Time", w: 1.2 },
            ]}
          />
          {data.lateness.map((item, index) => (
            <TableRow
              key={index}
              index={index}
              cols={[
                { w: 0.3, val: index + 1 },
                { w: 2, val: workerLabel(item), bold: true },
                { w: 1.2, val: item.time || "-" },
              ]}
            />
          ))}
        </Section>
      )}

      {data.absentees?.length > 0 && (
        <Section title={`Absentees (${data.absentees.length})`}>
          <TableHead
            cols={[
              { label: "#", w: 0.3 },
              { label: "Worker", w: 2 },
              { label: "Permission Time", w: 1.2 },
            ]}
          />
          {data.absentees.map((item, index) => (
            <TableRow
              key={index}
              index={index}
              cols={[
                { w: 0.3, val: index + 1 },
                { w: 2, val: workerLabel(item), bold: true },
                { w: 1.2, val: item.time || "-" },
              ]}
            />
          ))}
        </Section>
      )}

      {data.teamAssignments?.length > 0 && (
        <Section title={`Team Assignments (${data.teamAssignments.length})`}>
          <TableHead
            cols={[
              { label: "#", w: 0.3 },
              { label: "Worker", w: 2 },
              { label: "Assignment", w: 1.5 },
            ]}
          />
          {data.teamAssignments.map((item, index) => (
            <TableRow
              key={index}
              index={index}
              cols={[
                { w: 0.3, val: index + 1 },
                { w: 2, val: workerLabel(item), bold: true },
                { w: 1.5, val: item.assignment || "-" },
              ]}
            />
          ))}
        </Section>
      )}

      {data.convertsToChurch?.length > 0 && (
        <Section title={`Converts / Disciples Brought To Church (${data.convertsToChurch.length})`}>
          <TableHead
            cols={[
              { label: "#", w: 0.3 },
              { label: "Worker", w: 2 },
              { label: "Number", w: 1 },
            ]}
          />
          {data.convertsToChurch.map((item, index) => (
            <TableRow
              key={index}
              index={index}
              cols={[
                { w: 0.3, val: index + 1 },
                { w: 2, val: workerLabel(item), bold: true },
                { w: 1, val: item.count ?? 0 },
              ]}
            />
          ))}
        </Section>
      )}

      {data.convertsToCell?.length > 0 && (
        <Section
          title={`Converts / Disciples Brought To Cell / Fellowship (${data.convertsToCell.length})`}
        >
          <TableHead
            cols={[
              { label: "#", w: 0.3 },
              { label: "Worker", w: 2 },
              { label: "Number", w: 1 },
            ]}
          />
          {data.convertsToCell.map((item, index) => (
            <TableRow
              key={index}
              index={index}
              cols={[
                { w: 0.3, val: index + 1 },
                { w: 2, val: workerLabel(item), bold: true },
                { w: 1, val: item.count ?? 0 },
              ]}
            />
          ))}
        </Section>
      )}

      {data.childrenRegister?.length > 0 && (
        <Section title={`Children Register (${data.childrenRegister.length})`}>
          <TableHead
            cols={[
              { label: "#", w: 0.3 },
              { label: "Child", w: 1.5 },
              { label: "Brought By", w: 1.7 },
              { label: "Time", w: 1 },
            ]}
          />
          {data.childrenRegister.map((item, index) => (
            <TableRow
              key={index}
              index={index}
              cols={[
                { w: 0.3, val: index + 1 },
                { w: 1.5, val: item.childName, bold: true },
                { w: 1.7, val: item.broughtBy || "-" },
                { w: 1, val: item.time || "-" },
              ]}
            />
          ))}
        </Section>
      )}

      {(data.activities || data.comments) && (
        <Section title="Activity Report">
          {data.activities && <Field label="Activities / Details / Observations" value={data.activities} full />}
          {data.comments && <Field label="Comments" value={data.comments} full />}
        </Section>
      )}

      {data.qualifyingWorkers?.length > 0 && (
        <Section title={`People Who Qualify To Work (${data.qualifyingWorkers.length})`}>
          <TextBlock>{data.qualifyingWorkers.join(", ")}</TextBlock>
        </Section>
      )}
    </>
  );
};

const CustomContent = ({ report }) => {
  if (!report.customData) return null;

  return (
    <Section title="Custom Report Data">
      {Object.entries(report.customData).map(([key, value]) => (
        <Field
          key={key}
          label={key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())}
          value={
            Array.isArray(value)
              ? value.join(", ")
              : typeof value === "boolean"
                ? value
                  ? "Yes"
                  : "No"
                : value
          }
          full
        />
      ))}
    </Section>
  );
};

const getStatusMeta = (report) => {
  if (report.status === "draft") {
    return {
      label: report.isLateSubmission ? "Arrears Draft" : "Draft Saved",
      backgroundColor: report.isLateSubmission ? "#fef3c7" : "#e0f2fe",
      color: report.isLateSubmission ? "#92400e" : "#075985",
      timestampLabel: "Last Saved",
      timestampValue: report.updatedAt || report.createdAt,
    };
  }

  return {
    label: report.isLateSubmission ? "Arrears Submission" : "Submitted on Time",
    backgroundColor: report.isLateSubmission ? "#fef3c7" : "#dcfce7",
    color: report.isLateSubmission ? "#92400e" : "#15803d",
    timestampLabel: "Submitted",
    timestampValue: report.submittedAt || report.updatedAt || report.createdAt,
  };
};

const ReportDocumentView = ({
  report,
  backTo,
  onPrint,
  onDownload,
  isDownloading = false,
  showWorkerInSubtitle = false,
}) => {
  const typeName = getReportTypeLabel(report);
  const weekLabel = report.weekReference ? getWeekLabel(new Date(report.weekReference)) : "N/A";
  const workerName = report.submittedBy?.fullName || "Unknown";
  const workerId = report.submittedBy?.workerId || "";
  const statusMeta = getStatusMeta(report);
  const subtitle = showWorkerInSubtitle ? `${workerName} - ${weekLabel}` : weekLabel;

  const renderContent = () => {
    switch (report.reportType) {
      case "evangelism":
        return <EvangelismContent report={report} />;
      case "production":
        return <ProductionContent report={report} />;
      case "cell":
        return <CellReportContent report={report} />;
      case "brief":
        return <BriefContent report={report} />;
      case "departmental":
        return <DepartmentalContent report={report} />;
      case "custom":
        return <CustomContent report={report} />;
      default:
        return (
          <Section title="Report Details">
            <TextBlock>No detailed view is available for this report type.</TextBlock>
          </Section>
        );
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <style>{PRINT_STYLE}</style>

      <div className="no-print flex items-center gap-4">
        <Link
          to={backTo}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        <div className="flex-1">
          <h1 className="section-title">{typeName}</h1>
          <p className="section-subtitle">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button onClick={onPrint} className="btn-ghost flex items-center gap-2 text-sm">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={onDownload}
            disabled={isDownloading}
            className="btn-primary flex items-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {isDownloading ? "Preparing PDF..." : "Download PDF"}
          </button>
        </div>
      </div>

      <div
        id={REPORT_PRINT_AREA_ID}
        className="print-sheet"
        style={{
          backgroundColor: "white",
          color: "#111827",
          fontFamily: "Arial, Helvetica, sans-serif",
          padding: 24,
          width: "100%",
          maxWidth: 960,
          margin: "0 auto",
          boxSizing: "border-box",
          overflow: "visible",
          lineHeight: 1.55,
        }}
      >
        <div
          style={{
            borderBottom: "1px solid #cbd5e1",
            paddingBottom: 12,
            marginBottom: 20,
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 20,
              width: "100%",
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 9,
                  color: "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 4,
                }}
              >
                Yachal House Church
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: "bold",
                  color: "#111827",
                  marginBottom: 2,
                  overflowWrap: "break-word",
                }}
              >
                {typeName}
              </div>
              <div style={{ fontSize: 10, color: "#6b7280" }}>{weekLabel}</div>
            </div>

            <div style={{ textAlign: "right", minWidth: 0, maxWidth: "45%" }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#111827",
                  overflowWrap: "break-word",
                }}
              >
                {workerName}
              </div>
              <div style={{ fontSize: 10, color: "#6b7280" }}>Worker ID: {workerId}</div>
              {statusMeta.timestampValue && (
                <div style={{ fontSize: 10, color: "#6b7280" }}>
                  {statusMeta.timestampLabel}: {formatDateTime(statusMeta.timestampValue)}
                </div>
              )}
              <div style={{ marginTop: 4 }}>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 20,
                    backgroundColor: statusMeta.backgroundColor,
                    color: statusMeta.color,
                    border: "1px solid rgba(15, 23, 42, 0.08)",
                  }}
                >
                  {statusMeta.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {renderContent()}

        <div
          style={{
            borderTop: "1px solid #e5e7eb",
            marginTop: 24,
            paddingTop: 8,
            display: "flex",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 9, color: "#9ca3af" }}>Yachal House Church Management System</span>
          <span style={{ fontSize: 9, color: "#9ca3af" }}>
            Generated{" "}
            {new Date().toLocaleDateString("en-GH", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ReportDocumentView;
