import express from "express";
import {
  createSession, checkInWorker, getActiveSession,
  getSessionAttendance, getAttendanceHistory,
  closeSession, getSessionReport, searchWorkerForCheckIn,
} from "../controllers/attendanceController.js";
import { protect } from "../middleware/authMiddleware.js";
import { isAdminLevel } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/active",              protect, getActiveSession);
router.get("/history",             protect, isAdminLevel, getAttendanceHistory);
router.get("/search",              protect, searchWorkerForCheckIn);
router.post("/session",            protect, createSession);
router.post("/check-in",           protect, checkInWorker);
router.get("/session/:sessionId",  protect, getSessionAttendance);
router.get("/report/:sessionId",   protect, isAdminLevel, getSessionReport);
router.put("/close/:sessionId",    protect, closeSession);

export default router;