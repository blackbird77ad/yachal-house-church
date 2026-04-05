import mongoose from "mongoose";

const metricsSchema = new mongoose.Schema(
  {
    worker: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    weekReference: { type: Date, required: true },

    isLateSubmission: { type: Boolean, default: false },

    soulsCount: { type: Number, default: 0 },

    fellowshipPrayerHours: { type: Number, default: 0 },
    fellowshipPrayerVerified: { type: Boolean, default: false },

    cellPrayerHours: { type: Number, default: 0 },
    cellPrayerVerified: { type: Boolean, default: false },

    serviceAttendanceCounts: {
      tuesday: { type: Number, default: 0 },
      sunday: { type: Number, default: 0 },
      special: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },

    workerAttendance: {
      tuesday: {
        attended: { type: Boolean, default: false },
        reportingTime: { type: String },
        arrivalTime: { type: String },
        verifiedByFrontDesk: { type: Boolean, default: false },
        late: { type: Boolean, default: false },
        permissionSought: { type: Boolean, default: false },
        permissionOutcome: {
          type: String,
          enum: ["showed-up", "did-not-show", "pending", "n/a"],
          default: "n/a",
        },
      },
      sunday: {
        attended: { type: Boolean, default: false },
        reportingTime: { type: String },
        arrivalTime: { type: String },
        verifiedByFrontDesk: { type: Boolean, default: false },
        late: { type: Boolean, default: false },
        permissionSought: { type: Boolean, default: false },
        permissionOutcome: {
          type: String,
          enum: ["showed-up", "did-not-show", "pending", "n/a"],
          default: "n/a",
        },
      },
      special: {
        attended: { type: Boolean, default: false },
        reportingTime: { type: String },
        arrivalTime: { type: String },
        verifiedByFrontDesk: { type: Boolean, default: false },
        late: { type: Boolean, default: false },
        permissionSought: { type: Boolean, default: false },
        permissionOutcome: {
          type: String,
          enum: ["showed-up", "did-not-show", "pending", "n/a"],
          default: "n/a",
        },
      },
    },

    reportSubmitted: { type: Boolean, default: false },
    submittedOnTime: { type: Boolean, default: false },

    totalScore: { type: Number, default: 0 },
    isQualified: { type: Boolean, default: false },
    qualificationBreakdown: {
      soulsQualified: { type: Boolean, default: false },
      fellowshipQualified: { type: Boolean, default: false },
      cellQualified: { type: Boolean, default: false },
      attendanceQualified: { type: Boolean, default: false },
      reportQualified: { type: Boolean, default: false },
    },

    processedAt: { type: Date },
  },
  { timestamps: true }
);

metricsSchema.index({ worker: 1, weekReference: 1 }, { unique: true });
metricsSchema.index({ weekReference: 1 });
metricsSchema.index({ isQualified: 1 });
metricsSchema.index({ isLateSubmission: 1 });

const Metrics = mongoose.model("Metrics", metricsSchema);
export default Metrics;