"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import PageHeader from "@/app/_components/PageHeader";
import EmployeeMultiSelect from "@/app/_components/EmployeeMultiSelect";
import ReferenceFieldGroup, { EMPTY_REFERENCE, ReferenceValue } from "@/app/_components/ReferenceFieldGroup";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";

// Roles allowed to create tasks — keep in sync with TASK_MANAGE_ROLES
// in app/api/tasks/_lib/tasks.js
const TASK_MANAGE_ROLES = ["ADMIN", "DIRECTOR", "MANAGER", "HR"];

type Employee = { _id: string; empId: string; name: string };
type TaskTypeEntry = { name: string; subTypes: string[] };

function cleanReference(value: ReferenceValue) {
  return value.number.trim() ? value : undefined;
}

export default function CreateTaskPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const canManage = TASK_MANAGE_ROLES.includes(session?.user?.role ?? "");

  useEffect(() => {
    if (status === "authenticated" && !canManage) {
      router.replace("/tasks");
    }
  }, [status, canManage, router]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskTypeEntry[]>([]);
  const [description, setDescription] = useState("");
  const [taskType, setTaskType] = useState("");
  const [subTaskType, setSubTaskType] = useState("");
  const [assignedToEmpIds, setAssignedToEmpIds] = useState<string[]>([]);
  const [projectNo, setProjectNo] = useState<ReferenceValue>(EMPTY_REFERENCE);
  const [workOrderNo, setWorkOrderNo] = useState<ReferenceValue>(EMPTY_REFERENCE);
  const [tenderNo, setTenderNo] = useState<ReferenceValue>(EMPTY_REFERENCE);
  const [descriptionError, setDescriptionError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const [showNewType, setShowNewType] = useState(false);
  const [newType, setNewType] = useState("");
  const [showNewSubType, setShowNewSubType] = useState(false);
  const [newSubType, setNewSubType] = useState("");
  const [savingType, setSavingType] = useState(false);

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
        // Non-fatal — dropdowns will just be empty/short; task can still be created.
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
    if (!description.trim()) {
      setDescriptionError(true);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          taskType,
          subTaskType,
          assignedToEmpIds,
          projectNo: cleanReference(projectNo),
          workOrderNo: cleanReference(workOrderNo),
          tenderNo: cleanReference(tenderNo),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setServerError(result.message || "Failed to create task.");
        return;
      }
      router.push("/tasks");
      router.refresh();
    } catch (err) {
      console.error(err);
      setServerError("Something went wrong while creating the task.");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || (status === "authenticated" && !canManage)) {
    return (
      <div className="space-y-4 px-0 md:px-4 lg:px-8">
        <PageHeader title="Create Task" />
      </div>
    );
  }

  return (
    <div className="space-y-4 px-0 md:px-4 lg:px-8">
      <PageHeader title="Create Task" />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Task Information</CardTitle>
        </CardHeader>

        <CardContent className="space-y-8">
          {serverError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <div className="space-y-2">
            <Label>Description <span className="text-red-500">*</span></Label>
            <Textarea
              placeholder="Describe what needs to be done..."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (descriptionError) setDescriptionError(false);
              }}
              rows={4}
              className={descriptionError ? "border-red-500" : ""}
            />
            {descriptionError && <p className="text-xs text-red-500">* This is Mandatory</p>}
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
            <Label>Assign To</Label>
            <EmployeeMultiSelect
              employees={employees}
              selectedEmpIds={assignedToEmpIds}
              onChange={setAssignedToEmpIds}
              placeholder="Leave unassigned (status: New)"
            />
            <p className="text-xs text-muted-foreground">Select one employee, or several to assign the task to a team. Leave blank to assign later from the Tasks list.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
            <Button onClick={handleSubmit} disabled={loading} className="bg-cyan-900 hover:bg-cyan-700">
              {loading ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}