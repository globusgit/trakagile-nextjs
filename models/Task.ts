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
export const TASK_SOURCES = [
  "Accounting",
  "Sales",
  "IT",
  "Project",
  "Internal",
  "Personal",
] as const;

// Shared shape for the Project No / Work-Order No / Tender No reference fields.
// Only "number" is required to consider the reference "present" - the rest are
// optional context shown in that column's hover card.
const referenceSchema = new mongoose.Schema(
  {
    number: { type: String, trim: true },
    description: { type: String, trim: true },
    vertical: { type: String, trim: true },
    subVertical: { type: String, trim: true },
    status: { type: String, trim: true },
    state: { type: String, trim: true },
  },
  { _id: false },
);

// Append-only note log shown on the Edit Task page. Anyone with access to the
// task may add a note; existing notes are never edited or removed via the API.
// authorName is captured at write time so the log stays a stable historical record.
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
    taskId: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: TASK_STATUSES,
      default: "New",
    },

    // Task Source -> Task Vertical (only for "Project")
    // -> Task Type -> Sub-Task Type.
    taskSource: {
      type: String,
      enum: TASK_SOURCES,
    },

    taskVertical: {
      type: String,
      trim: true,
    },

    taskType: {
      type: String,
      trim: true,
    },

    subTaskType: {
      type: String,
      trim: true,
    },

    // Creator
    createdBy: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: true,
    },

    createdByEmpId: {
      type: String,
      required: true,
    },

    // Assignment
    // A task can be assigned to one employee or a whole team.
    assignedTo: [
      {
        type: mongoose.Types.ObjectId,
        ref: "User",
      },
    ],

    assignedToEmpIds: [
      {
        type: String,
      },
    ],

    assignedBy: {
      type: mongoose.Types.ObjectId,
      ref: "User",
    },

    assignedByEmpId: {
      type: String,
    },

    assignedAt: {
      type: Date,
    },

    // Optional Project / Work Order / Tender references.
    projectNo: {
      type: referenceSchema,
      default: undefined,
    },

    workOrderNo: {
      type: referenceSchema,
      default: undefined,
    },

    tenderNo: {
      type: referenceSchema,
      default: undefined,
    },

    // ============================================================
    // TASK END DATE & TIME
    // ============================================================
    // Stores the complete deadline selected from the Create/Edit
    // Task "End Date & Time" field.
    //
    // Example:
    // 2026-09-30T18:30:00
    //
    // This value is used by:
    // - Create Task
    // - Edit Task
    // - Tasks listing table
    endDateTime: {
      type: Date,
    },

    // Captured automatically when status becomes "Done".
    completedDate: {
      type: Date,
    },

    // Captured automatically when status becomes "Done" or "Rejected".
    // This freezes the Age column.
    closedAt: {
      type: Date,
    },

    // Append-only notes log.
    notes: {
      type: [noteSchema],
      default: [],
    },

    orgId: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
taskSchema.index(
  {
    orgId: 1,
    taskId: 1,
  },
  {
    unique: true,
  },
);

taskSchema.index({
  orgId: 1,
  status: 1,
});

taskSchema.index({
  orgId: 1,
  assignedToEmpIds: 1,
});

taskSchema.index({
  orgId: 1,
  createdByEmpId: 1,
});

// Optional index for deadline/date based filtering and sorting.
taskSchema.index({
  orgId: 1,
  endDateTime: 1,
});

export default mongoose.models.Task ||
  mongoose.model("Task", taskSchema);