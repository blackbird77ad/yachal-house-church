import express from "express";
import {
  getRosterBuilderData, createOrUpdateRoster, publishRoster,
  getRosters, getRosterById, getWhatsAppText, getMyAssignment,
  resetRosterAssignments,
} from "../controllers/rosterController.js";
import { protect } from "../middleware/authMiddleware.js";
import { isAdminLevel } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/my-assignment", protect, getMyAssignment);
router.get("/builder", protect, isAdminLevel, getRosterBuilderData);
router.get("/", protect, isAdminLevel, getRosters);
router.post("/", protect, isAdminLevel, createOrUpdateRoster);
router.get("/:rosterId/whatsapp", protect, isAdminLevel, getWhatsAppText);
router.get("/:rosterId", protect, getRosterById);
router.put("/:rosterId/publish", protect, isAdminLevel, publishRoster);
router.put("/:rosterId/reset", protect, isAdminLevel, resetRosterAssignments);

export default router;
