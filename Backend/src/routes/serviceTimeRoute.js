import express from "express";
import ServiceTime from "../models/serviceTimeModel.js";
import { protect } from "../middleware/authMiddleware.js";
import { isAdminLevel } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const times = await ServiceTime.find({ isActive: true }).sort({ createdAt: 1 });
    res.status(200).json({ times });
  } catch (error) {
    next(error);
  }
});

router.post("/", protect, isAdminLevel, async (req, res, next) => {
  try {
    const time = await ServiceTime.create({ ...req.body, updatedBy: req.user._id });
    res.status(201).json({ message: "Service time created.", time });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", protect, isAdminLevel, async (req, res, next) => {
  try {
    const time = await ServiceTime.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user._id },
      { new: true }
    );
    res.status(200).json({ message: "Service time updated.", time });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", protect, isAdminLevel, async (req, res, next) => {
  try {
    await ServiceTime.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Service time removed." });
  } catch (error) {
    next(error);
  }
});

export default router;