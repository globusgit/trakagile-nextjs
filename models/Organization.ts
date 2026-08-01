import mongoose from "mongoose";

const OrganizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    contactPerson: { type: String, required: true },
    contactEmail: { type: String, required: true },
    contactPhone: { type: String, required: true },
    contactDesignation: { type: String },
    website: { type: String },
    gstNumber: { type: String },
    panNumber: { type: String },
    registrationNumber: { type: String },

    // Add any other fields relevant to your organization
  },
  { timestamps: true },
);

export default mongoose.models.Organization ||
  mongoose.model("Organization", OrganizationSchema);
