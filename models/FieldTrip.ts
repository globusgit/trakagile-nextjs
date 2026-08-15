import mongoose from "mongoose";

const PointSchema = new mongoose.Schema({
  latitude: { type: Number, required: true }, longitude: { type: Number, required: true },
  accuracy: Number, capturedAt: Date, locationName: String,
}, { _id: false });

const FieldTripSchema = new mongoose.Schema({
  orgId: { type: String, required: true, index: true },
  employeeId: { type: String, required: true, index: true },
  attendanceId: { type: mongoose.Types.ObjectId, ref: "Attendance" },
  clientSiteId: { type: mongoose.Types.ObjectId, ref: "VisitedSite", required: true },
  purpose: { type: String, required: true, trim: true },
  source: { type: String, required: true, trim: true },
  destination: { type: String, required: true, trim: true },
  travelMode: { type: String, enum: ["COMPANY_VEHICLE", "PERSONAL_CAR", "BIKE", "BUS", "TRAIN", "FLIGHT", "TAXI_AUTO", "WALKING", "OTHER"], required: true },
  expectedStartAt: { type: Date, required: true },
  expectedReturnAt: { type: Date, required: true },
  advanceAmount: { type: Number, min: 0, default: 0 },
  status: { type: String, enum: ["PLANNED", "TRAVELLING", "AT_CLIENT", "WORKING", "SITE_COMPLETED", "STAYING", "RETURNING", "COMPLETED", "CANCELLED"], default: "PLANNED" },
  currentLocation: PointSchema,
  hotel: {
    name: String, address: String, expectedCheckOutAt: Date,
    checkInAt: Date, checkInLocation: PointSchema,
    checkOutAt: Date, checkOutLocation: PointSchema,
  },
  startedAt: Date,
  completedAt: Date,
  totalExpenses: { type: Number, min: 0, default: 0 },
}, { timestamps: true });

FieldTripSchema.index({ orgId: 1, employeeId: 1, status: 1 });
export default mongoose.models.FieldTrip || mongoose.model("FieldTrip", FieldTripSchema);
