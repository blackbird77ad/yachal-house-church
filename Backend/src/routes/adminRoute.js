import express from "express";
import {
  getDashboardSummary,
  getPendingWorkers,
  overridePortal,
  cleanupPortalRecords,
  fixReportWeekReferences,
  getLeaderboard,
  createSpecialService,
  sendBulkNotification,
} from "../controllers/adminController.js";
import { protect } from "../middleware/authMiddleware.js";
import { hasAllBranchOversight, isAdminLevel } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(protect, isAdminLevel);

router.get("/dashboard", getDashboardSummary);
router.get("/pending-workers", getPendingWorkers);
router.post("/portal-override", hasAllBranchOversight, overridePortal);
router.post("/portal-cleanup", hasAllBranchOversight, cleanupPortalRecords);
router.post("/fix-week-references", hasAllBranchOversight, fixReportWeekReferences);
router.get("/leaderboard", getLeaderboard);
router.post("/special-service", createSpecialService);
router.post("/notify", sendBulkNotification);

export default router;
