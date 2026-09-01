import mongoose from "mongoose";

const branchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Branch name is required"],
      unique: true,
      trim: true,
    },

    code: {
      type: String,
      required: [true, "Branch code is required"],
      unique: true,
      uppercase: true,
      trim: true,
    },

    location: {
      type: String,
      trim: true,
      default: "",
    },

    contactEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: "",
    },

    contactPhone: {
      type: String,
      trim: true,
      default: "",
    },

    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
    },

    adminUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    adminCanViewAllBranches: {
      type: Boolean,
      default: false,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

branchSchema.index({ status: 1 });
branchSchema.index({ createdBy: 1 });

const Branch = mongoose.model("Branch", branchSchema);

export default Branch;
