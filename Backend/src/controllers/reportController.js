import Report from "../models/reportModel.js";
import User from "../models/userModel.js";
import { processWeeklyMetrics } from "../services/metricsService.js";
import PortalWindow from "../models/portalWindowModel.js";
import { processLateMetrics } from "../services/metricsService.js";
import { createNotification } from "../services/notificationService.js";

const getWeekReference = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const getPreviousWeekReference = () => {
  const current = getWeekReference();
  const prev = new Date(current);
  prev.setDate(prev.getDate() - 7);
  return prev;
};

export const saveDraft = async (req, res, next) => {
  try {
    const { reportType, weekType, weekDate, isEdit, customReportType, ...reportData } = req.body;

    const isLateSubmission = weekType === "late" || weekType === "past";
    let weekReference;
    if (weekDate) {
      weekReference = new Date(weekDate);
    } else if (isLateSubmission) {
      weekReference = getPreviousWeekReference();
    } else {
      weekReference = getWeekReference();
    }

    let report = await Report.findOne({
      submittedBy: req.user._id,
      reportType,
      weekReference,
      isLateSubmission,
    });

    // Block saving draft over a locked arrears report
    if (report && report.status === "submitted" && isLateSubmission && !report.isEditable) {
      return res.status(400).json({ message: "This arrears report is locked and cannot be edited." });
    }

    if (report) {
      // Update existing draft or current week submitted report
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
    const portalOpen = await PortalWindow.findOne({ opensAt: { $lte: now }, closesAt: { $gte: now }, isOpen: true });

    if (!portalOpen) {
      return res.status(403).json({ message: "The submission portal is currently closed. It opens every Friday." });
    }

    const { reportType, weekType, weekDate, isEdit, ...reportData } = req.body;
    const isLateSubmission = weekType === "late" || weekType === "past";
    let weekReference;
    if (weekDate) {
      weekReference = new Date(weekDate);
    } else if (isLateSubmission) {
      weekReference = getPreviousWeekReference();
    } else {
      weekReference = getWeekReference();
    }

    if (reportData.evangelismData?.souls) {
      const souls = reportData.evangelismData.souls;
      reportData.evangelismData.totalSouls = souls.length;
      // Only souls aged 12+ count toward qualification (minimum 10 to qualify)
      reportData.evangelismData.qualifyingSouls = souls.filter(
        (s) => !s.age || s.age >= 12
      ).length;

      // Church attendees - only 12+ count toward the 4-person requirement
      if (reportData.churchAttendees) {
        reportData.churchAttendees = reportData.churchAttendees.map((a) => ({
          ...a,
          countsForQualification: !a.age || a.age >= 12,
        }));
      }

      // ── Partner duplicate check ─────────────────────────────────────────────
      // Partners are now stored as Worker IDs (e.g. "042") — exact, reliable match
      // Also support legacy name-based partners for backwards compatibility
      const partnerEntries = reportData.evangelismData?.evangelismPartners || [];

      if (partnerEntries.length > 0 && souls.length > 0) {
        // Separate Worker IDs (numeric strings) from plain names
        const partnerWorkerIds = partnerEntries
          .map((p) => p.trim())
          .filter((p) => p && p.toLowerCase() !== "none" && /^\d+$/.test(p.replace(/^0+/, "") ? p : ""));

        const partnerNames = partnerEntries
          .map((p) => p.trim())
          .filter((p) => p && p.toLowerCase() !== "none" && !/^\d+$/.test(p));

        // Look up partner users by Worker ID first (reliable), then fall back to name
        let partnerUserIds = [];

        if (partnerWorkerIds.length > 0) {
          const partnerUsers = await User.find({
            workerId: { $in: partnerWorkerIds },
          }).select("_id fullName workerId");
          partnerUserIds = partnerUsers.map((u) => u._id);
        }

        // Find this week's submitted evangelism reports from confirmed partners
        const partnerReports = await Report.find({
          reportType:    "evangelism",
          weekReference,
          status:        "submitted",
          submittedBy:   {
            $ne: req.user._id,
            ...(partnerUserIds.length > 0 ? { $in: partnerUserIds } : {}),
          },
        }).populate("submittedBy", "fullName workerId");

        // If no Worker ID match was found, fall back to name matching (legacy)
        const partnerSubmissions = partnerUserIds.length > 0
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
              // Match by name + phone (both must match) OR name + status if no phone given
              const alreadyClaimed = pr.evangelismData?.souls?.some((ps) => {
                const nameMatch = ps.fullName?.toLowerCase().trim() === soul.fullName?.toLowerCase().trim();
                if (!nameMatch) return false;
                // If both have phone — require phone match too
                if (ps.phone && soul.phone) {
                  return ps.phone.replace(/\s+/g, "") === soul.phone.replace(/\s+/g, "");
                }
                // If no phone on either — name + status match is enough
                return ps.status === soul.status;
              });

              if (alreadyClaimed) {
                duplicates.push({
                  soul:      soul.fullName,
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

    let report = await Report.findOne({
      submittedBy: req.user._id,
      reportType,
      weekReference,
      isLateSubmission,
    });

    // Block duplicate current week submission (must edit existing instead)
    if (report && report.status === "submitted" && !isLateSubmission && !isEdit) {
      return res.status(400).json({
        message: "You have already submitted this report type for the current week. Please edit your existing submission.",
        existingReportId: report._id,
        canEdit: report.isEditable,
      });
    }

    if (report) {
      if (!report.isEditable && isLateSubmission) {
        return res.status(403).json({ message: "This arrears report is locked and cannot be edited." });
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
    } else {
      // Trigger running metrics calculation so qualification updates in real time
      processWeeklyMetrics(weekReference).catch((err) =>
        console.error("Background metrics error:", err.message)
      );
    }

    res.status(200).json({ message: "Report submitted successfully.", report });
  } catch (error) {
    next(error);
  }
};

export const editSubmittedReport = async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.reportId);

    if (!report) return res.status(404).json({ message: "Report not found." });
    if (report.submittedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You can only edit your own reports." });
    }
    if (!report.isEditable) {
      return res.status(403).json({ message: "This report is locked and cannot be edited." });
    }

    const { reportType, weekType, weekDate, isEdit, ...reportData } = req.body;
    Object.assign(report, reportData);
    report.submittedAt = new Date();
    await report.save();

    res.status(200).json({ message: "Report updated successfully.", report });
  } catch (error) {
    next(error);
  }
};

export const getMyReports = async (req, res, next) => {
  try {
    const { weekReference, reportType, status, weekType, limit = 20, page = 1 } = req.query;
    const filter = { submittedBy: req.user._id };

    if (weekReference) filter.weekReference = new Date(weekReference);
    if (reportType) filter.reportType = reportType;
    if (status) filter.status = status;
    if (weekType === "current") filter.isLateSubmission = false;
    if (weekType === "late") filter.isLateSubmission = true;

    const query = Report.find(filter).sort({ createdAt: -1 });
    const skip = (Number(page) - 1) * Number(limit);
    const total = await Report.countDocuments(filter);
    query.skip(skip).limit(Number(limit));

    const reports = await query;
    res.status(200).json({ reports, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (error) {
    next(error);
  }
};

export const getMyDraft = async (req, res, next) => {
  try {
    const { reportType, weekType, weekDate } = req.query;

    // Determine weekReference
    let weekReference;
    if (weekDate) {
      weekReference = new Date(weekDate);
    } else if (weekType === "late" || weekType === "past") {
      weekReference = getPreviousWeekReference();
    } else {
      weekReference = getWeekReference();
    }

    const isLateSubmission = weekType === "late" || weekType === "past";

    // First check for a draft
    let report = await Report.findOne({
      submittedBy: req.user._id,
      reportType,
      weekReference,
      isLateSubmission,
      status: "draft",
    });

    // If no draft, check for a submitted report (for edit mode)
    if (!report) {
      report = await Report.findOne({
        submittedBy: req.user._id,
        reportType,
        weekReference,
        isLateSubmission,
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
    const { weekReference, reportType, status, isLateSubmission, workerId, dateFrom, dateTo, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (weekReference) filter.weekReference = new Date(weekReference);
    if (reportType) filter.reportType = reportType;
    if (status) filter.status = status;
    if (isLateSubmission !== undefined && isLateSubmission !== "") {
      filter.isLateSubmission = isLateSubmission === "true";
    }
    if (workerId) filter.submittedBy = workerId;

    if (dateFrom || dateTo) {
      filter.submittedAt = {};
      if (dateFrom) filter.submittedAt.$gte = new Date(dateFrom);
      if (dateTo) filter.submittedAt.$lte = new Date(dateTo);
    }

    const total = await Report.countDocuments(filter);
    const reports = await Report.find(filter)
      .populate("submittedBy", "fullName workerId department")
      .sort({ weekReference: -1, submittedAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.status(200).json({ reports });
  } catch (error) {
    next(error);
  }
};

export const getReportById = async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.reportId).populate("submittedBy", "fullName workerId department");

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

// Returns unique cell names from worker's past evangelism reports
// Used by the form to suggest previously entered cell names
export const getMyCellNames = async (req, res, next) => {
  try {
    const reports = await Report.find({
      submittedBy: req.user._id,
      reportType:  "evangelism",
      status:      "submitted",
      "cellData.cells.0": { $exists: true }, // has at least one cell
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