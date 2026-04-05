import express from "express";
import {
  getAllWorkers,
  getWorkerById,
  getWorkerByWorkerId,
  searchWorkersByName,
  updateWorkerProfile,
  getWorkerMetrics,
  getMyProfile,
  updateMyProfile,
} from "../controllers/workerController.js";
import { protect } from "../middleware/authMiddleware.js";
import { isAdminLevel } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/me", protect, getMyProfile);
router.put("/me", protect, updateMyProfile);
router.get("/search", protect, searchWorkersByName);
router.get("/by-worker-id/:workerId", protect, getWorkerByWorkerId);
router.get("/", protect, isAdminLevel, getAllWorkers);
router.get("/:workerId", protect, isAdminLevel, getWorkerById);
router.put("/:workerId", protect, isAdminLevel, updateWorkerProfile);
router.get("/:workerId/metrics", protect, isAdminLevel, getWorkerMetrics);

export default router;