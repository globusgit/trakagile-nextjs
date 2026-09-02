"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

// Roles allowed to assign a task to someone else — everyone else's tasks are
// always self-assigned. Keep in sync with TASK_MANAGE_ROLES in
// app/api/tasks/_lib/tasks.js
const TASK_MANAGE_ROLES = ["ADMIN", "DIRECTOR", "MANAGER", "HR"];

type Employee = { _id: string; empId: string; name: string };
type TaskTypeEntry = { name: string; subTypes: string[] };

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

export default function CreateTaskPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const canManage = TASK_MANAGE_ROLES.includes(session?.user?.role ?? "");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [taskVerticalOptions, setTaskVerticalOptions] = useState<string[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskTypeEntry[]>([]);

  const [description, setDescription] = useState("");
  const [taskSource, setTaskSource] = useState("");
  const [taskVertical, setTaskVertical] = useState("");
  const [taskType, setTaskType] = useState("");
  const [subTaskType, setSubTaskType] = useState("");
  const [assignedToEmpIds, setAssignedToEmpIds] = useState<string[]>([]);
  const [projectNo, setProjectNo] = useState<ReferenceValue>(EMPTY_REFERENCE);
  const [workOrderNo, setWorkOrderNo] = useState<ReferenceValue>(EMPTY_REFERENCE);
  const [tenderNo, setTenderNo] = useState<ReferenceValue>(EMPTY_REFERENCE);
  const [descriptionError, setDescriptionError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  // Everyone can reach the Create Task page now - only management roles get
  // to pick an assignee; everyone else's task is always self-assigned.
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
    (async () => {
      try {
        const response = await fetch("/api/task-verticals", { cache: "no-store" });
        if (response.ok) setTaskVerticalOptions((await response.json()).taskVerticals || []);
      } catch {
        // Non-fatal.
      }
    })();
  }, []);

  // Task Type options depend on Task Source (+ Task Vertical for "Project").
  // Reset downstream selections whenever the scope they depend on changes.
  const scopeReady = taskSource && (taskSource !== "Project" || taskVertical);

  useEffect(() => {
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
  }, [scopeReady, taskSource, taskVertical]);

  const subTypeOptions = useMemo(
    () => taskTypes.find((entry) => entry.name === taskType)?.subTypes || [],
    [taskTypes, taskType],
  );

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

  const handleTaskTypeChange = (nextValue: string) => {
    setTaskType(nextValue);
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
          taskSource: taskSource || undefined,
          taskVertical: taskSource === "Project" ? taskVertical : undefined,
          taskType,
          subTaskType,
          assignedToEmpIds: canManage ? assignedToEmpIds : [],
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

  if (status === "loading") {
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
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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

          <div className="space-y-2">
            <Label>Assign To</Label>
            {canManage ? (
              <>
                <EmployeeMultiSelect
                  employees={employees}
                  selectedEmpIds={assignedToEmpIds}
                  onChange={setAssignedToEmpIds}
                  placeholder="Leave unassigned (status: New)"
                />
                <p className="text-xs text-muted-foreground">Select one employee, or several to assign the task to a team. Leave blank to assign later from the Tasks list.</p>
              </>
            ) : (
              <>
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  {session?.user?.name || "You"} <span className="text-xs text-muted-foreground">(self-assigned)</span>
                </div>
                <p className="text-xs text-muted-foreground">Tasks you create are always assigned to yourself.</p>
              </>
            )}
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