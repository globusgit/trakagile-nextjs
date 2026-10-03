
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import ListingToolbar from "@/app/_components/ListingToolbar";
import PageHeader from "@/app/_components/PageHeader";
import { escapeCsvValue } from "@/lib/dashboardExport.mjs";

interface Organization {
  _id: string;
  name: string;
  code: string;
  status: "ACTIVE" | "INACTIVE";
  contactPerson?: string;
  contactDesignation?: string;
  contactPhone?: string;
  contactEmail?: string;
  city?: string;
  state?: string;
  country?: string;
  createdAt?: string;
}

async function fetchOrganizations(): Promise<Organization[]> {
  const res = await fetch("/api/organizations", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch organizations");
  const data = await res.json();
  return Array.isArray(data.organizations) ? data.organizations : [];
}

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const dash = (value?: string) => value || "—";

export default function OrganizationsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const { data, error, isLoading } = useQuery({
    queryKey: ["sysadmin-organizations"],
    queryFn: fetchOrganizations,
    placeholderData: keepPreviousData,
  });

  const filtered = useMemo(() => {
    const organizations = data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return organizations;
    return organizations.filter((item) =>
      [item.name, item.code, item.contactPerson, item.contactDesignation, item.contactPhone, item.contactEmail, item.city, item.state, item.country]
        .some((field) => String(field ?? "").toLowerCase().includes(term)),
    );
  }, [data, search]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * limit, currentPage * limit);

  const handleExport = () => {
    const header = ["Org Name", "Code", "Status", "Contact Name", "Contact Designation", "Phone", "Email", "Reg. Date", "City", "State", "Country"];
    const lines = filtered.map((item) => [
      item.name, item.code, item.status, item.contactPerson, item.contactDesignation, item.contactPhone,
      item.contactEmail, formatDate(item.createdAt), item.city, item.state, item.country,
    ].map(escapeCsvValue).join(","));
    const blob = new Blob(["\ufeff" + [header.join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "organizations.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader title="Organizations" backHref={null} />

      <div className="pt-2">
        <ListingToolbar
          searchValue={search}
          onSearchChange={(value) => { setSearch(value); setPage(1); }}
          pageSize={limit}
          onPageSizeChange={(value) => { setLimit(value); setPage(1); }}
          onExport={handleExport}
          exportDisabled={!total}
          exportLabel="Export to CSV"
          showAddButton
          addHref="/sysadmin/organizations/new"
          addLabel="+ Organization"
          searchPlaceholder="Universal Search..."
        />
      </div>

      <div className="bg-white rounded-xl shadow border overflow-hidden">
        <Table>
          <TableHeader className="sticky top-0 bg-cyan-200 z-10 shadow-sm">
            <TableRow>
              <TableHead className="w-[70px] font-bold">Edit</TableHead>
              <TableHead className="font-bold">Org Name</TableHead>
              <TableHead className="font-bold">Contact Name</TableHead>
              <TableHead className="font-bold">Contact Designation</TableHead>
              <TableHead className="font-bold">Phone</TableHead>
              <TableHead className="font-bold">Email</TableHead>
              <TableHead className="font-bold">Reg. Date</TableHead>
              <TableHead className="font-bold">City</TableHead>
              <TableHead className="font-bold">State</TableHead>
              <TableHead className="font-bold">Country</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={10} className="text-center py-6 text-gray-500">Loading...</TableCell></TableRow>
            )}
            {!!error && (
              <TableRow><TableCell colSpan={10} className="text-center py-6 text-red-500">Failed to load organizations.</TableCell></TableRow>
            )}
            {!isLoading && !error && rows.length === 0 && (
              <TableRow><TableCell colSpan={10} className="text-center py-6 text-gray-500">No organizations found</TableCell></TableRow>
            )}
            {!isLoading && !error && rows.map((item) => (
              <TableRow key={item._id} className="hover:bg-gray-50">
                <TableCell>
                  <button
                    onClick={() => router.push(`/sysadmin/organizations/${item._id}`)}
                    className="text-orange-500 hover:text-orange-700"
                    aria-label="Edit organization"
                  >
                    <Pencil size={16} />
                  </button>
                </TableCell>
                <TableCell className="font-medium">
                  {item.name}
                  {item.status === "INACTIVE" && (
                    <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">Inactive</span>
                  )}
                </TableCell>
                <TableCell>{dash(item.contactPerson)}</TableCell>
                <TableCell>{dash(item.contactDesignation)}</TableCell>
                <TableCell>{dash(item.contactPhone)}</TableCell>
                <TableCell className="max-w-[220px] truncate">{dash(item.contactEmail)}</TableCell>
                <TableCell>{dash(formatDate(item.createdAt))}</TableCell>
                <TableCell>{dash(item.city)}</TableCell>
                <TableCell>{dash(item.state)}</TableCell>
                <TableCell>{dash(item.country)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-4">
        <div className="text-sm text-muted-foreground">Total Records: {total}</div>
        <div className="flex justify-end items-center gap-3">
          <Button variant="outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</Button>
          <span className="text-sm font-medium">Page {currentPage} of {totalPages}</span>
          <Button variant="outline" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}