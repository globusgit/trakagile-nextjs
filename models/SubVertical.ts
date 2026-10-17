import mongoose from "mongoose";

// Per-organization list of sub-verticals. Each sub-vertical belongs to a
// vertical (Vertical.name), so the Sub-vertical dropdown on the Create Task
// page only offers the ones under the vertical that was selected.
const subVerticalSchema = new mongoose.Schema(
  {
    orgId: { type: String, required: true },
    vertical: { type: String, required: true, trim: true }, // parent Vertical.name
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

subVerticalSchema.index({ orgId: 1, vertical: 1, name: 1 }, { unique: true });

export default mongoose.models.SubVertical || mongoose.model("SubVertical", subVerticalSchema);