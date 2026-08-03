import Report from "../models/reportModel.js";
import User from "../models/userModel.js";
import {
  ensureWeeklyMetricsFresh,
  processLateMetrics,
} from "../services/metricsService.js";
import { getCurrentPortalState } from "../services/portalStateService.js";
import {
  dedupeReportsForDisplay,
  reconcileReportIdentity,
  reportPayloadHasDraftSignal,
} from "../services/reportIntegrityService.js";
import {
  getPortalWeekReferenceForNow,
  getPreviousPortalWeekReference,
  normalizeWeekReference,
} from "../utils/portalWeek.js";

// Portal week helpers
const getPortalWeekReference = async () => getPortalWeekReferenceForNow();

const getPreviousWeekReference = async () => getPreviousPortalWeekReference();

const getWeekReference = getPortalWeekReference;

const runDeferredMetricsRefresh = (task, label) => {
  Promise.resolve()
    .then(task)
    .catch((metricError) => {
      console.error(`${label}:`, metricError.message);
    });
};

const ADMIN_LEVEL_ROLES = new Set(["pastor", "admin", "moderator"]);

const MY_REPORT_BASE_FIELDS =
  "status reportType weekReference isLateSubmission customReportType submittedBy draftStarted submittedAt createdAt updatedAt";

const MY_REPORT_LIST_FIELDS = `${MY_REPORT_BASE_FIELDS} isEditable evangelismData followUpData churchAttendees serviceAttendance cellData cellReportData fellowshipPrayerData productionData briefData departmentalData customData`;

const REPORT_ANALYSIS_TYPES = [
  "evangelism",
  "cell",
  "production",
  "fellowship-prayer",
  "brief",
  "departmental",
  "custom",
];

const REPORT_ANALYSIS_TYPE_SET = new Set(REPORT_ANALYSIS_TYPES);

const createTimingCountBucket = () => ({
  all: 0,
  onTime: 0,
  arrears: 0,
});

const createTypeCountBucket = () => ({ all: 0 });

const createTypeCountBucketsByTiming = () => ({
  all: createTypeCountBucket(),
  onTime: createTypeCountBucket(),
  arrears: createTypeCountBucket(),
});

const parsePartnerEntry = (value = "") => {
  const raw = value.toString().trim();

  if (!raw) {
    return {
      raw,
      fullName: "",
      workerId: "",
      isNone: false,
    };
  }

  if (raw.toLowerCase() === "none") {
    return {
      raw,
      fullName: "",
      workerId: "",
      isNone: true,
    };
  }

  const pairMatch =
    raw.match(/^(.*?)\s*\((\d+)\)$/) ||
    raw.match(/^(.*?)\s*-\s*(\d+)$/);

  if (pairMatch) {
    return {
      raw,
      fullName: pairMatch[1].trim(),
      workerId: pairMatch[2].trim(),
      isNone: false,
    };
  }

  if (/^\d+$/.test(raw)) {
    return {
      raw,
      fullName: "",
      workerId: raw,
      isNone: false,
    };
  }

  return {
    raw,
    fullName: raw,
    workerId: "",
    isNone: false,
  };
};

const CELL_MEETING_AGE_RANGES = new Set([
  "unknown",
  "under-12",
  "above-12",
  "typed",
]);

const getNumericAge = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const age = Number(value);
  return Number.isFinite(age) && age >= 0 && age <= 120 ? age : null;
};

const getCellMeetingAgeRange = (person = {}) => {
  if (CELL_MEETING_AGE_RANGES.has(person.ageRange)) return person.ageRange;
  return getNumericAge(person.age) !== null ? "typed" : "unknown";
};

const isCellMeetingPersonAtLeast12 = (person = {}) => {
  if (person.olderThan12 === true) return true;

  const ageRange = getCellMeetingAgeRange(person);
  if (ageRange === "above-12") return true;
  if (ageRange === "under-12" || ageRange === "unknown") return false;

  const age = getNumericAge(person.age);
  return age !== null && age >= 12;
};

const normalizeCellMeetingPerson = (person = {}, fallbackCellName = "") => {
  const fullName =
    person.fullName?.toString?.().trim() ||
    person.name?.toString?.().trim() ||
    "";

  if (!fullName) return null;

  const ageRange = getCellMeetingAgeRange(person);
  const age = ageRange === "typed" ? getNumericAge(person.age) : null;
  const normalized = {
    fullName,
    cellName:
      person.cellName?.toString?.().trim() ||
      fallbackCellName?.toString?.().trim() ||
      "",
    olderThan12: isCellMeetingPersonAtLeast12(person),
  };

  if (person.contact?.toString?.().trim()) {
    normalized.contact = person.contact.toString().trim();
  }

  if (person.ageRange || age !== null) {
    normalized.ageRange = ageRange;
    normalized.age = age;
    normalized.olderThan12 = isCellMeetingPersonAtLeast12({
      ...person,
      ...normalized,
    });
  }

  return normalized;
};

const normalizePeopleTakenToCell = (people = [], fallbackCellName = "") =>
  people
    .map((person) => normalizeCellMeetingPerson(person, fallbackCellName))
    .filter(Boolean);

const normalizePeopleTakenToCellGroups = (groups = []) =>
  groups
    .map((group) => {
      const cellName = group.cellName?.toString?.().trim() || "";
      return {
        cellName,
        people: normalizePeopleTakenToCell(group.people || [], cellName),
      };
    })
    .filter((group) => group.cellName || group.people.length > 0);

const groupPeopleTakenToCell = (people = []) => {
  const groups = new Map();

  people.forEach((person) => {
    const cellName = person.cellName || "";
    const key = cellName.toLowerCase() || "__blank__";
    const group = groups.get(key) || { cellName, people: [] };
    group.people.push(person);
    groups.set(key, group);
  });

  return [...groups.values()];
};

const normalizeEvangelismReportData = (reportData = {}) => {
  if (!reportData.cellData) return reportData;

  const rawGroups =
    reportData.cellData.peopleTakenToCellGroups ||
    reportData.cellData.cellMeetingGroups;

  const rawPeopleTakenToCell =
    reportData.cellData?.peopleTakenToCell ||
    reportData.cellData?.cellMeetingPeople;

  const peopleTakenToCellGroups = Array.isArray(rawGroups)
    ? normalizePeopleTakenToCellGroups(rawGroups)
    : [];

  let peopleTakenToCell = Array.isArray(rawPeopleTakenToCell)
    ? normalizePeopleTakenToCell(rawPeopleTakenToCell)
    : [];

  if (peopleTakenToCellGroups.length > 0) {
    peopleTakenToCell = peopleTakenToCellGroups.flatMap((group) =>
      group.people.map((person) => ({
        ...person,
        cellName: person.cellName || group.cellName,
      }))
    );
  }

  reportData.cellData = {
    ...reportData.cellData,
    peopleTakenToCellGroups:
      peopleTakenToCellGroups.length > 0
        ? peopleTakenToCellGroups
        : groupPeopleTakenToCell(peopleTakenToCell),
    peopleTakenToCell,
  };

  return reportData;
};

const buildReportIdentityFilter = ({
  userId,
  reportType,
  weekReference,
  isLateSubmission,
  customReportType,
}) => {
  const filter = {
    submittedBy: userId,
    reportType,
    weekReference,
    isLateSubmission,
  };

  if (reportType === "custom") {
    filter.customReportType = customReportType || null;
  }

  return filter;
};

const resolveReportWeekReference = ({
  weekType,
  weekDate,
  weekReference: requestedWeekReference,
  currentWeekReference = getPortalWeekReferenceForNow(),
}) => {
  const normalizedCurrentWeek = normalizeWeekReference(currentWeekReference);
  const isLateSubmission = weekType === "late" || weekType === "past";

  if (!isLateSubmission) {
    return {
      isLateSubmission: false,
      weekReference: normalizedCurrentWeek,
    };
  }

  const lateWeekReference = requestedWeekReference
    ? normalizeWeekReference(requestedWeekReference)
    : weekDate
    ? normalizeWeekReference(weekDate)
    : getPreviousPortalWeekReference(normalizedCurrentWeek);

  if (lateWeekReference.getTime() >= normalizedCurrentWeek.getTime()) {
    const error = new Error(
      "Late submissions must target a previous reporting week."
    );
    error.statusCode = 400;
    throw error;
  }

  return {
    isLateSubmission: true,
    weekReference: lateWeekReference,
  };
};

export const saveDraft = async (req, res, next) => {
  try {
    const {
      reportType,
      weekType,
      weekDate,
      isEdit,
      customReportType,
      draftStarted,
      ...reportData
    } = req.body;

    let isLateSubmission = weekType === "late" || weekType === "past";
    let weekReference;

    // Priority: use frontend-sent weekReference (most accurate — client knows the window)
    // Fall back to weekDate, then compute from weekType
    if (req.body.weekReference) {
      weekReference = normalizeWeekReference(req.body.weekReference);
    } else if (weekDate) {
      weekReference = normalizeWeekReference(weekDate);
    } else if (isLateSubmission) {
      weekReference = getPreviousPortalWeekReference();
    } else {
      weekReference = getPortalWeekReferenceForNow();
    }

    ({ isLateSubmission, weekReference } = resolveReportWeekReference({
      weekType,
      weekDate,
      weekReference: req.body.weekReference,
      currentWeekReference: getPortalWeekReferenceForNow(),
    }));

    normalizeEvangelismReportData(reportData);

    const identityFilter = buildReportIdentityFilter({
      userId: req.user._id,
      reportType,
      weekReference,
      isLateSubmission,
      customReportType,
    });

    let { canonicalReport: report } = await reconcileReportIdentity(identityFilter);

    if (report && report.status === "submitted" && isLateSubmission && !report.isEditable) {
      return res.status(400).json({
        message: "This arrears report is locked and cannot be edited.",
      });
    }

    if (report && report.status === "submitted") {
      return res.status(409).json({
        message:
          "This report has already been submitted. Open the submitted report and use Update Report if you need to change it.",
        existingReportId: report._id,
        canEdit: !!report.isEditable,
      });
    }

    const shouldPersistDraft =
      draftStarted === true || reportPayloadHasDraftSignal(reportData);

    if (!shouldPersistDraft) {
      return res.status(200).json({
        message: "Draft not saved because no field has been started yet.",
        report: report || null,
        skipped: true,
      });
    }

    if (report) {
      Object.assign(report, reportData);
      report.status = "draft";
      report.draftStarted = true;
      await report.save();
    } else {
      try {
        report = await Report.create({
          submittedBy: req.user._id,
          reportType,
          weekReference,
          isLateSubmission,
          customReportType: customReportType || null,
          status: "draft",
          draftStarted: true,
          ...reportData,
        });
      } catch (error) {
        if (error?.code !== 11000) throw error;

        const retry = await reconcileReportIdentity(identityFilter);
        report = retry.canonicalReport;

        if (!report || report.status === "submitted") {
          return res.status(409).json({
            message:
              "This report has already been submitted. Open the submitted report and use Update Report if you need to change it.",
            existingReportId: report?._id,
            canEdit: !!report?.isEditable,
          });
        }

        Object.assign(report, reportData);
        report.status = "draft";
        report.draftStarted = true;
        await report.save();
      }
    }

    res.status(200).json({ message: "Draft saved.", report });
  } catch (error) {
    next(error);
  }
};

export const submitReport = async (req, res, next) => {
  try {
    const now = new Date();
    const portalState = await getCurrentPortalState(now);

    if (!portalState.isOpen) {
      return res.status(403).json({
        message: "The submission portal is currently closed. It opens every Friday.",
      });
    }

    const {
      reportType,
      weekType,
      weekDate,
      isEdit,
      customReportType,
      ...reportData
    } = req.body;
    let isLateSubmission = weekType === "late" || weekType === "past";

    let weekReference;
    // Priority: use frontend-sent weekReference (source of truth — client computed from portal status)
    if (req.body.weekReference) {
      weekReference = normalizeWeekReference(req.body.weekReference);
    } else if (weekDate) {
      weekReference = normalizeWeekReference(weekDate);
    } else if (isLateSubmission) {
      weekReference = getPreviousPortalWeekReference();
    } else {
      weekReference = getPortalWeekReferenceForNow();
    }

    ({ isLateSubmission, weekReference } = resolveReportWeekReference({
      weekType,
      weekDate,
      weekReference: req.body.weekReference,
      currentWeekReference: portalState.weekReference,
    }));

    normalizeEvangelismReportData(reportData);

    if (reportData.evangelismData?.souls) {
      const souls = reportData.evangelismData.souls;
      reportData.evangelismData.totalSouls = souls.length;
      reportData.evangelismData.qualifyingSouls = souls.filter(
        (s) => !s.age || s.age >= 12
      ).length;

      if (reportData.churchAttendees) {
        reportData.churchAttendees = reportData.churchAttendees.map((a) => ({
          ...a,
          countsForQualification: !a.age || a.age >= 12,
        }));
      }

      const partnerEntries = reportData.evangelismData?.evangelismPartners || [];

      if (partnerEntries.length > 0 && souls.length > 0) {
        const parsedPartners = partnerEntries
          .map(parsePartnerEntry)
          .filter((partner) => !partner.isNone);

        const partnerWorkerIds = [
          ...new Set(
            parsedPartners.map((partner) => partner.workerId).filter(Boolean)
          ),
        ];

        const partnerNames = [
          ...new Set(
            parsedPartners
              .flatMap((partner) => [partner.fullName, partner.raw])
              .map((name) => name?.trim())
              .filter(Boolean)
          ),
        ];

        let partnerUserIds = [];

        if (partnerWorkerIds.length > 0) {
          const partnerUsers = await User.find({
            workerId: { $in: partnerWorkerIds },
          }).select("_id fullName workerId");

          partnerUserIds = partnerUsers.map((u) => u._id);
        }

        const partnerReports = await Report.find({
          reportType: "evangelism",
          weekReference,
          status: "submitted",
          submittedBy: {
            $ne: req.user._id,
            ...(partnerUserIds.length > 0 ? { $in: partnerUserIds } : {}),
          },
        }).populate("submittedBy", "fullName workerId");

        const partnerSubmissions =
          partnerUserIds.length > 0
            ? partnerReports
            : partnerReports.filter((r) =>
                partnerNames.some((name) =>
                  r.submittedBy?.fullName?.toLowerCase().includes(name.toLowerCase())
                )
              );

        if (partnerSubmissions.length > 0) {
          const duplicates = [];

          for (const soul of souls) {
            for (const pr of partnerSubmissions) {
              const alreadyClaimed = pr.evangelismData?.souls?.some((ps) => {
                const nameMatch =
                  ps.fullName?.toLowerCase().trim() === soul.fullName?.toLowerCase().trim();

                if (!nameMatch) return false;

                if (ps.phone && soul.phone) {
                  return ps.phone.replace(/\s+/g, "") === soul.phone.replace(/\s+/g, "");
                }

                return ps.status === soul.status;
              });

              if (alreadyClaimed) {
                duplicates.push({
                  soul: soul.fullName,
                  claimedBy: pr.submittedBy?.fullName,
                  claimedByWorkerId: pr.submittedBy?.workerId,
                });
              }
            }
          }

          if (duplicates.length > 0) {
            return res.status(400).json({
              message: `${duplicates.length} soul(s) in your report have already been submitted by your evangelism partner. Remove them before submitting.`,
              duplicates,
            });
          }
        }
      }
    }

    const identityFilter = buildReportIdentityFilter({
      userId: req.user._id,
      reportType,
      weekReference,
      isLateSubmission,
      customReportType,
    });

    let { canonicalReport: report } = await reconcileReportIdentity(identityFilter);

    if (report && report.status === "submitted" && !isLateSubmission && !isEdit) {
      return res.status(409).json({
        message:
          "You have already submitted this report type for the current week. Please edit your existing submission.",
        existingReportId: report._id,
        canEdit: report.isEditable,
      });
    }

    if (report) {
      if (!report.isEditable && isLateSubmission) {
        return res.status(403).json({
          message: "This arrears report is locked and cannot be edited.",
        });
      }

      Object.assign(report, reportData);
      report.status = "submitted";
      report.submittedAt = now;
      report.isEditable = !isLateSubmission;
      report.customReportType = customReportType || null;
      report.draftStarted = true;
      await report.save();
    } else {
      try {
        report = await Report.create({
          submittedBy: req.user._id,
          reportType,
          weekReference,
          isLateSubmission,
          customReportType: customReportType || null,
          status: "submitted",
          draftStarted: true,
          submittedAt: now,
          isEditable: !isLateSubmission,
          ...reportData,
        });
      } catch (error) {
        if (error?.code !== 11000) throw error;

        const retry = await reconcileReportIdentity(identityFilter);
        report = retry.canonicalReport;

        if (report && report.status === "submitted" && !isLateSubmission && !isEdit) {
          return res.status(409).json({
            message:
              "You have already submitted this report type for the current week. Please edit your existing submission.",
            existingReportId: report._id,
            canEdit: report.isEditable,
          });
        }

        if (!report) throw error;

        Object.assign(report, reportData);
        report.status = "submitted";
        report.submittedAt = now;
        report.isEditable = !isLateSubmission;
        report.customReportType = customReportType || null;
        report.draftStarted = true;
        await report.save();
      }
    }

    let responseMessage = "Report submitted successfully.";

    if (isLateSubmission) {
      responseMessage =
        "Report submitted successfully. Qualification is updating in the background.";
      runDeferredMetricsRefresh(
        () => processLateMetrics(req.user._id, weekReference),
        "submitReport late metrics refresh error"
      );
    } else if (reportType === "evangelism") {
      responseMessage =
        "Report submitted successfully. Qualification is updating in the background.";
      runDeferredMetricsRefresh(
        () =>
          ensureWeeklyMetricsFresh(weekReference, {
            maxAgeMinutes: 0,
            force: true,
          }),
        "submitReport post-submit refresh error"
      );
    }

    res.status(200).json({
      message: responseMessage,
      warningMessage: null,
      report,
    });
  } catch (error) {
    next(error);
  }
};

export const editSubmittedReport = async (req, res, next) => {
  try {
    const now = new Date();
    const report = await Report.findById(req.params.reportId);

    if (!report) {
      return res.status(404).json({ message: "Report not found." });
    }

    if (report.submittedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You can only edit your own reports." });
    }

    if (!report.isEditable) {
      return res.status(403).json({ message: "This report is locked and cannot be edited." });
    }

    if (!report.isLateSubmission) {
      const portalState = await getCurrentPortalState(now);
      const currentWeekReference = normalizeWeekReference(portalState.weekReference);
      const reportWeekReference = normalizeWeekReference(report.weekReference);

      if (!portalState.isOpen) {
        report.isEditable = false;
        await report.save();
        return res.status(403).json({
          message: "Submitted reports can only be edited while the submission portal is open.",
        });
      }

      if (reportWeekReference.getTime() !== currentWeekReference.getTime()) {
        report.isEditable = false;
        await report.save();
        return res.status(403).json({
          message: "Only the active week's submitted report can be edited.",
        });
      }
    }

    const { reportType, weekType, weekDate, isEdit, ...reportData } = req.body;
    normalizeEvangelismReportData(reportData);
    Object.assign(report, reportData);
    if (!report.submittedAt) {
      report.submittedAt = new Date();
    }
    await report.save();

    let responseMessage = "Report updated successfully.";

    if (!report.isLateSubmission && report.reportType === "evangelism") {
      responseMessage =
        "Report updated successfully. Qualification is updating in the background.";
      runDeferredMetricsRefresh(
        () =>
          ensureWeeklyMetricsFresh(report.weekReference, {
            maxAgeMinutes: 0,
            force: true,
          }),
        "editSubmittedReport metrics refresh error"
      );
    }

    res.status(200).json({
      message: responseMessage,
      warningMessage: null,
      report,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyReports = async (req, res, next) => {
  try {
    const { weekReference, reportType, status, weekType, limit = 200, page = 1 } = req.query;
    const filter = { submittedBy: req.user._id };

    if (weekReference) filter.weekReference = normalizeWeekReference(weekReference);
    if (reportType) filter.reportType = reportType;
    if (weekType === "current") filter.isLateSubmission = false;
    if (weekType === "late") filter.isLateSubmission = true;

    let reports = await Report.find(filter)
      .select(MY_REPORT_LIST_FIELDS)
      .populate("customReportType", "name")
      .sort({
        weekReference: -1,
        submittedAt: -1,
        updatedAt: -1,
        createdAt: -1,
      })
      .lean();

    reports = dedupeReportsForDisplay(reports);

    if (status) {
      reports = reports.filter((report) => report.status === status);
    }

    const total = reports.length;
    const skip = (Number(page) - 1) * Number(limit);
    const pagedReports = reports.slice(skip, skip + Number(limit));

    res.status(200).json({
      reports: pagedReports,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    next(error);
  }
};

export const getMyReportSummary = async (req, res, next) => {
  try {
    let reports = await Report.find({ submittedBy: req.user._id })
      .select(MY_REPORT_LIST_FIELDS)
      .lean();

    reports = dedupeReportsForDisplay(reports);

    const summary = {
      statusCounts: {
        all: reports.length,
        draft: 0,
        submitted: 0,
      },
      typeCountsByStatus: {
        all: { all: reports.length },
        draft: { all: 0 },
        submitted: { all: 0 },
      },
      timingCountsByStatus: {
        draft: createTimingCountBucket(),
        submitted: createTimingCountBucket(),
      },
      typeCountsByStatusAndTiming: {
        draft: createTypeCountBucketsByTiming(),
        submitted: createTypeCountBucketsByTiming(),
      },
    };

    for (const report of reports) {
      const statusKey = report.status === "submitted" ? "submitted" : "draft";
      const typeKey = report.reportType || "unknown";
      const timingKey = report.isLateSubmission ? "arrears" : "onTime";

      summary.statusCounts[statusKey] += 1;
      summary.typeCountsByStatus[statusKey].all += 1;
      summary.typeCountsByStatus[statusKey][typeKey] =
        (summary.typeCountsByStatus[statusKey][typeKey] || 0) + 1;
      summary.timingCountsByStatus[statusKey].all += 1;
      summary.timingCountsByStatus[statusKey][timingKey] += 1;

      summary.typeCountsByStatusAndTiming[statusKey].all.all += 1;
      summary.typeCountsByStatusAndTiming[statusKey].all[typeKey] =
        (summary.typeCountsByStatusAndTiming[statusKey].all[typeKey] || 0) + 1;

      summary.typeCountsByStatusAndTiming[statusKey][timingKey].all += 1;
      summary.typeCountsByStatusAndTiming[statusKey][timingKey][typeKey] =
        (summary.typeCountsByStatusAndTiming[statusKey][timingKey][typeKey] || 0) + 1;

      summary.typeCountsByStatus.all[typeKey] =
        (summary.typeCountsByStatus.all[typeKey] || 0) + 1;
    }

    res.status(200).json(summary);
  } catch (error) {
    next(error);
  }
};

export const getMyDraft = async (req, res, next) => {
  try {
    const { reportType, weekType, weekDate, customReportType } = req.query;

    let weekReference;
    if (req.query.weekReference) {
      weekReference = normalizeWeekReference(req.query.weekReference);
    } else if (weekDate) {
      weekReference = normalizeWeekReference(weekDate);
    } else if (weekType === "late" || weekType === "past") {
      weekReference = getPreviousPortalWeekReference();
    } else {
      weekReference = getPortalWeekReferenceForNow();
    }

    let isLateSubmission = weekType === "late" || weekType === "past";

    ({ isLateSubmission, weekReference } = resolveReportWeekReference({
      weekType,
      weekDate,
      weekReference: req.query.weekReference,
      currentWeekReference: getPortalWeekReferenceForNow(),
    }));

    const identityFilter = buildReportIdentityFilter({
      userId: req.user._id,
      reportType,
      weekReference,
      isLateSubmission,
      customReportType,
    });

    const { canonicalReport: report } = await reconcileReportIdentity(identityFilter);

    res.status(200).json({ draft: report || null });
  } catch (error) {
    next(error);
  }
};

export const getAllReports = async (req, res, next) => {
  try {
    const {
      weekReference,
      reportType,
      status,
      isLateSubmission,
      workerId,
      dateFrom,
      dateTo,
      exactWeekRef,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    if (reportType) filter.reportType = reportType;
    if (status) filter.status = status;
    if (workerId) filter.submittedBy = workerId;

    const hasLateFilter =
      isLateSubmission !== undefined &&
      isLateSubmission !== null &&
      isLateSubmission !== "";

    if (hasLateFilter) {
      filter.isLateSubmission = isLateSubmission === "true";
    }

    if (dateFrom && exactWeekRef === "true") {
      filter.weekReference = normalizeWeekReference(dateFrom);
    } else if (dateFrom || dateTo) {
      filter.weekReference = {};
      if (dateFrom) filter.weekReference.$gte = normalizeWeekReference(dateFrom);
      if (dateTo) filter.weekReference.$lte = normalizeWeekReference(dateTo);
    }

    if (weekReference) {
      filter.weekReference = normalizeWeekReference(weekReference);
    }

    const total = await Report.countDocuments(filter);

    const reports = await Report.find(filter)
      .populate("submittedBy", "fullName workerId department")
      .sort({ weekReference: -1, submittedAt: -1, createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.status(200).json({
      reports,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    next(error);
  }
};

export const getWorkerReportAnalysis = async (req, res, next) => {
  try {
    const {
      search = "",
      department = "",
      reportType = "",
      timing = "",
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
      sortBy = "totalSubmitted",
      sortDir = "desc",
    } = req.query;

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(5, Number(limit) || 20));
    const normalizedSearch = search.toString().trim();
    const userFilter = {
      status: "approved",
      workerId: { $ne: "001" },
    };

    if (department) {
      userFilter.department = department;
    }

    if (normalizedSearch) {
      const escaped = normalizedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      userFilter.$or = [
        { fullName: regex },
        { workerId: regex },
        { email: regex },
        { department: regex },
      ];
    }

    const workers = await User.find(userFilter)
      .select("fullName workerId email department role status")
      .lean();
    const workerIds = workers.map((worker) => worker._id);

    const reportFilter = {
      status: "submitted",
      submittedBy: { $in: workerIds },
    };

    if (REPORT_ANALYSIS_TYPE_SET.has(reportType)) {
      reportFilter.reportType = reportType;
    }

    if (timing === "on-time") {
      reportFilter.isLateSubmission = false;
    } else if (timing === "arrears") {
      reportFilter.isLateSubmission = true;
    }

    if (dateFrom || dateTo) {
      reportFilter.weekReference = {};
      if (dateFrom) reportFilter.weekReference.$gte = normalizeWeekReference(dateFrom);
      if (dateTo) reportFilter.weekReference.$lte = normalizeWeekReference(dateTo);
    }

    const aggregateRows = workerIds.length
      ? await Report.aggregate([
          { $match: reportFilter },
          {
            $group: {
              _id: {
                worker: "$submittedBy",
                reportType: "$reportType",
              },
              count: { $sum: 1 },
              onTime: {
                $sum: {
                  $cond: [{ $eq: ["$isLateSubmission", true] }, 0, 1],
                },
              },
              arrears: {
                $sum: {
                  $cond: [{ $eq: ["$isLateSubmission", true] }, 1, 0],
                },
              },
              firstSubmittedAt: { $min: "$submittedAt" },
              latestSubmittedAt: { $max: "$submittedAt" },
            },
          },
        ])
      : [];

    const analysisByWorker = new Map();

    workers.forEach((worker) => {
      const typeCounts = REPORT_ANALYSIS_TYPES.reduce((acc, type) => {
        acc[type] = 0;
        return acc;
      }, {});

      analysisByWorker.set(worker._id.toString(), {
        worker,
        totalSubmitted: 0,
        onTimeSubmitted: 0,
        arrearsSubmitted: 0,
        typeCounts,
        firstSubmittedAt: null,
        latestSubmittedAt: null,
      });
    });

    aggregateRows.forEach((row) => {
      const workerId = row._id.worker?.toString();
      const reportTypeKey = REPORT_ANALYSIS_TYPE_SET.has(row._id.reportType)
        ? row._id.reportType
        : "custom";
      const entry = analysisByWorker.get(workerId);
      if (!entry) return;

      entry.typeCounts[reportTypeKey] =
        (entry.typeCounts[reportTypeKey] || 0) + row.count;
      entry.totalSubmitted += row.count;
      entry.onTimeSubmitted += row.onTime;
      entry.arrearsSubmitted += row.arrears;

      if (
        row.firstSubmittedAt &&
        (!entry.firstSubmittedAt || row.firstSubmittedAt < entry.firstSubmittedAt)
      ) {
        entry.firstSubmittedAt = row.firstSubmittedAt;
      }

      if (
        row.latestSubmittedAt &&
        (!entry.latestSubmittedAt || row.latestSubmittedAt > entry.latestSubmittedAt)
      ) {
        entry.latestSubmittedAt = row.latestSubmittedAt;
      }
    });

    const sortDirection = sortDir === "asc" ? 1 : -1;
    const getSortValue = (entry) => {
      if (REPORT_ANALYSIS_TYPE_SET.has(sortBy)) {
        return Number(entry.typeCounts[sortBy] || 0);
      }

      if (sortBy === "fullName") return entry.worker?.fullName || "";
      if (sortBy === "workerId") return entry.worker?.workerId || "";
      if (sortBy === "department") return entry.worker?.department || "";
      if (sortBy === "onTimeSubmitted") return Number(entry.onTimeSubmitted || 0);
      if (sortBy === "arrearsSubmitted") return Number(entry.arrearsSubmitted || 0);
      if (sortBy === "latestSubmittedAt") {
        return entry.latestSubmittedAt ? new Date(entry.latestSubmittedAt).getTime() : 0;
      }

      return Number(entry.totalSubmitted || 0);
    };

    const analysis = [...analysisByWorker.values()].sort((a, b) => {
      const aValue = getSortValue(a);
      const bValue = getSortValue(b);

      if (typeof aValue === "string" || typeof bValue === "string") {
        const compare = String(aValue).localeCompare(String(bValue));
        if (compare !== 0) return compare * sortDirection;
      } else if (aValue !== bValue) {
        return (aValue - bValue) * sortDirection;
      }

      return (a.worker?.fullName || "").localeCompare(b.worker?.fullName || "");
    });

    const totals = analysis.reduce(
      (acc, entry) => {
        acc.totalSubmitted += entry.totalSubmitted;
        acc.onTimeSubmitted += entry.onTimeSubmitted;
        acc.arrearsSubmitted += entry.arrearsSubmitted;
        REPORT_ANALYSIS_TYPES.forEach((type) => {
          acc.typeCounts[type] += entry.typeCounts[type] || 0;
        });
        return acc;
      },
      {
        totalWorkers: analysis.length,
        totalSubmitted: 0,
        onTimeSubmitted: 0,
        arrearsSubmitted: 0,
        typeCounts: REPORT_ANALYSIS_TYPES.reduce((acc, type) => {
          acc[type] = 0;
          return acc;
        }, {}),
      }
    );

    const skip = (safePage - 1) * safeLimit;
    const paginatedAnalysis = analysis.slice(skip, skip + safeLimit);

    const departments = [...new Set(workers.map((worker) => worker.department || "unassigned"))]
      .sort((a, b) => a.localeCompare(b));

    res.status(200).json({
      analysis: paginatedAnalysis,
      totals,
      departments,
      reportTypes: REPORT_ANALYSIS_TYPES,
      total: analysis.length,
      page: safePage,
      totalPages: Math.ceil(analysis.length / safeLimit),
    });
  } catch (error) {
    next(error);
  }
};

export const getReportById = async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.reportId)
      .populate("submittedBy", "fullName workerId department")
      .populate("customReportType", "name description")
      .lean();

    if (!report) {
      return res.status(404).json({ message: "Report not found." });
    }

    const reportOwnerId =
      report?.submittedBy?._id?.toString?.() || report?.submittedBy?.toString?.();
    const isOwner = reportOwnerId === req.user._id.toString();
    const isAdminLevel = ADMIN_LEVEL_ROLES.has(req.user.role);

    if (!isOwner && !isAdminLevel) {
      return res.status(403).json({ message: "You can only view your own reports." });
    }

    res.status(200).json({ report });
  } catch (error) {
    next(error);
  }
};

export const lockAllReports = async (weekReference) => {
  await Report.updateMany(
    { weekReference, status: "submitted" },
    { isEditable: false }
  );
};

export const getMyCellNames = async (req, res, next) => {
  try {
    const reports = await Report.find({
      submittedBy: req.user._id,
      reportType: "evangelism",
      $or: [
        { "cellData.cells.0": { $exists: true } },
        { "cellData.peopleTakenToCellGroups.0": { $exists: true } },
        { "cellData.peopleTakenToCell.0": { $exists: true } },
      ],
    })
      .select(
        "cellData.cells.cellName cellData.peopleTakenToCellGroups.cellName cellData.peopleTakenToCell.cellName"
      )
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(20)
      .lean();

    const names = new Set();

    for (const r of reports) {
      for (const cell of r.cellData?.cells || []) {
        if (cell.cellName?.trim()) names.add(cell.cellName.trim());
      }
      for (const group of r.cellData?.peopleTakenToCellGroups || []) {
        if (group.cellName?.trim()) names.add(group.cellName.trim());
      }
      for (const person of r.cellData?.peopleTakenToCell || []) {
        if (person.cellName?.trim()) names.add(person.cellName.trim());
      }
    }

    res.status(200).json({ cellNames: [...names] });
  } catch (error) {
    next(error);
  }
};

export const deleteMyDraftReport = async (req, res, next) => {
  try {
    const { reportId } = req.params;
    const userId = req.user?._id || req.user?.id;

    const report = await Report.findById(reportId);

    if (!report) {
      return res.status(404).json({ message: "Draft not found." });
    }

    if (report.status !== "draft") {
      return res.status(400).json({
        message: "Only draft reports can be deleted.",
      });
    }

    if (String(report.submittedBy) !== String(userId)) {
      return res.status(403).json({
        message: "You can only delete your own draft.",
      });
    }

    await Report.findByIdAndDelete(reportId);

    return res.status(200).json({
      message: "Draft deleted permanently.",
    });
  } catch (error) {
    next(error);
  }
};
