"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import EmployeeAvatar from "./EmployeeAvatar";

type Employee = { _id?: string; empId: string; name: string; photo?: string | null };

// A single-select employee picker that shows avatars in the trigger and in
// the dropdown list. Use this anywhere a native <select> was standing in for
// "pick one employee" - a plain <option> can never render an <img>, so a
// native select is a dead end for avatars no matter how it's styled.
export default function EmployeeSingleSelect({
  employees,
  value,
  onChange,
  placeholder = "Select employee...",
  className = "",
  triggerClassName = "h-9 text-sm",
  avatarSize = 20,
  getValue = (employee) => employee.empId,
}: {
  employees: Employee[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  avatarSize?: number;
  /** How to derive the option's value/id from an employee - defaults to empId.
   *  Pass e.g. `(e) => e.userId` when the caller keys selection by userId instead. */
  getValue?: (employee: Employee & Record<string, unknown>) => string;
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

  const selected = employees.find((employee) => getValue(employee) === value) || null;

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center justify-between gap-2 rounded-md border bg-background px-2 ${triggerClassName}`}
      >
        {selected ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <EmployeeAvatar name={selected.name} photo={selected.photo} size={avatarSize} />
            <span className="truncate">{selected.name}</span>
          </span>
        ) : (
          <span className="truncate text-muted-foreground">{placeholder}</span>
        )}
        <ChevronDown className="size-3.5 shrink-0 opacity-60" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-md border bg-popover shadow-lg">
          <div className="border-b p-1.5">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search employees..."
              className="h-7 w-full rounded border bg-background px-2 text-xs outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">No employees found.</p>
            ) : (
              filtered.map((employee) => (
                <button
                  type="button"
                  key={employee._id || getValue(employee)}
                  onClick={() => pick(getValue(employee))}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted ${
                    getValue(employee) === value ? "bg-muted" : ""
                  }`}
                >
                  <EmployeeAvatar name={employee.name} photo={employee.photo} size={avatarSize} />
                  <span className="truncate">
                    {employee.name} <span className="text-muted-foreground">({employee.empId})</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}