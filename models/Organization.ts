
import mongoose from "mongoose";

const OrganizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
    address: { type: String, required: true },
    contactPerson: { type: String },
    contactEmail: { type: String, required: true },
    contactPhone: { type: String, required: true },
    contactDesignation: { type: String },
    website: { type: String },
    gstNumber: { type: String },
    panNumber: { type: String },
    registrationNumber: { type: String },

    // Location and classification (System Admin "Create Organization" form).
    city: { type: String },
    district: { type: String },
    state: { type: String },
    country: { type: String },
    pincode: { type: String },
    industryType: { type: String },
    registrationMode: { type: String },
    organizationType: { type: String },

    timeZone: { type: String, default: "Asia/Kolkata" },
    locale: { type: String, default: "en-IN" },
    currency: { type: String, default: "INR", uppercase: true },
    countryCode: { type: String, default: "IN", uppercase: true },
    weekStartsOn: { type: Number, min: 0, max: 6, default: 1 },

    // Module keys (see lib/moduleAccess.ts) enabled for this organization.
    // Set from the currently enabled modules when the organization is created.
    // Left undefined on older organizations, which then use the defaults.
    enabledModules: { type: [String], default: undefined },
  },
  { timestamps: true },
);

OrganizationSchema.index({ code: 1 }, { unique: true });

export default mongoose.models.Organization ||
  mongoose.model("Organization", OrganizationSchema);