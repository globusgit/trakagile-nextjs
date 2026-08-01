"use client";

import { useState } from "react";
import Link from "next/link";
import React from "react";

// Leave status types
type LeaveStatus = "Approved" | "Rejected" | "Requested";

// Leave data structure
interface LeaveRequest {
  id: string;
  employeeName: string;
  employeeId: string;
  department: string;
  leaveType: "Annual" | "Sick" | "Casual" | "Unpaid" | "Other";
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  submittedDate: string;
}

// Mock data - Replace with your API call
const mockLeaves: LeaveRequest[] = [
  {
    id: "1",
    employeeName: "John Doe",
    employeeId: "EMP001",
    department: "Engineering",
    leaveType: "Annual",
    startDate: "2024-01-15",
    endDate: "2024-01-19",
    totalDays: 5,
    reason: "Family vacation",
    status: "Approved",
    submittedDate: "2024-01-01",
  },
  {
    id: "2",
    employeeName: "John Doe",
    employeeId: "EMP001",
    department: "Engineering",
    leaveType: "Sick",
    startDate: "2024-02-10",
    endDate: "2024-02-12",
    totalDays: 3,
    reason: "Medical treatment",
    status: "Rejected",
    submittedDate: "2024-02-05",
  },
  {
    id: "3",
    employeeName: "John Doe",
    employeeId: "EMP001",
    department: "Engineering",
    leaveType: "Casual",
    startDate: "2024-03-05",
    endDate: "2024-03-06",
    totalDays: 2,
    reason: "Personal errands",
    status: "Requested",
    submittedDate: "2024-03-01",
  },
  {
    id: "4",
    employeeName: "John Doe",
    employeeId: "EMP001",
    department: "Engineering",
    leaveType: "Unpaid",
    startDate: "2024-04-20",
    endDate: "2024-04-25",
    totalDays: 6,
    reason: "Wedding ceremony",
    status: "Approved",
    submittedDate: "2024-04-01",
  },
];

// Status badge component
function StatusBadge({ status }: { status: LeaveStatus }) {
  const statusStyles = {
    Approved: "bg-green-100 text-green-800 border-green-200",
    Rejected: "bg-red-100 text-red-800 border-red-200",
    Requested: "bg-blue-100 text-blue-800 border-blue-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        statusStyles[status]
      }`}
    >
      {status}
    </span>
  );
}

// Format date helper
function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function LeavesPage() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>(mockLeaves);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<LeaveStatus | "All">("All");

  // Fetch leaves from API (replace with your actual API call)
  React.useEffect(() => {
    async function fetchLeaves() {
      try {
        // Example API call:
        // const res = await fetch("/api/leaves");
        // const data = await res.json();
        // setLeaves(data);
        
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 500));
        setLeaves(mockLeaves);
      } catch (error) {
        console.error("Failed to fetch leaves:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchLeaves();
  }, []);

  // Filter leaves by status
  const filteredLeaves =
    filterStatus === "All"
      ? leaves
      : leaves.filter((leave) => leave.status === filterStatus);

  // Calculate statistics
  const stats = {
    total: leaves.length,
    approved: leaves.filter((l) => l.status === "Approved").length,
    rejected: leaves.filter((l) => l.status === "Rejected").length,
    requested: leaves.filter((l) => l.status === "Requested").length,
  };

  return (
    <div className="min-h-screen bg-blue-50 py-10">
      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Leaves</h1>
            <p className="text-sm text-gray-600">
              View and track all your leave requests
            </p>
          </div>
          <Link
            href="/leaves/requests"
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <svg
              className="mr-2 h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Request Leave
          </Link>
        </div>

        {/* Statistics Cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Total Requests</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="rounded-lg border border-green-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-green-600">Approved</p>
            <p className="text-2xl font-bold text-green-700">{stats.approved}</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-red-600">Rejected</p>
            <p className="text-2xl font-bold text-red-700">{stats.rejected}</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-blue-600">Pending</p>
            <p className="text-2xl font-bold text-blue-700">{stats.requested}</p>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="mb-4 flex gap-2">
          {(["All", "Approved", "Rejected", "Requested"] as const).map(
            (status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  filterStatus === status
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
                }`}
              >
                {status}
              </button>
            )
          )}
        </div>

        {/* Leave Requests Table */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-sm text-gray-500">Loading leave requests...</div>
            </div>
          ) : filteredLeaves.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <svg
                className="mb-3 h-12 w-12 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-sm text-gray-500">No leave requests found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Leave Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Duration
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Total Days
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Reason
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Submitted
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredLeaves.map((leave) => (
                    <tr
                      key={leave.id}
                      className="transition hover:bg-gray-50"
                    >
                      <td className="whitespace-nowrap px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {leave.leaveType} Leave
                          </p>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="text-sm text-gray-900">
                          <p>{formatDate(leave.startDate)}</p>
                          <p className="text-xs text-gray-500">
                            to {formatDate(leave.endDate)}
                          </p>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="text-sm font-medium text-gray-900">
                          {leave.totalDays}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="max-w-xs truncate text-sm text-gray-700" title={leave.reason}>
                          {leave.reason}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="text-sm text-gray-500">
                          {formatDate(leave.submittedDate)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge status={leave.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-4 text-center text-xs text-gray-500">
          Showing {filteredLeaves.length} of {leaves.length} leave requests
        </div>
      </div>
    </div>
  );
}