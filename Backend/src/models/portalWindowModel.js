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
  },
  { timestamps: true }
);

portalWindowSchema.index({ isOpen: 1 });

const PortalWindow = mongoose.model("PortalWindow", portalWindowSchema);
export default PortalWindow;