"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import PageHeader from "@/app/_components/PageHeader";
import EmployeeMultiSelect from "@/app/_components/EmployeeMultiSelect";
import SearchableSelect from "@/app/_components/SearchableSelect";
import { EMPTY_REFERENCE, ReferenceValue } from "@/app/_components/ReferenceFieldGroup";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

// Roles allowed to assign a task to someone else — everyone else's tasks are
// always self-assigned. Keep in sync with TASK_MANAGE_ROLES in
// app/api/tasks/_lib/tasks.js
const TASK_MANAGE_ROLES = ["ADMIN", "DIRECTOR", "MANAGER", "HR"];

type Employee = { _id: string; empId: string; name: string };

// Task Type choices - same values and same saved field (taskType) as the Edit Task
// page. "Project" tasks also capture Work-Order and Tender details.
const TASK_TYPE_OPTIONS = ["Internal", "Project"];

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

// Work-Order / Tender detail card - same look as the Edit Task page: Number and
// Status on the top row, a large Description box underneath.
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
}: {
  title: string;
  numberLabel: string;
  tone: keyof typeof REFERENCE_CARD_TONES;
  value: ReferenceValue;
  onChange: (value: ReferenceValue) => void;
}) {
  const styles = REFERENCE_CARD_TONES[tone];
  const set = (field: "number" | "description" | "status") =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({ ...value, [field]: e.target.value });

  return (
    <div className={`min-w-0 overflow-hidden rounded-lg border ${styles.card}`}>
      <div className={`px-4 py-2 text-sm font-semibold ${styles.header}`}>{title}</div>
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{numberLabel}</Label>
            <Input placeholder={numberLabel} value={value.number} onChange={set("number")} className="bg-white" />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Input placeholder="Status" value={value.status} onChange={set("status")} className="bg-white" />
          </div>
        </div>
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
      </div>
    </div>
  );
}

export default function CreateTaskPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const canManage = TASK_MANAGE_ROLES.includes(session?.user?.role ?? "");
  const selfEmpId = session?.user?.empId ?? "";

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [taskVerticalOptions, setTaskVerticalOptions] = useState<string[]>([]);
  const [subVerticalOptions, setSubVerticalOptions] = useState<string[]>([]);

  const [description, setDescription] = useState("");
  const [endDateTime, setEndDateTime] = useState("");
  const [taskType, setTaskType] = useState(""); // Internal | Project
  const [taskVertical, setTaskVertical] = useState("");
  const [subTaskType, setSubTaskType] = useState(""); // saved as the task's Sub-vertical
  const [assignedToEmpIds, setAssignedToEmpIds] = useState<string[]>([]);
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
        const response = await fetch("/api/verticals", { cache: "no-store" });
        if (response.ok) setTaskVerticalOptions((await response.json()).verticals || []);
      } catch {
        // Non-fatal.
      }
    })();
  }, []);

  // Sub-vertical options depend on the selected Vertical.
  useEffect(() => {
    (async () => {
      if (!taskVertical) {
        setSubVerticalOptions([]);
        return;
      }
      try {
        const params = new URLSearchParams({ vertical: taskVertical });
        const response = await fetch(`/api/sub-verticals?${params}`, { cache: "no-store" });
        if (response.ok) setSubVerticalOptions((await response.json()).subVerticals || []);
      } catch {
        // Non-fatal.
      }
    })();
  }, [taskVertical]);

  // The logged-in user's own entry. The employee search is scoped/limited, so
  // the user may not appear in it - always include them so their name shows
  // in the Assign To field after clicking "Self Task".
  const assigneeOptions = useMemo(() => {
    if (!selfEmpId || employees.some((employee) => employee.empId === selfEmpId)) return employees;
    return [
      { _id: session?.user?.id ?? selfEmpId, empId: selfEmpId, name: session?.user?.name || selfEmpId },
      ...employees,
    ];
  }, [employees, selfEmpId, session?.user?.id, session?.user?.name]);

  const isProject = taskType === "Project";
  const isSelfTask = assignedToEmpIds.length === 1 && assignedToEmpIds[0] === selfEmpId;

  // "Self Task": assign the task to the logged-in user (replaces any other
  // selection). Clicking again clears it.
  const handleSelfTask = () => {
    if (!selfEmpId) return;
    setAssignedToEmpIds(isSelfTask ? [] : [selfEmpId]);
  };

  // Switching away from "Project" clears the Tender / Work-Order cards (they only
  // apply to projects). Vertical and Sub-Vertical are kept for every task type.
  const handleTaskTypeChange = (nextValue: string) => {
    setTaskType(nextValue);
    if (nextValue !== "Project") {
      setWorkOrderNo(EMPTY_REFERENCE);
      setTenderNo(EMPTY_REFERENCE);
    }
  };

  // Sub-verticals belong to a vertical, so changing it clears the sub-vertical.
  const handleTaskVerticalChange = (nextValue: string) => {
    setTaskVertical(nextValue);
    setSubTaskType("");
  };

  const handleAddTaskVertical = async (name: string) => {
    try {
      await postJson("/api/verticals", { name });
      setTaskVerticalOptions((prev) => (prev.includes(name) ? prev : [...prev, name].sort()));
      handleTaskVerticalChange(name);
      toast.success("Vertical added.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add vertical.");
    }
  };

  const handleAddSubVertical = async (name: string) => {
    try {
      await postJson("/api/sub-verticals", { vertical: taskVertical, name });
      setSubVerticalOptions((prev) => (prev.includes(name) ? prev : [...prev, name].sort()));
      setSubTaskType(name);
      toast.success("Sub-vertical added.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add sub-vertical.");
    }
  };

  const handleSubmit = async () => {
    setServerError("");
    if (!description.trim()) {
      setDescriptionError(true);
      return;
    }
    if (isProject) {
      const incomplete = [
        { label: "Work-Order No", value: workOrderNo },
        { label: "Tender No", value: tenderNo },
      ].find(({ value }) => !value.number.trim() && (value.description.trim() || value.status.trim()));
      if (incomplete) {
        setServerError(`Enter the ${incomplete.label}, or clear its description and status.`);
        return;
      }
    }
    setLoading(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          endDateTime: endDateTime || undefined,
          taskType,
          taskVertical: taskVertical.trim() || undefined,
          subTaskType: subTaskType.trim() || undefined,
          assignedToEmpIds: canManage ? assignedToEmpIds : [],
          workOrderNo: isProject ? cleanReference(workOrderNo) : undefined,
          tenderNo: isProject ? cleanReference(tenderNo) : undefined,
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
              <Label>End Date &amp; Time</Label>
              <input
                type="datetime-local"
                value={endDateTime}
                onChange={(e) => setEndDateTime(e.target.value)}
                className="h-10 w-full rounded-md border bg-transparent px-3 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label>Task Type</Label>
              <select
                className="h-10 w-full rounded-md border bg-transparent px-3 text-sm"
                value={taskType}
                onChange={(e) => handleTaskTypeChange(e.target.value)}
              >
                <option value="">Select task type</option>
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
              <SearchableSelect
                options={subVerticalOptions}
                value={subTaskType}
                onChange={setSubTaskType}
                onAddNew={handleAddSubVertical}
                placeholder="Search or add a sub-vertical..."
                disabled={!taskVertical}
                disabledMessage={!taskVertical ? "Select a vertical first." : undefined}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Label>Assign To</Label>
              {canManage && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSelfTask}
                  disabled={!selfEmpId}
                  aria-pressed={isSelfTask}
                  className={`h-7 bg-blue-600 px-3 text-xs text-white hover:bg-blue-700 ${isSelfTask ? "ring-2 ring-blue-300 ring-offset-1" : ""}`}
                >
                  Self Task
                </Button>
              )}
            </div>
            {canManage ? (
              <>
                <EmployeeMultiSelect
                  employees={assigneeOptions}
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

          {isProject && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
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