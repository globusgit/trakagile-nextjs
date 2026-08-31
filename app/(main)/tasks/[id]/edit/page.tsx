"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import PageHeader from "@/app/_components/PageHeader";
import EmployeeMultiSelect from "@/app/_components/EmployeeMultiSelect";
import ReferenceFieldGroup, { EMPTY_REFERENCE, ReferenceValue } from "@/app/_components/ReferenceFieldGroup";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

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

type Task = {
  _id: string;
  taskId: string;
  description: string;
  status: string;
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
};

type Employee = { _id: string; empId: string; name: string };
type TaskTypeEntry = { name: string; subTypes: string[] };

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
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

  const [showNewType, setShowNewType] = useState(false);
  const [newType, setNewType] = useState("");
  const [showNewSubType, setShowNewSubType] = useState(false);
  const [newSubType, setNewSubType] = useState("");
  const [savingType, setSavingType] = useState(false);

  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");

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
        const [employeeRes, taskTypeRes] = await Promise.all([
          fetch("/api/employee/search?limit=200", { cache: "no-store" }),
          fetch("/api/task-types", { cache: "no-store" }),
        ]);
        if (employeeRes.ok) setEmployees((await employeeRes.json()).employees || []);
        if (taskTypeRes.ok) setTaskTypes((await taskTypeRes.json()).taskTypes || []);
      } catch {
        // Non-fatal — dropdowns will just be empty/short.
      }
    })();
  }, [canManage]);

  const subTypeOptions = useMemo(
    () => taskTypes.find((entry) => entry.name === taskType)?.subTypes || [],
    [taskTypes, taskType],
  );

  const addTaskType = async () => {
    const name = newType.trim();
    if (!name) return;
    setSavingType(true);
    try {
      const response = await fetch("/api/task-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Unable to add task type.");
      setTaskTypes((prev) => (prev.some((t) => t.name === name) ? prev : [...prev, { name, subTypes: [] }]));
      setTaskType(name);
      setSubTaskType("");
      setNewType("");
      setShowNewType(false);
      toast.success("Task type added.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add task type.");
    } finally {
      setSavingType(false);
    }
  };

  const addSubTaskType = async () => {
    const name = newSubType.trim();
    if (!name || !taskType) return;
    setSavingType(true);
    try {
      const response = await fetch("/api/task-types/sub-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskType, name }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Unable to add sub-task type.");
      setTaskTypes((prev) =>
        prev.map((entry) =>
          entry.name === taskType && !entry.subTypes.includes(name)
            ? { ...entry, subTypes: [...entry.subTypes, name] }
            : entry,
        ),
      );
      setSubTaskType(name);
      setNewSubType("");
      setShowNewSubType(false);
      toast.success("Sub-task type added.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add sub-task type.");
    } finally {
      setSavingType(false);
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
    <div className="space-y-4 px-0 md:px-4 lg:px-8">
      <PageHeader title={canManage ? "Edit Task" : "View Task"} />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Task Information</CardTitle>
          {canManage && (
            <p className="text-sm text-muted-foreground">
              Project No, Work-Order No, Tender No, Task Type, Sub-Task Type, Assigned To and Task Status can be edited here.
            </p>
          )}
        </CardHeader>

        <CardContent className="space-y-8">
          {loadingTask ? (
            <p className="text-sm text-muted-foreground">Loading task...</p>
          ) : loadError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
          ) : task ? (
            <>
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
                      <select
                        className="h-10 w-full rounded-md border bg-transparent px-3 text-sm"
                        value={taskType}
                        onChange={(e) => { setTaskType(e.target.value); setSubTaskType(""); }}
                      >
                        <option value="">Select task type...</option>
                        {taskTypes.map((entry) => (
                          <option key={entry.name} value={entry.name}>{entry.name}</option>
                        ))}
                      </select>
                      {showNewType ? (
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="New task type name"
                            value={newType}
                            onChange={(e) => setNewType(e.target.value)}
                          />
                          <Button type="button" size="sm" disabled={savingType || !newType.trim()} onClick={addTaskType}>Add</Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => { setShowNewType(false); setNewType(""); }}>Cancel</Button>
                        </div>
                      ) : (
                        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowNewType(true)}>
                          <Plus className="size-3.5" /> Add Task Type
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Sub-Task Type</Label>
                      <select
                        className="h-10 w-full rounded-md border bg-transparent px-3 text-sm disabled:opacity-50"
                        value={subTaskType}
                        disabled={!taskType}
                        onChange={(e) => setSubTaskType(e.target.value)}
                      >
                        <option value="">{taskType ? "Select sub-task type..." : "Select a task type first"}</option>
                        {subTypeOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                      {showNewSubType ? (
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="New sub-task type name"
                            value={newSubType}
                            onChange={(e) => setNewSubType(e.target.value)}
                          />
                          <Button type="button" size="sm" disabled={savingType || !newSubType.trim()} onClick={addSubTaskType}>Add</Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => { setShowNewSubType(false); setNewSubType(""); }}>Cancel</Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          disabled={!taskType}
                          onClick={() => setShowNewSubType(true)}
                        >
                          <Plus className="size-3.5" /> Add Sub-Task Type
                        </Button>
                      )}
                      {!taskType && <p className="text-xs text-muted-foreground">Select a task type above before adding a sub-task type.</p>}
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
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}