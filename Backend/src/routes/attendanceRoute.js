import express from "express";
import {
  createSession,
  joinSession,
  checkInWorker,
  manualCheckIn,
  getSessionAttendance,
  getActiveSession,
  closeSession,
} from "../controllers/attendanceController.js";
import { protect } from "../middleware/authMiddleware.js";
import { isAdminLevel } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/active-session", getActiveSession);
router.post("/session", createSession);
router.put("/session/:sessionId/join", joinSession);
router.put("/session/:sessionId/close", isAdminLevel, closeSession);
router.get("/session/:sessionId", getSessionAttendance);
router.post("/check-in", checkInWorker);
router.post("/manual-check-in", checkInWorker, manualCheckIn);

export default router;