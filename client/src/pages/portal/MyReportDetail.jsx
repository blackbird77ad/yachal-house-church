import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { getReportById } from "../../services/reportService";
import Loader from "../../components/common/Loader";
import { formatDate, formatDateTime, getWeekLabel } from "../../utils/formatDate";
import { REPORT_TYPES, SOUL_STATUSES } from "../../utils/constants";

const PRINT_STYLE = `
@media print {
  body * { visibility: hidden !important; }
  #report-print-area, #report-print-area * { visibility: visible !important; }
  #report-print-area {
    position: absolute !important;
    top: 0;
    left: 0;
    width: 100% !important;
    max-width: 100% !important;
    background: white !important;
    color: black !important;
    font-family: Georgia, serif !important;
    padding: 0 !important;
    margin: 0 !important;
    box-sizing: border-box !important;
    overflow: visible !important;
  }
  #report-print-area,
  #report-print-area * {
    overflow-wrap: break-word !important;
    word-break: break-word !important;
    white-space: normal !important;
  }
  .no-print { display: none !important; }
  @page {
    size: A4 portrait;
    margin: 20mm 15mm 20mm 15mm;
  }
}
`;

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 20 }}>
    <div style={{ borderBottom: "2px solid #1e1b4b", marginBottom: 10, paddingBottom: 4 }}>
      <span
        style={{
          fontSize: 13,
          fontWeight: "bold",
          color: "#1e1b4b",
          textTransform: "uppercase",
          letterSpacing: 1,
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
        display: full ? "block" : "inline-block",
        width: full ? "100%" : "auto",
        marginRight: 24,
        marginBottom: 8,
        verticalAlign: "top",
        maxWidth: "100%",
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
      backgroundColor: "#1e1b4b",
      color: "white",
      padding: "4px 8px",
      marginBottom: 2,
      borderRadius: 2,
      width: "100%",
      boxSizing: "border-box",
    }}
  >
    {cols.map(({ label, w }, i) => (
      <div
        key={i}
        style={{
          flex: w || 1,
          fontSize: 9,
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

const Row = ({ cols, index }) => (
  <div
    style={{
      display: "flex",
      padding: "3px 8px",
      backgroundColor: index % 2 === 0 ? "#f9fafb" : "white",
      width: "100%",
      boxSizing: "border-box",
    }}
  >
    {cols.map(({ w, val, bold }, j) => (
      <div
        key={j}
        style={{
          flex: w,
          minWidth: 0,
          fontSize: 10,
          color: bold ? "#111" : "#374151",
          fontWeight: bold ? 600 : 400,
          paddingRight: 8,
          overflowWrap: "break-word",
          wordBreak: "break-word",
        }}
      >
        {val}
      </div>
    ))}
  </div>
);

const MyReportDetail = () => {
  const { reportId } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReportById(reportId)
      .then(({ report: r }) => setReport(r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [reportId]);

  if (loading) return <Loader text="Loading your report..." />;
  if (!report) return <div className="card p-8 text-center text-gray-400">Report not found.</div>;

  const typeName = REPORT_TYPES.find((t) => t.value === report.reportType)?.label || report.reportType;
  const weekLabel = report.weekReference ? getWeekLabel(new Date(report.weekReference)) : "N/A";
  const workerName = report.submittedBy?.fullName || "Unknown";
  const workerId = report.submittedBy?.workerId || "";
  const soulLabel = (status) => SOUL_STATUSES?.find((s) => s.value === status)?.label || status;

  const ev = report.evangelismData;
  const ca = report.churchAttendees;
  const sa = report.serviceAttendance;
  const cd = report.cellData;
  const fp = report.fellowshipPrayerData;
  const fu = report.followUpData;
  const pd = report.productionData || {};
  const bd = report.briefData || {};
  const crd = report.cellReportData || {};
  const dd = report.departmentalData || {};

  const handlePrint = () => {
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
          * {
            box-sizing: border-box;
          }

          html, body {
            margin: 0;
            padding: 0;
            background: white;
            color: #111;
            font-family: Georgia, serif;
            overflow: visible;
          }

          body {
            font-size: 11pt;
            line-height: 1.45;
          }

          @page {
            size: A4 portrait;
            margin: 20mm 15mm 20mm 15mm;
          }

          @media screen {
            body {
              padding: 24px;
              max-width: 900px;
              margin: 0 auto;
            }

            .print-btn {
              position: fixed;
              top: 16px;
              right: 16px;
              background: #1e1b4b;
              color: white;
              border: none;
              border-radius: 8px;
              padding: 10px 20px;
              font-size: 14px;
              cursor: pointer;
              font-family: sans-serif;
              box-shadow: 0 2px 8px rgba(0,0,0,0.2);
              z-index: 999;
            }
          }

          @media print {
            body {
              margin: 0 !important;
              padding: 0 !important;
            }

            .print-btn {
              display: none !important;
            }
          }

          #report-print-shell {
            width: 100%;
            max-width: 100%;
            margin: 0;
            padding: 0;
            overflow: visible;
          }

          #report-print-shell,
          #report-print-shell * {
            overflow-wrap: break-word;
            word-break: break-word;
            white-space: normal;
          }

          table, div, span, p {
            max-width: 100%;
          }
        </style>
      </head>
      <body>
        <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
        <div id="report-print-shell">
          ${el.innerHTML}
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <style>{PRINT_STYLE}</style>

      <div className="no-print flex items-center gap-4">
        <Link
          to="/portal/my-reports"
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        <div className="flex-1">
          <h1 className="section-title">{typeName}</h1>
          <p className="section-subtitle">{weekLabel}</p>
        </div>

        <button onClick={handlePrint} className="btn-primary flex items-center gap-2 text-sm">
          <Printer className="w-4 h-4" /> Print / Save as PDF
        </button>
      </div>

      <div
        id="report-print-area"
        style={{
          backgroundColor: "white",
          color: "black",
          fontFamily: "Georgia, serif",
          padding: 0,
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          overflow: "visible",
        }}
      >
        <div
          style={{
            borderBottom: "3px solid #1e1b4b",
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
                  color: "#6b7280",
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  marginBottom: 4,
                }}
              >
                Yachal House Church
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: "bold",
                  color: "#1e1b4b",
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
                  color: "#111",
                  overflowWrap: "break-word",
                }}
              >
                {workerName}
              </div>
              <div style={{ fontSize: 10, color: "#6b7280" }}>Worker ID: {workerId}</div>
              {report.submittedAt && (
                <div style={{ fontSize: 10, color: "#6b7280" }}>
                  Submitted: {formatDateTime(report.submittedAt)}
                </div>
              )}
              <div style={{ marginTop: 4 }}>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 20,
                    backgroundColor: report.isLateSubmission ? "#fef3c7" : "#dcfce7",
                    color: report.isLateSubmission ? "#92400e" : "#15803d",
                  }}
                >
                  {report.isLateSubmission ? "Arrears Submission" : "Submitted on Time"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {report.reportType === "evangelism" && (
          <>
            {sa?.length > 0 && (
              <Section title="Service Attendance">
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  {sa.map((s, i) => (
                    <div key={i} style={{ fontSize: 11 }}>
                      <span style={{ textTransform: "capitalize", fontWeight: 600 }}>
                        {s.serviceType}
                      </span>
                      {" — "}
                      <span style={{ color: s.attended ? "#15803d" : "#b91c1c" }}>
                        {s.attended ? "Attended" : "Absent"}
                      </span>
                      {s.reportingTime && <span style={{ color: "#6b7280" }}> · {s.reportingTime}</span>}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {ev?.souls?.length > 0 && (
              <Section title={`Souls Preached To (${ev.souls.length})`}>
                <TableHead
                  cols={[
                    { label: "#", w: 0.3 },
                    { label: "Full Name", w: 2 },
                    { label: "Status", w: 1.5 },
                    { label: "Location", w: 1.5 },
                    { label: "Phone", w: 1.5 },
                  ]}
                />
                {ev.souls.map((s, i) => (
                  <Row
                    key={i}
                    index={i}
                    cols={[
                      { w: 0.3, val: i + 1 },
                      { w: 2, val: s.fullName, bold: true },
                      { w: 1.5, val: soulLabel(s.status) },
                      { w: 1.5, val: s.location },
                      { w: 1.5, val: s.phone || "Not shared" },
                    ]}
                  />
                ))}
                {ev.scriptures?.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 10, color: "#6b7280" }}>
                    Scriptures: {ev.scriptures.join(", ")}
                  </div>
                )}
              </Section>
            )}

            {ev?.evangelismPartners?.length > 0 && (
              <Section title="Evangelism Partners">
                <div style={{ fontSize: 11, overflowWrap: "break-word" }}>
                  {ev.evangelismPartners.join(", ")}
                </div>
              </Section>
            )}

            {ca?.length > 0 && (
              <Section title={`People Brought to Church (${ca.length})`}>
                <TableHead
                  cols={[
                    { label: "Name", w: 2 },
                    { label: "12+ Years", w: 1 },
                    { label: "Tuesday", w: 1 },
                    { label: "Sunday", w: 1 },
                    { label: "Special", w: 1 },
                  ]}
                />
                {ca.map((a, i) => (
                  <Row
                    key={i}
                    index={i}
                    cols={[
                      { w: 2, val: a.fullName, bold: true },
                      { w: 1, val: a.olderThan12 ? "Yes" : "No" },
                      { w: 1, val: a.attendedTuesday ? "Yes" : "—" },
                      { w: 1, val: a.attendedSunday ? "Yes" : "—" },
                      { w: 1, val: a.attendedSpecial ? "Yes" : "—" },
                    ]}
                  />
                ))}
              </Section>
            )}

            {cd && (
              <Section title="Cell Meeting Attendance">
                <Field label="Attended Cell" value={cd.didAttendCell ? "Yes" : "No"} />
                {cd.didAttendCell &&
                  cd.cells?.map((c, i) => (
                    <div
                      key={i}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 4,
                        padding: 8,
                        marginTop: 6,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          marginBottom: 4,
                          color: "#1e1b4b",
                        }}
                      >
                        Cell {i + 1}
                      </div>
                      <Field label="Cell Name" value={c.cellName} />
                      <Field label="Meeting Days" value={c.meetingDays?.join(", ")} />
                      <Field label="Time Reported" value={c.reportTime} />
                      <Field label="Role Played" value={c.role} />
                    </div>
                  ))}
              </Section>
            )}

            {fp && (
              <Section title="Fellowship Prayer">
                <Field label="Fellowship" value={fp.fellowshipName} />
                <Field label="Prayed" value={fp.prayedThisWeek ? "Yes" : "No"} />
                <Field label="Prayer Day" value={fp.prayerDay} />
                <Field label="Start Time" value={fp.prayerStartTime} />
                <Field
                  label="Hours Prayed"
                  value={fp.hoursOfPrayer != null ? `${fp.hoursOfPrayer} hrs` : null}
                />
              </Section>
            )}

            {fu?.followUps?.length > 0 && (
              <Section title={`Follow-Ups (${fu.followUps.length})`}>
                <TableHead
                  cols={[
                    { label: "#", w: 0.3 },
                    { label: "Name", w: 2 },
                    { label: "Location", w: 1.5 },
                    { label: "Phone", w: 1.5 },
                    { label: "Status", w: 1.5 },
                  ]}
                />
                {fu.followUps.map((f, i) => (
                  <Row
                    key={i}
                    index={i}
                    cols={[
                      { w: 0.3, val: i + 1 },
                      { w: 2, val: f.fullName, bold: true },
                      { w: 1.5, val: f.location },
                      { w: 1.5, val: f.phone },
                      { w: 1.5, val: f.status },
                    ]}
                  />
                ))}
              </Section>
            )}
          </>
        )}

        {report.reportType === "production" && (
          <>
            <Section title="Service Details">
              <Field label="Service Type" value={pd.meeting} />
              <Field label="Date" value={pd.meetingDate ? formatDate(pd.meetingDate) : null} />
              <Field label="Coordinator Report Time" value={pd.reportingTime} />
            </Section>

            {[
              { label: "Prayer", value: pd.prayer },
              { label: "Song Ministration", value: pd.songMinistration },
              { label: "Media", value: pd.media },
              { label: "Ushering", value: pd.ushering },
              { label: "Front Desk", value: pd.frontDesk },
              { label: "Service Coordination", value: pd.serviceCoordination },
              { label: "Brief Writing", value: pd.briefWriting },
              { label: "Security", value: pd.security },
              { label: "Sunday School", value: pd.sundaySchool },
              { label: "Other Departments", value: pd.otherDepartment },
            ].filter((d) => d.value).length > 0 && (
              <Section title="Department Assignments">
                {[
                  { label: "Prayer", value: pd.prayer },
                  { label: "Song Ministration", value: pd.songMinistration },
                  { label: "Media", value: pd.media },
                  { label: "Ushering", value: pd.ushering },
                  { label: "Front Desk", value: pd.frontDesk },
                  { label: "Service Coordination", value: pd.serviceCoordination },
                  { label: "Brief Writing", value: pd.briefWriting },
                  { label: "Security", value: pd.security },
                  { label: "Sunday School", value: pd.sundaySchool },
                  { label: "Other Departments", value: pd.otherDepartment },
                ]
                  .filter((d) => d.value)
                  .map((d, i) => (
                    <div key={i} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase" }}>
                        {d.label}
                      </div>
                      <div style={{ fontSize: 11, overflowWrap: "break-word" }}>{d.value}</div>
                    </div>
                  ))}
              </Section>
            )}

            {pd.preService && (
              <Section title="Pre-Service Worker Reporting Times">
                {pd.preService.oneHourPlus && (
                  <Field label="1 hour or more before service" value={pd.preService.oneHourPlus} full />
                )}
                {pd.preService.thirtyMins && (
                  <Field label="30 minutes before service" value={pd.preService.thirtyMins} full />
                )}
                {pd.preService.fifteenMins && (
                  <Field label="15 minutes before service" value={pd.preService.fifteenMins} full />
                )}
              </Section>
            )}

            {pd.duringService?.lateDuty && (
              <Section title="Late Reporting During Service">
                <Field label="Workers who reported late" value={pd.duringService.lateDuty} full />
              </Section>
            )}

            {(pd.permissionsSought || pd.observations || pd.challenges || pd.suggestions) && (
              <Section title="Permissions, Observations and Remarks">
                {pd.permissionsSought && (
                  <Field label="Permissions Sought" value={pd.permissionsSought} full />
                )}
                {pd.observations && (
                  <Field label="Observations and Comments" value={pd.observations} full />
                )}
                {pd.challenges && <Field label="Challenges" value={pd.challenges} full />}
                {pd.suggestions && <Field label="Suggestions" value={pd.suggestions} full />}
              </Section>
            )}
          </>
        )}

        {report.reportType === "cell" && (
          <>
            <Section title="Cell Details">
              <Field label="Cell Name" value={crd.cellName} />
              <Field label="Location" value={crd.location} />
              <Field label="Meeting Day" value={crd.meetingDay} />
              <Field label="Meeting Time" value={crd.meetingTime} />
              <Field
                label="Total Attendance"
                value={crd.totalAttendance != null ? String(crd.totalAttendance) : null}
              />
            </Section>

            <Section title="Coordinator">
              <Field label="Coordinator" value={crd.coordinatorName} />
              <Field label="Time Reported" value={crd.coordinatorReportTime} />
              <Field label="Role" value={crd.coordinatorRole} />
              {crd.coCoordinatorName && (
                <>
                  <div style={{ borderTop: "1px solid #e5e7eb", margin: "8px 0" }} />
                  <Field label="Co-coordinator" value={crd.coCoordinatorName} />
                  <Field label="Time Reported" value={crd.coCoordinatorReportTime} />
                  <Field label="Role" value={crd.coCoordinatorRole} />
                </>
              )}
            </Section>

            {crd.members?.length > 0 && (
              <Section title={`Members Present (${crd.members.length})`}>
                <TableHead
                  cols={[
                    { label: "#", w: 0.3 },
                    { label: "Full Name", w: 2 },
                    { label: "Time Reported", w: 1.5 },
                    { label: "Role Played", w: 1.5 },
                  ]}
                />
                {crd.members.map((m, i) => (
                  <Row
                    key={i}
                    index={i}
                    cols={[
                      { w: 0.3, val: i + 1 },
                      { w: 2, val: m.fullName, bold: true },
                      { w: 1.5, val: m.reportingTime || "—" },
                      { w: 1.5, val: m.role || "—" },
                    ]}
                  />
                ))}
              </Section>
            )}

            {crd.attendees?.length > 0 && (
              <Section title={`New Converts / Visitors (${crd.attendees.length})`}>
                <TableHead
                  cols={[
                    { label: "#", w: 0.3 },
                    { label: "Full Name", w: 2 },
                    { label: "Location", w: 1.5 },
                    { label: "Phone", w: 1.5 },
                  ]}
                />
                {crd.attendees.map((a, i) => (
                  <Row
                    key={i}
                    index={i}
                    cols={[
                      { w: 0.3, val: i + 1 },
                      { w: 2, val: a.fullName, bold: true },
                      { w: 1.5, val: a.location || "—" },
                      { w: 1.5, val: a.phone || "—" },
                    ]}
                  />
                ))}
              </Section>
            )}

            {crd.activityType && (
              <Section title="Cell Activity">
                <Field
                  label="Activity Type"
                  value={
                    {
                      teaching: "Teaching",
                      prayer: "Prayer Meeting",
                      "holy-ghost": "Holy Ghost Meeting",
                      other: "Other",
                    }[crd.activityType] || crd.activityType
                  }
                />
                {crd.activityType === "other" && (
                  <Field label="Description" value={crd.activityOther} full />
                )}
                {crd.activityType === "teaching" &&
                  crd.topics?.map((t, i) => (
                    <div
                      key={i}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 4,
                        padding: 8,
                        marginTop: 6,
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 10, marginBottom: 4 }}>
                        Topic {i + 1}
                      </div>
                      <Field label="Title" value={t.title} />
                      <Field label="Duration" value={t.duration} />
                      <Field label="Bible Verses" value={t.verses} />
                    </div>
                  ))}
                {(crd.activityType === "prayer" || crd.activityType === "holy-ghost") && (
                  <>
                    <Field label="Duration" value={crd.activityDuration} />
                    <Field label="Bible Verses" value={crd.activityVerses} />
                  </>
                )}
              </Section>
            )}

            {crd.remarks && (
              <Section title="Comments / Remarks / Observations">
                <div style={{ fontSize: 11, lineHeight: 1.6, color: "#374151" }}>{crd.remarks}</div>
              </Section>
            )}
          </>
        )}

        {report.reportType === "brief" && (
          <>
            <Section title="Service Details">
              <Field label="Service" value={bd.meeting} />
              <Field label="Date" value={bd.meetingDate ? formatDate(bd.meetingDate) : null} />
              <Field label="Reported Time" value={bd.reportingTime} />
            </Section>

            {[
              { label: "Workers on duty — 1 hour before", value: bd.workerHourBefore },
              { label: "Workers on duty — 30 minutes before", value: bd.workerThirtyMins },
              { label: "Workers after service", value: bd.workerAfterService },
              { label: "Permissions Sought", value: bd.permissionsSought },
              { label: "Late Workers", value: bd.lateWorkers },
              { label: "Observations", value: bd.observations },
              { label: "Challenges", value: bd.challenges },
              { label: "Suggestions", value: bd.suggestions },
            ]
              .filter((f) => f.value)
              .map((f, i) => (
                <Section key={i} title={f.label}>
                  <div style={{ fontSize: 11, lineHeight: 1.6, color: "#374151" }}>
                    {Array.isArray(f.value) ? f.value.join(", ") : f.value}
                  </div>
                </Section>
              ))}
          </>
        )}

        {report.reportType === "departmental" && dd && (
          <>
            <Section title="Department Details">
              <Field
                label="Department"
                value={dd.department === "other" ? dd.otherDepartment : dd.department}
              />
              <Field
                label="Service / Meeting"
                value={dd.service === "other" ? dd.otherService : dd.service}
              />
              <Field
                label="Date of Submission"
                value={dd.serviceDate ? formatDate(dd.serviceDate) : null}
              />
            </Section>

            {dd.attendees?.length > 0 && (
              <Section title={`Attendees (${dd.attendees.length})`}>
                <TableHead
                  cols={[
                    { label: "#", w: 0.3 },
                    { label: "Worker", w: 2 },
                    { label: "Arrival Time", w: 1.2 },
                  ]}
                />
                {dd.attendees.map((item, i) => (
                  <Row
                    key={i}
                    index={i}
                    cols={[
                      { w: 0.3, val: i + 1 },
                      {
                        w: 2,
                        val: item.workerId
                          ? `${item.name} (${item.workerId})`
                          : item.name,
                        bold: true,
                      },
                      { w: 1.2, val: item.time || "—" },
                    ]}
                  />
                ))}
              </Section>
            )}

            {dd.lateness?.length > 0 && (
              <Section title={`Lateness (${dd.lateness.length})`}>
                <TableHead
                  cols={[
                    { label: "#", w: 0.3 },
                    { label: "Worker", w: 2 },
                    { label: "Permission Time", w: 1.2 },
                  ]}
                />
                {dd.lateness.map((item, i) => (
                  <Row
                    key={i}
                    index={i}
                    cols={[
                      { w: 0.3, val: i + 1 },
                      {
                        w: 2,
                        val: item.workerId
                          ? `${item.name} (${item.workerId})`
                          : item.name,
                        bold: true,
                      },
                      { w: 1.2, val: item.time || "—" },
                    ]}
                  />
                ))}
              </Section>
            )}

            {dd.absentees?.length > 0 && (
              <Section title={`Absentees (${dd.absentees.length})`}>
                <TableHead
                  cols={[
                    { label: "#", w: 0.3 },
                    { label: "Worker", w: 2 },
                    { label: "Permission Time", w: 1.2 },
                  ]}
                />
                {dd.absentees.map((item, i) => (
                  <Row
                    key={i}
                    index={i}
                    cols={[
                      { w: 0.3, val: i + 1 },
                      {
                        w: 2,
                        val: item.workerId
                          ? `${item.name} (${item.workerId})`
                          : item.name,
                        bold: true,
                      },
                      { w: 1.2, val: item.time || "—" },
                    ]}
                  />
                ))}
              </Section>
            )}

            {dd.teamAssignments?.length > 0 && (
              <Section title={`Team Assignments (${dd.teamAssignments.length})`}>
                <TableHead
                  cols={[
                    { label: "#", w: 0.3 },
                    { label: "Worker", w: 2 },
                    { label: "Assignment", w: 1.5 },
                  ]}
                />
                {dd.teamAssignments.map((item, i) => (
                  <Row
                    key={i}
                    index={i}
                    cols={[
                      { w: 0.3, val: i + 1 },
                      {
                        w: 2,
                        val: item.workerId
                          ? `${item.name} (${item.workerId})`
                          : item.name,
                        bold: true,
                      },
                      { w: 1.5, val: item.assignment || "—" },
                    ]}
                  />
                ))}
              </Section>
            )}

            {dd.convertsToChurch?.length > 0 && (
              <Section
                title={`Converts / Disciples Brought To Church (${dd.convertsToChurch.length})`}
              >
                <TableHead
                  cols={[
                    { label: "#", w: 0.3 },
                    { label: "Worker", w: 2 },
                    { label: "Number", w: 1 },
                  ]}
                />
                {dd.convertsToChurch.map((item, i) => (
                  <Row
                    key={i}
                    index={i}
                    cols={[
                      { w: 0.3, val: i + 1 },
                      {
                        w: 2,
                        val: item.workerId
                          ? `${item.name} (${item.workerId})`
                          : item.name,
                        bold: true,
                      },
                      { w: 1, val: item.count ?? 0 },
                    ]}
                  />
                ))}
              </Section>
            )}

            {dd.convertsToCell?.length > 0 && (
              <Section
                title={`Converts / Disciples Brought To Cell / Fellowship (${dd.convertsToCell.length})`}
              >
                <TableHead
                  cols={[
                    { label: "#", w: 0.3 },
                    { label: "Worker", w: 2 },
                    { label: "Number", w: 1 },
                  ]}
                />
                {dd.convertsToCell.map((item, i) => (
                  <Row
                    key={i}
                    index={i}
                    cols={[
                      { w: 0.3, val: i + 1 },
                      {
                        w: 2,
                        val: item.workerId
                          ? `${item.name} (${item.workerId})`
                          : item.name,
                        bold: true,
                      },
                      { w: 1, val: item.count ?? 0 },
                    ]}
                  />
                ))}
              </Section>
            )}

            {dd.childrenRegister?.length > 0 && (
              <Section title={`Children Register (${dd.childrenRegister.length})`}>
                <TableHead
                  cols={[
                    { label: "#", w: 0.3 },
                    { label: "Child", w: 1.5 },
                    { label: "Brought By", w: 1.7 },
                    { label: "Time", w: 1 },
                  ]}
                />
                {dd.childrenRegister.map((item, i) => (
                  <Row
                    key={i}
                    index={i}
                    cols={[
                      { w: 0.3, val: i + 1 },
                      { w: 1.5, val: item.childName, bold: true },
                      { w: 1.7, val: item.broughtBy || "—" },
                      { w: 1, val: item.time || "—" },
                    ]}
                  />
                ))}
              </Section>
            )}

            {(dd.activities || dd.comments) && (
              <Section title="Activity Report">
                <Field label="Activities / Details / Observations" value={dd.activities} full />
                <Field label="Comments" value={dd.comments} full />
              </Section>
            )}

            {dd.qualifyingWorkers?.length > 0 && (
              <Section title={`People Who Qualify To Work (${dd.qualifyingWorkers.length})`}>
                <div style={{ fontSize: 11, lineHeight: 1.7, color: "#374151" }}>
                  {dd.qualifyingWorkers.join(", ")}
                </div>
              </Section>
            )}
          </>
        )}

        {report.reportType === "custom" && report.customData && (
          <Section title="Custom Report Data">
            {Object.entries(report.customData).map(([key, value]) => (
              <Field
                key={key}
                label={key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                value={Array.isArray(value) ? value.join(", ") : typeof value === "boolean" ? (value ? "Yes" : "No") : value}
                full
              />
            ))}
          </Section>
        )}

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
          <span style={{ fontSize: 9, color: "#9ca3af" }}>
            Yachal House Church Management System
          </span>
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

export default MyReportDetail;
