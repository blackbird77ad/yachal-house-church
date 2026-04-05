import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    worker: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    session: { type: mongoose.Schema.Types.ObjectId, ref: "FrontDeskSession", required: true },

    serviceType: {
      type: String,
      enum: ["tuesday", "sunday", "special"],
      required: true,
    },

    serviceDate: { type: Date, required: true },

    checkInTime: { type: Date, required: true },

    isOnDuty: { type: Boolean, default: false },

    isLate: { type: Boolean, default: false },

    verifiedByFrontDesk: { type: Boolean, default: true },

    loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    manualEntry: { type: Boolean, default: false },

    manualTime: { type: String },
  },
  { timestamps: true }
);

attendanceSchema.index({ worker: 1, serviceDate: 1 });
attendanceSchema.index({ session: 1 });
attendanceSchema.index({ serviceType: 1, serviceDate: 1 });

const Attendance = mongoose.model("Attendance", attendanceSchema);
export default Attendance;