import mongoose from "mongoose";

// Full lifecycle of a task's status column.
// New        -> task created, not yet assigned to anyone
// Assigned   -> assigned to one or more employees, who have not started working yet
// In Progress / Suspended -> an assignee is actively working the task, or has paused it
// Done       -> completed (completedDate captured, age frozen)
// Rejected   -> an assignee rejected the task (age frozen)
export const TASK_STATUSES = [
  "New",
  "Assigned",
  "In Progress",
  "Done",
  "Suspended",
  "Rejected",
] as const;

// Statuses that "close" a task: Age stops incrementing once a task reaches one of these.
export const TASK_CLOSED_STATUSES = ["Done", "Rejected"];

// Shared shape for the Project No / Work-Order No / Tender No reference fields.
// Only "number" is required to consider the reference "present" - the rest are
// optional context shown in that column's hover card.
const referenceSchema = new mongoose.Schema(
  {
    number: { type: String, trim: true },
    description: { type: String, trim: true },
    vertical: { type: String, trim: true },
    subVertical: { type: String, trim: true }, // comma-separated if more than one
    status: { type: String, trim: true },
    state: { type: String, trim: true },
  },
  { _id: false },
);

const taskSchema = new mongoose.Schema(
  {
    taskId: { type: String, required: true, trim: true }, // e.g. TSK-00001
    description: { type: String, required: true, trim: true },
    status: { type: String, enum: TASK_STATUSES, default: "New" },
    taskType: { type: String, trim: true },
    subTaskType: { type: String, trim: true },

    // Creator (always set, read-only after creation)
    createdBy: { type: mongoose.Types.ObjectId, ref: "User", required: true },
    createdByEmpId: { type: String, required: true },

    // Assignment - a task can be assigned to one employee or a whole team.
    // When assignedToEmpIds.length > 1 the Tasks list shows "Team" in that column.
    assignedTo: [{ type: mongoose.Types.ObjectId, ref: "User" }],
    assignedToEmpIds: [{ type: String }],
    assignedBy: { type: mongoose.Types.ObjectId, ref: "User" },
    assignedByEmpId: { type: String },
    assignedAt: { type: Date },

    // Optional reference numbers - shown only when present. A task with all
    // three left empty is considered "Internal" (see Internal column).
    projectNo: { type: referenceSchema, default: undefined },
    workOrderNo: { type: referenceSchema, default: undefined },
    tenderNo: { type: referenceSchema, default: undefined },

    // Captured automatically when status becomes "Done".
    completedDate: { type: Date },
    // Captured automatically when status becomes "Done" or "Rejected" - freezes the Age column.
    closedAt: { type: Date },

    orgId: { type: String, required: true },
  },
  { timestamps: true },
);

taskSchema.index({ orgId: 1, taskId: 1 }, { unique: true });
taskSchema.index({ orgId: 1, status: 1 });
taskSchema.index({ orgId: 1, assignedToEmpIds: 1 });
taskSchema.index({ orgId: 1, createdByEmpId: 1 });

export default mongoose.models.Task || mongoose.model("Task", taskSchema);