import mongoose from "mongoose";

const VisitedSiteSchema = new mongoose.Schema(
  {
    clientName: { type: String, required: true, trim: true },
    siteName: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    contactPerson: { type: String, trim: true },
    mobile: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    location: {
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 },
    },
    radiusMeters: { type: Number, min: 0, default: 300 },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
    createdBy: { type: String, required: true },
    orgId: { type: String, required: true, index: true },
  },
  { timestamps: true },
);

VisitedSiteSchema.index({ orgId: 1, clientName: 1, siteName: 1 });

export default mongoose.models.VisitedSite ||
  mongoose.model("VisitedSite", VisitedSiteSchema);
