import mongoose from "mongoose";

const soulSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true },
    status: {
      type: String,
      enum: [
        "saved",
        "not_saved",
        "filled",
        "saved-not-filled",
        "already-saved",
        "already-saved-not-filled",
        "already-saved-filled",
      ],
      default: "not_saved",
    },
    location: { type: String, trim: true },
    phone: { type: String, trim: true },
  },
  { _id: false }
);

const churchAttendeeSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    olderThan12: { type: Boolean, default: false },
    attendedTuesday: { type: Boolean, default: false },
    attendedSunday: { type: Boolean, default: false },
    attendedSpecial: { type: Boolean, default: false },
  },
  { _id: false }
);

const followUpSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true },
    topic: { type: String, trim: true },
    scriptures: [{ type: String }],
  },
  { _id: false }
);

const fellowshipParticipantSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["worker", "manual"], default: "manual" },
    workerId: { type: String, trim: true },
    fullName: { type: String, trim: true },
    isApprovedWorker: { type: Boolean, default: false },
  },
  { _id: false }
);

const serviceAttendanceSchema = new mongoose.Schema(
  {
    serviceType: {
      type: String,
      enum: ["tuesday", "sunday", "special"],
    },
    attended: { type: Boolean, default: false },
    reportingTime: { type: String },
    arrivalTime: { type: String },
    verifiedByFrontDesk: { type: Boolean, default: false },
    lateReason: { type: String },
    permissionSought: { type: Boolean, default: false },
  },
  { _id: false }
);

const reportSchema = new mongoose.Schema(
  {
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    reportType: {
      type: String,
      enum: [
        "evangelism",
        "cell",
        "production",
        "fellowship-prayer",
        "brief",
        "departmental",
        "custom",
      ],
      required: true,
    },

    customReportType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReportType",
    },

    weekReference: {
      type: Date,
      required: true,
    },

    isLateSubmission: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ["draft", "submitted"],
      default: "draft",
    },

    submittedAt: {
      type: Date,
    },

    isEditable: {
      type: Boolean,
      default: true,
    },

    evangelismData: {
      souls: [soulSchema],
      scriptures: [{ type: String }],
      totalSouls: { type: Number, default: 0 },
      qualifyingSouls: { type: Number, default: 0 },
      evangelismPartners: [{ type: String, trim: true }],
    },

    followUpData: {
      followUps: [followUpSchema],
      scriptures: [{ type: String }],
    },

    churchAttendees: [churchAttendeeSchema],

    serviceAttendance: [serviceAttendanceSchema],

    cellData: {
      didAttendCell: { type: Boolean, default: false },
      cells: [
        {
          cellName: { type: String },
          meetingDays: [{ type: String }],
          reportTime: { type: String },
          role: { type: String },
          _id: false,
        },
      ],
    },

    cellReportData: {
      cellName: { type: String },
      location: { type: String },
      meetingDay: { type: String },
      meetingTime: { type: String },
      coordinatorName: { type: String },
      coordinatorReportTime: { type: String },
      coordinatorRole: { type: String },
      coCoordinatorName: { type: String },
      coCoordinatorReportTime: { type: String },
      coCoordinatorRole: { type: String },
      members: [
        {
          fullName: { type: String },
          reportingTime: { type: String },
          role: { type: String },
          _id: false,
        },
      ],
      attendees: [
        {
          fullName: { type: String },
          location: { type: String },
          phone: { type: String },
          _id: false,
        },
      ],
      activityType: { type: String },
      activityOther: { type: String },
      topics: [
        {
          title: { type: String },
          duration: { type: String },
          verses: { type: String },
          _id: false,
        },
      ],
      activityDuration: { type: String },
      activityVerses: { type: String },
      remarks: { type: String },
    },

    fellowshipPrayerData: {
      fellowshipName: { type: String },
      prayedThisWeek: { type: Boolean, default: false },
      prayerDay: { type: String },
      prayerStartTime: { type: String },
      hoursOfPrayer: { type: Number, default: 0 },
      fellowship: { type: String, trim: true },
      meetingDate: { type: Date },
      timeStarted: { type: String, trim: true },
      timeEnded: { type: String, trim: true },
      duration: { type: Number, default: 0 },
      prayerLedBy: { type: String, trim: true },
      participants: [fellowshipParticipantSchema],
      comments: { type: String, trim: true },
    },

    productionData: {
      meeting: { type: String },
      meetingDate: { type: Date },
      reportingTime: { type: String },
      serviceStartTime: { type: String, trim: true },
      serviceCloseTime: { type: String, trim: true },
      coordinatorReportingTime: { type: String, trim: true },
      prayer: { type: String },
      songMinistration: [{ type: String }],
      media: { type: String },
      ushering: [{ type: String }],
      frontDesk: [{ type: String }],
      serviceCoordination: { type: String },
      briefWriting: { type: String },
      security: [{ type: String }],
      sundaySchool: [{ type: String }],
      preServicePrayers: {
        thirtyToSixtyMins: [{ type: String }],
        tenToThirtyMins: [{ type: String }],
      },
      departmentAssignments: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      autoSummary: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      permissionsSought: {
        type: mongoose.Schema.Types.Mixed,
        default: "",
      },
      observations: { type: String },
      challenges: { type: String },
      suggestions: { type: String },
    },

    briefData: {
      meeting: { type: String },
      meetingDate: { type: Date },
      workerHourBefore: [{ type: String }],
      workerThirtyMins: [{ type: String }],
      workerAfterService: [{ type: String }],
      workerAbsent: [{ type: String }],
      preServicePrayers: {
        thirtyToSixtyMins: [{ type: String }],
        tenToThirtyMins: [{ type: String }],
        notSeenPraying: [{ type: String }],
      },
      observationsBefore: { type: String },
      observationsDuring: { type: String },
      comments: { type: String },
    },

    departmentalData: {
      department: { type: String },
      otherDepartment: { type: String },
      service: { type: String },
      otherService: { type: String },
      serviceDate: { type: Date },

      attendees: [
        {
          name: { type: String },
          workerId: { type: String },
          time: { type: String },
          _id: false,
        },
      ],

      lateness: [
        {
          name: { type: String },
          workerId: { type: String },
          time: { type: String },
          _id: false,
        },
      ],

      absentees: [
        {
          name: { type: String },
          workerId: { type: String },
          time: { type: String },
          _id: false,
        },
      ],

      teamAssignments: [
        {
          name: { type: String },
          workerId: { type: String },
          assignment: { type: String },
          _id: false,
        },
      ],

      preServicePrayerTimes: {
        oneHourOrMore: [{ type: String }],
        thirtyMinsOrMore: [{ type: String }],
        fifteenMinsOrMore: [{ type: String }],
      },

      convertsToChurch: [
        {
          name: { type: String },
          workerId: { type: String },
          count: { type: Number },
          _id: false,
        },
      ],

      convertsToCell: [
        {
          name: { type: String },
          workerId: { type: String },
          count: { type: Number },
          _id: false,
        },
      ],

      childrenRegister: [
        {
          childName: { type: String },
          broughtBy: { type: String },
          time: { type: String },
          _id: false,
        },
      ],

      activities: { type: String },
      comments: { type: String },
      qualifyingWorkers: [{ type: String }],
    },

    customData: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

reportSchema.index({ submittedBy: 1, weekReference: 1 });
reportSchema.index({ reportType: 1 });
reportSchema.index({ status: 1 });
reportSchema.index({ isLateSubmission: 1 });
reportSchema.index({ weekReference: 1 });

const Report = mongoose.model("Report", reportSchema);

export default Report;
