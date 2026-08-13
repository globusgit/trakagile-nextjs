import mongoose from "mongoose";

const TrackingLocationSchema = new mongoose.Schema(
  {
    attendanceId: {
      type: mongoose.Types.ObjectId,
      ref: "Attendance",
      required: true,
      index: true,
    },
    employeeId: { type: String, required: true, index: true },
    visitId: { type: mongoose.Types.ObjectId, ref: "EmployeeVisit", default: null },
    orgId: { type: String, required: true, index: true },
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    accuracy: { type: Number, min: 0 },
    speed: { type: Number, default: null },
    heading: { type: Number, min: 0, max: 360, default: null },
    capturedAt: { type: Date, required: true },
    receivedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

TrackingLocationSchema.index({ attendanceId: 1, capturedAt: 1 });

export default mongoose.models.TrackingLocation ||
  mongoose.model("TrackingLocation", TrackingLocationSchema);
