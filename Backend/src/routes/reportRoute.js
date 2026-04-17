import express from "express";
import {
  saveDraft,
  submitReport,
  editSubmittedReport,
  getMyReports,
  getMyReportSummary,
  getMyCellNames,
  getMyDraft,
  getAllReports,
  getReportById,
  deleteMyDraftReport,
} from "../controllers/reportController.js";
import { protect } from "../middleware/authMiddleware.js";
import { isAdminLevel } from "../middleware/roleMiddleware.js";
import { reportLimiter } from "../middleware/rateLimiter.js";


const router = express.Router();

router.post("/draft", protect, reportLimiter, saveDraft);
router.post("/submit", protect, reportLimiter, submitReport);
router.put("/edit/:reportId", protect, reportLimiter, editSubmittedReport);
router.get("/my-reports",    protect, getMyReports);
router.get("/my-report-summary", protect, getMyReportSummary);
router.get("/my-cell-names", protect, getMyCellNames);
router.get("/my-draft", protect, getMyDraft);
router.get("/", protect, isAdminLevel, getAllReports);
router.get("/:reportId", protect, getReportById);
router.delete("/my-drafts/:reportId", protect, deleteMyDraftReport);

export default router;
