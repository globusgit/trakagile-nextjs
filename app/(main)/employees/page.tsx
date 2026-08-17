"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import ListingToolbar from "@/app/_components/ListingToolbar";
import PageHeader from "@/app/_components/PageHeader";

interface Employee {
  _id: string;
  empId: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  photo?: string;
}

async function fetchEmployees({
  orgId,
  page,
  limit,
  q,
}: {
  orgId: string;
  page: number;
  limit: number;
  q?: string;
}) {
  const params = new URLSearchParams({
    orgId,
    page: String(page),
    limit: String(limit),
  });
  if (q) params.set("q", q);

  const res = await fetch(`/api/employee/search?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch employees");
  return res.json();
}

export default function EmployeeList() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const orgId = session?.user?.orgId ?? "";

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const { data, error, isLoading } = useQuery({
    queryKey: ["employees", orgId, page, limit, search],
    queryFn: () => fetchEmployees({ orgId, page, limit, q: search }),
    placeholderData: keepPreviousData,
    enabled: !!orgId,
  });

  const employees: Employee[] = data?.employees ?? [];
  const total: number = data?.total ?? 0;

  const handleExport = async () => {
    console.log("Export not wired up yet — need /api/employee/export route.");
  };

  if (status === "loading") {
    return <div className="p-8 text-center text-gray-500">Loading session...</div>;
  }

  return (
    <div>
      <PageHeader title="Employees" />

      <div className="pt-2">
        <ListingToolbar
          searchValue={search}
          onSearchChange={setSearch}
          pageSize={limit}
          onPageSizeChange={setLimit}
          onExport={handleExport}
          showAddButton
          addHref="/employees/create"
          addLabel="Employee"
          searchPlaceholder="Search Employee..."
        />
      </div>

      <div className="bg-white rounded-xl shadow border overflow-hidden">
        <Table>
          <TableHeader className="sticky top-0 bg-cyan-200 z-10 shadow-sm">
            <TableRow>
              <TableHead className="w-[70px] font-bold">Edit</TableHead>
              <TableHead className="w-[90px] font-bold">Photo</TableHead>
              <TableHead className="font-bold">Name</TableHead>
              <TableHead className="font-bold">Emp ID</TableHead>
              <TableHead className="font-bold">Email</TableHead>
              <TableHead className="font-bold">Phone</TableHead>
              <TableHead className="font-bold">Designation</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-gray-500">
                  Loading...
                </TableCell>
              </TableRow>
            )}

            {!!error && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-red-500">
                  Failed to load employees.
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !error && employees.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-gray-500">
                  No employees found
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              !error &&
              employees.map((emp) => (
                <TableRow key={emp._id} className="hover:bg-gray-50">
                  <TableCell>
                    <button
                      onClick={() => router.push(`/employees/${emp._id}`)}
                      className="text-orange-500 hover:text-orange-700"
                      aria-label="Edit employee"
                    >
                      <Pencil size={16} />
                    </button>
                  </TableCell>

                  <TableCell>
                    <Image
                      src={
                        emp.photo
                          ? `/api/files/employees/${encodeURIComponent(emp.photo)}`
                          : "/default-avatar.jpg"
                      }
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = "/default-avatar.jpg";
                      }}
                      alt={emp.name}
                      width={40}
                      height={40}
                      unoptimized
                      className="w-10 h-10 rounded-full object-cover border"
                    />
                  </TableCell>

                  <TableCell className="font-medium">{emp.name}</TableCell>
                  <TableCell>{emp.empId}</TableCell>
                  <TableCell className="max-w-[220px] truncate">
                    {emp.email}
                  </TableCell>
                  <TableCell>{emp.phone}</TableCell>
                  <TableCell>{emp.designation}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

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
            disabled={page * limit >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
