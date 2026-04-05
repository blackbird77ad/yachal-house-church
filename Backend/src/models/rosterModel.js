import mongoose from "mongoose";

const roleAssignmentSchema = new mongoose.Schema(
  {
    worker: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    isCoordinator: { type: Boolean, default: false },
    isQualified: { type: Boolean, default: false },
    score: { type: Number, default: 0 },
  },
  { _id: false }
);

const departmentSlotSchema = new mongoose.Schema(
  {
    department: {
      type: String,
      enum: [
        "song-ministration",
        "media",
        "security",
        "sunday-school",
        "ushering",
        "projection",
        "brief-writing",
        "production",
        "service-coordination",
        "front-desk",
      ],
      required: true,
    },
    subRole: { type: String, trim: true },
    assignments: [roleAssignmentSchema],
  },
  { _id: false }
);

const rosterSchema = new mongoose.Schema(
  {
    weekReference: { type: Date, required: true },

    serviceType: {
      type: String,
      enum: ["tuesday", "sunday", "special"],
      required: true,
    },

    specialServiceName: { type: String, trim: true },

    serviceDate: { type: Date, required: true },

    slots: [departmentSlotSchema],

    notes: { type: String, trim: true },

    isPublished: { type: Boolean, default: false },

    publishedAt: { type: Date },

    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

rosterSchema.index({ weekReference: 1, serviceType: 1 });
rosterSchema.index({ isPublished: 1 });

const Roster = mongoose.model("Roster", rosterSchema);
export default Roster;