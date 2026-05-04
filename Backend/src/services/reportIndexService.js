import Report from "../models/reportModel.js";
import {
  buildReportIdentityKey,
  pickCanonicalReport,
  reportHasDraftSignal,
} from "./reportIntegrityService.js";

const REPORT_IDENTITY_INDEX = {
  submittedBy: 1,
  reportType: 1,
  customReportType: 1,
  weekReference: 1,
  isLateSubmission: 1,
};

export const ensureReportIndexes = async () => {
  try {
    const reports = await Report.find({}).sort({ updatedAt: -1, createdAt: -1 });
    const grouped = new Map();

    reports.forEach((report) => {
      const key = buildReportIdentityKey(report);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(report);
    });

    let deletedCount = 0;

    for (const group of grouped.values()) {
      const meaningfulReports = group.filter(
        (report) => report.status === "submitted" || reportHasDraftSignal(report)
      );

      if (meaningfulReports.length === 0) {
        const result = await Report.deleteMany({
          _id: { $in: group.map((report) => report._id) },
        });
        deletedCount += result.deletedCount || 0;
        continue;
      }

      const canonical = pickCanonicalReport(meaningfulReports);
      const removableIds = group
        .filter((report) => String(report._id) !== String(canonical?._id))
        .map((report) => report._id);

      if (!removableIds.length) continue;

      const result = await Report.deleteMany({ _id: { $in: removableIds } });
      deletedCount += result.deletedCount || 0;
    }

    if (deletedCount > 0) {
      console.log(`Report index repair: removed ${deletedCount} duplicate or empty report(s)`);
    }

    await Report.collection.createIndex(REPORT_IDENTITY_INDEX, {
      unique: true,
      name: "report_identity_unique",
    });
  } catch (error) {
    console.error("Report index repair error:", error.message);
  }
};
