"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/app/_components/PageHeader";
import { useSession } from "next-auth/react";

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

export default function LeaveRequestPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "";
  const orgId = session?.user?.orgId ?? "";

  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const [days, setDays] = useState<number | "">("");
  const [dayType, setDayType] = useState<"full" | "half" | null>(null);

  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success">("idle");

  useEffect(() => {
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
      setDayType("full");
      setDays(1);
    } else {
      setDayType(null);
      setDays(diffDays);
    }
  }, [startDate, endDate]);

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

  const handleSubmit = async () => {
    setServerError("");
    setSubmitStatus("idle");
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          employeeName: session?.user?.empId ?? "", // Assuming empId is the employee's name or identifier
          leaveType,
          startDate,
          endDate,
          days,
          reason,
          orgId,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setServerError(
          typeof data === "string" ? data : data.error || "Failed to submit leave request."
        );
        return;
      }

      setSubmitStatus("success");
      setTimeout(() => {
        router.push("/leaves");
        router.refresh();
      }, 1000);
    } catch (err) {
      console.error(err);
      setServerError("Something went wrong while submitting the leave request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 px-0 md:px-4 lg:px-8">
      <PageHeader title="Leave Request Form" />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Leave Details</CardTitle>
        </CardHeader>

        <CardContent className="space-y-8">
          {serverError && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
              {serverError}
            </div>
          )}

          {submitStatus === "success" && (
            <div className="rounded-md bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3">
              Leave request submitted successfully.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>
                Leave Type <span className="text-red-500">*</span>
              </Label>
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
              {errors.leaveType && <p className="text-red-500 text-xs">* This is Mandatory</p>}
            </div>

            <div className="space-y-2">
              <Label>Total Days</Label>
              <Input
                value={days === "" ? "" : days}
                placeholder="Select dates below"
                disabled
                className="bg-gray-50 text-gray-900 font-semibold"
              />
            </div>

            <div className="space-y-2">
              <Label>
                Start Date <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (errors.startDate) setErrors({ ...errors, startDate: false });
                }}
                className={errors.startDate ? "border-red-500" : ""}
              />
              {errors.startDate && <p className="text-red-500 text-xs">* This is Mandatory</p>}
            </div>

            <div className="space-y-2">
              <Label>
                End Date <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  if (errors.endDate) setErrors({ ...errors, endDate: false });
                }}
                className={errors.endDate ? "border-red-500" : ""}
              />
              {errors.endDate && <p className="text-red-500 text-xs">* This is Mandatory</p>}
            </div>

            {dayType !== null && (
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
              Reason <span className="text-red-500">*</span>
            </Label>
            <Textarea
              placeholder="Add a reason for this leave..."
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (errors.reason) setErrors({ ...errors, reason: false });
              }}
              rows={4}
              className={`w-full resize-none ${errors.reason ? "border-red-500" : ""}`}
            />
            {errors.reason && <p className="text-red-500 text-xs">* This is Mandatory</p>}
          </div>

          <div className="flex justify-end gap-4 border-t border-gray-100 pt-6">
            <Button
              variant="outline"
              onClick={() => router.push("/leaves")}
              className="bg-orange-700 hover:bg-orange-500 text-white"
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading} className="bg-cyan-900 hover:bg-cyan-700">
              {loading ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}