"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye } from "lucide-react";

import PageHeader from "@/app/_components/PageHeader";
import ListingToolbar from "@/app/_components/ListingToolbar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface LeaveRequestRow {
  _id: string;
  userId: string;
  employeeName?: string | null;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: "pending" | "approved" | "rejected" | "cancellation_pending" | "cancelled";
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  cancellationReason?: string;
}

async function fetchLeaves({
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
  const params = new URLSearchParams({ orgId, page: String(page), limit: String(limit), search });
  if (userId) params.set("userId", userId);
  const res = await fetch(`/api/leave/search?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch leave requests");
  return res.json();
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    approved: "bg-green-50 text-green-700 border-green-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
    cancellation_pending: "bg-orange-50 text-orange-700 border-orange-200",
    cancelled: "bg-gray-50 text-gray-700 border-gray-200",
  };
  const labels: Record<string, string> = { cancellation_pending: "Cancellation Pending" };
  return (
    <span
      className={`inline-block px-2 py-1 rounded-md text-xs font-medium border capitalize ${
        styles[status] || styles.pending
      }`}
    >
      {labels[status] || status}
    </span>
  );
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export default function LeaveRequestsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, status: sessionStatus } = useSession();

  const userId = session?.user?.id ?? "";
  const orgId = session?.user?.orgId ?? "";
  const role = session?.user?.role ?? "";
  const isAdminRole = ["ADMIN", "DIRECTOR"].includes(role);

  const [scope, setScope] = useState<"all" | "mine">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Per-row inline reject / reject-cancellation form state
  const [rejectDrafts, setRejectDrafts] = useState<Record<string, string>>({});
  const [showRejectFor, setShowRejectFor] = useState<string | null>(null);
  const [cancelRejectDrafts, setCancelRejectDrafts] = useState<Record<string, string>>({});
  const [showCancelRejectFor, setShowCancelRejectFor] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (sessionStatus !== "loading" && !isAdminRole) {
      router.replace("/leaves");
    }
  }, [sessionStatus, isAdminRole, router]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["leave-requests", orgId, scope, userId, page, limit, search],
    queryFn: () =>
      fetchLeaves({
        orgId,
        userId: scope === "mine" ? userId : "",
        page,
        limit,
        search,
      }),
    placeholderData: keepPreviousData,
    enabled: !!orgId && !!userId && isAdminRole,
  });

  const leaves: LeaveRequestRow[] = data?.leaves ?? [];
  const totalRecords: number = data?.total ?? 0;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
    await queryClient.invalidateQueries({ queryKey: ["leaves"] });
  };

  const review = async (id: string, actionType: "approve" | "reject", rejectionReason?: string) => {
    setActionError("");
    setActioningId(id);
    try {
      const res = await fetch(`/api/leave/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionType, rejectionReason: rejectionReason || "" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || `Failed to ${actionType} leave request.`);
      setShowRejectFor(null);
      setRejectDrafts((current) => ({ ...current, [id]: "" }));
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setActioningId(null);
    }
  };

  const decideCancellation = async (
    id: string,
    actionType: "approve_cancellation" | "reject_cancellation",
    cancellationDecisionReason?: string,
  ) => {
    setActionError("");
    setActioningId(id);
    try {
      const res = await fetch(`/api/leave/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionType, cancellationDecisionReason: cancellationDecisionReason || "" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Failed to update cancellation request.");
      setShowCancelRejectFor(null);
      setCancelRejectDrafts((current) => ({ ...current, [id]: "" }));
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setActioningId(null);
    }
  };

  if (!isAdminRole) return null;

  return (
    <div>
      <PageHeader title="Leave Requests" />

      <div className="pt-3">
        <ListingToolbar
          searchValue={search}
          onSearchChange={setSearch}
          pageSize={limit}
          onPageSizeChange={(value) => {
            setLimit(value);
            setPage(1);
          }}
          searchPlaceholder="Search leave requests..."
          rightSlot={
            <Select
              value={scope}
              onValueChange={(value) => {
                setScope(value as "all" | "mine");
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Leaves</SelectItem>
                <SelectItem value="mine">My Leaves</SelectItem>
              </SelectContent>
            </Select>
          }
        />
      </div>

      {actionError && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {actionError}
        </div>
      )}

      <div className="bg-white rounded-xl shadow border overflow-hidden">
        <Table>
          <TableHeader className="sticky top-0 bg-cyan-200 z-10 shadow-sm">
            <TableRow>
              <TableHead className="w-[60px] font-bold">View</TableHead>
              <TableHead className="font-bold">Emp Name</TableHead>
              <TableHead className="font-bold">Leave Type</TableHead>
              <TableHead className="font-bold">Dates</TableHead>
              <TableHead className="font-bold">Days</TableHead>
              <TableHead className="font-bold">Reason</TableHead>
              <TableHead className="font-bold">Status</TableHead>
              <TableHead className="font-bold min-w-[260px]">Action</TableHead>
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

            {!isLoading && !error && leaves.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-6 text-gray-500">
                  No leave requests found
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              !error &&
              leaves.map((leave) => {
                const isOwn = String(leave.userId) === String(userId);
                const isBusy = actioningId === leave._id;

                return (
                  <TableRow key={leave._id} className="hover:bg-gray-50 align-top">
                    <TableCell>
                      <button
                        onClick={() => router.push(`/leaves/${leave._id}`)}
                        className="text-cyan-700 hover:text-cyan-900"
                        aria-label="View leave request"
                      >
                        <Eye size={16} />
                      </button>
                    </TableCell>

                    <TableCell className="font-medium">
                      {leave.employeeName || leave.userId}
                      {isOwn && <span className="block text-[10px] text-muted-foreground">(You)</span>}
                    </TableCell>
                    <TableCell className="capitalize">{leave.leaveType}</TableCell>
                    <TableCell className="text-xs">
                      {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                    </TableCell>
                    <TableCell>{leave.days}</TableCell>
                    <TableCell className="max-w-[220px] truncate" title={leave.reason}>
                      {leave.reason || "-"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={leave.status} />
                      {leave.status === "rejected" && leave.rejectionReason && (
                        <p className="mt-1 max-w-[180px] text-[11px] text-gray-500">{leave.rejectionReason}</p>
                      )}
                      {leave.status === "cancellation_pending" && leave.cancellationReason && (
                        <p className="mt-1 max-w-[180px] text-[11px] text-orange-700">
                          Reason: {leave.cancellationReason}
                        </p>
                      )}
                    </TableCell>

                    <TableCell>
                      {isOwn && (leave.status === "pending" || leave.status === "cancellation_pending") && (
                        <span className="text-xs text-muted-foreground">
                          You can&apos;t review your own request.
                        </span>
                      )}

                      {!isOwn && leave.status === "pending" && showRejectFor !== leave._id && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-700 hover:bg-green-600"
                            disabled={isBusy}
                            onClick={() => void review(leave._id, "approve")}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() => setShowRejectFor(leave._id)}
                          >
                            Reject
                          </Button>
                        </div>
                      )}

                      {!isOwn && leave.status === "pending" && showRejectFor === leave._id && (
                        <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-2 w-full max-w-[260px]">
                          <Textarea
                            value={rejectDrafts[leave._id] ?? ""}
                            onChange={(e) =>
                              setRejectDrafts((current) => ({ ...current, [leave._id]: e.target.value }))
                            }
                            placeholder="Reject reason (optional)"
                            rows={2}
                            className="bg-white text-xs resize-none"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowRejectFor(null)}
                            >
                              Back
                            </Button>
                            <Button
                              size="sm"
                              className="bg-red-700 hover:bg-red-600"
                              disabled={isBusy}
                              onClick={() => void review(leave._id, "reject", rejectDrafts[leave._id])}
                            >
                              {isBusy ? "Rejecting..." : "Confirm Reject"}
                            </Button>
                          </div>
                        </div>
                      )}

                      {!isOwn && leave.status === "cancellation_pending" && showCancelRejectFor !== leave._id && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-cyan-900 hover:bg-cyan-700"
                            disabled={isBusy}
                            onClick={() => void decideCancellation(leave._id, "approve_cancellation")}
                          >
                            {isBusy ? "Processing..." : "Approve Cancellation"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() => setShowCancelRejectFor(leave._id)}
                          >
                            Reject Cancellation
                          </Button>
                        </div>
                      )}

                      {!isOwn && leave.status === "cancellation_pending" && showCancelRejectFor === leave._id && (
                        <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-2 w-full max-w-[260px]">
                          <Textarea
                            value={cancelRejectDrafts[leave._id] ?? ""}
                            onChange={(e) =>
                              setCancelRejectDrafts((current) => ({ ...current, [leave._id]: e.target.value }))
                            }
                            placeholder="Note (optional)"
                            rows={2}
                            className="bg-white text-xs resize-none"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setShowCancelRejectFor(null)}>
                              Back
                            </Button>
                            <Button
                              size="sm"
                              className="bg-cyan-900 hover:bg-cyan-700"
                              disabled={isBusy}
                              onClick={() =>
                                void decideCancellation(leave._id, "reject_cancellation", cancelRejectDrafts[leave._id])
                              }
                            >
                              {isBusy ? "Processing..." : "Confirm Reject Cancellation"}
                            </Button>
                          </div>
                        </div>
                      )}

                      {(leave.status === "approved" || leave.status === "rejected" || leave.status === "cancelled") &&
                        !(isOwn && (leave.status === "pending" || leave.status === "cancellation_pending")) && (
                          <Link href={`/leaves/${leave._id}`} className="text-xs text-cyan-700 hover:underline">
                            View details
                          </Link>
                        )}
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-4">
        <div className="text-sm text-muted-foreground">Total Records: {totalRecords}</div>
        <div className="flex justify-end items-center gap-3">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Prev
          </Button>
          <span className="text-sm font-medium">Page {page}</span>
          <Button variant="outline" disabled={page * limit >= totalRecords} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}