"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

// A text input that searches `options` as you type, shows a dropdown of
// matches, and - when `onAddNew` is provided and the typed text doesn't
// match anything - reveals an "Add New" button to the right of the field.
//
// The committed value (the `value` prop / `onChange` callback) only changes
// when an option is picked, "Add New" succeeds, or the field is cleared -
// not on every keystroke - so parent components can safely key hierarchy
// resets (e.g. clearing a Sub-Task Type when Task Type changes) off it.
export default function SearchableSelect({
  options,
  value,
  onChange,
  onAddNew,
  placeholder = "Search or select...",
  disabled = false,
  disabledMessage,
  addingLabel = "Add New",
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  onAddNew?: (value: string) => Promise<void> | void;
  placeholder?: string;
  disabled?: boolean;
  disabledMessage?: string;
  addingLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const [adding, setAdding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the input in sync when `value` changes from outside (e.g. parent
  // resets the field) without syncing on every render - see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (value !== prevValue) {
    setPrevValue(value);
    setInputValue(value);
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const trimmed = inputValue.trim();
  const filtered = trimmed
    ? options.filter((option) => option.toLowerCase().includes(trimmed.toLowerCase()))
    : options;
  const exactMatch = options.some((option) => option.toLowerCase() === trimmed.toLowerCase());
  const showAddNew = Boolean(onAddNew) && trimmed !== "" && !exactMatch && !disabled;

  const selectOption = (option: string) => {
    setInputValue(option);
    onChange(option);
    setOpen(false);
  };

  const handleAddNew = async () => {
    if (!onAddNew || !trimmed) return;
    setAdding(true);
    try {
      await onAddNew(trimmed);
      setOpen(false);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-1">
      <div ref={containerRef} className="relative flex items-start gap-2">
        <div className="relative flex-1">
          <Input
            value={inputValue}
            disabled={disabled}
            placeholder={placeholder}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              const next = e.target.value;
              setInputValue(next);
              setOpen(true);
              if (next.trim() === "") onChange("");
            }}
          />
          {open && !disabled && filtered.length > 0 && (
            <div className="absolute left-0 top-full z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover shadow-lg">
              {filtered.map((option) => (
                <button
                  type="button"
                  key={option}
                  onClick={() => selectOption(option)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>
        {showAddNew && (
          <Button type="button" size="sm" className="h-10 shrink-0" disabled={adding} onClick={handleAddNew}>
            <Plus className="size-3.5" /> {adding ? "Adding..." : addingLabel}
          </Button>
        )}
      </div>
      {disabled && disabledMessage && <p className="text-xs text-muted-foreground">{disabledMessage}</p>}
    </div>
  );
}