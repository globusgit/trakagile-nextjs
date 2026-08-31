import mongoose from "mongoose";

const taskTypeSchema = new mongoose.Schema(
  {
    orgId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

taskTypeSchema.index({ orgId: 1, name: 1 }, { unique: true });

export default mongoose.models.TaskType || mongoose.model("TaskType", taskTypeSchema);