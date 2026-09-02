import mongoose from "mongoose";

const OrganizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
    address: { type: String, required: true },
    contactPerson: { type: String, required: true },
    contactEmail: { type: String, required: true },
    contactPhone: { type: String, required: true },
    contactDesignation: { type: String },
    website: { type: String },
    gstNumber: { type: String },
    panNumber: { type: String },
    registrationNumber: { type: String },
    timeZone: { type: String, default: "Asia/Kolkata" },
    locale: { type: String, default: "en-IN" },
    currency: { type: String, default: "INR", uppercase: true },
    countryCode: { type: String, default: "IN", uppercase: true },
    weekStartsOn: { type: Number, min: 0, max: 6, default: 1 },

    // Add any other fields relevant to your organization
  },
  { timestamps: true },
);

OrganizationSchema.index({ code: 1 }, { unique: true });

export default mongoose.models.Organization ||
  mongoose.model("Organization", OrganizationSchema);
