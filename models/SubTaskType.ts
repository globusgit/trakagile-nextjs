import mongoose from "mongoose";

const subTaskTypeSchema = new mongoose.Schema(
  {
    orgId: { type: String, required: true },
    taskType: { type: String, required: true, trim: true }, // parent TaskType.name
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

subTaskTypeSchema.index({ orgId: 1, taskType: 1, name: 1 }, { unique: true });

export default mongoose.models.SubTaskType || mongoose.model("SubTaskType", subTaskTypeSchema);