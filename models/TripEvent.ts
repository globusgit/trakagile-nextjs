import mongoose from "mongoose";

const TripEventSchema = new mongoose.Schema({
  tripId: { type: mongoose.Types.ObjectId, ref: "FieldTrip", required: true, index: true },
  orgId: { type: String, required: true, index: true },
  employeeId: { type: String, required: true },
  type: { type: String, required: true },
  location: { latitude: Number, longitude: Number, accuracy: Number, capturedAt: Date, locationName: String },
  remarks: { type: String, trim: true },
  metadata: mongoose.Schema.Types.Mixed,
}, { timestamps: true });
TripEventSchema.index({ tripId: 1, createdAt: 1 });
export default mongoose.models.TripEvent || mongoose.model("TripEvent", TripEventSchema);
