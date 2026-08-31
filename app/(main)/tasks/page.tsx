"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import PageHeader from "@/app/_components/PageHeader";
import ListingToolbar from "@/app/_components/ListingToolbar";
import HoverPanel from "@/app/_components/HoverPanel";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, UserPlus } from "lucide-react";

// Roles allowed to create tasks, assign tasks and edit tasks via the edit page.
// Keep in sync with TASK_MANAGE_ROLES in app/api/tasks/_lib/tasks.js
const TASK_MANAGE_ROLES = ["ADMIN", "DIRECTOR", "MANAGER", "HR"];

const STATUS_BADGE: Record<string, string> = {
  New: "bg-slate-100 text-slate-700",
  Assigned: "bg-amber-100 text-amber-800",
  "In Progress": "bg-sky-100 text-sky-800",
  Suspended: "bg-orange-100 text-orange-800",
  Done: "bg-emerald-100 text-emerald-800",
  Rejected: "bg-red-100 text-red-800",
};

const WORK_STATUS_OPTIONS = ["In Progress", "Done", "Suspended", "Rejected"];

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
  createdByEmpId: string;
  createdByName?: string;
  createdAt: string;
  assignedToEmpIds?: string[];
  assignedToNames?: AssignedEmployee[];
  assignedByEmpId?: string;
  assignedByName?: string;
  assignedAt?: string;
  projectNo?: Reference;
  workOrderNo?: Reference;
  tenderNo?: Reference;
  completedDate?: string;
  closedAt?: string;
};

type Employee = { _id: string; empId: string; name: string };

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// Days + hours since createdAt, frozen at closedAt once the task is Done/Rejected.
function ageLabel(createdAt: string, closedAt: string | undefined, now: number) {
  const start = new Date(createdAt).getTime();
  const end = closedAt ? new Date(closedAt).getTime() : now;
  const diffMs = Math.max(0, end - start);
  const days = Math.floor(diffMs / 86400000);
  const hours = Math.floor((diffMs % 86400000) / 3600000);
  return `${days}d ${hours}h`;
}

function isInternal(task: Task) {
  return !task.projectNo?.number && !task.workOrderNo?.number && !task.tenderNo?.number;
}

// Small hover-triggered card showing the full task description.
function DescriptionCell({ text }: { text: string }) {
  return (
    <HoverPanel
      trigger={<p className="max-w-[220px] cursor-default truncate">{text}</p>}
      panel={text}
    />
  );
}

// Cell for Project No / Work-Order No / Tender No: shows the number (or blank),
// hover reveals Number / Description / Vertical / Sub-Vertical(s) / Status / State.
function ReferenceCell({ reference }: { reference?: Reference }) {
  if (!reference?.number) return <span className="whitespace-nowrap"></span>;
  const subVerticals = (reference.subVertical || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return (
    <HoverPanel
      trigger={<span className="whitespace-nowrap cursor-default underline decoration-dotted underline-offset-4">{reference.number}</span>}
      panel={
        <div className="space-y-1.5">
          <p><span className="font-semibold">Number:</span> {reference.number}</p>
          {reference.description && <p><span className="font-semibold">Description:</span> {reference.description}</p>}
          {reference.vertical && <p><span className="font-semibold">Vertical:</span> {reference.vertical}</p>}
          {subVerticals.length > 0 && (
            <p><span className="font-semibold">Sub-Vertical{subVerticals.length > 1 ? "s" : ""}:</span> {subVerticals.join(", ")}</p>
          )}
          {reference.status && <p><span className="font-semibold">Status:</span> {reference.status}</p>}
          {reference.state && <p><span className="font-semibold">State:</span> {reference.state}</p>}
        </div>
      }
    />
  );
}

// Assigned To cell: shows the single employee's name, "Team" when more than
// one is assigned, or "-" when unassigned. Hover always lists everyone assigned.
function AssignedToCell({ assignedToNames }: { assignedToNames?: AssignedEmployee[] }) {
  const names = assignedToNames || [];
  if (names.length === 0) return <span className="whitespace-nowrap">-</span>;

  const label = names.length > 1 ? "Team" : names[0].name;
  return (
    <HoverPanel
      trigger={<span className="whitespace-nowrap cursor-default underline decoration-dotted underline-offset-4">{label}</span>}
      panel={
        <div className="space-y-1">
          <p className="font-semibold">Assigned Employees</p>
          <ul className="list-disc space-y-0.5 pl-4">
            {names.map((employee) => (
              <li key={employee.empId}>{employee.name} <span className="text-muted-foreground">({employee.empId})</span></li>
            ))}
          </ul>
        </div>
      }
    />
  );
}

function StatusCell({
  task,
  currentEmpId,
  canManage,
  employees,
  onAssign,
  onStartWorking,
  onUpdateStatus,
  busyId,
}: {
  task: Task;
  currentEmpId?: string;
  canManage: boolean;
  employees: Employee[];
  onAssign: (taskId: string, empId: string) => void;
  onStartWorking: (taskId: string) => void;
  onUpdateStatus: (taskId: string, status: string) => void;
  busyId: string | null;
}) {
  const [assigning, setAssigning] = useState(false);
  const [pickedEmpId, setPickedEmpId] = useState("");
  const isBusy = busyId === task._id;
  const isAssignee = currentEmpId && (task.assignedToEmpIds || []).includes(currentEmpId);

  const badge = <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[task.status] || "bg-slate-100 text-slate-700"}`}>{task.status}</span>;

  if (task.status === "New") {
    if (!canManage) return badge;
    return (
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-1.5">
          {badge}
          <HoverPanel
            panelClassName="w-max whitespace-nowrap"
            trigger={
              <button
                type="button"
                onClick={() => setAssigning((v) => !v)}
                className="flex size-6 items-center justify-center rounded-full border border-cyan-700 text-cyan-800 hover:bg-cyan-50"
                aria-label="Assign Task"
              >
                <UserPlus className="size-3.5" />
              </button>
            }
            panel="Assign Task"
          />
        </div>
        {assigning && (
          <div className="flex items-center gap-1">
            <select
              className="h-8 rounded-md border bg-background px-2 text-xs"
              value={pickedEmpId}
              onChange={(event) => setPickedEmpId(event.target.value)}
            >
              <option value="">Select employee...</option>
              {employees.map((employee) => (
                <option key={employee._id} value={employee.empId}>{employee.name} ({employee.empId})</option>
              ))}
            </select>
            <Button size="sm" className="h-8" disabled={!pickedEmpId || isBusy} onClick={() => { onAssign(task._id, pickedEmpId); setAssigning(false); }}>
              {isBusy ? "..." : "Assign"}
            </Button>
            <Button size="sm" variant="outline" className="h-8" onClick={() => setAssigning(false)}>Cancel</Button>
          </div>
        )}
      </div>
    );
  }

  if (task.status === "Assigned") {
    if (!isAssignee) return badge;
    return (
      <div className="flex items-center gap-2">
        {badge}
        <Button size="sm" className="h-7 text-xs" disabled={isBusy} onClick={() => onStartWorking(task._id)}>
          {isBusy ? "Starting..." : "Start Working"}
        </Button>
      </div>
    );
  }

  if (task.status === "In Progress" || task.status === "Suspended") {
    if (!isAssignee) return badge;
    return (
      <select
        className="h-8 rounded-md border bg-background px-2 text-xs font-medium"
        value={task.status}
        disabled={isBusy}
        onChange={(event) => onUpdateStatus(task._id, event.target.value)}
      >
        {WORK_STATUS_OPTIONS.map((option) => (
          <option key={option} value={option}>{option === "Rejected" ? "Reject" : option}</option>
        ))}
      </select>
    );
  }

  return badge;
}

export default function TasksPage() {
  const { data: session } = useSession();
  const role = session?.user?.role ?? "";
  const currentEmpId = session?.user?.empId;
  const canManage = TASK_MANAGE_ROLES.includes(role);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Tick the "now" reference every minute so open tasks' Age keeps incrementing live.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), limit: String(size) });
    if (query) params.set("search", query);
    try {
      const response = await fetch(`/api/tasks?${params}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to load tasks.");
      setTasks(result.tasks || []);
      setTotal(result.total || 0);
    } catch (requestError) {
      setTasks([]);
      setError(requestError instanceof Error ? requestError.message : "Unable to load tasks.");
    } finally {
      setLoading(false);
    }
  }, [page, size, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadTasks(), 0);
    return () => window.clearTimeout(timer);
  }, [loadTasks]);

  useEffect(() => {
    if (!canManage) return;
    (async () => {
      try {
        const response = await fetch("/api/employee/search?limit=200", { cache: "no-store" });
        if (response.ok) {
          const result = await response.json();
          setEmployees(result.employees || []);
        }
      } catch {
        // Assign dialog will just show an empty list; not fatal.
      }
    })();
  }, [canManage]);

  const runAction = useCallback(async (taskId: string, action: string, extra: Record<string, unknown> = {}) => {
    setBusyId(taskId);
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to update task.");
      toast.success(result.message || "Task updated.");
      await loadTasks();
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : "Unable to update task.");
    } finally {
      setBusyId(null);
    }
  }, [loadTasks]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / size)), [total, size]);

  return (
    <div className="space-y-4">
      <PageHeader title="Tasks" />

      <ListingToolbar
        searchValue={search}
        onSearchChange={(value) => { setSearch(value); setQuery(value); setPage(1); }}
        pageSize={size}
        onPageSizeChange={(value) => { setSize(value); setPage(1); }}
        searchPlaceholder="Search by Task ID, description, project/WO/tender no..."
        showAddButton={canManage}
        addHref="/tasks/create"
        addLabel="Create Task"
      />

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      <div className="overflow-x-auto rounded-xl border bg-white shadow">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-cyan-200 shadow-sm">
            <TableRow>
              <TableHead className="font-bold whitespace-nowrap">Edit</TableHead>
              <TableHead className="font-bold whitespace-nowrap">Task ID</TableHead>
              <TableHead className="font-bold">Description</TableHead>
              <TableHead className="font-bold whitespace-nowrap">Task Status</TableHead>
              <TableHead className="font-bold whitespace-nowrap">Task Type</TableHead>
              <TableHead className="font-bold whitespace-nowrap">Created By</TableHead>
              <TableHead className="font-bold whitespace-nowrap">Created Date</TableHead>
              <TableHead className="font-bold whitespace-nowrap">Age</TableHead>
              <TableHead className="font-bold whitespace-nowrap">Assigned To</TableHead>
              <TableHead className="font-bold whitespace-nowrap">Assigned By</TableHead>
              <TableHead className="font-bold whitespace-nowrap">Assigned Date</TableHead>
              <TableHead className="font-bold whitespace-nowrap">Project No</TableHead>
              <TableHead className="font-bold whitespace-nowrap">Work-Order No</TableHead>
              <TableHead className="font-bold whitespace-nowrap">Tender No</TableHead>
              <TableHead className="font-bold whitespace-nowrap">Internal</TableHead>
              <TableHead className="font-bold whitespace-nowrap">Completed Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={16} className="py-8 text-center text-muted-foreground">Loading tasks...</TableCell></TableRow>
            ) : tasks.length === 0 ? (
              <TableRow><TableCell colSpan={16} className="py-10 text-center text-muted-foreground">No tasks found.</TableCell></TableRow>
            ) : (
              tasks.map((task) => (
                <TableRow key={task._id} className="hover:bg-gray-50">
                  <TableCell>
                    <Link href={`/tasks/${task._id}/edit`}>
                      <Button size="icon" variant="ghost" className="size-8"><Pencil className="size-4" /></Button>
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-medium">{task.taskId}</TableCell>
                  <TableCell><DescriptionCell text={task.description} /></TableCell>
                  <TableCell>
                    <StatusCell
                      task={task}
                      currentEmpId={currentEmpId}
                      canManage={canManage}
                      employees={employees}
                      busyId={busyId}
                      onAssign={(taskId, empId) => void runAction(taskId, "assign", { assignedToEmpId: empId })}
                      onStartWorking={(taskId) => void runAction(taskId, "start_working")}
                      onUpdateStatus={(taskId, status) => void runAction(taskId, "update_status", { status })}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{task.taskType || "-"}</TableCell>
                  <TableCell className="whitespace-nowrap">{task.createdByName || task.createdByEmpId}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(task.createdAt)}</TableCell>
                  <TableCell className="whitespace-nowrap">{ageLabel(task.createdAt, task.closedAt, now)}</TableCell>
                  <TableCell><AssignedToCell assignedToNames={task.assignedToNames} /></TableCell>
                  <TableCell className="whitespace-nowrap">{task.assignedByName || "-"}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(task.assignedAt)}</TableCell>
                  <TableCell><ReferenceCell reference={task.projectNo} /></TableCell>
                  <TableCell><ReferenceCell reference={task.workOrderNo} /></TableCell>
                  <TableCell><ReferenceCell reference={task.tenderNo} /></TableCell>
                  <TableCell className="whitespace-nowrap">{isInternal(task) ? "Internal" : ""}</TableCell>
                  <TableCell className="whitespace-nowrap">{task.status === "Done" ? formatDate(task.completedDate) : ""}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
        <div className="text-sm text-muted-foreground">Total Records: {total}</div>
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Prev</Button>
          <span className="text-sm font-medium">Page {page} of {totalPages}</span>
          <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}