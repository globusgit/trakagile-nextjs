import mongoose from "mongoose";


const counterSchema = new mongoose.Schema({
  orgId: { type: String, required: true },
  name: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

counterSchema.index({ orgId: 1, name: 1 }, { unique: true });

export default mongoose.models.Counter || mongoose.model("Counter", counterSchema);