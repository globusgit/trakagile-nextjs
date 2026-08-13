import mongoose from "mongoose";

const LocationSchema = new mongoose.Schema(
  {
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    accuracy: { type: Number, min: 0 },
    capturedAt: { type: Date, required: true },
    receivedAt: { type: Date, required: true },
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
