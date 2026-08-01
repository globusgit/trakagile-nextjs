"use client";
// HolidayList.tsx (summary - see full component in document)
import React, { useState, useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import ListingToolbar from "@/app/_components/ListingToolbar";
import PageHeader from "@/app/_components/PageHeader";

// shadcn components: Table, Button, Input, Select, Pagination primitives
interface Holiday {
  id: string;
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
  const res = await fetch(`/api/holidays?${params.toString()}`);
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

  const handleExport = async () => {
    console.log("Export these rows:");
  };
  return (
    <div>
      <PageHeader title="Holidays" />
      <ListingToolbar
        searchValue={search}
        onSearchChange={setSearch}
        pageSize={page}
        onPageSizeChange={setPage}
        onExport={handleExport}
        showAddButton
        addHref="/api/holiday"
        addLabel="Holiday"
        searchPlaceholder="Search attendance..."
      />
      This is Holiday Listing page
    </div>
  );
}
