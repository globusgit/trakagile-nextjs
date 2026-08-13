"use client";
import ListingToolbar from "@/app/_components/ListingToolbar";
import PageHeader from "@/app/_components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";

import { useSession } from "next-auth/react";
import { Pencil } from "lucide-react";

export async function fetchLeaves({
  orgId,
  userId,
  page,
  limit,
  search,
}: {
  orgId: string;
  userId: string;
  page: number;
  limit: number;
  search: string;
}) {
  const res = await fetch(
    `/api/leave/search?orgId=${orgId}&userId=${userId}&page=${page}&limit=${limit}&search=${search}`,
  );

  if (!res.ok) {
    throw new Error("Failed to fetch leaves");
  }

  return res.json();
}

async function fetchLeaveInfo({
  orgId,
  userId,
  year,
}: {
  orgId: string;
  userId: string;
  year: number;
}) {
  const res = await fetch(
    `/api/leave/info?orgId=${orgId}&userId=${userId}&year=${year}`,
  );
  if (!res.ok) {
    throw new Error("Failed to fetch leave info");
  }
  return res.json();
}

interface LeaveRequestRow {
  _id: string;
  userId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
}

interface LeaveCardStat {
  label: string;
  allocated: number;
  availed: number;
  balance: number;
}

function LeaveCard({ stat }: { stat: LeaveCardStat }) {
  return (
    <Card className="shadow-sm transition-all hover:shadow-lg duration-200 hover:translate-y-1 hover:border-cyan-700 cursor-pointer">
      <CardContent className="p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-800">{stat.label}</p>

        <div className="flex flex-col gap-2">
          <div className="rounded-md bg-blue-50 px-3 py-2 flex items-center justify-between">
            <p className="text-xs font-medium text-blue-700">Allocated</p>
            <p className="text-base font-bold text-blue-900">{stat.allocated}</p>
          </div>

          <div className="rounded-md bg-green-50 px-3 py-2 flex items-center justify-between">
            <p className="text-xs font-medium text-green-700">Balance</p>
            <p className="text-base font-bold text-green-900">{stat.balance}</p>
          </div>

          <div className="rounded-md bg-orange-50 px-3 py-2 flex items-center justify-between">
            <p className="text-xs font-medium text-orange-700">Availed</p>
            <p className="text-base font-bold text-orange-900">{stat.availed}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    approved: "bg-green-50 text-green-700 border-green-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
    cancelled: "bg-gray-50 text-gray-700 border-gray-200",
  };
  return (
    <span
      className={`inline-block px-2 py-1 rounded-md text-xs font-medium border capitalize ${
        styles[status] || styles.pending
      }`}
    >
      {status}
    </span>
  );
}

export default function LeavesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "";
  const orgId = session?.user?.orgId ?? "";
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const currentYear = new Date().getFullYear();

  const { data, isLoading, error } = useQuery({
    queryKey: ["leaves", orgId, userId, page, limit, search],
    queryFn: () =>
      fetchLeaves({
        orgId,
        userId,
        page,
        limit,
        search,
      }),
    placeholderData: keepPreviousData,
    enabled: !!orgId && !!userId,
  });

  const leavesData: LeaveRequestRow[] = data?.leaves ?? [];
  const totalRecords: number = data?.total ?? 0;

  const { data: leaveInfo, isLoading: leaveInfoLoading } = useQuery({
    queryKey: ["leave-info", orgId, userId, currentYear],
    queryFn: () =>
      fetchLeaveInfo({ orgId, userId, year: currentYear }),
    enabled: !!orgId && !!userId,
  });

  const casualAllocated = leaveInfo?.casual ?? 0;
  const casualAvailed = leaveInfo?.usedCasual ?? 0;
  const sickAllocated = leaveInfo?.sick ?? 0;
  const sickAvailed = leaveInfo?.usedSick ?? 0;
  const earnedAllocated = leaveInfo?.earned ?? 0;
  const earnedAvailed = leaveInfo?.usedEarned ?? 0;
  const maternityAllocated = leaveInfo?.maternity ?? 0;
  const maternityAvailed = leaveInfo?.usedMaternity ?? 0;
  const paternityAllocated = leaveInfo?.paternity ?? 0;
  const paternityAvailed = leaveInfo?.usedPaternity ?? 0;

  const totalAllocated = casualAllocated + sickAllocated + earnedAllocated;
  const totalAvailed = casualAvailed + sickAvailed + earnedAvailed;

  const cardStats: LeaveCardStat[] = [
    {
      label: "Available Leaves",
      allocated: totalAllocated,
      availed: totalAvailed,
      balance: totalAllocated - totalAvailed,
    },
    {
      label: "Earned Leaves",
      allocated: earnedAllocated,
      availed: earnedAvailed,
      balance: earnedAllocated - earnedAvailed,
    },
    {
      label: "Casual Leaves",
      allocated: casualAllocated,
      availed: casualAvailed,
      balance: casualAllocated - casualAvailed,
    },
    {
      label: "Sick Leaves",
      allocated: sickAllocated,
      availed: sickAvailed,
      balance: sickAllocated - sickAvailed,
    },
    {
      label: "Maternity / Paternity",
      allocated: maternityAllocated + paternityAllocated,
      availed: maternityAvailed + paternityAvailed,
      balance:
        maternityAllocated + paternityAllocated - (maternityAvailed + paternityAvailed),
    },
  ];

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const handleExport = async () => {
    const rows = leavesData.map((item) => ({
      date: item.startDate,
      type: item.leaveType,
      status: item.status,
    }));

    //console.log("Export these rows:", rows);
  };

  return (
    <div>
      <PageHeader title="Leaves" />

      <div className="pt-3">
        <ListingToolbar
          searchValue={search}
          onSearchChange={setSearch}
          pageSize={page}
          onPageSizeChange={setPage}
          onExport={handleExport}
          showAddButton
          addHref="/leaves/create"
          addLabel="Leave Request"
          searchPlaceholder="Search leaves..."
        />
      </div>

      {/* Leave balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-1">
        {leaveInfoLoading
          ? cardStats.map((stat) => (
              <Card key={stat.label} className="shadow-sm">
                <CardContent className="p-4">
                  <p className="text-sm font-semibold text-gray-800">{stat.label}</p>
                  <p className="text-xs text-gray-400 mt-2">Loading...</p>
                </CardContent>
              </Card>
            ))
          : cardStats.map((stat) => <LeaveCard key={stat.label} stat={stat} />)}
      </div>

      {/* Leave requests table */}
      <div className="mt-6 bg-white rounded-xl shadow border overflow-hidden">
        <Table>
          <TableHeader className="sticky top-0 bg-cyan-200 z-10 shadow-sm">
            <TableRow>
              <TableHead className="w-[70px] font-bold">Edit</TableHead>
              <TableHead className="font-bold">Emp Name</TableHead>
              <TableHead className="font-bold">Leave Type</TableHead>
              <TableHead className="font-bold">Total Days</TableHead>
              <TableHead className="font-bold">Status</TableHead>
              <TableHead className="font-bold">Approved/Rejected By</TableHead>
              <TableHead className="font-bold">Approved Date</TableHead>
              <TableHead className="font-bold">Rejection Reason</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-6 text-gray-500">
                  Loading...
                </TableCell>
              </TableRow>
            )}

            {!!error && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-6 text-red-500">
                  Failed to load leave requests.
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !error && leavesData.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-6 text-gray-500">
                  No leave requests found
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              !error &&
              leavesData.map((leave) => (
                <TableRow key={leave._id} className="hover:bg-gray-50">
                  <TableCell>
                    <button
                      onClick={() => router.push(`/leaves/${leave._id}`)}
                      className="text-orange-500 hover:text-orange-700"
                      aria-label="Edit leave request"
                    >
                      <Pencil size={16} />
                    </button>
                  </TableCell>

                  <TableCell className="font-medium">{leave.employeeName}</TableCell>
                  <TableCell className="capitalize">{leave.leaveType}</TableCell>
                  <TableCell>{leave.days}</TableCell>
                  <TableCell>
                    <StatusBadge status={leave.status} />
                  </TableCell>
                  <TableCell>{leave.approvedBy || "-"}</TableCell>
                  <TableCell>{formatDate(leave.approvedAt)}</TableCell>
                  <TableCell className="max-w-[220px] truncate">
                    {leave.status === "rejected" ? leave.rejectionReason || "-" : "-"}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-4">
        <div className="text-sm text-muted-foreground">
          Total Records: {totalRecords}
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
            disabled={page * limit >= totalRecords}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}