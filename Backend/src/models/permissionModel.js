import mongoose from "mongoose";

const permissionSchema = new mongoose.Schema(
  {
    worker: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    coordinator: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    serviceType: {
      type: String,
      enum: ["tuesday", "sunday", "special"],
      required: true,
    },

    serviceDate: { type: Date, required: true },

    reason: { type: String, required: true, trim: true },

    estimatedArrivalTime: { type: String },

    status: {
      type: String,
      enum: ["pending", "acknowledged", "showed-up", "did-not-show"],
      default: "pending",
    },

    acknowledgedAt: { type: Date },

    outcomeUpdatedAt: { type: Date },

    outcomeUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

permissionSchema.index({ worker: 1, serviceDate: 1 });
permissionSchema.index({ coordinator: 1, serviceDate: 1 });
permissionSchema.index({ status: 1 });

const Permission = mongoose.model("Permission", permissionSchema);
export default Permission;