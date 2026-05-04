import mongoose from "mongoose";

const portalWindowSchema = new mongoose.Schema(
  {
    weekReference: { type: Date, required: true, unique: true },

    opensAt: { type: Date, required: true },

    closesAt: { type: Date, required: true },

    isOpen: { type: Boolean, default: false },

    overriddenBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    overrideReason: { type: String, trim: true },

    processedAt: { type: Date },

    isProcessed: { type: Boolean, default: false },

    processingStartedAt: { type: Date },

    communicationAudit: {
      portalClosed: {
        inAppSentAt: { type: Date },
        emailSentAt: { type: Date },
        pushSentAt: { type: Date },
        emailAttempts: { type: Number, default: 0 },
        lastAttemptAt: { type: Date },
        lastEmailError: { type: String, trim: true },
        emailDeliveredTo: [{ type: String, trim: true, lowercase: true }],
      },
      qualificationResults: {
        inAppSentAt: { type: Date },
        emailSentAt: { type: Date },
        pushSentAt: { type: Date },
        emailAttempts: { type: Number, default: 0 },
        lastAttemptAt: { type: Date },
        lastEmailError: { type: String, trim: true },
        emailDeliveredTo: [{ type: String, trim: true, lowercase: true }],
        qualifiedCount: { type: Number, default: 0 },
        disqualifiedCount: { type: Number, default: 0 },
      },
      frontDeskWeeklySummary: {
        inAppSentAt: { type: Date },
        emailSentAt: { type: Date },
        pushSentAt: { type: Date },
        emailAttempts: { type: Number, default: 0 },
        lastAttemptAt: { type: Date },
        lastEmailError: { type: String, trim: true },
        emailDeliveredTo: [{ type: String, trim: true, lowercase: true }],
        sessionCount: { type: Number, default: 0 },
        workerCheckIns: { type: Number, default: 0 },
        hasUsableLogging: { type: Boolean, default: false },
      },
      noFrontDeskLogging: {
        required: { type: Boolean, default: false },
        inAppSentAt: { type: Date },
        emailSentAt: { type: Date },
        pushSentAt: { type: Date },
        emailAttempts: { type: Number, default: 0 },
        lastAttemptAt: { type: Date },
        lastEmailError: { type: String, trim: true },
        emailDeliveredTo: [{ type: String, trim: true, lowercase: true }],
      },
    },
  },
  { timestamps: true }
);

portalWindowSchema.index({ isOpen: 1 });

const PortalWindow = mongoose.model("PortalWindow", portalWindowSchema);
export default PortalWindow;
