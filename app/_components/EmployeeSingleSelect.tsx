"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import EmployeeAvatar from "./EmployeeAvatar";

// Base shape every caller's employee objects must satisfy. The component is
// generic over T so callers can pass richer shapes (e.g. the leaves page's
// { userId, name, photo, balance } allocation employees) and have getValue
// type-check against their actual fields, instead of everything being
// forced through one fixed empId-based type.
type BaseEmployee = { _id?: string; name: string; photo?: string | null };

const PANEL_WIDTH = 224; // matches the old w-56 (14rem)
const PANEL_MAX_HEIGHT = 260; // ~ search box + max-h-56 list + some padding
const VIEWPORT_MARGIN = 8;

// A single-select employee picker that shows avatars in the trigger and in
// the dropdown list. Use this anywhere a native <select> was standing in for
// "pick one employee" - a plain <option> can never render an <img>, so a
// native select is a dead end for avatars no matter how it's styled.
//
// The dropdown panel is rendered through a portal into document.body and
// positioned with fixed coordinates computed from the trigger button. This
// is required because this component gets used inside containers that clip
// overflow (e.g. the Tasks table wrapper has overflow-hidden, and the
// Leaves allocation Card clips too) - an in-place absolutely-positioned
// panel gets cut off in those spots no matter what z-index it has, since
// overflow-hidden on an ancestor clips regardless of z-index. Portaling
// escapes that ancestor's DOM subtree entirely.
export default function EmployeeSingleSelect<T extends BaseEmployee>({
  employees,
  value,
  onChange,
  placeholder = "Select employee...",
  className = "",
  triggerClassName = "h-9 text-sm",
  avatarSize = 20,
  getValue = (employee) => ((employee as unknown as { empId?: string }).empId ?? "") as string,
  getSearchText,
}: {
  employees: T[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  avatarSize?: number;
  /** How to derive the option's value/id from an employee - defaults to empId.
   *  Pass e.g. `(e) => e.userId` when the caller keys selection by userId instead. */
  getValue?: (employee: T) => string;
  /** Optional extra text to match against when searching (e.g. empId/userId
   *  shown in parens). Defaults to whatever getValue returns. */
  getSearchText?: (employee: T) => string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(
    null,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Recompute the panel's position (and whether it should flip above the
  // trigger) whenever it opens, and keep it pinned to the trigger on
  // scroll/resize while it stays open.
  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.max(rect.width, PANEL_WIDTH);
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - VIEWPORT_MARGIN;
    const openUp = spaceBelow < PANEL_MAX_HEIGHT && spaceAbove > spaceBelow;

    let left = rect.left;
    const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN;
    if (left > maxLeft) left = Math.max(VIEWPORT_MARGIN, maxLeft);

    setPosition({
      top: openUp ? rect.top : rect.bottom,
      left,
      width,
      openUp,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleReposition = () => updatePosition();
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        panelRef.current &&
        !panelRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape for keyboard users.
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((employee) => {
      const extra = (getSearchText ? getSearchText(employee) : getValue(employee)) || "";
      return employee.name.toLowerCase().includes(term) || extra.toLowerCase().includes(term);
    });
  }, [employees, query, getValue, getSearchText]);

  const selected = employees.find((employee) => getValue(employee) === value) || null;

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  // The portal only ever mounts once `open` is true, and `open` starts as
  // false and can only flip to true from a user click - which can't happen
  // during server rendering. So there's no hydration mismatch to guard
  // against here, and no need for a separate "mounted" state/effect just to
  // delay the first client render.
  const canPortal = typeof document !== "undefined";

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        ref={triggerRef}
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

      {canPortal && open && position &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[999] rounded-md border bg-popover shadow-lg"
            style={{
              top: position.openUp ? undefined : position.top + 4,
              bottom: position.openUp ? window.innerHeight - position.top + 4 : undefined,
              left: position.left,
              width: position.width,
            }}
          >
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
                filtered.map((employee) => {
                  const id = getValue(employee);
                  const searchText = getSearchText ? getSearchText(employee) : id;
                  return (
                    <button
                      type="button"
                      key={employee._id || id}
                      onClick={() => pick(id)}
                      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted ${
                        id === value ? "bg-muted" : ""
                      }`}
                    >
                      <EmployeeAvatar name={employee.name} photo={employee.photo} size={avatarSize} />
                      <span className="truncate">
                        {employee.name}
                        {searchText ? <span className="text-muted-foreground"> ({searchText})</span> : null}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}