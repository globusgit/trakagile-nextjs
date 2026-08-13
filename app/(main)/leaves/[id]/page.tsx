"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import PageHeader from "@/app/_components/PageHeader";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LEAVE_TYPES = [
  { value: "casual", label: "Casual Leave" },
  { value: "sick", label: "Sick Leave" },
  { value: "earned", label: "Earned Leave" },
  { value: "unpaid", label: "Unpaid Leave" },
  { value: "maternity", label: "Maternity Leave" },
  { value: "paternity", label: "Paternity Leave" },
  { value: "other", label: "Other" },
];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    approved: "bg-green-50 text-green-700 border-green-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
    cancellation_pending: "bg-orange-50 text-orange-700 border-orange-200",
    cancelled: "bg-gray-50 text-gray-700 border-gray-200",
  };
  const labels: Record<string, string> = {
    cancellation_pending: "Cancellation Pending",
  };
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

export default function EditLeaveRequest() {
  const router = useRouter();
  const params = useParams();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [days, setDays] = useState<number | "">("");
  const [dayType, setDayType] = useState<"full" | "half" | null>(null);

  const [status, setStatus] = useState("pending");
  const [approvedBy, setApprovedBy] = useState("");
  const [approvedAt, setApprovedAt] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationDecisionReason, setCancellationDecisionReason] = useState("");
  const [showCancelPendingForm, setShowCancelPendingForm] = useState(false);
  const [cancelPendingReasonInput, setCancelPendingReasonInput] = useState("");

  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [serverError, setServerError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReasonInput, setCancelReasonInput] = useState("");

  const [showRejectCancelForm, setShowRejectCancelForm] = useState(false);
  const [rejectCancelReasonInput, setRejectCancelReasonInput] = useState("");

  const isEditable = status === "pending";
  const isApproved = status === "approved";
  const isCancellationPending = status === "cancellation_pending";

  const loadLeave = async () => {
    try {
      const res = await fetch(`/api/leave/${params.id}`);
      if (!res.ok) {
        setLoadError(`Failed to load leave request (status ${res.status})`);
        setPageLoading(false);
        return;
      }
      const data = await res.json();

      setLeaveType(data.leaveType || "");
      setStartDate(data.startDate ? data.startDate.slice(0, 10) : "");
      setEndDate(data.endDate ? data.endDate.slice(0, 10) : "");
      setReason(data.reason || "");
      setDays(data.days ?? "");
      setDayType(data.days === 0.5 ? "half" : data.days === 1 ? "full" : null);
      setStatus(data.status || "pending");
      setApprovedBy(data.approvedBy || "");
      setApprovedAt(data.approvedAt || "");
      setRejectionReason(data.rejectionReason || "");
      setCancellationReason(data.cancellationReason || "");
      setCancellationDecisionReason(data.cancellationDecisionReason || "");
    } catch (err) {
      console.error("Failed to load leave request:", err);
      setLoadError("Failed to load leave request.");
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    if (params.id) loadLeave();
  }, [params.id]);

  useEffect(() => {
    if (!isEditable) return;

    if (!startDate || !endDate) {
      setDays("");
      setDayType(null);
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      setDays("");
      setDayType(null);
      return;
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays === 1) {
      setDayType((prev) => prev ?? "full");
      setDays((prev) => (prev === 0.5 ? 0.5 : 1));
    } else {
      setDayType(null);
      setDays(diffDays);
    }
  }, [startDate, endDate, isEditable]);

  const handleDayTypeChange = (type: "full" | "half") => {
    setDayType(type);
    setDays(type === "half" ? 0.5 : 1);
  };

  const validate = () => {
    const newErrors: Record<string, boolean> = {
      leaveType: !leaveType,
      startDate: !startDate,
      endDate: !endDate,
      days: days === "" || days === 0,
      reason: !reason.trim(),
    };
    setErrors(newErrors);
    return !Object.values(newErrors).some(Boolean);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const handleSubmit = async () => {
    setServerError("");
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/leave/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaveType, startDate, endDate, days, reason }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setServerError(
          typeof data === "string" ? data : data.message || "Failed to update leave request."
        );
        return;
      }

      router.push("/leaves");
      router.refresh();
    } catch (err) {
      console.error(err);
      setServerError("Something went wrong while updating the leave request.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPending = async () => {
    setServerError("");
    setSuccessMessage("");
    setLoading(true);
    try {
      const res = await fetch(`/api/leave/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel_pending",
          cancellationReason: cancelPendingReasonInput,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setServerError(typeof data === "string" ? data : data.message || "Failed to cancel leave request.");
        return;
      }
      setSuccessMessage("Leave request cancelled.");
      setShowCancelPendingForm(false);
      setCancelPendingReasonInput("");
      await loadLeave();
    } catch (err) {
      console.error(err);
      setServerError("Something went wrong while cancelling the leave request.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestCancellation = async () => {
    setServerError("");
    setSuccessMessage("");
    setLoading(true);
    try {
      const res = await fetch(`/api/leave/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request_cancellation",
          cancellationReason: cancelReasonInput,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setServerError(typeof data === "string" ? data : data.message || "Failed to request cancellation.");
        return;
      }
      setSuccessMessage("Cancellation requested. Waiting for admin review.");
      setShowCancelForm(false);
      setCancelReasonInput("");
      await loadLeave();
    } catch (err) {
      console.error(err);
      setServerError("Something went wrong while requesting cancellation.");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveCancellation = async () => {
    setServerError("");
    setSuccessMessage("");
    setLoading(true);
    try {
      const res = await fetch(`/api/leave/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve_cancellation" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setServerError(typeof data === "string" ? data : data.message || "Failed to approve cancellation.");
        return;
      }
      setSuccessMessage("Cancellation approved. This leave is now cancelled.");
      await loadLeave();
    } catch (err) {
      console.error(err);
      setServerError("Something went wrong while approving cancellation.");
    } finally {
      setLoading(false);
    }
  };

  const handleRejectCancellation = async () => {
    setServerError("");
    setSuccessMessage("");
    setLoading(true);
    try {
      const res = await fetch(`/api/leave/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject_cancellation",
          cancellationDecisionReason: rejectCancelReasonInput,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setServerError(typeof data === "string" ? data : data.message || "Failed to reject cancellation.");
        return;
      }
      setSuccessMessage("Cancellation request rejected. Leave remains approved.");
      setShowRejectCancelForm(false);
      setRejectCancelReasonInput("");
      await loadLeave();
    } catch (err) {
      console.error(err);
      setServerError("Something went wrong while rejecting cancellation.");
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="space-y-4 px-0 md:px-4 lg:px-8">
        <PageHeader title="Edit Leave Request" />
        <div className="p-8 text-center text-gray-500">Loading leave request...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4 px-0 md:px-4 lg:px-8">
        <PageHeader title="Edit Leave Request" />
        <div className="p-8 text-center text-red-500">{loadError}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-0 md:px-4 lg:px-8">
      <PageHeader title="Edit Leave Request" />

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl">Leave Details</CardTitle>
          <StatusBadge status={status} />
        </CardHeader>

        <CardContent className="space-y-8">
          {serverError && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
              {serverError}
            </div>
          )}

          {successMessage && (
            <div className="rounded-md bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3">
              {successMessage}
            </div>
          )}

          {!isEditable && !isCancellationPending && (
            <div className="rounded-md bg-gray-50 border border-gray-200 text-gray-600 text-sm px-4 py-3">
              This request has already been {status} and can no longer be edited.
            </div>
          )}

          {isCancellationPending && (
            <div className="rounded-md bg-orange-50 border border-orange-200 text-orange-700 text-sm px-4 py-3">
              A cancellation has been requested for this approved leave and is awaiting admin review.
              {cancellationReason && (
                <p className="mt-1 text-orange-800">
                  <span className="font-medium">Reason:</span> {cancellationReason}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>
                Leave Type {isEditable && <span className="text-red-500">*</span>}
              </Label>
              {isEditable ? (
                <Select
                  value={leaveType}
                  onValueChange={(v) => {
                    setLeaveType(v);
                    if (errors.leaveType) setErrors({ ...errors, leaveType: false });
                  }}
                >
                  <SelectTrigger className={errors.leaveType ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAVE_TYPES.map((lt) => (
                      <SelectItem key={lt.value} value={lt.value}>
                        {lt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={leaveType} disabled className="bg-gray-50 capitalize" />
              )}
              {isEditable && errors.leaveType && (
                <p className="text-red-500 text-xs">* This is Mandatory</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Total Days</Label>
              <Input
                value={days === "" ? "" : days}
                disabled
                className="bg-gray-50 text-gray-900 font-semibold"
              />
            </div>

            <div className="space-y-2">
              <Label>
                Start Date {isEditable && <span className="text-red-500">*</span>}
              </Label>
              <Input
                type="date"
                value={startDate}
                disabled={!isEditable}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (errors.startDate) setErrors({ ...errors, startDate: false });
                }}
                className={!isEditable ? "bg-gray-50" : errors.startDate ? "border-red-500" : ""}
              />
              {isEditable && errors.startDate && (
                <p className="text-red-500 text-xs">* This is Mandatory</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                End Date {isEditable && <span className="text-red-500">*</span>}
              </Label>
              <Input
                type="date"
                value={endDate}
                disabled={!isEditable}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  if (errors.endDate) setErrors({ ...errors, endDate: false });
                }}
                className={!isEditable ? "bg-gray-50" : errors.endDate ? "border-red-500" : ""}
              />
              {isEditable && errors.endDate && (
                <p className="text-red-500 text-xs">* This is Mandatory</p>
              )}
            </div>

            {isEditable && dayType !== null && (
              <div className="md:col-span-2 flex items-center gap-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 w-fit">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={dayType === "full"}
                    onCheckedChange={() => handleDayTypeChange("full")}
                    className="border-2 border-gray-500 data-[state=checked]:border-cyan-900 data-[state=checked]:bg-cyan-900"
                  />
                  <Label className="cursor-pointer" onClick={() => handleDayTypeChange("full")}>
                    Full Day
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={dayType === "half"}
                    onCheckedChange={() => handleDayTypeChange("half")}
                    className="border-2 border-gray-500 data-[state=checked]:border-cyan-900 data-[state=checked]:bg-cyan-900"
                  />
                  <Label className="cursor-pointer" onClick={() => handleDayTypeChange("half")}>
                    Half Day
                  </Label>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>
              Reason {isEditable && <span className="text-red-500">*</span>}
            </Label>
            <Textarea
              value={reason}
              disabled={!isEditable}
              onChange={(e) => {
                setReason(e.target.value);
                if (errors.reason) setErrors({ ...errors, reason: false });
              }}
              rows={4}
              className={`w-full resize-none ${
                !isEditable ? "bg-gray-50" : errors.reason ? "border-red-500" : ""
              }`}
            />
            {isEditable && errors.reason && (
              <p className="text-red-500 text-xs">* This is Mandatory</p>
            )}
          </div>

          {(status === "approved" ||
            status === "rejected" ||
            status === "cancellation_pending" ||
            status === "cancelled") && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-gray-100 pt-6">
              <div className="space-y-2">
                <Label>Approved By</Label>
                <Input value={approvedBy || "-"} disabled className="bg-gray-50" />
              </div>

              <div className="space-y-2">
                <Label>Approved Date</Label>
                <Input value={formatDate(approvedAt)} disabled className="bg-gray-50" />
              </div>

              {status === "rejected" && (
                <div className="md:col-span-2 space-y-2">
                  <Label>Rejection Reason</Label>
                  <Textarea
                    value={rejectionReason || "-"}
                    disabled
                    rows={3}
                    className="w-full resize-none bg-gray-50"
                  />
                </div>
              )}

              {status === "cancelled" && cancellationReason && (
                <div className="md:col-span-2 space-y-2">
                  <Label>Cancellation Reason</Label>
                  <Textarea
                    value={cancellationReason}
                    disabled
                    rows={3}
                    className="w-full resize-none bg-gray-50"
                  />
                </div>
              )}

              {status === "approved" && cancellationDecisionReason && (
                <div className="md:col-span-2 space-y-2">
                  <Label>Last Cancellation Request — Rejected By Admin, Note</Label>
                  <Textarea
                    value={cancellationDecisionReason}
                    disabled
                    rows={3}
                    className="w-full resize-none bg-gray-50"
                  />
                </div>
              )}
            </div>
          )}

          {isApproved && (
            <div className="border-t border-gray-100 pt-6 space-y-3">
              {!showCancelForm ? (
                <Button
                  variant="outline"
                  onClick={() => setShowCancelForm(true)}
                  className="border-red-300 text-red-600 hover:bg-red-50"
                >
                  Request Cancellation
                </Button>
              ) : (
                <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4">
                  <Label>Reason for cancellation</Label>
                  <Textarea
                    value={cancelReasonInput}
                    onChange={(e) => setCancelReasonInput(e.target.value)}
                    rows={3}
                    placeholder="Let the admin know why you'd like to cancel this leave..."
                    className="w-full resize-none bg-white"
                  />
                  <div className="flex gap-3 pt-1">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowCancelForm(false);
                        setCancelReasonInput("");
                      }}
                    >
                      Never Mind
                    </Button>
                    <Button
                      onClick={handleRequestCancellation}
                      disabled={loading}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {loading ? "Submitting..." : "Submit Cancellation Request"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Admin-only: decide on a pending cancellation request */}
          {isCancellationPending && isAdmin && (
            <div className="border-t border-gray-100 pt-6 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Admin Action
              </p>

              {!showRejectCancelForm ? (
                <div className="flex gap-3">
                  <Button
                    onClick={handleApproveCancellation}
                    disabled={loading}
                    className="bg-cyan-900 hover:bg-cyan-700"
                  >
                    {loading ? "Processing..." : "Approve Cancellation"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowRejectCancelForm(true)}
                    className="border-gray-300"
                  >
                    Reject Cancellation
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <Label>Note for rejecting this cancellation (optional)</Label>
                  <Textarea
                    value={rejectCancelReasonInput}
                    onChange={(e) => setRejectCancelReasonInput(e.target.value)}
                    rows={3}
                    className="w-full resize-none bg-white"
                  />
                  <div className="flex gap-3 pt-1">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowRejectCancelForm(false);
                        setRejectCancelReasonInput("");
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleRejectCancellation}
                      disabled={loading}
                      className="bg-cyan-900 hover:bg-cyan-700"
                    >
                      {loading ? "Processing..." : "Confirm Reject Cancellation"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {isCancellationPending && !isAdmin && (
            <div className="border-t border-gray-100 pt-6">
              <p className="text-sm text-gray-500">
                Your cancellation request is waiting for admin review.
              </p>
            </div>
          )}

          {isEditable && (
            <div className="border-t border-gray-100 pt-6 space-y-3">
              {!showCancelPendingForm ? (
                <Button
                  variant="outline"
                  onClick={() => setShowCancelPendingForm(true)}
                  className="border-red-300 text-red-600 hover:bg-red-50"
                >
                  Cancel Leave Request
                </Button>
              ) : (
                <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4">
                  <Label>Reason for cancelling (optional)</Label>
                  <Textarea
                    value={cancelPendingReasonInput}
                    onChange={(e) => setCancelPendingReasonInput(e.target.value)}
                    rows={3}
                    placeholder="Why are you cancelling this leave request?"
                    className="w-full resize-none bg-white"
                  />
                  <div className="flex gap-3 pt-1">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowCancelPendingForm(false);
                        setCancelPendingReasonInput("");
                      }}
                    >
                      Never Mind
                    </Button>
                    <Button
                      onClick={handleCancelPending}
                      disabled={loading}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {loading ? "Cancelling..." : "Confirm Cancel"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-4 border-t border-gray-100 pt-6">
            <Button
              variant="outline"
              onClick={() => router.push("/leaves")}
              className="bg-orange-700 hover:bg-orange-500 text-white"
            >
              {isEditable ? "Cancel" : "Back"}
            </Button>
            {isEditable && (
              <Button onClick={handleSubmit} disabled={loading} className="bg-cyan-900 hover:bg-cyan-700">
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}