import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
    },

    workerId: {
      type: String,
      unique: true,
      sparse: true,
    },

    role: {
      type: String,
      enum: ["pastor", "admin", "moderator", "worker"],
      default: "worker",
    },

    status: {
      type: String,
      enum: ["pending", "approved", "suspended"],
      default: "pending",
    },

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
        "evangelism",
        "cell",
        "unassigned",
        "leadership",
      ],
      default: "unassigned",
    },

    isRotating: {
      type: Boolean,
      default: false,
    },

    additionalDepartments: [
      {
        type: String,
      },
    ],

    phone: {
      type: String,
      trim: true,
    },

    profilePhoto: {
      type: String,
    },

    score: {
      type: Number,
      default: 0,
    },

    isQualified: {
      type: Boolean,
      default: false,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    approvedAt: {
      type: Date,
    },

    lastLogin: {
      type: Date,
    },

    notificationPreferences: {
      email: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      popup: { type: Boolean, default: true },
    },

    mustChangePassword: {
      type: Boolean,
      default: false,
    },

    passwordResetToken: String,
    passwordResetExpires: Date,
  },
  {
    timestamps: true,
  }
);

userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ department: 1 });

const User = mongoose.model("User", userSchema);

export default User;
