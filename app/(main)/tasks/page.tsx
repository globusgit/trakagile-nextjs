"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import PageHeader from "@/app/_components/PageHeader";
import ListingToolbar from "@/app/_components/ListingToolbar";
import HoverPanel from "@/app/_components/HoverPanel";
import MultiSelectDropdown from "@/app/_components/MultiSelectDropdown";

import { Button } from "@/components/ui/button";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  Pencil,
  UserPlus,
} from "lucide-react";

import { useRegionalSettings } from "@/app/_components/RegionalSettingsProvider";

import {
  formatRegionalDate,
  formatRegionalDateTime,
} from "@/lib/regionalFormat.mjs";

import EmployeeAvatar, {
  EmployeeNameTag,
} from "@/app/_components/EmployeeAvatar";

import EmployeeSingleSelect from "@/app/_components/EmployeeSingleSelect";

/*
 * Roles allowed to create tasks, assign tasks
 * and edit tasks via the edit page.
 */
const TASK_MANAGE_ROLES = [
  "ADMIN",
  "DIRECTOR",
  "MANAGER",
  "HR",
];

const STATUS_BADGE: Record<
  string,
  string
> = {
  New:
    "bg-slate-100 text-slate-700",

  Assigned:
    "bg-amber-100 text-amber-800",

  "In Progress":
    "bg-sky-100 text-sky-800",

  Suspended:
    "bg-orange-100 text-orange-800",

  Done:
    "bg-emerald-100 text-emerald-800",

  Rejected:
    "bg-red-100 text-red-800",
};

const WORK_STATUS_OPTIONS = [
  "In Progress",
  "Done",
  "Suspended",
  "Rejected",
];

type Reference = {
  number?: string;
  description?: string;
  vertical?: string;
  subVertical?: string;
  status?: string;
  state?: string;
};

type AssignedEmployee = {
  empId: string;
  name: string;
  photo?: string | null;
};

type Employee = {
  _id: string;
  empId: string;
  name: string;
  photo?: string;
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

  createdByEmpId: string;

  createdByName?: string;

  createdByPhoto?: string | null;

  createdAt: string;

  assignedToEmpIds?: string[];

  assignedToNames?: AssignedEmployee[];

  assignedByEmpId?: string;

  assignedByName?: string;

  assignedByPhoto?: string | null;

  assignedAt?: string;

  projectNo?: Reference;

  workOrderNo?: Reference;

  tenderNo?: Reference;

  endDateTime?: string;

  completedDate?: string;

  closedAt?: string;
};

type TaskFilterOptions = {
  taskSources: string[];

  taskVerticals: string[];

  taskTypes: string[];

  subTaskTypes: string[];
};

const EMPTY_FILTER_OPTIONS: TaskFilterOptions =
  {
    taskSources: [],
    taskVerticals: [],
    taskTypes: [],
    subTaskTypes: [],
  };

function formatDate(
  value: string | undefined,
  regional: {
    locale: string;
    timeZone: string;
  },
) {
  if (!value) {
    return "-";
  }

  return formatRegionalDate(
    value,
    regional,
  );
}

function ageLabel(
  createdAt: string,
  closedAt: string | undefined,
  now: number,
) {
  const start =
    new Date(
      createdAt,
    ).getTime();

  const end = closedAt
    ? new Date(
        closedAt,
      ).getTime()
    : now;

  const diffMs = Math.max(
    0,
    end - start,
  );

  const days = Math.floor(
    diffMs / 86400000,
  );

  const hours = Math.floor(
    (diffMs % 86400000) /
      3600000,
  );

  return `${days}d ${hours}h`;
}

/*
 * ============================================================
 * TASK ID HOVER CARD
 * ============================================================
 *
 * Displays the task details when the user
 * hovers over the Task ID.
 */
function TaskIdHoverCard({
  task,
  regional,
}: {
  task: Task;

  regional: {
    locale: string;
    timeZone: string;
  };
}) {
  const assignedEmployees =
    task.assignedToNames || [];

  const referenceValue = (
    reference?: Reference,
  ) => {
    if (!reference?.number) {
      return (
        <span>
          -
        </span>
      );
    }

    return (
      <div className="space-y-0.5">
        <div className="font-medium">
          {reference.number}
        </div>

        {reference.description && (
          <div className="line-clamp-2 text-[11px] text-muted-foreground">
            {reference.description}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-[430px] max-w-[calc(100vw-24px)] text-sm">
      {/* Header */}
      <div className="border-b pb-3">
        <div className="text-base font-bold text-foreground">
          {task.taskId}
        </div>

        <div className="mt-1 text-xs text-muted-foreground">
          Task Details
        </div>
      </div>

      {/* Description */}
      <div className="border-b py-3">
        <div className="mb-1 text-[11px] font-medium text-muted-foreground">
          Description
        </div>

        <div className="whitespace-pre-wrap break-words font-medium">
          {task.description ||
            "-"}
        </div>
      </div>

      {/* Basic details */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 py-3">
        <div>
          <div className="text-[11px] text-muted-foreground">
            Task Source
          </div>

          <div className="font-medium">
            {task.taskSource ||
              "-"}
          </div>
        </div>

        <div>
          <div className="text-[11px] text-muted-foreground">
            Vertical
          </div>

          <div className="font-medium">
            {task.taskVertical ||
              "-"}
          </div>
        </div>

        <div>
          <div className="text-[11px] text-muted-foreground">
            Task Type
          </div>

          <div className="font-medium">
            {task.taskType ||
              "-"}
          </div>
        </div>

        <div>
          <div className="text-[11px] text-muted-foreground">
            Sub-Task Type
          </div>

          <div className="font-medium">
            {task.subTaskType ||
              "-"}
          </div>
        </div>

        <div>
          <div className="text-[11px] text-muted-foreground">
            Status
          </div>

          <div className="mt-0.5">
            <span
              className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                STATUS_BADGE[
                  task.status
                ] ||
                "bg-slate-100 text-slate-700"
              }`}
            >
              {task.status ||
                "-"}
            </span>
          </div>
        </div>

        <div>
          <div className="text-[11px] text-muted-foreground">
            Created By
          </div>

          <div className="mt-1">
            {task.createdByName ||
            task.createdByEmpId ? (
              <EmployeeNameTag
                name={
                  task.createdByName ||
                  task.createdByEmpId
                }
                photo={
                  task.createdByPhoto
                }
                empId={
                  task.createdByEmpId
                }
                size={22}
              />
            ) : (
              "-"
            )}
          </div>
        </div>

        <div>
          <div className="text-[11px] text-muted-foreground">
            Created Date
          </div>

          <div className="font-medium">
            {task.createdAt
              ? formatRegionalDateTime(
                  task.createdAt,
                  regional,
                )
              : "-"}
          </div>
        </div>

        <div>
          <div className="text-[11px] text-muted-foreground">
            Assigned Date
          </div>

          <div className="font-medium">
            {task.assignedAt
              ? formatRegionalDateTime(
                  task.assignedAt,
                  regional,
                )
              : "-"}
          </div>
        </div>
      </div>

      {/* Assigned To */}
      <div className="border-t py-3">
        <div className="mb-2 text-[11px] text-muted-foreground">
          Assigned To
        </div>

        {assignedEmployees.length >
        0 ? (
          <div className="flex flex-wrap gap-3">
            {assignedEmployees.map(
              (employee) => (
                <div
                  key={
                    employee.empId
                  }
                  className="flex items-center gap-1.5"
                >
                  <EmployeeAvatar
                    name={
                      employee.name
                    }
                    photo={
                      employee.photo
                    }
                    size={24}
                  />

                  <div>
                    <div className="text-xs font-medium">
                      {
                        employee.name
                      }
                    </div>

                    <div className="text-[10px] text-muted-foreground">
                      {
                        employee.empId
                      }
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        ) : (
          <span>
            -
          </span>
        )}
      </div>

      {/* Assigned By */}
      <div className="border-t py-3">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-[11px] text-muted-foreground">
              Assigned By
            </div>

            <div className="mt-1">
              {task.assignedByName ||
              task.assignedByEmpId ? (
                <EmployeeNameTag
                  name={
                    task.assignedByName ||
                    task.assignedByEmpId ||
                    "-"
                  }
                  photo={
                    task.assignedByPhoto
                  }
                  empId={
                    task.assignedByEmpId
                  }
                  size={22}
                />
              ) : (
                "-"
              )}
            </div>
          </div>

          <div>
            <div className="text-[11px] text-muted-foreground">
              Assigned Date
            </div>

            <div className="font-medium">
              {task.assignedAt
                ? formatRegionalDateTime(
                    task.assignedAt,
                    regional,
                  )
                : "-"}
            </div>
          </div>
        </div>
      </div>

      {/* Project / Work Order / Tender */}
      <div className="border-t py-3">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="mb-1 text-[11px] text-muted-foreground">
              Project No
            </div>

            {referenceValue(
              task.projectNo,
            )}
          </div>

          <div>
            <div className="mb-1 text-[11px] text-muted-foreground">
              Work-Order No
            </div>

            {referenceValue(
              task.workOrderNo,
            )}
          </div>

          <div>
            <div className="mb-1 text-[11px] text-muted-foreground">
              Tender No
            </div>

            {referenceValue(
              task.tenderNo,
            )}
          </div>
        </div>
      </div>

      {/* End / Completion */}
      <div className="border-t pt-3">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-[11px] text-muted-foreground">
              End Date &amp; Time
            </div>

            <div className="font-medium">
              {task.endDateTime
                ? formatRegionalDateTime(
                    task.endDateTime,
                    regional,
                  )
                : "-"}
            </div>
          </div>

          <div>
            <div className="text-[11px] text-muted-foreground">
              Completed Date
            </div>

            <div className="font-medium">
              {task.completedDate
                ? formatRegionalDateTime(
                    task.completedDate,
                    regional,
                  )
                : "-"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/*
 * Description hover card.
 */
function DescriptionCell({
  task,
  regional,
}: {
  task: Task;

  regional: {
    locale: string;
    timeZone: string;
  };
}) {
  const descriptionLines =
    (
      task.description.match(
        /\S+/g,
      ) || []
    ).reduce<string[]>(
      (
        lines,
        word,
        index,
      ) => {
        const lineIndex =
          Math.floor(
            index / 4,
          );

        lines[lineIndex] =
          lines[lineIndex]
            ? `${lines[lineIndex]} ${word}`
            : word;

        return lines;
      },
      [],
    );

  return (
    <HoverPanel
      trigger={
        <p className="w-full min-w-0 cursor-default line-clamp-2 whitespace-normal break-words">
          {descriptionLines.map(
            (
              line,
              index,
            ) => (
              <span
                key={`${index}-${line}`}
              >
                {line}

                {index <
                  descriptionLines.length -
                    1 && (
                  <br />
                )}
              </span>
            ),
          )}
        </p>
      }
      panel={
        <div className="space-y-2">
          <p className="whitespace-pre-wrap">
            {
              task.description
            }
          </p>

          <div className="space-y-1 border-t pt-2">
            <p>
              <span className="font-semibold">
                Created Date:
              </span>{" "}
              {formatDate(
                task.createdAt,
                regional,
              )}
            </p>

            <p>
              <span className="font-semibold">
                Assigned Date:
              </span>{" "}
              {formatDate(
                task.assignedAt,
                regional,
              )}
            </p>
          </div>
        </div>
      }
      panelClassName="w-72"
    />
  );
}

/*
 * Project / Work Order / Tender hover card.
 */
function ReferenceCell({
  reference,
}: {
  reference?: Reference;
}) {
  if (
    !reference?.number
  ) {
    return (
      <span className="whitespace-nowrap">
      </span>
    );
  }

  const subVerticals =
    (
      reference.subVertical ||
      ""
    )
      .split(",")
      .map(
        (value) =>
          value.trim(),
      )
      .filter(Boolean);

  return (
    <HoverPanel
      trigger={
        <span className="whitespace-nowrap cursor-default underline decoration-dotted underline-offset-4">
          {
            reference.number
          }
        </span>
      }
      panel={
        <div className="space-y-1.5">
          <p>
            <span className="font-semibold">
              Number:
            </span>{" "}
            {
              reference.number
            }
          </p>

          {reference.description && (
            <p>
              <span className="font-semibold">
                Description:
              </span>{" "}
              {
                reference.description
              }
            </p>
          )}

          {reference.vertical && (
            <p>
              <span className="font-semibold">
                Vertical:
              </span>{" "}
              {
                reference.vertical
              }
            </p>
          )}

          {subVerticals.length >
            0 && (
            <p>
              <span className="font-semibold">
                Sub-Vertical
                {subVerticals.length >
                1
                  ? "s"
                  : ""}
                :
              </span>{" "}
              {subVerticals.join(
                ", ",
              )}
            </p>
          )}

          {reference.status && (
            <p>
              <span className="font-semibold">
                Status:
              </span>{" "}
              {
                reference.status
              }
            </p>
          )}

          {reference.state && (
            <p>
              <span className="font-semibold">
                State:
              </span>{" "}
              {
                reference.state
              }
            </p>
          )}
        </div>
      }
    />
  );
}

/*
 * Assigned To cell.
 */
function AssignedToCell({
  assignedToNames,
}: {
  assignedToNames?: AssignedEmployee[];
}) {
  const names =
    assignedToNames || [];

  if (
    names.length === 0
  ) {
    return (
      <span className="whitespace-nowrap">
        -
      </span>
    );
  }

  const trigger =
    names.length > 1 ? (
      <span className="flex items-center -space-x-2">
        {names
          .slice(0, 3)
          .map(
            (employee) => (
              <EmployeeAvatar
                key={
                  employee.empId
                }
                name={
                  employee.name
                }
                photo={
                  employee.photo
                }
                size={22}
                className="ring-2 ring-background"
              />
            ),
          )}

        {names.length >
          3 && (
          <span className="ml-3 flex size-[22px] items-center justify-center rounded-full border bg-muted text-[10px] font-medium">
            +
            {names.length -
              3}
          </span>
        )}
      </span>
    ) : (
      <EmployeeNameTag
        name={
          names[0].name
        }
        photo={
          names[0].photo
        }
        size={22}
      />
    );

  return (
    <HoverPanel
      trigger={
        <span className="inline-flex cursor-default whitespace-nowrap items-center">
          {trigger}
        </span>
      }
      panel={
        <div className="space-y-1">
          <p className="font-semibold">
            Assigned Employees
          </p>

          <ul className="space-y-1">
            {names.map(
              (employee) => (
                <li
                  key={
                    employee.empId
                  }
                >
                  <EmployeeNameTag
                    name={
                      employee.name
                    }
                    photo={
                      employee.photo
                    }
                    empId={
                      employee.empId
                    }
                    size={20}
                  />
                </li>
              ),
            )}
          </ul>
        </div>
      }
    />
  );
}

/*
 * Task status cell.
 *
 * The minimum width is intentional.
 * It prevents:
 *
 * Assigned + Start Working
 *
 * from being squeezed together.
 */
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

  onAssign: (
    taskId: string,
    empId: string,
  ) => void;

  onStartWorking: (
    taskId: string,
  ) => void;

  onUpdateStatus: (
    taskId: string,
    status: string,
  ) => void;

  busyId: string | null;
}) {
  const [
    assigning,
    setAssigning,
  ] = useState(false);

  const [
    pickedEmpId,
    setPickedEmpId,
  ] = useState("");

  const isBusy =
    busyId === task._id;

  const isAssignee =
    currentEmpId &&
    (
      task.assignedToEmpIds ||
      []
    ).includes(
      currentEmpId,
    );

  const badge = (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        STATUS_BADGE[
          task.status
        ] ||
        "bg-slate-100 text-slate-700"
      }`}
    >
      {task.status}
    </span>
  );

  if (
    task.status === "New"
  ) {
    if (!canManage) {
      return badge;
    }

    return (
      <div className="flex min-w-[180px] flex-col items-start gap-1">
        <div className="flex items-center gap-1.5">
          {badge}

          <HoverPanel
            panelClassName="w-max whitespace-nowrap"
            trigger={
              <button
                type="button"
                onClick={() =>
                  setAssigning(
                    (v) =>
                      !v,
                  )
                }
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
            <EmployeeSingleSelect
              employees={
                employees
              }
              value={
                pickedEmpId
              }
              onChange={
                setPickedEmpId
              }
              placeholder="Select employee..."
              triggerClassName="h-8 text-xs"
              avatarSize={18}
            />

            <Button
              size="sm"
              className="h-8"
              disabled={
                !pickedEmpId ||
                isBusy
              }
              onClick={() => {
                onAssign(
                  task._id,
                  pickedEmpId,
                );

                setAssigning(
                  false,
                );
              }}
            >
              {isBusy
                ? "..."
                : "Assign"}
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() =>
                setAssigning(
                  false,
                )
              }
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (
    task.status ===
    "Assigned"
  ) {
    if (!isAssignee) {
      return badge;
    }

    return (
      <div className="flex min-w-[180px] flex-wrap items-center gap-2">
        {badge}

        <Button
          size="sm"
          className="h-7 shrink-0 whitespace-nowrap text-xs"
          disabled={isBusy}
          onClick={() =>
            onStartWorking(
              task._id,
            )
          }
        >
          {isBusy
            ? "Starting..."
            : "Start Working"}
        </Button>
      </div>
    );
  }

  if (
    task.status ===
      "In Progress" ||
    task.status ===
      "Suspended"
  ) {
    if (!isAssignee) {
      return badge;
    }

    return (
      <select
        className="h-8 rounded-md border bg-background px-2 text-xs font-medium"
        value={
          task.status
        }
        disabled={isBusy}
        onChange={(
          event,
        ) =>
          onUpdateStatus(
            task._id,
            event.target
              .value,
          )
        }
      >
        {WORK_STATUS_OPTIONS.map(
          (option) => (
            <option
              key={
                option
              }
              value={
                option
              }
            >
              {option ===
              "Rejected"
                ? "Reject"
                : option}
            </option>
          ),
        )}
      </select>
    );
  }

  return badge;
}

export default function TasksPage() {
  const regional =
    useRegionalSettings();

  const {
    data: session,
  } = useSession();

  const role =
    session?.user?.role ??
    "";

  const currentEmpId =
    session?.user?.empId;

  const canManage =
    TASK_MANAGE_ROLES.includes(
      role,
    );

  const [tasks, setTasks] =
    useState<Task[]>([]);

  const [
    employees,
    setEmployees,
  ] = useState<Employee[]>(
    [],
  );

  const [search, setSearch] =
    useState("");

  const [query, setQuery] =
    useState("");

  const [page, setPage] =
    useState(1);

  const [size, setSize] =
    useState(20);

  const [total, setTotal] =
    useState(0);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    busyId,
    setBusyId,
  ] = useState<string | null>(
    null,
  );

  const [now, setNow] =
    useState(
      () => Date.now(),
    );

  const [
    taskSourceFilter,
    setTaskSourceFilter,
  ] = useState<string[]>(
    [],
  );

  const [
    taskVerticalFilter,
    setTaskVerticalFilter,
  ] = useState("");

  const [
    taskTypeFilter,
    setTaskTypeFilter,
  ] = useState("");

  const [
    subTaskTypeFilter,
    setSubTaskTypeFilter,
  ] = useState("");

  const [
    filterOptions,
    setFilterOptions,
  ] = useState<TaskFilterOptions>(
    EMPTY_FILTER_OPTIONS,
  );

  const [
    projectNoSearch,
    setProjectNoSearch,
  ] = useState("");

  const [
    projectNoQuery,
    setProjectNoQuery,
  ] = useState("");

  const [
    workOrderNoSearch,
    setWorkOrderNoSearch,
  ] = useState("");

  const [
    workOrderNoQuery,
    setWorkOrderNoQuery,
  ] = useState("");

  const [
    tenderNoSearch,
    setTenderNoSearch,
  ] = useState("");

  const [
    tenderNoQuery,
    setTenderNoQuery,
  ] = useState("");

  /*
   * Keep Age current.
   */
  useEffect(() => {
    const timer =
      window.setInterval(
        () =>
          setNow(
            Date.now(),
          ),
        60_000,
      );

    return () =>
      window.clearInterval(
        timer,
      );
  }, []);

  /*
   * Project search debounce.
   */
  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          setProjectNoQuery(
            projectNoSearch,
          );

          setPage(1);
        },
        350,
      );

    return () =>
      window.clearTimeout(
        timer,
      );
  }, [projectNoSearch]);

  /*
   * Work Order search debounce.
   */
  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          setWorkOrderNoQuery(
            workOrderNoSearch,
          );

          setPage(1);
        },
        350,
      );

    return () =>
      window.clearTimeout(
        timer,
      );
  }, [
    workOrderNoSearch,
  ]);

  /*
   * Tender search debounce.
   */
  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          setTenderNoQuery(
            tenderNoSearch,
          );

          setPage(1);
        },
        350,
      );

    return () =>
      window.clearTimeout(
        timer,
      );
  }, [
    tenderNoSearch,
  ]);

  /*
   * Load Tasks.
   */
  const loadTasks =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        const params =
          new URLSearchParams({
            page: String(page),
            limit: String(size),
          });

        if (query) {
          params.set(
            "search",
            query,
          );
        }

        taskSourceFilter.forEach(
          (source) =>
            params.append(
              "taskSource",
              source,
            ),
        );

        if (
          taskVerticalFilter
        ) {
          params.set(
            "taskVertical",
            taskVerticalFilter,
          );
        }

        if (
          taskTypeFilter
        ) {
          params.set(
            "taskType",
            taskTypeFilter,
          );
        }

        if (
          subTaskTypeFilter
        ) {
          params.set(
            "subTaskType",
            subTaskTypeFilter,
          );
        }

        if (projectNoQuery) {
          params.set(
            "projectNo",
            projectNoQuery,
          );
        }

        if (
          workOrderNoQuery
        ) {
          params.set(
            "workOrderNo",
            workOrderNoQuery,
          );
        }

        if (tenderNoQuery) {
          params.set(
            "tenderNo",
            tenderNoQuery,
          );
        }

        try {
          const response =
            await fetch(
              `/api/tasks?${params}`,
              {
                cache:
                  "no-store",
              },
            );

          const result =
            await response.json();

          if (!response.ok) {
            throw new Error(
              result.message ||
                "Unable to load tasks.",
            );
          }

          setTasks(
            result.tasks || [],
          );

          setTotal(
            result.total || 0,
          );
        } catch (
          requestError
        ) {
          setTasks([]);

          setError(
            requestError instanceof
              Error
              ? requestError.message
              : "Unable to load tasks.",
          );
        } finally {
          setLoading(false);
        }
      },
      [
        page,
        size,
        query,
        taskSourceFilter,
        taskVerticalFilter,
        taskTypeFilter,
        subTaskTypeFilter,
        projectNoQuery,
        workOrderNoQuery,
        tenderNoQuery,
      ],
    );

  /*
   * Load filter options.
   */
  const loadFilterOptions =
    useCallback(
      async () => {
        const params =
          new URLSearchParams();

        taskSourceFilter.forEach(
          (source) =>
            params.append(
              "taskSource",
              source,
            ),
        );

        if (
          taskVerticalFilter
        ) {
          params.set(
            "taskVertical",
            taskVerticalFilter,
          );
        }

        if (
          taskTypeFilter
        ) {
          params.set(
            "taskType",
            taskTypeFilter,
          );
        }

        try {
          const response =
            await fetch(
              `/api/tasks/filters?${params}`,
              {
                cache:
                  "no-store",
              },
            );

          if (
            response.ok
          ) {
            setFilterOptions(
              await response.json(),
            );
          }
        } catch {
          /*
           * Non-fatal.
           */
        }
      },
      [
        taskSourceFilter,
        taskVerticalFilter,
        taskTypeFilter,
      ],
    );

  useEffect(() => {
    const timer =
      window.setTimeout(
        () =>
          void loadFilterOptions(),
        0,
      );

    return () =>
      window.clearTimeout(
        timer,
      );
  }, [
    loadFilterOptions,
  ]);

  /*
   * Task Source changed.
   */
  const handleTaskSourceFilterChange =
    useCallback(
      (values: string[]) => {
        setTaskSourceFilter(
          values,
        );

        setTaskVerticalFilter(
          "",
        );

        setTaskTypeFilter(
          "",
        );

        setSubTaskTypeFilter(
          "",
        );

        setPage(1);
      },
      [],
    );

  const handleVerticalFilterChange =
    useCallback(
      (value: string) => {
        setTaskVerticalFilter(
          value,
        );

        setTaskTypeFilter(
          "",
        );

        setSubTaskTypeFilter(
          "",
        );

        setPage(1);
      },
      [],
    );

  const handleTaskTypeFilterChange =
    useCallback(
      (value: string) => {
        setTaskTypeFilter(
          value,
        );

        setSubTaskTypeFilter(
          "",
        );

        setPage(1);
      },
      [],
    );

  const handleSubTaskTypeFilterChange =
    useCallback(
      (value: string) => {
        setSubTaskTypeFilter(
          value,
        );

        setPage(1);
      },
      [],
    );

  const clearTaskFilters =
    useCallback(() => {
      setTaskSourceFilter(
        [],
      );

      setTaskVerticalFilter(
        "",
      );

      setTaskTypeFilter(
        "",
      );

      setSubTaskTypeFilter(
        "",
      );

      setPage(1);
    }, []);

  /*
   * Cascading dropdown state.
   */
  const verticalHasOptions =
    taskSourceFilter.length ===
      1 &&
    filterOptions
      .taskVerticals.length >
      0;

  const verticalEnabled =
    verticalHasOptions;

  const verticalResolved =
    !verticalEnabled ||
    Boolean(
      taskVerticalFilter,
    );

  const taskTypeEnabled =
    taskSourceFilter.length >
      0 &&
    verticalResolved;

  const subTaskTypeEnabled =
    taskTypeEnabled &&
    Boolean(
      taskTypeFilter,
    );

  const verticalPlaceholder =
    taskSourceFilter.length !==
    1
      ? "Select a single Task Source"
      : filterOptions
          .taskVerticals
          .length === 0
        ? "No verticals for this source"
        : "All Verticals";

  const taskTypePlaceholder =
    taskSourceFilter.length ===
    0
      ? "Select a Task Source first"
      : verticalEnabled &&
          !taskVerticalFilter
        ? "Select a Vertical first"
        : "All Task Types";

  const subTaskTypePlaceholder =
    !taskTypeFilter
      ? "Select a Task Type first"
      : "All Sub-Task Types";

  const hasActiveTaskFilters =
    taskSourceFilter.length >
      0 ||
    Boolean(
      taskVerticalFilter,
    ) ||
    Boolean(
      taskTypeFilter,
    ) ||
    Boolean(
      subTaskTypeFilter,
    );

  /*
   * Load tasks.
   */
  useEffect(() => {
    const timer =
      window.setTimeout(
        () =>
          void loadTasks(),
        0,
      );

    return () =>
      window.clearTimeout(
        timer,
      );
  }, [loadTasks]);

  /*
   * Load employees for assignment.
   */
  useEffect(() => {
    if (!canManage) {
      return;
    }

    (async () => {
      try {
        const response =
          await fetch(
            "/api/employee/search?limit=200",
            {
              cache:
                "no-store",
            },
          );

        if (
          response.ok
        ) {
          const result =
            await response.json();

          setEmployees(
            result.employees ||
              [],
          );
        }
      } catch {
        /*
         * Non-fatal.
         */
      }
    })();
  }, [canManage]);

  /*
   * Task actions.
   */
  const runAction =
    useCallback(
      async (
        taskId: string,
        action: string,
        extra: Record<
          string,
          unknown
        > = {},
      ) => {
        setBusyId(
          taskId,
        );

        try {
          const response =
            await fetch(
              `/api/tasks/${taskId}`,
              {
                method:
                  "PUT",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify(
                  {
                    action,
                    ...extra,
                  },
                ),
              },
            );

          const result =
            await response.json();

          if (
            !response.ok
          ) {
            throw new Error(
              result.message ||
                "Unable to update task.",
            );
          }

          toast.success(
            result.message ||
              "Task updated.",
          );

          await loadTasks();
        } catch (
          actionError
        ) {
          toast.error(
            actionError instanceof
              Error
              ? actionError.message
              : "Unable to update task.",
          );
        } finally {
          setBusyId(
            null,
          );
        }
      },
      [loadTasks],
    );

  const totalPages =
    useMemo(
      () =>
        Math.max(
          1,
          Math.ceil(
            total / size,
          ),
        ),
      [
        total,
        size,
      ],
    );

  return (
    <div
      className="w-full min-w-0 max-w-full space-y-4 overflow-x-hidden"
      style={{
        contain:
          "inline-size",
      }}
    >
      <PageHeader title="Tasks" />

      <ListingToolbar
        searchValue={
          search
        }
        onSearchChange={(
          value,
        ) => {
          setSearch(
            value,
          );

          setQuery(
            value,
          );

          setPage(1);
        }}
        pageSize={
          size
        }
        onPageSizeChange={(
          value,
        ) => {
          setSize(
            value,
          );

          setPage(1);
        }}
        searchPlaceholder="Search by Task ID, description, project/WO/tender no..."
        showAddButton
        addHref="/tasks/create"
        addLabel="Create Task"
      />

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border bg-white shadow [&>[data-slot=table-container]]:max-w-full [&>[data-slot=table-container]]:overflow-hidden">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 border-b bg-slate-50 px-4 py-3">
          <MultiSelectDropdown
            label="Task Source"
            options={
              filterOptions.taskSources
            }
            selected={
              taskSourceFilter
            }
            onChange={
              handleTaskSourceFilterChange
            }
            placeholder="All Sources"
          />

          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">
              Vertical
            </label>

            <select
              className="h-9 min-w-[190px] rounded-md border bg-white px-3 text-sm outline-none focus:border-cyan-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-muted-foreground"
              value={
                taskVerticalFilter
              }
              disabled={
                !verticalEnabled
              }
              onChange={(
                e,
              ) =>
                handleVerticalFilterChange(
                  e.target
                    .value,
                )
              }
            >
              <option value="">
                {
                  verticalPlaceholder
                }
              </option>

              {filterOptions.taskVerticals.map(
                (
                  vertical,
                ) => (
                  <option
                    key={
                      vertical
                    }
                    value={
                      vertical
                    }
                  >
                    {
                      vertical
                    }
                  </option>
                ),
              )}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">
              Task Type
            </label>

            <select
              className="h-9 min-w-[190px] rounded-md border bg-white px-3 text-sm outline-none focus:border-cyan-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-muted-foreground"
              value={
                taskTypeFilter
              }
              disabled={
                !taskTypeEnabled
              }
              onChange={(
                e,
              ) =>
                handleTaskTypeFilterChange(
                  e.target
                    .value,
                )
              }
            >
              <option value="">
                {
                  taskTypePlaceholder
                }
              </option>

              {filterOptions.taskTypes.map(
                (type) => (
                  <option
                    key={type}
                    value={type}
                  >
                    {
                      type
                    }
                  </option>
                ),
              )}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">
              Sub-Task Type
            </label>

            <select
              className="h-9 min-w-[190px] rounded-md border bg-white px-3 text-sm outline-none focus:border-cyan-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-muted-foreground"
              value={
                subTaskTypeFilter
              }
              disabled={
                !subTaskTypeEnabled
              }
              onChange={(
                e,
              ) =>
                handleSubTaskTypeFilterChange(
                  e.target
                    .value,
                )
              }
            >
              <option value="">
                {
                  subTaskTypePlaceholder
                }
              </option>

              {filterOptions.subTaskTypes.map(
                (
                  subType,
                ) => (
                  <option
                    key={
                      subType
                    }
                    value={
                      subType
                    }
                  >
                    {
                      subType
                    }
                  </option>
                ),
              )}
            </select>
          </div>

          {hasActiveTaskFilters && (
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={
                clearTaskFilters
              }
            >
              Clear Filters
            </Button>
          )}
        </div>

        {/* ============================================================
            RESPONSIVE TABLE
            ============================================================

            IMPORTANT:
            The table has a minimum width so all 14 columns are not
            squeezed into small screens.

            Only this table area scrolls horizontally.
            The complete page does not become wider than the screen.
        */}
        <div className="w-full max-w-full overflow-x-auto overflow-y-visible">
          <Table className="w-full min-w-[1500px] table-auto text-xs xl:text-sm">
            <TableHeader className="sticky top-0 z-10 bg-cyan-200 shadow-sm">
              <TableRow>
                <TableHead className="font-bold whitespace-nowrap">
                  Edit
                </TableHead>

                <TableHead className="font-bold whitespace-nowrap">
                  Task ID
                </TableHead>

                <TableHead className="font-bold">
                  Description
                </TableHead>

                <TableHead className="w-[190px] min-w-[190px] font-bold whitespace-nowrap">
                  Task Status
                </TableHead>

                <TableHead className="font-bold whitespace-nowrap">
                  Task Type
                </TableHead>

                <TableHead className="font-bold whitespace-nowrap">
                  Created By
                </TableHead>

                <TableHead className="font-bold whitespace-nowrap">
                  Age
                </TableHead>

                <TableHead className="font-bold whitespace-nowrap">
                  Assigned To
                </TableHead>

                <TableHead className="font-bold whitespace-nowrap">
                  Assigned By
                </TableHead>

                <TableHead className="font-bold whitespace-nowrap">
                  Project No
                </TableHead>

                <TableHead className="font-bold whitespace-nowrap">
                  Work-Order No
                </TableHead>

                <TableHead className="font-bold whitespace-nowrap">
                  Tender No
                </TableHead>

                <TableHead className="font-bold whitespace-nowrap">
                  End Date &amp; Time
                </TableHead>

                <TableHead className="font-bold whitespace-nowrap">
                  Completed Date
                </TableHead>
              </TableRow>

              {/* Search boxes */}
              <TableRow className="bg-cyan-100/60">
                <TableHead />
                <TableHead />
                <TableHead />
                <TableHead />
                <TableHead />
                <TableHead />
                <TableHead />
                <TableHead />
                <TableHead />

                <TableHead className="py-1.5">
                  <input
                    type="text"
                    value={
                      projectNoSearch
                    }
                    onChange={(
                      e,
                    ) =>
                      setProjectNoSearch(
                        e.target
                          .value,
                      )
                    }
                    placeholder="Search..."
                    className="h-7 w-full min-w-0 rounded border bg-white px-2 text-xs font-normal outline-none focus:border-cyan-600"
                  />
                </TableHead>

                <TableHead className="py-1.5">
                  <input
                    type="text"
                    value={
                      workOrderNoSearch
                    }
                    onChange={(
                      e,
                    ) =>
                      setWorkOrderNoSearch(
                        e.target
                          .value,
                      )
                    }
                    placeholder="Search..."
                    className="h-7 w-full min-w-0 rounded border bg-white px-2 text-xs font-normal outline-none focus:border-cyan-600"
                  />
                </TableHead>

                <TableHead className="py-1.5">
                  <input
                    type="text"
                    value={
                      tenderNoSearch
                    }
                    onChange={(
                      e,
                    ) =>
                      setTenderNoSearch(
                        e.target
                          .value,
                      )
                    }
                    placeholder="Search..."
                    className="h-7 w-full min-w-0 rounded border bg-white px-2 text-xs font-normal outline-none focus:border-cyan-600"
                  />
                </TableHead>

                <TableHead />
                <TableHead />
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={14}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Loading tasks...
                  </TableCell>
                </TableRow>
              ) : tasks.length ===
                0 ? (
                <TableRow>
                  <TableCell
                    colSpan={14}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No tasks found.
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map(
                  (task) => (
                    <TableRow
                      key={
                        task._id
                      }
                      className="hover:bg-gray-50"
                    >
                      {/* Edit */}
                      <TableCell>
                        <Link
                          href={`/tasks/${task._id}/edit`}
                        >
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-orange-500 hover:text-orange-700"
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </Link>
                      </TableCell>

                      {/* =================================================
                          TASK ID HOVER CARD
                          ================================================= */}
                      <TableCell className="whitespace-nowrap font-medium">
                        <HoverPanel
                          trigger={
                            <span className="cursor-default underline decoration-dotted underline-offset-4">
                              {
                                task.taskId
                              }
                            </span>
                          }
                          panel={
                            <TaskIdHoverCard
                              task={
                                task
                              }
                              regional={
                                regional
                              }
                            />
                          }
                          panelClassName="w-[450px] max-w-[calc(100vw-24px)]"
                        />
                      </TableCell>

                      {/* Description */}
                      <TableCell>
                        <DescriptionCell
                          task={
                            task
                          }
                          regional={
                            regional
                          }
                        />
                      </TableCell>

                      {/* Task Status */}
                      <TableCell className="w-[190px] min-w-[190px] overflow-visible">
                        <StatusCell
                          task={
                            task
                          }
                          currentEmpId={
                            currentEmpId
                          }
                          canManage={
                            canManage
                          }
                          employees={
                            employees
                          }
                          busyId={
                            busyId
                          }
                          onAssign={(
                            taskId,
                            empId,
                          ) =>
                            void runAction(
                              taskId,
                              "assign",
                              {
                                assignedToEmpId:
                                  empId,
                              },
                            )
                          }
                          onStartWorking={(
                            taskId,
                          ) =>
                            void runAction(
                              taskId,
                              "start_working",
                            )
                          }
                          onUpdateStatus={(
                            taskId,
                            status,
                          ) =>
                            void runAction(
                              taskId,
                              "update_status",
                              {
                                status,
                              },
                            )
                          }
                        />
                      </TableCell>

                      {/* Task Type */}
                      <TableCell className="whitespace-nowrap">
                        {
                          task.taskType ||
                          "-"
                        }
                      </TableCell>

                      {/* Created By */}
                      <TableCell className="whitespace-nowrap">
                        <EmployeeNameTag
                          name={
                            task.createdByName ||
                            task.createdByEmpId
                          }
                          photo={
                            task.createdByPhoto
                          }
                          size={22}
                        />
                      </TableCell>

                      {/* Age */}
                      <TableCell className="whitespace-nowrap">
                        {ageLabel(
                          task.createdAt,
                          task.closedAt,
                          now,
                        )}
                      </TableCell>

                      {/* Assigned To */}
                      <TableCell>
                        <AssignedToCell
                          assignedToNames={
                            task.assignedToNames
                          }
                        />
                      </TableCell>

                      {/* Assigned By */}
                      <TableCell className="whitespace-nowrap">
                        {task.assignedByName ? (
                          <EmployeeNameTag
                            name={
                              task.assignedByName
                            }
                            photo={
                              task.assignedByPhoto
                            }
                            size={22}
                          />
                        ) : (
                          "-"
                        )}
                      </TableCell>

                      {/* Project No */}
                      <TableCell>
                        <ReferenceCell
                          reference={
                            task.projectNo
                          }
                        />
                      </TableCell>

                      {/* Work Order No */}
                      <TableCell>
                        <ReferenceCell
                          reference={
                            task.workOrderNo
                          }
                        />
                      </TableCell>

                      {/* Tender No */}
                      <TableCell>
                        <ReferenceCell
                          reference={
                            task.tenderNo
                          }
                        />
                      </TableCell>

                      {/* End Date & Time */}
                      <TableCell className="whitespace-nowrap">
                        {task.endDateTime
                          ? formatRegionalDateTime(
                              task.endDateTime,
                              regional,
                            )
                          : "-"}
                      </TableCell>

                      {/* Completed Date */}
                      <TableCell className="whitespace-nowrap">
                        {task.status ===
                        "Done"
                          ? formatDate(
                              task.completedDate,
                              regional,
                            )
                          : ""}
                      </TableCell>
                    </TableRow>
                  ),
                )
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
        <div className="text-sm text-muted-foreground">
          Total Records:{" "}
          {total}
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button
            variant="outline"
            disabled={
              page === 1
            }
            onClick={() =>
              setPage(
                (value) =>
                  value - 1,
              )
            }
          >
            Prev
          </Button>

          <span className="text-sm font-medium">
            Page {page} of{" "}
            {totalPages}
          </span>

          <Button
            variant="outline"
            disabled={
              page >=
              totalPages
            }
            onClick={() =>
              setPage(
                (value) =>
                  value + 1,
              )
            }
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}