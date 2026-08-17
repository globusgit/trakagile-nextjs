"use client";

import Link from "next/link";
import { ReactNode } from "react";

type ListingToolbarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;

  pageSize: number;
  onPageSizeChange: (value: number) => void;
  pageSizeOptions?: number[];

  onExport?: () => void | Promise<void>;
  exportDisabled?: boolean;
  exportLabel?: string;

  showAddButton?: boolean;
  addHref?: string;
  addLabel?: string;

  searchPlaceholder?: string;
  rightSlot?: ReactNode;

  // Optional year filter — only renders when both props are provided
  selectedYear?: number;
  onYearChange?: (year: number) => void;
  yearRange?: number; // years before/after current year to show, default 1
};

export default function ListingToolbar({
  searchValue,
  onSearchChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  onExport,
  exportDisabled = false,
  exportLabel = "Export to Excel",
  showAddButton,
  addHref,
  addLabel = "Add New",
  searchPlaceholder = "Search...",
  rightSlot,
  selectedYear,
  onYearChange,
  yearRange = 1,
}: ListingToolbarProps) {
  const showYearFilter = selectedYear !== undefined && onYearChange !== undefined;

  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  if (showYearFilter) {
    for (let y = currentYear - yearRange; y <= currentYear + yearRange; y++) {
      years.push(y);
    }
  }

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-lg border bg-white p-4 md:flex-row md:items-center md:justify-between">
      <div className="w-full md:max-w-sm">
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        {showYearFilter && (
          <select
            value={selectedYear}
            onChange={(e) => onYearChange!(Number(e.target.value))}
            className="rounded-md border px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}

        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="rounded-md border px-3 py-2 text-sm outline-none focus:border-blue-500"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              Show {size}
            </option>
          ))}
        </select>

        {rightSlot}

        {onExport && (
          <button
            type="button"
            onClick={onExport}
            disabled={exportDisabled}
            className="rounded-md border border-green-600 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exportLabel}
          </button>
        )}

        {showAddButton && addHref && (
          <Link
            href={addHref}
            className="rounded-md bg-cyan-900 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700"
          >
            {addLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
