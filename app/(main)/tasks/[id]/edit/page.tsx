"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import PageHeader from "@/app/_components/PageHeader";
import EmployeeMultiSelect from "@/app/_components/EmployeeMultiSelect";
import SearchableSelect from "@/app/_components/SearchableSelect";
import { EMPTY_REFERENCE, ReferenceValue } from "@/app/_components/ReferenceFieldGroup";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmployeeNameTag } from "@/app/_components/EmployeeAvatar";
import HoverPanel from "@/app/_components/HoverPanel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Check, Pause, Play, X, type LucideIcon } from "lucide-react";

// Roles allowed to edit tasks — keep in sync with TASK_MANAGE_ROLES
// in app/api/tasks/_lib/tasks.js
const TASK_MANAGE_ROLES = ["ADMIN", "DIRECTOR", "MANAGER", "HR"];

// Task Type choices on the edit page. "Project" tasks also capture
// Work-Order No and Tender No details.
const TASK_TYPE_OPTIONS = ["Internal", "Project"];

// Status action buttons shown in place of the old Task Status dropdown.
// Colours match the status badges used in the Tasks listing.
type StatusActionKey = "start" | "resume" | "done" | "reject" | "suspend";

type StatusAction = {
  label: string;
  nextStatus: string;
  // Completes the sentence "Are you sure you want to ...?"
  confirmText: string;
  Icon: LucideIcon;
  buttonClass: string;
  mediaClass: string;
};

const STATUS_ACTIONS: Record<StatusActionKey, StatusAction> = {
  start: {
    label: "Start",
    nextStatus: "In Progress",
    confirmText: "start this task",
    Icon: Play,
    buttonClass: "bg-sky-600 hover:bg-sky-700 focus-visible:ring-sky-300",
    mediaClass: "bg-sky-100 text-sky-700",
  },
  resume: {
    label: "Resume",
    nextStatus: "In Progress",
    confirmText: "resume this task",
    Icon: Play,
    buttonClass: "bg-sky-600 hover:bg-sky-700 focus-visible:ring-sky-300",
    mediaClass: "bg-sky-100 text-sky-700",
  },
  done: {
    label: "Done",
    nextStatus: "Done",
    confirmText: "mark this task as done",
    Icon: Check,
    buttonClass: "bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-300",
    mediaClass: "bg-emerald-100 text-emerald-700",
  },
  reject: {
    label: "Reject",
    nextStatus: "Rejected",
    confirmText: "reject this task",
    Icon: X,
    buttonClass: "bg-red-600 hover:bg-red-700 focus-visible:ring-red-300",
    mediaClass: "bg-red-100 text-red-700",
  },
  suspend: {
    label: "Suspend",
    nextStatus: "Suspended",
    confirmText: "suspend this task",
    Icon: Pause,
    buttonClass: "bg-orange-500 hover:bg-orange-600 focus-visible:ring-orange-300",
    mediaClass: "bg-orange-100 text-orange-700",
  },
};

// Which buttons are offered for each (current) status.
//   New / Assigned -> Reject, Suspend, Start
//   In Progress    -> Reject, Suspend, Done
//   Suspended      -> Reject, Resume, Done
//   Done / Rejected -> none (task is closed)
function getStatusActionKeys(status: string): StatusActionKey[] {
  switch (status) {
    case "New":
    case "Assigned":
      return ["reject", "suspend", "start"];
    case "In Progress":
      return ["reject", "suspend", "done"];
    case "Suspended":
      return ["reject", "resume", "done"];
    default:
      return [];
  }
}

type Reference = {
  number?: string;
  description?: string;
  vertical?: string;
  subVertical?: string;
  status?: string;
  state?: string;
};

type AssignedEmployee = { empId: string; 
  name: string;
  photo?: string | null;
 };

// A single entry in the task's append-only notes log.
type Note = {
  _id?: string;
  text: string;
  authorEmpId: string;
  authorName?: string;
  createdAt: string;
};

type Task = {
  _id: string;
  taskId: string;
  description: string;
  status: string;
  taskSource?: string;
  taskVertical?: string;
  taskType?: string;
  subTaskType?: string;
  createdByName?: string;
  createdByEmpId: string;
  createdByPhoto?: string | null;
  createdAt: string;
  assignedToEmpIds?: string[];
  assignedToNames?: AssignedEmployee[];
  assignedByName?: string;
  assignedByPhoto?: string | null;
  assignedAt?: string;
  projectNo?: Reference;
  workOrderNo?: Reference;
  tenderNo?: Reference;
  endDateTime?: string;
  completedDate?: string;
  notes?: Note[];
};

type Employee = { _id: string; empId: string; name: string; photo?: string};

function formatDateTime(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateTimeLocal(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toReferenceValue(reference?: Reference): ReferenceValue {
  return {
    number: reference?.number || "",
    description: reference?.description || "",
    vertical: reference?.vertical || "",
    subVertical: reference?.subVertical || "",
    status: reference?.status || "",
    state: reference?.state || "",
  };
}

function cleanReference(value: ReferenceValue) {
  return value.number.trim() ? value : undefined;
}

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Request failed.");
  return result;
}

function ReadOnlyField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-foreground">{label}</Label>
      <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">{value || "-"}</div>
    </div>
  );
}

// Small card for a Work-Order / Tender reference: Number + Status on the top
// row, with a large Description box underneath (it holds the most text).
// Only these three are edited here; the reference's other stored details
// (vertical, sub-vertical, state) are carried through unchanged on save.
const REFERENCE_CARD_TONES = {
  workOrder: {
    card: "border-amber-300 bg-amber-50/40",
    header: "bg-amber-100 text-amber-900",
  },
  tender: {
    card: "border-violet-300 bg-violet-50/40",
    header: "bg-violet-100 text-violet-900",
  },
};

function ReferenceDetailCard({
  title,
  numberLabel,
  tone,
  value,
  onChange,
  readOnly = false,
}: {
  title: string;
  numberLabel: string;
  tone: keyof typeof REFERENCE_CARD_TONES;
  value: ReferenceValue;
  onChange?: (value: ReferenceValue) => void;
  readOnly?: boolean;
}) {
  const styles = REFERENCE_CARD_TONES[tone];
  const set = (field: "number" | "description" | "status") =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange?.({ ...value, [field]: e.target.value });

  return (
    <div className={`min-w-0 overflow-hidden rounded-lg border ${styles.card}`}>
      <div className={`px-4 py-2 text-sm font-semibold ${styles.header}`}>{title}</div>
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {readOnly ? (
            <>
              <ReadOnlyField label={numberLabel} value={value.number} />
              <ReadOnlyField label="Status" value={value.status} />
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>{numberLabel}</Label>
                <Input placeholder={numberLabel} value={value.number} onChange={set("number")} className="bg-white" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Input placeholder="Status" value={value.status} onChange={set("status")} className="bg-white" />
              </div>
            </>
          )}
        </div>
        {readOnly ? (
          <ReadOnlyField
            label="Description"
            value={<div className="min-h-24 whitespace-pre-wrap">{value.description}</div>}
          />
        ) : (
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Description"
              rows={5}
              value={value.description}
              onChange={set("description")}
              className="min-h-28 bg-white"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Read-only value shown as plain text on one line - "Label : value" - with no
// surrounding box. Labels share a fixed width so the colons line up.
function TextRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="w-36 shrink-0 font-medium text-foreground">{label}</span>
      <span>:</span>
      <div className="min-w-0 break-words">{value || "-"}</div>
    </div>
  );
}

export default function EditTaskPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { data: session, status } = useSession();
  const canManage = TASK_MANAGE_ROLES.includes(session?.user?.role ?? "");

  const [task, setTask] = useState<Task | null>(null);
  const [loadingTask, setLoadingTask] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [projectNo, setProjectNo] = useState<ReferenceValue>(EMPTY_REFERENCE);
  const [workOrderNo, setWorkOrderNo] = useState<ReferenceValue>(EMPTY_REFERENCE);
  const [tenderNo, setTenderNo] = useState<ReferenceValue>(EMPTY_REFERENCE);
  const [description, setDescription] = useState("");
  const [taskVertical, setTaskVertical] = useState("");
  const [taskVerticalOptions, setTaskVerticalOptions] = useState<string[]>([]);
  const [taskType, setTaskType] = useState("");
  const [subTaskType, setSubTaskType] = useState("");
  const [taskStatus, setTaskStatus] = useState("");
  const [endDateTime, setEndDateTime] = useState("");
  const [assignedToEmpIds, setAssignedToEmpIds] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");

  // Status button the user clicked that is waiting for "Are you sure?" confirmation.
  const [pendingAction, setPendingAction] = useState<StatusActionKey | null>(null);

  // Notes log - anyone who can view this task can add a note. New notes are
  // appended to the end of the underlying list (see handleAddNote), but the
  // panel below displays them newest-first via the displayNotes memo.
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [notesError, setNotesError] = useState("");

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoadingTask(true);
      setLoadError("");
      try {
        const response = await fetch(`/api/tasks/${id}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Unable to load task.");
        setTask(result);
        setProjectNo(toReferenceValue(result.projectNo));
        setWorkOrderNo(toReferenceValue(result.workOrderNo));
        setTenderNo(toReferenceValue(result.tenderNo));
        setDescription(result.description || "");
        setTaskVertical(result.taskVertical || "");
        setTaskType(result.taskType || "");
        setSubTaskType(result.subTaskType || "");
        setTaskStatus(result.status);
        setEndDateTime(toDateTimeLocal(result.endDateTime));
        setAssignedToEmpIds(result.assignedToEmpIds || []);
        setNotes(result.notes || []);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Unable to load task.");
      } finally {
        setLoadingTask(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!canManage) return;
    (async () => {
      try {
        const response = await fetch("/api/employee/search?limit=200", { cache: "no-store" });
        if (response.ok) setEmployees((await response.json()).employees || []);
      } catch {
        // Non-fatal — the assignee picker will just be empty.
      }
    })();
  }, [canManage]);

  useEffect(() => {
    if (!canManage) return;
    (async () => {
      try {
        const response = await fetch("/api/task-verticals", { cache: "no-store" });
        if (response.ok) setTaskVerticalOptions((await response.json()).taskVerticals || []);
      } catch {
        // Non-fatal.
      }
    })();
  }, [canManage]);

  // Notes are stored/saved in chronological order (each new note is appended
  // to the end - see handleAddNote), but displayed newest-first so the most
  // recent note is immediately visible at the top of the panel.
  const displayNotes = useMemo(() => [...notes].reverse(), [notes]);

  // The logged-in user's own entry. The employee search is scoped/limited, so
  // the user may not appear in it - always include them so their name shows
  // in the Assigned To field after clicking "Self Task".
  const selfEmpId = session?.user?.empId ?? "";
  const assigneeOptions = useMemo(() => {
    if (!selfEmpId || employees.some((employee) => employee.empId === selfEmpId)) return employees;
    return [
      { _id: session?.user?.id ?? selfEmpId, empId: selfEmpId, name: session?.user?.name || selfEmpId },
      ...employees,
    ];
  }, [employees, selfEmpId, session?.user?.id, session?.user?.name]);

  const isSelfTask = assignedToEmpIds.length === 1 && assignedToEmpIds[0] === selfEmpId;
  // Only offered while the task was created without an assignee.
  const showSelfTaskButton = canManage && !!selfEmpId && !(task?.assignedToEmpIds?.length);

  // "Self Task": assign the task to the logged-in user. Clicking again clears it.
  const handleSelfTask = () => {
    if (!selfEmpId) return;
    setAssignedToEmpIds(isSelfTask ? [] : [selfEmpId]);
  };

  // Task Status is read-only text; it only changes through the action buttons.
  // "New" and "Assigned" are both shown as "New" here.
  const displayStatus = taskStatus === "Assigned" ? "New" : taskStatus;
  // Action buttons only make sense once somebody is assigned to the task.
  const statusActionKeys = assignedToEmpIds.length > 0 ? getStatusActionKeys(taskStatus) : [];
  const pending = pendingAction ? STATUS_ACTIONS[pendingAction] : null;

  const handleConfirmStatusAction = () => {
    if (!pending) return;
    setTaskStatus(pending.nextStatus);
    setPendingAction(null);
    toast.success(`Status changed to ${pending.nextStatus}. Click "Save Changes" to apply it.`);
  };

  const employeePhotoByEmpId = useMemo(() => {
    const map = new Map<string, string | undefined>();
    employees.forEach((employee) => map.set(employee.empId, employee.photo));
    return map;
  }, [employees]);
   

  // "Project" tasks show Work-Order No / Tender No fields; "Internal" ones don't.
  const isProjectTask = taskType === "Project";
  const isInternalTask = taskType === "Internal";

  const handleTaskVerticalChange = (nextValue: string) => {
    setTaskVertical(nextValue);
  };

  const handleAddTaskVertical = async (name: string) => {
    try {
      await postJson("/api/task-verticals", { name });
      setTaskVerticalOptions((prev) => (prev.includes(name) ? prev : [...prev, name].sort()));
      handleTaskVerticalChange(name);
      toast.success("Task vertical added.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add task vertical.");
    }
  };

  const handleAddNote = async () => {
    const text = noteText.trim();
    if (!text) return;
    setNotesError("");
    setAddingNote(true);
    try {
      const result = await postJson(`/api/tasks/${id}/notes`, { text });
      setNotes((prev) => [...prev, result.note]);
      setNoteText("");
    } catch (error) {
      setNotesError(error instanceof Error ? error.message : "Unable to add note.");
    } finally {
      setAddingNote(false);
    }
  };

  const handleSubmit = async () => {
    setServerError("");
    if (!description.trim()) {
      setServerError("Task description is required.");
      return;
    }
    if (isProjectTask) {
      const incomplete = [
        { label: "Work-Order No", value: workOrderNo },
        { label: "Tender No", value: tenderNo },
      ].find(({ value }) => !value.number.trim() && (value.description.trim() || value.status.trim()));
      if (incomplete) {
        setServerError(`Enter the ${incomplete.label}, or clear its description and status.`);
        return;
      }
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          projectNo: cleanReference(projectNo),
          // Internal tasks carry no Work-Order No / Tender No.
          workOrderNo: isInternalTask ? undefined : cleanReference(workOrderNo),
          tenderNo: isInternalTask ? undefined : cleanReference(tenderNo),
          // Task Type (Internal / Project), Vertical and Sub-vertical. Task Source
          // is no longer editable here and is left as stored.
          taskVertical: taskVertical.trim(),
          taskType,
          subTaskType: subTaskType.trim(),
          // End Date & Time is no longer editable on this page - the existing
          // value is sent back unchanged so saving never clears it.
          endDateTime: endDateTime || undefined,
          status: taskStatus,
          assignedToEmpIds,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setServerError(result.message || "Failed to update task.");
        return;
      }
      router.push("/tasks");
      router.refresh();
    } catch (err) {
      console.error(err);
      setServerError("Something went wrong while saving the task.");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="space-y-4 px-0 md:px-4 lg:px-8">
        <PageHeader title="Task" />
      </div>
    );
  }

   const assignedToDisplay =
    task?.assignedToNames && task.assignedToNames.length > 0 ? (
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {task.assignedToNames.map((employee) => (
          <EmployeeNameTag key={employee.empId} name={employee.name} photo={employee.photo} size={20} />
        ))}
      </span>
    ) : (
      ""
    );

  const headerTitle = task
    ? `${canManage ? "Edit Task" : "View Task"} – ${task.taskId} - ${task.createdByName || task.createdByEmpId}`
    : canManage
      ? "Edit Task"
      : "View Task";

  return (
    <div className="space-y-4">
      <PageHeader title={headerTitle} subtitle="Manage and review your task workspace" />

      {loadingTask ? (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl">Task Information</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Loading task...</p>
          </CardContent>
        </Card>
      ) : loadError ? (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl">Task Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
          </CardContent>
        </Card>
      ) : task ? (
        // Notes column is a fixed, narrower width on large screens so the
        // task form gets the remaining space.
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Left: all the editable/read-only task fields. */}
          <Card className="min-w-0 overflow-visible shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl">Task Information</CardTitle>
            {/*  {canManage && (
                <p className="text-sm text-muted-foreground">
                  Task Source, Task Vertical, Task Type, Sub-Task Type, Assigned To, Project No, Work-Order No, Tender No and Task Status can be edited here.
                </p>
              )} */}
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {serverError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {serverError}
                  </div>
                )}

                {/* Two columns (70% / 30%) on large screens, stacked on small ones. */}
                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[7fr_3fr]">
                  {/* Left column: Description, Task Status, Sources */}
                  <div className="min-w-0 space-y-6">
                    {canManage ? (
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Describe the task..."
                          rows={3}
                        />
                      </div>
                    ) : (
                      <ReadOnlyField label="Description" value={task.description} />
                    )}

                    {/* Task Status: plain read-only text, with the action icon buttons below it */}
                    <div className="space-y-3">
                      <TextRow label="Task Status" value={canManage ? displayStatus : task.status} />
                      {canManage && statusActionKeys.length > 0 && (
                        <div className="flex items-center gap-2">
                          {statusActionKeys.map((key) => {
                            const action = STATUS_ACTIONS[key];
                            return (
                              <HoverPanel
                                key={key}
                                panelClassName="w-max whitespace-nowrap"
                                trigger={
                                  <button
                                    type="button"
                                    onClick={() => setPendingAction(key)}
                                    disabled={saving}
                                    aria-label={action.label}
                                    className={`flex size-9 items-center justify-center rounded-full text-white shadow-sm outline-none transition-colors focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${action.buttonClass}`}
                                  >
                                    <action.Icon className="size-4" strokeWidth={2.5} />
                                  </button>
                                }
                                panel={action.label}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>

                  {/* Card 1: Sources */}
                    <Card className="min-w-0 overflow-visible bg-white pt-0 shadow-2xl shadow-cyan-700/40 ring-2 ring-cyan-700 transition-transform duration-200 hover:-translate-y-1">
                      <CardHeader className="rounded-t-xl bg-linear-to-r from-cyan-900 to-cyan-600 py-3">
                        <CardTitle className="text-base font-semibold tracking-wide text-white">Sources</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {canManage ? (
                          <div className="grid grid-cols-1 gap-5">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <div className="space-y-2">
                              <Label>Task Type</Label>
                              <select
                                className="h-10 w-full rounded-md border bg-transparent px-3 text-sm"
                                value={TASK_TYPE_OPTIONS.includes(taskType) ? taskType : ""}
                                onChange={(e) => setTaskType(e.target.value)}
                              >
                                <option value="" disabled>Select task type</option>
                                {TASK_TYPE_OPTIONS.map((option) => (
                                  <option key={option} value={option}>{option}</option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-2">
                              <Label>Vertical</Label>
                              <SearchableSelect
                                options={taskVerticalOptions}
                                value={taskVertical}
                                onChange={handleTaskVerticalChange}
                                onAddNew={handleAddTaskVertical}
                                placeholder="Search or add a vertical..."
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Sub-vertical</Label>
                              <Input
                                value={subTaskType}
                                onChange={(e) => setSubTaskType(e.target.value)}
                                placeholder="Sub-vertical"
                              />
                            </div>
                            </div>

                            {isProjectTask && (
                              <div className="grid grid-cols-1 gap-4 border-t border-gray-100 pt-5 xl:grid-cols-2">
                                <ReferenceDetailCard
                                  title="Work-Order Details"
                                  numberLabel="Work-Order No"
                                  tone="workOrder"
                                  value={workOrderNo}
                                  onChange={setWorkOrderNo}
                                />
                                <ReferenceDetailCard
                                  title="Tender Details"
                                  numberLabel="Tender No"
                                  tone="tender"
                                  value={tenderNo}
                                  onChange={setTenderNo}
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-5">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                              <ReadOnlyField label="Task Type" value={task.taskType || ""} />
                              <ReadOnlyField label="Vertical" value={task.taskVertical || ""} />
                              <ReadOnlyField label="Sub-vertical" value={task.subTaskType || ""} />
                            </div>
                            {task.taskType === "Project" && (
                              <div className="grid grid-cols-1 gap-4 border-t border-gray-100 pt-5 xl:grid-cols-2">
                                <ReferenceDetailCard
                                  readOnly
                                  title="Work-Order Details"
                                  numberLabel="Work-Order No"
                                  tone="workOrder"
                                  value={toReferenceValue(task.workOrderNo)}
                                />
                                <ReferenceDetailCard
                                  readOnly
                                  title="Tender Details"
                                  numberLabel="Tender No"
                                  tone="tender"
                                  value={toReferenceValue(task.tenderNo)}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Right column: Assigned, Time Lines */}
                  <div className="min-w-0 space-y-6">
                  {/* Card 2: Assigned */}
                    <Card className="min-w-0 overflow-visible bg-white pt-0 shadow-2xl shadow-indigo-700/40 ring-2 ring-indigo-700 transition-transform duration-200 hover:-translate-y-1">
                      <CardHeader className="rounded-t-xl bg-linear-to-r from-indigo-900 to-indigo-600 py-3">
                        <CardTitle className="text-base font-semibold tracking-wide text-white">Assigned</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 gap-5">
                          <TextRow
                            label="Assigned By"
                            value={task.assignedByName ? <EmployeeNameTag name={task.assignedByName} photo={task.assignedByPhoto} size={20} /> : ""}
                          />

                          {canManage ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                <Label>Assigned To</Label>
                                {showSelfTaskButton && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleSelfTask}
                                    aria-pressed={isSelfTask}
                                    className={`h-7 bg-blue-600 px-3 text-xs text-white hover:bg-blue-700 ${isSelfTask ? "ring-2 ring-blue-300 ring-offset-1" : ""}`}
                                  >
                                    Self Task
                                  </Button>
                                )}
                              </div>
                              <EmployeeMultiSelect
                                employees={assigneeOptions}
                                selectedEmpIds={assignedToEmpIds}
                                onChange={setAssignedToEmpIds}
                                placeholder="Unassigned"
                              />
                              <p className="text-xs text-muted-foreground">Select multiple employees to assign this task to a team - the Tasks list will show &quot;Team&quot; for it.</p>
                            </div>
                          ) : (
                            <ReadOnlyField label="Assigned To" value={assignedToDisplay} />
                          )}
                        </div>
                      </CardContent>
                    </Card>

                  {/* Card 3: Time Lines (all read-only) */}
                    <Card className="min-w-0 overflow-visible bg-white pt-0 shadow-2xl shadow-teal-700/40 ring-2 ring-teal-700 transition-transform duration-200 hover:-translate-y-1">
                      <CardHeader className="rounded-t-xl bg-linear-to-r from-teal-900 to-emerald-600 py-3">
                        <CardTitle className="text-base font-semibold tracking-wide text-white">Time Lines</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 gap-4">
                          <TextRow label="Create Date" value={formatDateTime(task.createdAt)} />
                          <TextRow label="Assigned Date" value={formatDateTime(task.assignedAt)} />
                          <TextRow label="Expected End Date" value={formatDateTime(task.endDateTime)} />
                          <TextRow label="Actual End Date" value={task.status === "Done" ? formatDateTime(task.completedDate) : ""} />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {canManage ? (
                  <>
                    <div className="flex justify-end gap-4 border-t border-gray-100 pt-6">
                      <Button
                        variant="outline"
                        onClick={() => router.push("/tasks")}
                        className="bg-orange-700 text-white hover:bg-orange-500"
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleSubmit} disabled={saving} className="bg-cyan-900 hover:bg-cyan-700">
                        {saving ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-6 border-t border-gray-100 pt-6 md:grid-cols-3">
                      <ReadOnlyField label="Project No" value={task.projectNo?.number || ""} />
                    </div>
                    <div className="flex justify-end border-t border-gray-100 pt-6">
                      <Button variant="outline" onClick={() => router.push("/tasks")}>Back</Button>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right: Notes - narrower fixed-width column, stays pinned while
              the task-information card scrolls. */}
          <Card className="min-w-0 shadow-sm lg:sticky lg:top-4 lg:self-start">
            <CardHeader>
              <CardTitle className="text-2xl">Notes</CardTitle>
              <p className="text-xs text-muted-foreground">
                Anyone with access to this task can add a note. Newest notes appear at the top.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Add a Note</Label>
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Write a note for this task..."
                  rows={3}
                />
                <div className="flex justify-end">
                  <Button
                    onClick={handleAddNote}
                    disabled={addingNote || !noteText.trim()}
                    className="bg-cyan-900 hover:bg-cyan-700"
                  >
                    {addingNote ? "Adding..." : "Add Note"}
                  </Button>
                </div>
              </div>

              {notesError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {notesError}
                </div>
              )}

              <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-md border bg-white p-3">
                {displayNotes.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No notes yet. Be the first to add one.</p>
                ) : (
                  displayNotes.map((note, index) => (
                    <div key={note._id || index} className="rounded-md border bg-slate-50 p-3 text-sm shadow-sm">
                     <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <EmployeeNameTag
                          name={note.authorName || note.authorEmpId}
                          photo={employeePhotoByEmpId.get(note.authorEmpId)}
                          size={20}
                          className="font-semibold"
                        />
                        <span className="text-xs text-muted-foreground">{formatDateTime(note.createdAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{note.text}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* "Are you sure?" confirmation for the status icon buttons */}
      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            {pending && (
              <AlertDialogMedia className={pending.mediaClass}>
                <pending.Icon />
              </AlertDialogMedia>
            )}
            <AlertDialogTitle>Confirm {pending?.label}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {pending?.confirmText}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmStatusAction}
              className={`text-white ${pending?.buttonClass ?? ""}`}
            >
              Yes, {pending?.label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}