import Report from "../models/reportModel.js";
import { normalizeWeekReference } from "../utils/portalWeek.js";

const IGNORED_CONTENT_KEYS = new Set([
  "_id",
  "__v",
  "createdAt",
  "updatedAt",
  "submittedAt",
  "submittedBy",
  "reportType",
  "customReportType",
  "weekReference",
  "isLateSubmission",
  "status",
  "isEditable",
  "draftStarted",
]);

const STRUCTURAL_STRING_KEYS = new Set(["serviceType"]);

const getReportContent = (report = {}) => ({
  evangelismData: report.evangelismData,
  followUpData: report.followUpData,
  churchAttendees: report.churchAttendees,
  serviceAttendance: report.serviceAttendance,
  cellData: report.cellData,
  cellReportData: report.cellReportData,
  fellowshipPrayerData: report.fellowshipPrayerData,
  productionData: report.productionData,
  briefData: report.briefData,
  departmentalData: report.departmentalData,
  customData: report.customData,
});

const hasHeuristicContent = (value, key = "") => {
  if (value === null || value === undefined) return false;

  if (typeof value === "string") {
    if (STRUCTURAL_STRING_KEYS.has(key)) return false;
    return value.trim().length > 0;
  }

  if (typeof value === "number") {
    return value > 0;
  }

  if (typeof value === "boolean") {
    return value === true;
  }

  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasHeuristicContent(item, key));
  }

  if (value instanceof Map) {
    return [...value.entries()].some(([childKey, childValue]) => {
      if (IGNORED_CONTENT_KEYS.has(childKey)) return false;
      return hasHeuristicContent(childValue, childKey);
    });
  }

  if (typeof value === "object") {
    return Object.entries(value).some(([childKey, childValue]) => {
      if (IGNORED_CONTENT_KEYS.has(childKey)) return false;
      return hasHeuristicContent(childValue, childKey);
    });
  }

  return false;
};

const getReportPriority = (report) => {
  if (report?.status === "submitted") return 3;
  if (reportHasDraftSignal(report)) return 2;
  return 1;
};

const getReportRecency = (report) =>
  Math.max(
    report?.submittedAt ? new Date(report.submittedAt).getTime() : 0,
    report?.updatedAt ? new Date(report.updatedAt).getTime() : 0,
    report?.createdAt ? new Date(report.createdAt).getTime() : 0
  );

const sortCanonicalFirst = (a, b) => {
  const priorityDiff = getReportPriority(b) - getReportPriority(a);
  if (priorityDiff !== 0) return priorityDiff;

  const recencyDiff = getReportRecency(b) - getReportRecency(a);
  if (recencyDiff !== 0) return recencyDiff;

  return String(b?._id || "").localeCompare(String(a?._id || ""));
};

export const reportHasDraftSignal = (report) =>
  !!report?.draftStarted || hasHeuristicContent(getReportContent(report));

export const reportPayloadHasDraftSignal = (payload = {}) => {
  const {
    reportType,
    weekType,
    weekDate,
    weekReference,
    isEdit,
    customReportType,
    draftStarted,
    ...content
  } = payload;

  return hasHeuristicContent(content);
};

export const buildReportIdentityKey = (report = {}) => {
  const submittedBy =
    report?.submittedBy?._id?.toString?.() ||
    report?.submittedBy?.toString?.() ||
    "";
  const customReportType =
    report?.customReportType?._id?.toString?.() ||
    report?.customReportType?.toString?.() ||
    "none";
  const weekReference = report?.weekReference
    ? normalizeWeekReference(report.weekReference).toISOString()
    : "none";

  return [
    submittedBy,
    report?.reportType || "",
    customReportType,
    weekReference,
    report?.isLateSubmission ? "late" : "current",
  ].join("|");
};

export const pickCanonicalReport = (reports = []) => {
  if (!reports.length) return null;
  return [...reports].sort(sortCanonicalFirst)[0] || null;
};

export const reconcileReportIdentity = async (filter, { cleanup = true } = {}) => {
  const reports = await Report.find(filter).sort({ updatedAt: -1, createdAt: -1 });

  if (!reports.length) {
    return { canonicalReport: null, duplicatesRemoved: 0 };
  }

  const canonicalReport = pickCanonicalReport(reports);

  if (!canonicalReport) {
    return { canonicalReport: null, duplicatesRemoved: 0 };
  }

  const removableIds = reports
    .filter((report) => String(report._id) !== String(canonicalReport._id))
    .map((report) => report._id);

  let duplicatesRemoved = 0;

  if (cleanup && removableIds.length > 0) {
    const result = await Report.deleteMany({ _id: { $in: removableIds } });
    duplicatesRemoved = result.deletedCount || 0;
  }

  if (cleanup && canonicalReport.status === "draft" && !reportHasDraftSignal(canonicalReport)) {
    await Report.findByIdAndDelete(canonicalReport._id);
    return {
      canonicalReport: null,
      duplicatesRemoved: duplicatesRemoved + 1,
    };
  }

  return { canonicalReport, duplicatesRemoved };
};

export const dedupeReportsForDisplay = (reports = []) => {
  const canonicalByKey = new Map();

  for (const report of reports) {
    if (report?.status === "draft" && !reportHasDraftSignal(report)) {
      continue;
    }

    const key = buildReportIdentityKey(report);
    const existing = canonicalByKey.get(key);

    if (!existing) {
      canonicalByKey.set(key, report);
      continue;
    }

    const canonical = pickCanonicalReport([existing, report]);
    canonicalByKey.set(key, canonical);
  }

  return [...canonicalByKey.values()].sort((a, b) => {
    const weekDiff =
      new Date(b?.weekReference || 0).getTime() -
      new Date(a?.weekReference || 0).getTime();
    if (weekDiff !== 0) return weekDiff;

    return getReportRecency(b) - getReportRecency(a);
  });
};
