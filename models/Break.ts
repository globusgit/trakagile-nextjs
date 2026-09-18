import mongoose from "mongoose";

const BreakSchema = new mongoose.Schema(
  {
    attendanceId: { type: mongoose.Types.ObjectId, ref: "Attendance", required: true },
    employeeId: { type: String, required: true },
    orgId: { type: String, required: true },
    breakType: {
      type: String,
      enum: ["LUNCH", "TEA", "PERSONAL", "OTHER"],
      default: "OTHER",
    },
    reason: { type: String, trim: true },
    startTime: { type: Date, required: true },
    endTime: Date,
    durationMinutes: { type: Number, min: 0 },
    status: {
      type: String,
      enum: ["ACTIVE", "COMPLETED"],
      default: "ACTIVE",
    },
  },
  { timestamps: true },
);

BreakSchema.index({ orgId: 1, attendanceId: 1, status: 1 });
BreakSchema.index({ orgId: 1, employeeId: 1, startTime: 1 });

export default mongoose.models.Break ||
  mongoose.model("Break", BreakSchema);
