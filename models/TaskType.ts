import mongoose from "mongoose";
import { TASK_SOURCES } from "./Task";

// Task Types are scoped under a Task Source (and, for "Project", also under a
// Task Vertical) - see the hierarchy comment on the Task model.
const taskTypeSchema = new mongoose.Schema(
  {
    orgId: { type: String, required: true },
    taskSource: { type: String, enum: TASK_SOURCES, required: true },
    taskVertical: { type: String, trim: true }, // only set when taskSource === "Project"
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

taskTypeSchema.index({ orgId: 1, taskSource: 1, taskVertical: 1, name: 1 }, { unique: true });

export default mongoose.models.TaskType || mongoose.model("TaskType", taskTypeSchema);