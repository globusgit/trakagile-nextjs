"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

type Employee = { _id: string; empId: string; name: string };

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

  const selectedNames = employees
    .filter((employee) => selectedEmpIds.includes(employee.empId))
    .map((employee) => employee.name);

  const toggle = (empId: string) => {
    if (selectedEmpIds.includes(empId)) {
      onChange(selectedEmpIds.filter((id) => id !== empId));
    } else {
      onChange([...selectedEmpIds, empId]);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 w-full items-center justify-between rounded-md border bg-transparent px-3 text-left text-sm"
      >
        <span className={selectedNames.length ? "" : "text-muted-foreground"}>
          {selectedNames.length ? selectedNames.join(", ") : placeholder}
        </span>
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
                  <span>{employee.name} <span className="text-xs text-muted-foreground">({employee.empId})</span></span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}