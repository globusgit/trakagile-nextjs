import mongoose from "mongoose";

const ConfigSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    value: { type: String, required: true, unique: true },
    suffix: { type: String, required: true },
    orgId: { type: String, required: true },
  },
  { timestamps: true },
);

ConfigSchema.index({ name: 1, value: 1, orgId: 1 }, { unique: true });
ConfigSchema.index({ name: 1, orgId: 1 }, { unique: true });

export default mongoose.models.Config || mongoose.model("Config", ConfigSchema);
