import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema({
  worker:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  session:     { type: mongoose.Schema.Types.ObjectId, ref: "FrontDeskSession", required: true },
  serviceType: { type: String, enum: ["tuesday", "sunday", "special"], required: true },
  serviceDate: { type: Date, required: true },
  checkInTime: { type: Date, required: true },

  // Timing category relative to service start
  timingCategory: {
    type: String,
    enum: ["early-60plus", "early-30to60", "early-15to30", "early-0to15", "late"],
    required: true,
  },
  minutesBeforeService: { type: Number }, // negative = late

  isOnDuty:            { type: Boolean, default: false },
  verifiedByFrontDesk: { type: Boolean, default: true },
  loggedBy:            { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  manualEntry:         { type: Boolean, default: false },
  notes:               { type: String },
}, { timestamps: true });

attendanceSchema.index({ worker: 1, serviceDate: 1 });
attendanceSchema.index({ session: 1, checkInTime: 1 });
attendanceSchema.index({ serviceType: 1, serviceDate: 1 });

// TTL: auto-delete attendance records 180 days after service date
attendanceSchema.index({ serviceDate: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

export default mongoose.model("Attendance", attendanceSchema);