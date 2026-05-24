import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Loader from "../../components/common/Loader";
import ReportDocumentView from "../../components/reports/ReportDocumentView";
import { getReportById } from "../../services/reportService";
import { getReportTypeLabel } from "../../utils/constants";
import {
  REPORT_PRINT_AREA_ID,
  buildReportPdfFileName,
  downloadReportPdf,
} from "../../utils/reportPdf";

const MyReportDetail = () => {
  const { reportId } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    getReportById(reportId)
      .then(({ report: currentReport }) => setReport(currentReport))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [reportId]);

  const handlePrint = () => {
    if (!report) return;

    const previousTitle = document.title;
    const typeName = getReportTypeLabel(report);
    const workerName = report.submittedBy?.fullName || "Unknown";
    const nextTitle = `${typeName} - ${workerName}`;
    let restored = false;

    const restoreTitle = () => {
      if (restored) return;
      restored = true;
      document.title = previousTitle;
      window.removeEventListener("afterprint", restoreTitle);
    };

    document.title = nextTitle;
    window.addEventListener("afterprint", restoreTitle);

    window.setTimeout(() => {
      window.print();
      window.setTimeout(restoreTitle, 1000);
    }, 80);
  };

  const handleDownload = async () => {
    if (!report) return;

    const element = document.getElementById(REPORT_PRINT_AREA_ID);
    if (!element) return;

    const typeName = getReportTypeLabel(report);
    const fileName = buildReportPdfFileName({
      typeLabel: typeName,
      workerName: report.submittedBy?.fullName || "Unknown",
      weekReference: report.weekReference,
      status: report.status,
    });

    setIsDownloading(true);
    try {
      await downloadReportPdf({ element, fileName });
    } catch {
      window.alert("Could not download this report as PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) return <Loader text="Loading your report..." />;
  if (!report) return <div className="card p-8 text-center text-gray-400">Report not found.</div>;

  return (
    <ReportDocumentView
      report={report}
      backTo="/portal/my-reports"
      onPrint={handlePrint}
      onDownload={handleDownload}
      isDownloading={isDownloading}
    />
  );
};

export default MyReportDetail;
