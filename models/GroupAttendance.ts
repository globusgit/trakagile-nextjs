import mongoose from "mongoose";

const GroupAttendanceSchema = new mongoose.Schema({
  orgId: { type: String, required: true, index: true },
  managerEmpId: { type: String, required: true },
  employeeIds: [{ type: String, required: true }],
  attendanceIds: [{ type: mongoose.Types.ObjectId, ref: "Attendance" }],
  contextType: { type: String, enum: ["FIELD_TRIP", "SITE_VISIT", "TRAINING", "EVENT", "TEAM_SHIFT"], required: true },
  purpose: { type: String, required: true, trim: true },
  clientSiteId: { type: mongoose.Types.ObjectId, ref: "VisitedSite" },
  selfieFileId: { type: mongoose.Types.ObjectId, required: true },
  selfieMimeType: { type: String, enum: ["image/jpeg", "image/png"], required: true },
  selfieHash: { type: String, required: true },
  location: {
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    accuracy: { type: Number, min: 0 },
    capturedAt: { type: Date, required: true },
    receivedAt: { type: Date, required: true },
    locationName: String,
  },
}, { timestamps: true });

GroupAttendanceSchema.index({ orgId: 1, createdAt: -1 });
GroupAttendanceSchema.index({ orgId: 1, managerEmpId: 1, createdAt: -1 });

export default mongoose.models.GroupAttendance || mongoose.model("GroupAttendance", GroupAttendanceSchema);
