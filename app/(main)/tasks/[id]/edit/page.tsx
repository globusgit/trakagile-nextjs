"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import PageHeader from "@/app/_components/PageHeader";
import EmployeeMultiSelect from "@/app/_components/EmployeeMultiSelect";
import SearchableSelect from "@/app/_components/SearchableSelect";
import ReferenceFieldGroup, { EMPTY_REFERENCE, ReferenceValue } from "@/app/_components/ReferenceFieldGroup";
import { TASK_SOURCES } from "@/app/_components/taskConstants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmployeeNameTag } from "@/app/_components/EmployeeAvatar";

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
type TaskTypeEntry = { name: string; subTypes: string[] };

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
  const [description, setDescription] = useState("");
  const [taskSource, setTaskSource] = useState("");
  const [taskVertical, setTaskVertical] = useState("");
  const [taskVerticalOptions, setTaskVerticalOptions] = useState<string[]>([]);
  const [taskType, setTaskType] = useState("");
  const [subTaskType, setSubTaskType] = useState("");
  const [taskStatus, setTaskStatus] = useState("");
  const [endDateTime, setEndDateTime] = useState("");
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
        setDescription(result.description || "");
        setTaskSource(result.taskSource || "");
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

  // Task Source / Task Vertical are editable - Task Type options are looked up
  // within the currently selected scope.
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
      try {
        const response = await fetch("/api/task-verticals", { cache: "no-store" });
        if (response.ok) setTaskVerticalOptions((await response.json()).taskVerticals || []);
      } catch {
        // Non-fatal.
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

  const employeePhotoByEmpId = useMemo(() => {
    const map = new Map<string, string | undefined>();
    employees.forEach((employee) => map.set(employee.empId, employee.photo));
    return map;
  }, [employees]);
   

  const handleTaskSourceChange = (nextValue: string) => {
    const match = TASK_SOURCES.find((option) => option.toLowerCase() === nextValue.toLowerCase());
    setTaskSource(match || "");
    setTaskVertical("");
    setTaskType("");
    setSubTaskType("");
  };

  const handleTaskVerticalChange = (nextValue: string) => {
    setTaskVertical(nextValue);
    setTaskType("");
    setSubTaskType("");
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
    if (!description.trim()) {
      setServerError("Task description is required.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          projectNo: cleanReference(projectNo),
          workOrderNo: cleanReference(workOrderNo),
          tenderNo: cleanReference(tenderNo),
          taskSource: taskSource || undefined,
          taskVertical: taskSource === "Project" ? taskVertical : undefined,
          taskType,
          subTaskType,
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

                {/* Description with Task Status beside it */}
                <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
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
                  {canManage ? (
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
                  ) : (
                    <ReadOnlyField label="Task Status" value={task.status} />
                  )}
                </div>

                {/* Three cards side by side on large screens, stacked on small ones. */}
                <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
                  {/* Card 1: Sources */}
                  <Card className="h-full min-w-0 overflow-visible bg-white pt-0 shadow-2xl shadow-cyan-700/40 ring-2 ring-cyan-700 transition-transform duration-200 hover:-translate-y-1">
                    <CardHeader className="rounded-t-xl bg-linear-to-r from-cyan-900 to-cyan-600 py-3">
                      <CardTitle className="text-base font-semibold tracking-wide text-white">Sources</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {canManage ? (
                        <div className="grid grid-cols-1 gap-5">
                          <div className="space-y-2">
                            <Label>Task Source</Label>
                            <SearchableSelect
                              options={TASK_SOURCES}
                              value={taskSource}
                              onChange={handleTaskSourceChange}
                              placeholder="Search task source..."
                            />
                          </div>

                          {taskSource === "Project" && (
                            <div className="space-y-2">
                              <Label>Task Vertical</Label>
                              <SearchableSelect
                                options={taskVerticalOptions}
                                value={taskVertical}
                                onChange={handleTaskVerticalChange}
                                onAddNew={handleAddTaskVertical}
                                placeholder="Search or add a vertical..."
                              />
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label>Task Type</Label>
                            <SearchableSelect
                              options={taskTypes.map((entry) => entry.name)}
                              value={taskType}
                              onChange={handleTaskTypeChange}
                              onAddNew={handleAddTaskType}
                              placeholder="Search or add a task type..."
                              disabled={!scopeReady}
                              disabledMessage={
                                !taskSource
                                  ? "Select a task source first."
                                  : taskSource === "Project"
                                    ? "Select a task vertical first."
                                    : undefined
                              }
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
                      ) : (
                        <div className="grid grid-cols-1 gap-5">
                          <ReadOnlyField label="Task Source" value={task.taskSource || ""} />
                          {task.taskSource === "Project" && (
                            <ReadOnlyField label="Task Vertical" value={task.taskVertical || ""} />
                          )}
                          <ReadOnlyField label="Task Type" value={task.taskType || ""} />
                          <ReadOnlyField label="Sub-Task Type" value={task.subTaskType || ""} />
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Card 2: Assigned */}
                  <Card className="h-full min-w-0 overflow-visible bg-white pt-0 shadow-2xl shadow-indigo-700/40 ring-2 ring-indigo-700 transition-transform duration-200 hover:-translate-y-1">
                    <CardHeader className="rounded-t-xl bg-linear-to-r from-indigo-900 to-indigo-600 py-3">
                      <CardTitle className="text-base font-semibold tracking-wide text-white">Assigned</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 gap-5">
                        <ReadOnlyField
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
                  <Card className="h-full min-w-0 overflow-visible bg-white pt-0 shadow-2xl shadow-teal-700/40 ring-2 ring-teal-700 transition-transform duration-200 hover:-translate-y-1">
                    <CardHeader className="rounded-t-xl bg-linear-to-r from-teal-900 to-emerald-600 py-3">
                      <CardTitle className="text-base font-semibold tracking-wide text-white">Time Lines</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 gap-5">
                        <ReadOnlyField label="Create Date" value={formatDateTime(task.createdAt)} />
                        <ReadOnlyField label="Assigned Date" value={formatDateTime(task.assignedAt)} />
                        <ReadOnlyField label="Expected End Date" value={formatDateTime(task.endDateTime)} />
                        <ReadOnlyField label="Actual End Date" value={task.status === "Done" ? formatDateTime(task.completedDate) : ""} />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {canManage ? (
                  <>
                    <div className="grid grid-cols-1 gap-4 border-t border-gray-100 pt-6 md:grid-cols-3">
                      <ReferenceFieldGroup label="Project No" value={projectNo} onChange={setProjectNo} />
                      <ReferenceFieldGroup label="Work-Order No" value={workOrderNo} onChange={setWorkOrderNo} />
                      <ReferenceFieldGroup label="Tender No" value={tenderNo} onChange={setTenderNo} />
                    </div>
                    <p className="-mt-4 text-xs text-muted-foreground">Leave all three blank to mark this as an internal task.</p>

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
    </div>
  );
}