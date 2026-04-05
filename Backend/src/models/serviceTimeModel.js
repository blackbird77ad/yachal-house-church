import mongoose from "mongoose";

const serviceTimeSchema = new mongoose.Schema(
  {
    serviceType: {
      type: String,
      enum: ["tuesday", "sunday", "special"],
      required: true,
    },
    label: { type: String, required: true, trim: true },
    day: { type: String, required: true, trim: true },
    time: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const ServiceTime = mongoose.model("ServiceTime", serviceTimeSchema);
export default ServiceTime;