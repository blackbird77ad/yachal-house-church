import express from "express";
import {
  getDashboardSummary,
  getPendingWorkers,
  overridePortal,
  getLeaderboard,
  createSpecialService,
  sendBulkNotification,
} from "../controllers/adminController.js";
import { protect } from "../middleware/authMiddleware.js";
import { isAdminLevel } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(protect, isAdminLevel);

router.get("/dashboard", getDashboardSummary);
router.get("/pending-workers", getPendingWorkers);
router.post("/portal-override", overridePortal);
router.get("/leaderboard", getLeaderboard);
router.post("/special-service", createSpecialService);
router.post("/notify", sendBulkNotification);

export default router;