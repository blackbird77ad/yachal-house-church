import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { getReportById } from "../../services/reportService";
import Loader from "../../components/common/Loader";
import { formatDate, formatDateTime, getWeekLabel } from "../../utils/formatDate";
import { REPORT_TYPES, SOUL_STATUSES } from "../../utils/constants";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const ReportDetail = () => {
  const { reportId } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const printRef = useRef(null);

  useEffect(() => {
    getReportById(reportId).then(({ report: r }) => setReport(r)).catch(() => {}).finally(() => setLoading(false));
  }, [reportId]);

  const handleDownload = async () => {
    setExporting(true);
    try {
      const el = printRef.current;
      const canvas = await html2canvas(el, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`report-${report.submittedBy?.fullName}-${formatDate(report.weekReference)}.pdf`);
    } catch {} finally { setExporting(false); }
  };

  if (loading) return <Loader text="Loading report..." />;
  if (!report) return <div className="card p-8 text-center text-gray-400">Report not found.</div>;

  const typeName = REPORT_TYPES.find((t) => t.value === report.reportType)?.label || report.reportType;
  const soulLabel = (status) => SOUL_STATUSES.find((s) => s.value === status)?.label || status;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/admin/reports" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="section-title">{typeName}</h1>
          <p className="section-subtitle">{report.submittedBy?.fullName} - {getWeekLabel(report.weekReference)}</p>
        </div>
        <button onClick={handleDownload} disabled={exporting} className="btn-outline flex items-center gap-2 text-sm">
          <Download className="w-4 h-4" />{exporting ? "Exporting..." : "Download PDF"}
        </button>
      </div>

      <div ref={printRef} className="space-y-4 bg-white dark:bg-slate-900 p-6 rounded-2xl">
        <div className="flex items-start justify-between pb-4 border-b border-gray-100 dark:border-slate-700">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-slate-100 text-lg">{typeName}</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">Submitted by: <span className="font-medium">{report.submittedBy?.fullName}</span> (ID: {report.submittedBy?.workerId})</p>
            <p className="text-sm text-gray-500 dark:text-slate-400">Week: {getWeekLabel(report.weekReference)}</p>
            {report.submittedAt && <p className="text-sm text-gray-500 dark:text-slate-400">Submitted: {formatDateTime(report.submittedAt)}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            {report.isLateSubmission ? <span className="badge-warning">Late Submission</span> : <span className="badge-success">On Time</span>}
            {!report.isEditable && <span className="badge-danger">Locked</span>}
          </div>
        </div>

        {report.reportType === "evangelism" && report.evangelismData?.souls?.length > 0 && (
          <div>
            <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-3">Souls Preached To ({report.evangelismData.totalSouls})</h3>
            <div className="space-y-2">
              {report.evangelismData.souls.map((s, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl text-sm">
                  <span className="font-bold text-gray-300 w-5">{i + 1}.</span>
                  <span className="font-medium text-gray-900 dark:text-slate-100 flex-1">{s.fullName}</span>
                  <span className="text-gray-500 dark:text-slate-400">{soulLabel(s.status)}</span>
                  {s.location && <span className="text-gray-400">{s.location}</span>}
                  {s.phone && <span className="text-gray-400">{s.phone}</span>}
                </div>
              ))}
            </div>
            {report.evangelismData.scriptures?.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-3">Scriptures: {report.evangelismData.scriptures.join(", ")}</p>
            )}
          </div>
        )}

        {report.churchAttendees?.length > 0 && (
          <div>
            <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-3">People Brought to Church</h3>
            <div className="space-y-2">
              {report.churchAttendees.map((a, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl text-sm">
                  <span className="font-medium text-gray-900 dark:text-slate-100 flex-1">{a.fullName}</span>
                  {a.attendedTuesday && <span className="badge-info">Tuesday</span>}
                  {a.attendedSunday && <span className="badge-success">Sunday</span>}
                  {a.attendedSpecial && <span className="badge-primary">Special</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {report.cellData && (
          <div>
            <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-3">Cell Meeting</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mb-3">
              <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3">
                <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Attended</p>
                <p className="font-medium text-gray-900 dark:text-slate-100">
                  {report.cellData.didAttendCell ? "Yes" : "No"}
                </p>
              </div>
            </div>
            {report.cellData.didAttendCell && report.cellData.cells?.length > 0 && (
              <div className="space-y-2">
                {report.cellData.cells.map((cell, i) => (
                  <div key={i} className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3 space-y-1">
                    <p className="text-xs font-bold text-purple-600 dark:text-purple-400">Cell {i + 1}</p>
                    {[
                      { label: "Cell Name",    value: cell.cellName },
                      { label: "Meeting Day",  value: cell.meetingDays?.join(", ") },
                      { label: "Reported At",  value: cell.reportTime },
                      { label: "Role Played",  value: cell.role },
                    ].filter((x) => x.value).map((item) => (
                      <div key={item.label} className="flex justify-between text-sm">
                        <span className="text-gray-400 dark:text-slate-500">{item.label}</span>
                        <span className="font-medium text-gray-900 dark:text-slate-100">{item.value}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {report.fellowshipPrayerData && (
          <div>
            <h3 className="font-bold text-gray-900 dark:text-slate-100 mb-3">Fellowship Prayer</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {[
                { label: "Fellowship",    value: report.fellowshipPrayerData.fellowshipName },
                { label: "Prayed",        value: report.fellowshipPrayerData.prayedThisWeek ? "Yes" : "No" },
                { label: "Day",           value: report.fellowshipPrayerData.prayerDay },
                { label: "Time Started",  value: report.fellowshipPrayerData.prayerStartTime },
                { label: "Hours Prayed",  value: report.fellowshipPrayerData.hoursOfPrayer != null
                    ? `${report.fellowshipPrayerData.hoursOfPrayer} hrs` : undefined },
              ].filter((i) => i.value != null && i.value !== "" && i.value !== undefined).map((item) => (
                <div key={item.label} className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3">
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">{item.label}</p>
                  <p className="font-medium text-gray-900 dark:text-slate-100">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportDetail;