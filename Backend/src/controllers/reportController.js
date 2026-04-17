import Report from "../models/reportModel.js";
import User from "../models/userModel.js";
import {
  ensureWeeklyMetricsFresh,
  processLateMetrics,
} from "../services/metricsService.js";
import { getCurrentPortalState } from "../services/portalStateService.js";
import {
  getPortalWeekReferenceForNow,
  getPreviousPortalWeekReference,
  normalizeWeekReference,
} from "../utils/portalWeek.js";

// Portal week helpers
const getPortalWeekReference = async () => getPortalWeekReferenceForNow();

const getPreviousWeekReference = async () => getPreviousPortalWeekReference();

const getWeekReference = getPortalWeekReference;

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

export const saveDraft = async (req, res, next) => {
  try {
    const { reportType, weekType, weekDate, isEdit, customReportType, ...reportData } = req.body;

    const isLateSubmission = weekType === "late" || weekType === "past";
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

    let report = await Report.findOne(
      buildReportIdentityFilter({
        userId: req.user._id,
        reportType,
        weekReference,
        isLateSubmission,
        customReportType,
      })
    );

    if (report && report.status === "submitted" && isLateSubmission && !report.isEditable) {
      return res.status(400).json({
        message: "This arrears report is locked and cannot be edited.",
      });
    }

    if (report) {
      Object.assign(report, reportData);
      if (report.status !== "submitted") report.status = "draft";
      await report.save();
    } else {
      report = await Report.create({
        submittedBy: req.user._id,
        reportType,
        weekReference,
        isLateSubmission,
        customReportType: customReportType || null,
        status: "draft",
        ...reportData,
      });
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

    const { reportType, weekType, weekDate, isEdit, ...reportData } = req.body;
    const isLateSubmission = weekType === "late" || weekType === "past";

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
        const partnerWorkerIds = partnerEntries
          .map((p) => p.trim())
          .filter((p) => p && p.toLowerCase() !== "none" && /^\d+$/.test(p));

        const partnerNames = partnerEntries
          .map((p) => p.trim())
          .filter((p) => p && p.toLowerCase() !== "none" && !/^\d+$/.test(p));

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

    let report = await Report.findOne(
      buildReportIdentityFilter({
        userId: req.user._id,
        reportType,
        weekReference,
        isLateSubmission,
        customReportType: req.body.customReportType,
      })
    );

    if (report && report.status === "submitted" && !isLateSubmission && !isEdit) {
      return res.status(400).json({
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
      await report.save();
    } else {
      report = await Report.create({
        submittedBy: req.user._id,
        reportType,
        weekReference,
        isLateSubmission,
        status: "submitted",
        submittedAt: now,
        isEditable: !isLateSubmission,
        ...reportData,
      });
    }

    if (isLateSubmission) {
      await processLateMetrics(req.user._id, weekReference);
    } else if (reportType === "evangelism") {
      await ensureWeeklyMetricsFresh(weekReference, {
        maxAgeMinutes: 0,
        force: true,
      });
    }

    res.status(200).json({ message: "Report submitted successfully.", report });
  } catch (error) {
    next(error);
  }
};

export const editSubmittedReport = async (req, res, next) => {
  try {
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

    const { reportType, weekType, weekDate, isEdit, ...reportData } = req.body;
    Object.assign(report, reportData);
    if (!report.submittedAt) {
      report.submittedAt = new Date();
    }
    await report.save();

    if (!report.isLateSubmission && report.reportType === "evangelism") {
      await ensureWeeklyMetricsFresh(report.weekReference, {
        maxAgeMinutes: 0,
        force: true,
      });
    }

    res.status(200).json({ message: "Report updated successfully.", report });
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
    if (status) filter.status = status;
    if (weekType === "current") filter.isLateSubmission = false;
    if (weekType === "late") filter.isLateSubmission = true;

    const query = Report.find(filter).sort({ createdAt: -1 });
    const skip = (Number(page) - 1) * Number(limit);
    const total = await Report.countDocuments(filter);

    query.skip(skip).limit(Number(limit));

    const reports = await query;

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

export const getMyReportSummary = async (req, res, next) => {
  try {
    const reports = await Report.find({ submittedBy: req.user._id })
      .select("status reportType")
      .lean();

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
    };

    for (const report of reports) {
      const statusKey = report.status === "submitted" ? "submitted" : "draft";
      const typeKey = report.reportType || "unknown";

      summary.statusCounts[statusKey] += 1;
      summary.typeCountsByStatus[statusKey].all += 1;
      summary.typeCountsByStatus[statusKey][typeKey] =
        (summary.typeCountsByStatus[statusKey][typeKey] || 0) + 1;

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

    const isLateSubmission = weekType === "late" || weekType === "past";

    const baseFilter = buildReportIdentityFilter({
      userId: req.user._id,
      reportType,
      weekReference,
      isLateSubmission,
      customReportType,
    });

    let report = await Report.findOne({
      ...baseFilter,
      status: "draft",
    });

    if (!report) {
      report = await Report.findOne({
        ...baseFilter,
        status: "submitted",
      });
    }

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

export const getReportById = async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.reportId).populate(
      "submittedBy",
      "fullName workerId department"
    );

    if (!report) {
      return res.status(404).json({ message: "Report not found." });
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
      status: "submitted",
      "cellData.cells.0": { $exists: true },
    })
      .select("cellData.cells.cellName")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const names = new Set();

    for (const r of reports) {
      for (const cell of r.cellData?.cells || []) {
        if (cell.cellName?.trim()) names.add(cell.cellName.trim());
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
