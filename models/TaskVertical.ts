import mongoose from "mongoose";

// Flat per-organization list of verticals, offered only when a task's
// Task Source is "Project" (see Task model's hierarchy comment).
const taskVerticalSchema = new mongoose.Schema(
  {
    orgId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

taskVerticalSchema.index({ orgId: 1, name: 1 }, { unique: true });

export default mongoose.models.TaskVertical || mongoose.model("TaskVertical", taskVerticalSchema);