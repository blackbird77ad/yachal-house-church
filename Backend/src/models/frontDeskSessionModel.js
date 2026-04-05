import mongoose from "mongoose";

const frontDeskSessionSchema = new mongoose.Schema(
  {
    primaryWorker: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    coWorkers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    serviceType: {
      type: String,
      enum: ["tuesday", "sunday", "special"],
      required: true,
    },

    specialServiceName: { type: String, trim: true },

    serviceDate: { type: Date, required: true },

    serviceStartTime: { type: Date, required: true },

    estimatedEndTime: { type: Date, required: true },

    autoCloseTime: { type: Date, required: true },

    isOpen: { type: Boolean, default: true },

    closedAt: { type: Date },

    lateThresholdMinutes: { type: Number, default: 0 },
  },
  { timestamps: true }
);

frontDeskSessionSchema.index({ serviceDate: 1, serviceType: 1 });
frontDeskSessionSchema.index({ isOpen: 1 });

const FrontDeskSession = mongoose.model("FrontDeskSession", frontDeskSessionSchema);
export default FrontDeskSession;