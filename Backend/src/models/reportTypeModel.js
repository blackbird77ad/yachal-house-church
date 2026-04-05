import mongoose from "mongoose";

const fieldSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    fieldName: { type: String, required: true, trim: true },
    fieldType: {
      type: String,
      enum: ["text", "textarea", "number", "date", "time", "select", "checkbox", "radio", "file"],
      required: true,
    },
    options: [{ type: String }],
    required: { type: Boolean, default: false },
    placeholder: { type: String },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const reportTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    fields: [fieldSchema],
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const ReportType = mongoose.model("ReportType", reportTypeSchema);
export default ReportType;