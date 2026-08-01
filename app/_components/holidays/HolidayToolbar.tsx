"use client";

import { Download, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface HolidayToolbarProps {
  search: string;
  selectedYear: number;
  onSearchChange: (value: string) => void;
  onYearChange: (year: number) => void;
  onExcelDownload: () => void;
  onAdd: () => void;
  loading?: boolean;
}

export default function HolidayToolbar({
  search,
  selectedYear,
  onSearchChange,
  onYearChange,
  onExcelDownload,
  onAdd,
  loading = false,
}: HolidayToolbarProps) {
  const currentYear = new Date().getFullYear();

  const years = [];

  for (let year = currentYear - 5; year <= currentYear + 5; year++) {
    years.push(year);
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
      {/* Search */}

      <div className="w-full lg:max-w-sm">
        <Input
          placeholder="Search holidays..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Controls */}

      <div className="flex flex-wrap items-center gap-2 justify-end">
        <Select
          value={selectedYear.toString()}
          onValueChange={(value) => onYearChange(Number(value))}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={onExcelDownload} disabled={loading}>
          <Download className="h-4 w-4 mr-2" />
          Excel
        </Button>

        <Button onClick={onAdd} disabled={loading}>
          <Plus className="h-4 w-4 mr-2" />
          Add Holiday
        </Button>
      </div>
    </div>
  );
}
