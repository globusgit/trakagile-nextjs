"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import PageHeader from "@/app/_components/PageHeader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import EmployeeAvatar from "@/app/_components/EmployeeAvatar";

type TaskSummary = {
  taskId: string;
  description: string;
  status: string;
  assignedAt: string | null;
  endDate: string | null;
};

type DashboardRow = {
  empId: string;
  name: string;
  photo: string | null;
  assignedCount: number;
  completedCount: number;
  pendingCount: number;
  assignedTasks: TaskSummary[];
  completedTasks: TaskSummary[];
  pendingTasks: TaskSummary[];
};

async function fetchTaskDashboard(search: string) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  const res = await fetch(`/api/tasks/dashboard?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch the task dashboard");
  return res.json();
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// Pending count decides the row's colour:
//   0 pending  -> green   (all caught up)
//   1 pending  -> yellow  (watch)
//   2+ pending -> red     (falling behind)
function rowClassForPending(pendingCount: number) {
  if (pendingCount >= 2) return "bg-red-500 hover:bg-red-400 border-l-4 border-l-red-500";
  if (pendingCount === 1) return "bg-amber-500 hover:bg-amber-400 border-l-4 border-l-amber-400";
  return "bg-emerald-500 hover:bg-emerald-400 border-l-4 border-l-emerald-500";
}

function countBadgeClass(kind: "assigned" | "completed" | "pending") {
  if (kind === "completed") return "text-black";
  if (kind === "pending") return "text-black";
  return "text-black";
}

// Clickable count badge. Clicking opens a large, scrollable dialog listing
// every task in the bucket (Assigned / Completed / Pending) as a table.
function TaskCountCell({
  count,
  tasks,
  kind,
  emptyLabel,
  title,
  employeeName,
}: {
  count: number;
  tasks: TaskSummary[];
  kind: "assigned" | "completed" | "pending";
  emptyLabel: string;
  title: string;
  employeeName: string;
}) {
  const [open, setOpen] = useState(false);

  if (count === 0) {
    return (
      <span className={`inline-flex min-w-[2rem] justify-center rounded-full px-2.5 py-1 text-sm font-semibold ${countBadgeClass(kind)}`}>
        0
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`View ${title.toLowerCase()}`}
        className={`inline-flex min-w-[2rem] cursor-pointer justify-center rounded-full px-2.5 py-1 text-sm font-semibold transition hover:ring-2 hover:ring-cyan-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${countBadgeClass(kind)}`}
      >
        {count}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] w-full flex-col gap-3 sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {title} — {employeeName}
            </DialogTitle>
            <DialogDescription>
              {count} {count === 1 ? "task" : "tasks"}
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable table area */}
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
            {tasks.length === 0 ? (
              <p className="p-6 text-center text-muted-foreground">{emptyLabel}</p>
            ) : (
              <table className="w-full caption-bottom text-sm">
                <thead className="sticky top-0 z-10 bg-cyan-200 shadow-sm">
                  <tr className="border-b">
                    <th className="w-12 px-3 py-2 text-left font-bold">#</th>
                    <th className="whitespace-nowrap px-3 py-2 text-left font-bold">Task ID</th>
                    <th className="px-3 py-2 text-left font-bold">Description</th>
                    <th className="whitespace-nowrap px-3 py-2 text-left font-bold">Status</th>
                    <th className="whitespace-nowrap px-3 py-2 text-left font-bold">Assigned Date</th>
                    <th className="whitespace-nowrap px-3 py-2 text-left font-bold">End Date</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task, index) => (
                    <tr key={`${task.taskId}-${index}`} className="border-b last:border-b-0 hover:bg-slate-50">
                      <td className="px-3 py-2 text-muted-foreground">{index + 1}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-semibold">{task.taskId}</td>
                      <td className="min-w-[16rem] px-3 py-2 text-muted-foreground">{task.description}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {task.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">{formatDate(task.assignedAt)}</td>
                      <td className="whitespace-nowrap px-3 py-2">{formatDate(task.endDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function TaskDashboardPage() {
  const { data: session, status } = useSession();
  const orgId = session?.user?.orgId ?? "";
  const [search, setSearch] = useState("");

  const { data, error, isLoading } = useQuery({
    queryKey: ["task-dashboard", orgId, search],
    queryFn: () => fetchTaskDashboard(search),
    placeholderData: keepPreviousData,
    enabled: !!orgId,
  });

  const rows: DashboardRow[] = data?.rows ?? [];

  if (status === "loading") {
    return <div className="p-8 text-center text-gray-500">Loading session...</div>;
  }

  return (
    <div>
      <PageHeader title="Task Dashboard" />

      <div className="mt-4 mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee name or ID..."
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-emerald-700" /> 0 pending</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-amber-700" /> 1 pending</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-red-700" /> 2+ pending</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-cyan-200 shadow-sm">
            <TableRow>
              <TableHead className="font-bold">Emp ID</TableHead>
              <TableHead className="font-bold">Name</TableHead>
              <TableHead className="font-bold text-center">Assigned Tasks</TableHead>
              <TableHead className="font-bold text-center">Completed Tasks</TableHead>
              <TableHead className="font-bold text-center">Pending Tasks</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-gray-500">
                  Loading...
                </TableCell>
              </TableRow>
            )}

            {!!error && (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-red-500">
                  Failed to load the task dashboard.
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !error && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-gray-500">
                  You haven&apos;t assigned any tasks yet.
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              !error &&
              rows.map((row) => (
                <TableRow key={row.empId} className={rowClassForPending(row.pendingCount)}>
                  <TableCell>{row.empId}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <EmployeeAvatar name={row.name} photo={row.photo} size={28} />
                      <span>{row.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <TaskCountCell
                      count={row.assignedCount}
                      tasks={row.assignedTasks}
                      kind="assigned"
                      emptyLabel="No tasks assigned."
                      title="Assigned Tasks"
                      employeeName={row.name}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <TaskCountCell
                      count={row.completedCount}
                      tasks={row.completedTasks}
                      kind="completed"
                      emptyLabel="Nothing completed yet."
                      title="Completed Tasks"
                      employeeName={row.name}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <TaskCountCell
                      count={row.pendingCount}
                      tasks={row.pendingTasks}
                      kind="pending"
                      emptyLabel="Nothing pending."
                      title="Pending Tasks"
                      employeeName={row.name}
                    />
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 text-sm text-muted-foreground">
        Total Employees: {rows.length}
      </div>
    </div>
  );
}