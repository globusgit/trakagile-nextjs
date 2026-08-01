import mongoose from "mongoose";

const VisitedSite = new mongoose.Schema(
  {
    name: { type: String, required: true },
    contactPerson: { type: String },
    contactNumber: { type: String },
    address: { type: String },
    orgId: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

export default mongoose.models.VisitedSite ||
  mongoose.model("VisitedSite", VisitedSite);
