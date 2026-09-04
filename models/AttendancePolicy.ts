import mongoose from "mongoose";

const AttendancePolicySchema = new mongoose.Schema(
  {
    orgId: { type: String, required: true, unique: true, index: true },
    timeZone: { type: String, default: "Asia/Kolkata" },
    shiftStartMinutes: { type: Number, min: 0, max: 1439, default: 570 },
    shiftEndMinutes: { type: Number, min: 0, max: 1439, default: 1080 },
    reminderBeforeMinutes: { type: Number, min: 0, default: 15 },
    reminderAfterMinutes: { type: [Number], default: [15, 30] },
    autoCloseMinutes: { type: Number, min: 0, max: 1439, default: 1200 },
    overtimeGraceMinutes: { type: Number, min: 0, default: 30 },
    markOutResponseMinutes: { type: Number, min: 1, max: 120, default: 15 },
    officeGeofence: {
      enabled: { type: Boolean, default: false },
      name: { type: String, trim: true, default: "Main Office" },
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 },
      radiusMeters: { type: Number, min: 50, max: 2000, default: 300 },
      maximumAccuracyMeters: { type: Number, min: 10, max: 500, default: 100 },
    },
  },
  { timestamps: true },
);

export default mongoose.models.AttendancePolicy ||
  mongoose.model("AttendancePolicy", AttendancePolicySchema);
