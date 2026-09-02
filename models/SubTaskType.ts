import mongoose from "mongoose";
import { TASK_SOURCES } from "./Task";

// Sub-Task Types are scoped under the same Task Source (+ Task Vertical for
// "Project") as their parent Task Type, plus the parent Task Type's name.
const subTaskTypeSchema = new mongoose.Schema(
  {
    orgId: { type: String, required: true },
    taskSource: { type: String, enum: TASK_SOURCES, required: true },
    taskVertical: { type: String, trim: true }, // only set when taskSource === "Project"
    taskType: { type: String, required: true, trim: true }, // parent TaskType.name
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

subTaskTypeSchema.index(
  { orgId: 1, taskSource: 1, taskVertical: 1, taskType: 1, name: 1 },
  { unique: true },
);

export default mongoose.models.SubTaskType || mongoose.model("SubTaskType", subTaskTypeSchema);