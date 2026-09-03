"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown, X } from "lucide-react";

type Employee = { _id: string; empId: string; name: string; photo?: string };

// Same convention used across the app (employees page, dashboard, live
// tracking, navbar): employee.photo is a filename served through the
// authenticated /api/files/employees route; fall back to the shared
// default-avatar image when nothing has been uploaded.
function EmployeeAvatar({ name, photo }: { name: string; photo?: string }) {
  const src = photo ? `/api/files/employees/${encodeURIComponent(photo)}` : "/default-avatar.jpg";
  return (
    <Image
      src={src}
      alt={name}
      width={28}
      height={28}
      unoptimized
      className="size-7 shrink-0 rounded-full border object-cover"
    />
  );
}

export default function EmployeeMultiSelect({
  employees,
  selectedEmpIds,
  onChange,
  placeholder = "Search and select employees...",
}: {
  employees: Employee[];
  selectedEmpIds: string[];
  onChange: (empIds: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter(
      (employee) => employee.name.toLowerCase().includes(term) || employee.empId.toLowerCase().includes(term),
    );
  }, [employees, query]);

  const selectedEmployees = employees.filter((employee) => selectedEmpIds.includes(employee.empId));

  const summary =
    selectedEmployees.length === 0
      ? placeholder
      : selectedEmployees.length <= 2
        ? selectedEmployees.map((employee) => employee.name).join(", ")
        : `${selectedEmployees.length} employees selected`;

  const toggle = (empId: string) => {
    if (selectedEmpIds.includes(empId)) {
      onChange(selectedEmpIds.filter((id) => id !== empId));
    } else {
      onChange([...selectedEmpIds, empId]);
    }
  };

  return (
    <div ref={containerRef} className="space-y-2">
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex h-10 w-full items-center justify-between rounded-md border bg-transparent px-3 text-left text-sm"
        >
          <span className={selectedEmployees.length ? "" : "text-muted-foreground"}>{summary}</span>
          <ChevronDown className="size-4 shrink-0 opacity-60" />
        </button>

        {open && (
          <div className="absolute left-0 top-full z-30 mt-1 w-full rounded-md border bg-popover shadow-lg">
            <div className="border-b p-2">
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search employees..."
                className="h-8 w-full rounded border bg-background px-2 text-sm outline-none"
              />
            </div>
            <div className="max-h-56 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground">No employees found.</p>
              ) : (
                filtered.map((employee) => (
                  <label
                    key={employee._id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEmpIds.includes(employee.empId)}
                      onChange={() => toggle(employee.empId)}
                      className="size-4"
                    />
                    <EmployeeAvatar name={employee.name} photo={employee.photo} />
                    <span>{employee.name} <span className="text-xs text-muted-foreground">({employee.empId})</span></span>
                  </label>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Assigned employees, one per row with an avatar - the list the user asked for. */}
      {selectedEmployees.length > 0 && (
        <div className="space-y-1.5 rounded-md border bg-muted/20 p-2">
          {selectedEmployees.map((employee) => (
            <div
              key={employee._id}
              className="flex items-center justify-between gap-2 rounded-md border bg-white px-2 py-1.5 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <EmployeeAvatar name={employee.name} photo={employee.photo} />
                <span className="text-sm">
                  {employee.name} <span className="text-xs text-muted-foreground">({employee.empId})</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => toggle(employee.empId)}
                className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-red-50 hover:text-red-600"
                aria-label={`Remove ${employee.name}`}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}