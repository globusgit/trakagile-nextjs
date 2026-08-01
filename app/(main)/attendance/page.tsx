"use client";
import ListingToolbar from "@/app/_components/ListingToolbar";
import PageHeader from "@/app/_components/PageHeader";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";

export async function fetchAttendance({
  orgId,
  page,
  limit,
  search,
}: {
  orgId: string;
  page: number;
  limit: number;
  search: string;
}) {
  const res = await fetch(
    `/api/attendance?orgId=${orgId}&page=${page}&limit=${limit}&search=${search}`,
  );

  if (!res.ok) {
    throw new Error("Failed to fetch attendance");
  }

  return res.json();
}

export default function AttendancePage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(10);
  const [attendanceData, setAttendanceData] = useState([]);
  const orgId = "ORG1";

  const { data, isLoading } = useQuery({
    queryKey: ["attendance", orgId, page, limit, search],
    queryFn: () =>
      fetchAttendance({
        orgId,
        page,
        limit,
        search,
      }),
    placeholderData: keepPreviousData,
  });

  const handleExport = async () => {
    const rows = attendanceData.map((item: any) => ({
      date: item.id,
      inTime: item.name,
      outTime: item.category,
      totalHrs: item.price,
    }));

    console.log("Export these rows:", rows);

    // You can plug Excel export logic here
  };

  return (
    <div>
      <PageHeader title="Attendance" />
      <ListingToolbar
        searchValue={search}
        onSearchChange={setSearch}
        pageSize={page}
        onPageSizeChange={setPage}
        onExport={handleExport}
        showAddButton={false}
        searchPlaceholder="Search attendance..."
      />
      This is Attendance Listing page
    </div>
  );
}
