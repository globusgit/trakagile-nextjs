"use client";
// HolidayList.tsx (summary - see full component in document)
import React, { useState, useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import ListingToolbar from "@/app/_components/ListingToolbar";
import PageHeader from "@/app/_components/PageHeader";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

// shadcn components: Table, Button, Input, Select, Pagination primitives
interface Holiday {
  _id: string;
  orgId: string;
  name: string;
  date: string;
  isRecurring: boolean;
  year?: number;
  note?: string;
}
async function fetchHolidays({
  orgId,
  year,
  page,
  size,
  q,
}: {
  orgId: string;
  year: number;
  page: number;
  size: number;
  q?: string;
}) {
  const params = new URLSearchParams({
    orgId,
    year: String(year),
    page: String(page),
    size: String(size),
  });
  if (q) params.set("q", q);
  const res = await fetch(`/api/holiday/search?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}
export default function HolidayList() {
  const currentYear = new Date().getFullYear();
  const [search, setSearch] = useState("");
  const [year, setYear] = useState<number>(currentYear);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const orgId = "ORG1";
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["holidays", orgId, year, page, size, query],
    queryFn: () => fetchHolidays({ orgId, year, page, size, q: query }),
    placeholderData: keepPreviousData,
  });

  const holidays: Holiday[] = data?.holidays ?? [];
  const total: number = data?.total ?? 0;

  const handleExport = async () => {
    console.log("Export these rows:");
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div>
      <PageHeader title="Holidays" />
      <div className="pt-2">
        <ListingToolbar
        searchValue={search}
        onSearchChange={setSearch}
        pageSize={page}
        onPageSizeChange={setPage}
        onExport={handleExport}
        showAddButton
        addHref="/holidays/create"
        addLabel="Holiday"
        searchPlaceholder="Search attendance..."
        selectedYear={year}
        onYearChange={setYear}
      />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow border overflow-hidden">
        <Table>
          <TableHeader className="sticky top-0 bg-cyan-200 z-10 shadow-sm">
            <TableRow>
              <TableHead className="font-bold">Name</TableHead>
              <TableHead className="font-bold">Date</TableHead>
              <TableHead className="font-bold">Recurring</TableHead>
              <TableHead className="font-bold">Year</TableHead>
              {/*<TableHead className="font-bold">Note</TableHead> */}
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-gray-500">
                  Loading...
                </TableCell>
              </TableRow>
            )}

            {!!error && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-red-500">
                  Failed to load holidays.
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !error && holidays.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-gray-500">
                  No holidays found
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              !error &&
              holidays.map((h) => (
                <TableRow key={h._id} className="hover:bg-gray-50">
                  <TableCell className="font-medium">{h.name}</TableCell>
                  <TableCell>{formatDate(h.date)}</TableCell>
                  <TableCell>{h.isRecurring ? "Yes" : "No"}</TableCell>
                  <TableCell>{h.year ?? "-"}</TableCell>
                  {/*<TableCell className="max-w-[280px] truncate">
                    {h.note || "-"}
                  </TableCell> */}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-4">
        <div className="text-sm text-muted-foreground">
          Total Records: {total}
        </div>
        <div className="flex justify-end items-center gap-3">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Prev
          </Button>

          <span className="text-sm font-medium">Page {page}</span>

          <Button
            variant="outline"
            disabled={page * size >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

