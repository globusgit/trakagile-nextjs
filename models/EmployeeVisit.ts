import mongoose from "mongoose";

const VisitLocationSchema = new mongoose.Schema(
  {
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    accuracy: { type: Number, min: 0 },
  },
  { _id: false },
);

const EmployeeVisitSchema = new mongoose.Schema(
  {
    attendanceId: { type: mongoose.Types.ObjectId, ref: "Attendance", required: true },
    employeeId: { type: String, required: true },
    clientSiteId: { type: mongoose.Types.ObjectId, ref: "VisitedSite", required: true },
    orgId: { type: String, required: true },
    purpose: { type: String, required: true, trim: true },
    remarks: { type: String, trim: true },
    startTime: { type: Date, required: true },
    startLocation: { type: VisitLocationSchema, required: true },
    endTime: Date,
    endLocation: VisitLocationSchema,
    durationMinutes: Number,
    status: { type: String, enum: ["IN_PROGRESS", "COMPLETED"], default: "IN_PROGRESS" },
  },
  { timestamps: true },
);

EmployeeVisitSchema.index({ orgId: 1, employeeId: 1, status: 1 });
EmployeeVisitSchema.index({ attendanceId: 1, startTime: 1 });

export default mongoose.models.EmployeeVisit ||
  mongoose.model("EmployeeVisit", EmployeeVisitSchema);
