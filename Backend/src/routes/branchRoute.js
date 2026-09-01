import express from "express";
import {
  createBranch,
  deleteBranch,
  getBranchAdminCandidates,
  getBranches,
  getPublicBranches,
  reinstateBranch,
  suspendBranch,
  updateBranch,
} from "../controllers/branchController.js";
import { protect } from "../middleware/authMiddleware.js";
import { isAdminLevel } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/public", getPublicBranches);

router.use(protect, isAdminLevel);

router.get("/", getBranches);
router.get("/admin-candidates", getBranchAdminCandidates);
router.post("/", createBranch);
router.put("/:branchId", updateBranch);
router.put("/:branchId/suspend", suspendBranch);
router.put("/:branchId/reinstate", reinstateBranch);
router.delete("/:branchId", deleteBranch);

export default router;
