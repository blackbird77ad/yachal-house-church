import express from "express";
import { getPortalStatus, getPortalHistory } from "../controllers/portalController.js";
import { protect } from "../middleware/authMiddleware.js";
import { hasAllBranchOversight, isAdminLevel } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/status", protect, getPortalStatus);
router.get("/history", protect, isAdminLevel, hasAllBranchOversight, getPortalHistory);

export default router;
