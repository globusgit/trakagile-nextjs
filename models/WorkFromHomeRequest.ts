import mongoose from "mongoose";

const WorkFromHomeRequestSchema = new mongoose.Schema({
  orgId: { type: String, required: true, index: true },
  employeeId: { type: String, required: true, index: true },
  fromDate: { type: String, required: true },
  toDate: { type: String, required: true },
  dayType: { type: String, enum: ["FULL_DAY", "FIRST_HALF", "SECOND_HALF"], default: "FULL_DAY" },
  reason: { type: String, required: true, trim: true },
  plannedTasks: { type: String, required: true, trim: true },
  workLocation: {
    latitude: { type: Number, required: true }, longitude: { type: Number, required: true },
    accuracy: Number, capturedAt: Date, locationName: String,
  },
  radiusMeters: { type: Number, min: 100, max: 2000, default: 500 },
  status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED", "COMPLETED"], default: "PENDING" },
  reviewedBy: String,
  reviewedAt: Date,
  reviewRemarks: { type: String, trim: true },
}, { timestamps: true });

WorkFromHomeRequestSchema.index({ orgId: 1, employeeId: 1, fromDate: 1, toDate: 1 });
export default mongoose.models.WorkFromHomeRequest || mongoose.model("WorkFromHomeRequest", WorkFromHomeRequestSchema);
