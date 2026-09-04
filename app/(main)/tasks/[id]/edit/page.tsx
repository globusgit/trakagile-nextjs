"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import PageHeader from "@/app/_components/PageHeader";
import EmployeeMultiSelect from "@/app/_components/EmployeeMultiSelect";
import SearchableSelect from "@/app/_components/SearchableSelect";
import ReferenceFieldGroup, { EMPTY_REFERENCE, ReferenceValue } from "@/app/_components/ReferenceFieldGroup";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// Roles allowed to edit tasks — keep in sync with TASK_MANAGE_ROLES
// in app/api/tasks/_lib/tasks.js
const TASK_MANAGE_ROLES = ["ADMIN", "DIRECTOR", "MANAGER", "HR"];
const TASK_STATUSES = ["New", "Assigned", "In Progress", "Done", "Suspended", "Rejected"];

type Reference = {
  number?: string;
  description?: string;
  vertical?: string;
  subVertical?: string;
  status?: string;
  state?: string;
};

type AssignedEmployee = { empId: string; name: string };

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
  createdAt: string;
  assignedToEmpIds?: string[];
  assignedToNames?: AssignedEmployee[];
  assignedByName?: string;
  assignedAt?: string;
  projectNo?: Reference;
  workOrderNo?: Reference;
  tenderNo?: Reference;
  completedDate?: string;
  notes?: Note[];
};

type Employee = { _id: string; empId: string; name: string };
type TaskTypeEntry = { name: string; subTypes: string[] };

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

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

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-muted-foreground">{label}</Label>
      <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">{value || "-"}</div>
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
  const [taskTypes, setTaskTypes] = useState<TaskTypeEntry[]>([]);

  const [projectNo, setProjectNo] = useState<ReferenceValue>(EMPTY_REFERENCE);
  const [workOrderNo, setWorkOrderNo] = useState<ReferenceValue>(EMPTY_REFERENCE);
  const [tenderNo, setTenderNo] = useState<ReferenceValue>(EMPTY_REFERENCE);
  const [taskType, setTaskType] = useState("");
  const [subTaskType, setSubTaskType] = useState("");
  const [taskStatus, setTaskStatus] = useState("");
  const [assignedToEmpIds, setAssignedToEmpIds] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");

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
        setTaskType(result.taskType || "");
        setSubTaskType(result.subTaskType || "");
        setTaskStatus(result.status);
        setAssignedToEmpIds(result.assignedToEmpIds || []);
        setNotes(result.notes || []);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Unable to load task.");
      } finally {
        setLoadingTask(false);
      }
    })();
  }, [id]);

  // Task Source / Task Vertical are fixed at creation - Task Type options are
  // looked up within that fixed scope.
  const taskSource = task?.taskSource || "";
  const taskVertical = task?.taskVertical || "";
  const scopeReady = Boolean(taskSource) && (taskSource !== "Project" || Boolean(taskVertical));

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
      if (!scopeReady) {
        setTaskTypes([]);
        return;
      }
      try {
        const params = new URLSearchParams({ taskSource });
        if (taskSource === "Project") params.set("taskVertical", taskVertical);
        const response = await fetch(`/api/task-types?${params}`, { cache: "no-store" });
        if (response.ok) setTaskTypes((await response.json()).taskTypes || []);
      } catch {
        // Non-fatal.
      }
    })();
  }, [canManage, scopeReady, taskSource, taskVertical]);

  const subTypeOptions = useMemo(
    () => taskTypes.find((entry) => entry.name === taskType)?.subTypes || [],
    [taskTypes, taskType],
  );

  // Notes are stored/saved in chronological order (each new note is appended
  // to the end - see handleAddNote), but displayed newest-first so the most
  // recent note is immediately visible at the top of the panel.
  const displayNotes = useMemo(() => [...notes].reverse(), [notes]);

  const handleTaskTypeChange = (nextValue: string) => {
    setTaskType(nextValue);
    setSubTaskType("");
  };

  const handleAddTaskType = async (name: string) => {
    try {
      await postJson("/api/task-types", { name, taskSource, taskVertical: taskSource === "Project" ? taskVertical : undefined });
      setTaskTypes((prev) => (prev.some((entry) => entry.name === name) ? prev : [...prev, { name, subTypes: [] }]));
      handleTaskTypeChange(name);
      toast.success("Task type added.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add task type.");
    }
  };

  const handleAddSubTaskType = async (name: string) => {
    try {
      await postJson("/api/task-types/sub-types", {
        name,
        taskType,
        taskSource,
        taskVertical: taskSource === "Project" ? taskVertical : undefined,
      });
      setTaskTypes((prev) =>
        prev.map((entry) =>
          entry.name === taskType && !entry.subTypes.includes(name)
            ? { ...entry, subTypes: [...entry.subTypes, name] }
            : entry,
        ),
      );
      setSubTaskType(name);
      toast.success("Sub-task type added.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add sub-task type.");
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
    setSaving(true);
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectNo: cleanReference(projectNo),
          workOrderNo: cleanReference(workOrderNo),
          tenderNo: cleanReference(tenderNo),
          taskType,
          subTaskType,
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

  const assignedToDisplay = (task?.assignedToNames || []).map((employee) => employee.name).join(", ");

  return (
    <div className="space-y-4">
      <PageHeader title={canManage ? "Edit Task" : "View Task"} />

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
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left: all the editable/read-only task fields. */}
          <Card className="shadow-sm lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-2xl">Task Information</CardTitle>
              {canManage && (
                <p className="text-sm text-muted-foreground">
                  Project No, Work-Order No, Tender No, Task Type, Sub-Task Type, Assigned To and Task Status can be edited here.
                </p>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {serverError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {serverError}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <ReadOnlyField label="Task ID" value={task.taskId} />
                  <ReadOnlyField label="Created By" value={task.createdByName || task.createdByEmpId} />
                </div>

                <ReadOnlyField label="Description" value={task.description} />

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <ReadOnlyField label="Task Source" value={task.taskSource || ""} />
                  {task.taskSource === "Project" && <ReadOnlyField label="Task Vertical" value={task.taskVertical || ""} />}
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <ReadOnlyField label="Created Date" value={formatDate(task.createdAt)} />
                  <ReadOnlyField label="Assigned By" value={task.assignedByName || ""} />
                  <ReadOnlyField label="Assigned Date" value={formatDate(task.assignedAt)} />
                </div>

                {!canManage && (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <ReadOnlyField label="Task Type" value={[task.taskType, task.subTaskType].filter(Boolean).join(" / ")} />
                    <ReadOnlyField label="Assigned To" value={assignedToDisplay} />
                  </div>
                )}

                {canManage ? (
                  <>
                    <div className="grid grid-cols-1 gap-6 border-t border-gray-100 pt-6 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Task Type</Label>
                        <SearchableSelect
                          options={taskTypes.map((entry) => entry.name)}
                          value={taskType}
                          onChange={handleTaskTypeChange}
                          onAddNew={handleAddTaskType}
                          placeholder="Search or add a task type..."
                          disabled={!scopeReady}
                          disabledMessage={!scopeReady ? "This task has no task source set." : undefined}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Sub-Task Type</Label>
                        <SearchableSelect
                          options={subTypeOptions}
                          value={subTaskType}
                          onChange={setSubTaskType}
                          onAddNew={handleAddSubTaskType}
                          placeholder="Search or add a sub-task type..."
                          disabled={!taskType}
                          disabledMessage={!taskType ? "Select a task type first." : undefined}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Assigned To</Label>
                      <EmployeeMultiSelect
                        employees={employees}
                        selectedEmpIds={assignedToEmpIds}
                        onChange={setAssignedToEmpIds}
                        placeholder="Unassigned"
                      />
                      <p className="text-xs text-muted-foreground">Select multiple employees to assign this task to a team - the Tasks list will show &quot;Team&quot; for it.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 border-t border-gray-100 pt-6 md:grid-cols-3">
                      <ReferenceFieldGroup label="Project No" value={projectNo} onChange={setProjectNo} />
                      <ReferenceFieldGroup label="Work-Order No" value={workOrderNo} onChange={setWorkOrderNo} />
                      <ReferenceFieldGroup label="Tender No" value={tenderNo} onChange={setTenderNo} />
                    </div>
                    <p className="-mt-4 text-xs text-muted-foreground">Leave all three blank to mark this as an internal task.</p>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Task Status</Label>
                        <select
                          className="h-10 w-full rounded-md border bg-transparent px-3 text-sm"
                          value={taskStatus}
                          onChange={(e) => setTaskStatus(e.target.value)}
                        >
                          {TASK_STATUSES.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>
                      <ReadOnlyField label="Completed Date" value={task.status === "Done" ? formatDate(task.completedDate) : ""} />
                    </div>

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
                      <ReadOnlyField label="Work-Order No" value={task.workOrderNo?.number || ""} />
                      <ReadOnlyField label="Tender No" value={task.tenderNo?.number || ""} />
                    </div>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <ReadOnlyField label="Task Status" value={task.status} />
                      <ReadOnlyField label="Completed Date" value={task.status === "Done" ? formatDate(task.completedDate) : ""} />
                    </div>
                    <div className="flex justify-end border-t border-gray-100 pt-6">
                      <Button variant="outline" onClick={() => router.push("/tasks")}>Back</Button>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right: Notes remain in the existing one-third-width column and
              stay pinned while the task-information card scrolls. */}
          <Card className="shadow-sm lg:col-span-1 lg:sticky lg:top-4 lg:self-start">
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
                        <span className="font-semibold">{note.authorName || note.authorEmpId}</span>
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
    </div>
  );
}
