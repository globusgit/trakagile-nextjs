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

// Fixed list of task sources - the top of the Task Source -> Task Vertical (Project
// only) -> Task Type -> Sub-Task Type hierarchy.
export const TASK_SOURCES = ["Accounting", "Sales", "IT", "Project", "Internal", "Personal"] as const;

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

// Append-only note log shown on the Edit Task page. Anyone with access to the
// task may add a note; existing notes are never edited or removed via the API.
// authorName is captured at write time (not re-derived later) so the log stays
// a stable historical record even if the author's display name changes.
const noteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    authorEmpId: { type: String, required: true },
    authorName: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const taskSchema = new mongoose.Schema(
  {
    taskId: { type: String, required: true, trim: true }, // e.g. TSK-00001
    description: { type: String, required: true, trim: true },
    status: { type: String, enum: TASK_STATUSES, default: "New" },

    // Task Source -> Task Vertical (only for "Project") -> Task Type -> Sub-Task Type.
    // Task Type / Sub-Task Type are picked from the org's TaskType/SubTaskType
    // taxonomy, scoped by taskSource (+ taskVertical when Project).
    taskSource: { type: String, enum: TASK_SOURCES },
    taskVertical: { type: String, trim: true }, // only set when taskSource === "Project"
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
    // three left empty is considered "Internal" (used for filtering/reporting;
    // the Tasks list no longer shows a dedicated Internal column).
    projectNo: { type: referenceSchema, default: undefined },
    workOrderNo: { type: referenceSchema, default: undefined },
    tenderNo: { type: referenceSchema, default: undefined },

    // Captured automatically when status becomes "Done".
    completedDate: { type: Date },
    // Captured automatically when status becomes "Done" or "Rejected" - freezes the Age column.
    closedAt: { type: Date },

    // Append-only notes log - see noteSchema above. Displayed oldest-first on
    // the Edit Task page; new notes are always pushed to the end.
    notes: { type: [noteSchema], default: [] },

    orgId: { type: String, required: true },
  },
  { timestamps: true },
);

taskSchema.index({ orgId: 1, taskId: 1 }, { unique: true });
taskSchema.index({ orgId: 1, status: 1 });
taskSchema.index({ orgId: 1, assignedToEmpIds: 1 });
taskSchema.index({ orgId: 1, createdByEmpId: 1 });

export default mongoose.models.Task || mongoose.model("Task", taskSchema);