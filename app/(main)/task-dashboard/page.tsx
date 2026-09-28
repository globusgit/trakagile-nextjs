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
import HoverPanel from "@/app/_components/HoverPanel";
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
  if (pendingCount >= 2) return "bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500";
  if (pendingCount === 1) return "bg-amber-50 hover:bg-amber-100 border-l-4 border-l-amber-400";
  return "bg-emerald-50 hover:bg-emerald-100 border-l-4 border-l-emerald-500";
}

function countBadgeClass(kind: "assigned" | "completed" | "pending") {
  if (kind === "completed") return "bg-emerald-100 text-emerald-800";
  if (kind === "pending") return "bg-red-100 text-red-800";
  return "bg-sky-100 text-sky-800";
}

// Hover card listing every task in a bucket (Assigned / Completed /
// Pending) with its Assigned Date and End Date.
function TaskCountCell({
  count,
  tasks,
  kind,
  emptyLabel,
}: {
  count: number;
  tasks: TaskSummary[];
  kind: "assigned" | "completed" | "pending";
  emptyLabel: string;
}) {
  if (count === 0) {
    return <span className={`inline-flex min-w-[2rem] justify-center rounded-full px-2.5 py-1 text-sm font-semibold ${countBadgeClass(kind)}`}>0</span>;
  }

  return (
    <HoverPanel
      trigger={
        <span className={`inline-flex min-w-[2rem] cursor-default justify-center rounded-full px-2.5 py-1 text-sm font-semibold ${countBadgeClass(kind)}`}>
          {count}
        </span>
      }
      panel={
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {tasks.length === 0 ? (
            <p className="text-muted-foreground">{emptyLabel}</p>
          ) : (
            tasks.map((task, index) => (
              <div key={`${task.taskId}-${index}`} className={index > 0 ? "border-t pt-2" : ""}>
                <p className="font-semibold">{task.taskId}</p>
                <p className="line-clamp-2 text-muted-foreground">{task.description}</p>
                <p><span className="font-semibold">Assigned Date:</span> {formatDate(task.assignedAt)}</p>
                <p><span className="font-semibold">End Date:</span> {formatDate(task.endDate)}</p>
              </div>
            ))
          )}
        </div>
      }
      panelClassName="w-80"
    />
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
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <TaskCountCell
                      count={row.completedCount}
                      tasks={row.completedTasks}
                      kind="completed"
                      emptyLabel="Nothing completed yet."
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <TaskCountCell
                      count={row.pendingCount}
                      tasks={row.pendingTasks}
                      kind="pending"
                      emptyLabel="Nothing pending."
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