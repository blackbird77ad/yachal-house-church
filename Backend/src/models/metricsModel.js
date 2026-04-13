import mongoose from "mongoose";

const metricsSchema = new mongoose.Schema(
  {
    worker:           { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    weekReference:    { type: Date, required: true },
    isLateSubmission: { type: Boolean, default: false },

    // ── NEW fields (current scoring system) ──────────────────────────────────

    // Souls preached to — 30pts (min 10)
    totalSouls:          { type: Number, default: 0 },
    qualifyingSouls:     { type: Number, default: 0 },

    // Fellowship prayer — 10pts (min 2 hours)
    fellowshipHours:     { type: Number, default: 0 },
    fellowshipName:      { type: String },

    // Cell meeting — 20pts (attended = qualifies)
    attendedCell:        { type: Boolean, default: false },

    // Worker's own service attendance — 10pts each
    attendedTuesday:     { type: Boolean, default: false },
    attendedSunday:      { type: Boolean, default: false },

    // People 12+ brought to church — 20pts (min 4 counts)
    churchAttendeeCount: { type: Number, default: 0 },

    // ── LEGACY fields (kept so old documents still read correctly) ────────────
    // These were in the original schema — MongoDB keeps them in existing docs.
    // New code writes new field names; old docs still return these if queried.
    soulsCount:               { type: Number },
    fellowshipPrayerHours:    { type: Number },
    fellowshipPrayerVerified: { type: Boolean },
    cellPrayerHours:          { type: Number },
    cellPrayerVerified:       { type: Boolean },
    serviceAttendanceCounts: {
      tuesday: { type: Number },
      sunday:  { type: Number },
      special: { type: Number },
      total:   { type: Number },
    },
    workerAttendance: {
      tuesday: {
        attended:            { type: Boolean },
        reportingTime:       { type: String },
        arrivalTime:         { type: String },
        verifiedByFrontDesk: { type: Boolean },
        late:                { type: Boolean },
        permissionSought:    { type: Boolean },
        permissionOutcome: {
          type: String,
          enum: ["showed-up", "did-not-show", "pending", "n/a"],
        },
      },
      sunday: {
        attended:            { type: Boolean },
        reportingTime:       { type: String },
        arrivalTime:         { type: String },
        verifiedByFrontDesk: { type: Boolean },
        late:                { type: Boolean },
        permissionSought:    { type: Boolean },
        permissionOutcome: {
          type: String,
          enum: ["showed-up", "did-not-show", "pending", "n/a"],
        },
      },
      special: {
        attended:            { type: Boolean },
        reportingTime:       { type: String },
        arrivalTime:         { type: String },
        verifiedByFrontDesk: { type: Boolean },
        late:                { type: Boolean },
        permissionSought:    { type: Boolean },
        permissionOutcome: {
          type: String,
          enum: ["showed-up", "did-not-show", "pending", "n/a"],
        },
      },
    },
    submittedOnTime: { type: Boolean },

    // ── Qualification result (shared between old and new) ─────────────────────
    reportSubmitted: { type: Boolean, default: false },
    totalScore:      { type: Number, default: 0 },
    isQualified:     { type: Boolean, default: false },

    // Breakdown — new fields added, old ones kept for history
    qualificationBreakdown: {
      soulsQualified:      { type: Boolean, default: false }, // 30pts
      tuesdayQualified:    { type: Boolean, default: false }, // 10pts (new)
      sundayQualified:     { type: Boolean, default: false }, // 10pts (new)
      fellowshipQualified: { type: Boolean, default: false }, // 10pts
      cellQualified:       { type: Boolean, default: false }, // 20pts
      attendanceQualified: { type: Boolean, default: false }, // 20pts
      reportQualified:     { type: Boolean },                 // legacy — kept for old records
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