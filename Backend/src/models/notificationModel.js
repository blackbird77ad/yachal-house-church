import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    type: {
      type: String,
      enum: [
        "portal-open",
        "portal-closing-soon",
        "portal-closed",
        "report-submitted",
        "report-edited",
        "account-approved",
        "account-suspended",
        "roster-published",
        "permission-request",
        "permission-outcome",
        "qualification-result",
        "general",
      ],
      required: true,
    },

    title: { type: String, required: true, trim: true },

    message: { type: String, required: true, trim: true },

    isRead: { type: Boolean, default: false },

    readAt: { type: Date },

    link: { type: String },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });

// TTL index: auto-delete READ notifications 15 days after they were read
// readAt is only set when isRead becomes true — unread docs have no readAt so TTL ignores them
notificationSchema.index({ readAt: 1 }, { expireAfterSeconds: 15 * 24 * 60 * 60 });
// Unread notifications older than 30 days are cleaned by the weekly scheduler job

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;