import mongoose from "mongoose";

const LocationSchema = new mongoose.Schema(
  {
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    accuracy: { type: Number, min: 0 },
    capturedAt: { type: Date, required: true },
    receivedAt: { type: Date, required: true },
    locationName: { type: String, trim: true },
  },
  { _id: false },
);

const AttendanceSchema = new mongoose.Schema(
  {
    empObjId: { type: mongoose.Types.ObjectId, ref: "Employee", required: true },
    empId: { type: String, required: true },
    orgId: { type: String, required: true },
    attendanceDate: { type: String, required: true },
    markIn: {
      time: { type: Date, required: true },
      location: { type: LocationSchema, required: true },
    },
    markOut: {
      time: Date,
      location: LocationSchema,
    },
    lastKnownLocation: LocationSchema,
    lastKnownLocationName: { type: String, trim: true },
    lastLocationReceivedAt: Date,
    status: { type: String, enum: ["IN", "OUT"], default: "IN" },
    trackingStatus: {
      type: String,
      enum: ["ACTIVE", "DELAYED", "OFFLINE", "STOPPED"],
      default: "ACTIVE",
    },
    totalVisits: { type: Number, default: 0 },
    totalDistanceMeters: { type: Number, default: 0 },
    totalWorkedMinutes: { type: Number, default: 0 },
    attendanceType: {
      type: String,
      enum: ["OFFICE", "FIELD_VISIT", "WORK_FROM_HOME"],
      default: "OFFICE",
    },
    attendanceSource: { type: String, enum: ["INDIVIDUAL", "GROUP"], default: "INDIVIDUAL" },
    groupAttendanceId: { type: mongoose.Types.ObjectId, ref: "GroupAttendance" },
    isEarlyStart: { type: Boolean, default: false },
    expectedWorkEndAt: Date,
    overnightWork: { type: Boolean, default: false },
    wfhRequestId: { type: mongoose.Types.ObjectId, ref: "WorkFromHomeRequest" },
    wfh: {
      breakStartedAt: Date,
      totalBreakMinutes: { type: Number, default: 0 },
      dailySummary: { type: String, trim: true },
      pendingTasks: { type: String, trim: true },
      blockers: { type: String, trim: true },
    },
    wfhDevice: {
      deviceIdHash: { type: String, select: false },
      deviceType: String,
      platform: String,
      browser: String,
      userAgent: String,
      ipHash: { type: String, select: false },
      boundAt: Date,
      lastSeenAt: Date,
    },
    workMode: {
      type: String,
      enum: ["NORMAL", "OVERTIME"],
      default: "NORMAL",
    },
    overtime: {
      active: { type: Boolean, default: false },
      reason: { type: String, trim: true },
      startedAt: Date,
      expectedEndAt: Date,
      endedAt: Date,
    },
    closureType: {
      type: String,
      enum: ["MANUAL", "AUTO", "REGULARIZED"],
      default: undefined,
    },
    autoMarkOutReason: { type: String, trim: true },
  },
  { timestamps: true },
);

AttendanceSchema.index(
  { orgId: 1, empId: 1, attendanceDate: 1 },
  { unique: true },
);
AttendanceSchema.index({ orgId: 1, attendanceDate: 1, status: 1 });

export default mongoose.models.Attendance ||
  mongoose.model("Attendance", AttendanceSchema);
