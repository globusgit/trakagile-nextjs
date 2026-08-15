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
  },
  { timestamps: true },
);

export default mongoose.models.AttendancePolicy ||
  mongoose.model("AttendancePolicy", AttendancePolicySchema);
