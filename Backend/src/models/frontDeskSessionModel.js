import mongoose from "mongoose";

const frontDeskSessionSchema = new mongoose.Schema({
  serviceType:        { type: String, enum: ["tuesday", "sunday", "special"], required: true },
  specialServiceName: { type: String, trim: true },
  serviceDate:        { type: Date, required: true },
  serviceStartTime:   { type: Date, required: true },
  autoCloseTime:      { type: Date, required: true }, // last activity + 4 hours
  lastActivityAt:     { type: Date, required: true },

  // Supervisors
  primarySupervisor:  { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  supervisorCheckInTime: { type: Date },
  coSupervisors:      [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  isOpen:    { type: Boolean, default: true },
  closedAt:  { type: Date },
  closedBy:  { type: String, enum: ["manual", "auto", "force"], default: "manual" },
  closeReason: { type: String },  // reason given on force close

  // Deputy tracking
  isDeputy:  { type: Boolean, default: false },
  deputyFor: { type: String }, // name of the assigned worker being covered

  // Computed stats (filled on close)
  stats: {
    totalCheckedIn:   { type: Number, default: 0 },
    early60Plus:      { type: Number, default: 0 }, // 60+ mins before service
    early30to60:      { type: Number, default: 0 }, // 30-60 mins before
    early15to30:      { type: Number, default: 0 }, // 15-30 mins before
    early0to15:       { type: Number, default: 0 }, // 0-15 mins before
    late:             { type: Number, default: 0 }, // after service start
    onDuty:           { type: Number, default: 0 },
  },

  reportDispatch: {
    notificationSentAt: { type: Date },
    emailSentAt: { type: Date },
    pushSentAt: { type: Date },
    emailAttempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date },
    lastEmailError: { type: String, trim: true },
    emailDeliveredTo: [{ type: String, trim: true, lowercase: true }],
  },
}, { timestamps: true });

frontDeskSessionSchema.index({ serviceDate: 1, serviceType: 1 });
frontDeskSessionSchema.index({ isOpen: 1 });

// TTL: auto-delete closed sessions 180 days after service date
frontDeskSessionSchema.index({ serviceDate: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

export default mongoose.model("FrontDeskSession", frontDeskSessionSchema);
