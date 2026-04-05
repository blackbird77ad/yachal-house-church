import express from "express";
import {
  register, login, getMe, approveWorker, suspendWorker,
  reinstateWorker, changePassword, adminCreateWorker,
  adminBulkCreateWorkers, forgotPassword, adminResetPassword,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { isAdminLevel } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.get("/me", protect, getMe);
router.put("/change-password", protect, changePassword);

// Admin only
router.put("/approve/:workerId", protect, isAdminLevel, approveWorker);
router.put("/suspend/:workerId", protect, isAdminLevel, suspendWorker);
router.put("/reinstate/:workerId", protect, isAdminLevel, reinstateWorker);
router.put("/reset-password/:workerId", protect, isAdminLevel, adminResetPassword);
router.post("/create-worker", protect, isAdminLevel, adminCreateWorker);
router.post("/bulk-create-workers", protect, isAdminLevel, adminBulkCreateWorkers);

export default router;