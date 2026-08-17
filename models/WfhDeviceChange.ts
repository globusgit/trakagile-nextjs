import mongoose from "mongoose";

const DeviceSchema = new mongoose.Schema({
  deviceIdHash: { type: String, required: true, select: false },
  deviceType: String, platform: String, browser: String, userAgent: String,
  ipHash: { type: String, select: false },
}, { _id: false });

const WfhDeviceChangeSchema = new mongoose.Schema({
  orgId: { type: String, required: true, index: true },
  employeeId: { type: String, required: true, index: true },
  attendanceId: { type: mongoose.Types.ObjectId, ref: "Attendance", required: true, index: true },
  oldDevice: DeviceSchema,
  newDevice: { type: DeviceSchema, required: true },
  requestLocation: { latitude: Number, longitude: Number, accuracy: Number, capturedAt: Date, locationName: String },
  reason: { type: String, required: true, trim: true },
  status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING" },
  reviewedBy: String, reviewedAt: Date, reviewRemarks: String,
}, { timestamps: true });

WfhDeviceChangeSchema.index({ attendanceId: 1, status: 1 });
export default mongoose.models.WfhDeviceChange || mongoose.model("WfhDeviceChange", WfhDeviceChangeSchema);
