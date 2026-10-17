import mongoose from "mongoose";

// Flat per-organization list of verticals (collection: "verticals").
// Sub-verticals (SubVertical model) hang off these by name.
const verticalSchema = new mongoose.Schema(
  {
    orgId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

verticalSchema.index({ orgId: 1, name: 1 }, { unique: true });

export default mongoose.models.Vertical || mongoose.model("Vertical", verticalSchema);