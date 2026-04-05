import express from "express";
import {
  createReportType,
  getAllReportTypes,
  getReportTypeById,
  updateReportType,
  deleteReportType,
} from "../controllers/reportTypeController.js";
import { protect } from "../middleware/authMiddleware.js";
import { isAdminLevel } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/", protect, getAllReportTypes);
router.get("/:reportTypeId", protect, getReportTypeById);
router.post("/", protect, isAdminLevel, createReportType);
router.put("/:reportTypeId", protect, isAdminLevel, updateReportType);
router.delete("/:reportTypeId", protect, isAdminLevel, deleteReportType);

export default router;