import express from "express";
import {
  getMyMetrics,
  getMyMetricsHistory,
  getAllMetrics,
  getQualifiedList,
  getDisqualifiedList,
  getLateMetrics,
  triggerManualProcessing,
} from "../controllers/metricsController.js";
import { protect } from "../middleware/authMiddleware.js";
import { isAdminLevel } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/me", protect, getMyMetrics);
router.get("/me/history", protect, getMyMetricsHistory);
router.get("/", protect, isAdminLevel, getAllMetrics);
router.get("/qualified", protect, isAdminLevel, getQualifiedList);
router.get("/disqualified", protect, isAdminLevel, getDisqualifiedList);
router.get("/late", protect, isAdminLevel, getLateMetrics);
router.post("/process", protect, isAdminLevel, triggerManualProcessing);

export default router;