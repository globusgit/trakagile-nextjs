"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

// Generic checkbox multi-select dropdown for filter bars (e.g. the Task
// Source filter on the Tasks list). Not tied to any particular data shape -
// pass whatever string options / selected values you're filtering by.
export default function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  placeholder = "All",
}: {
  label?: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
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

  const toggle = (option: string) => {
    if (selected.includes(option)) onChange(selected.filter((value) => value !== option));
    else onChange([...selected, option]);
  };

  const summary = selected.length === 0
    ? placeholder
    : selected.length <= 2
      ? selected.join(", ")
      : `${selected.length} selected`;

  return (
    <div ref={containerRef} className="relative">
      {label && <label className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 min-w-[180px] items-center justify-between gap-2 rounded-md border bg-white px-3 text-left text-sm"
      >
        <span className={selected.length ? "" : "text-muted-foreground"}>{summary}</span>
        <ChevronDown className="size-4 shrink-0 opacity-60" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-64 w-56 overflow-y-auto rounded-md border bg-popover shadow-lg">
          {options.length === 0 ? (
            <p className="px-3 py-3 text-center text-xs text-muted-foreground">No options.</p>
          ) : (
            <>
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="block w-full border-b px-3 py-1.5 text-left text-xs font-medium text-cyan-800 hover:bg-muted"
                >
                  Clear selection
                </button>
              )}
              {options.map((option) => (
                <label
                  key={option}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={selected.includes(option)}
                    onChange={() => toggle(option)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
