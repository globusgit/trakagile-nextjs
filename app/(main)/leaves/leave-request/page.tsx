"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import React from "react";

// --- Validation schema ---
const leaveFormSchema = z.object({
  employeeName: z.string().min(1, "Employee name is required"),
  employeeId: z.string().min(1, "Employee ID is required"),
  department: z.string().min(1, "Department is required"),
  leaveType: z.enum(
    ["Annual", "Sick", "Casual", "Unpaid", "Other"],
    { message: "Please select a valid leave type" }
  ),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  totalDays: z.number().min(1, "Total days must be at least 1"),
  reason: z.string().min(1, "Reason is required").max(500, "Reason cannot exceed 500 characters"),
  contactDuringLeave: z.string().optional(),
  substituteEmployee: z.string().optional(),
});

type LeaveFormData = z.infer<typeof leaveFormSchema>;

export default function LeaveRequestPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<LeaveFormData>({
    resolver: zodResolver(leaveFormSchema),
    defaultValues: {
      employeeName: "",
      employeeId: "",
      department: "",
      leaveType: "Annual",
      startDate: "",
      endDate: "",
      totalDays: 1,
      reason: "",
      contactDuringLeave: "",
      substituteEmployee: "",
    },
  });

  const startDate = watch("startDate");
  const endDate = watch("endDate");

  // Auto-calculate total days when dates change
  React.useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive
        setValue("totalDays", diffDays);
      }
    }
  }, [startDate, endDate, setValue]);

  async function onSubmit(data: LeaveFormData) {
    setIsSubmitting(true);
    setSubmitStatus("idle");
    setErrorMessage(null);

    try {
      // TODO: Replace this with your real API call
      // Example:
      // const res = await fetch("/api/leaves", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify(data),
      // });
      // if (!res.ok) throw new Error("Failed to submit leave request");

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log("Leave request submitted:", data);
      setSubmitStatus("success");
    } catch (err) {
      console.error(err);
      setSubmitStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-blue-50 py-10">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Leave Request</h1>
        <p className="mb-6 text-sm text-gray-600">
          Fill in the details below to submit a new leave request. All fields marked with * are required.
        </p>

        {submitStatus === "success" && (
          <div className="mb-6 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Your leave request has been submitted successfully.
          </div>
        )}

        {submitStatus === "error" && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errorMessage || "Failed to submit leave request. Please try again."} 
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          {/* Employee Details */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-800">Employee Details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="employeeName" className="mb-1 block text-sm font-medium text-gray-700">
                  Employee Name *
                </label>
                <input
                  id="employeeName"
                  type="text"
                  className={`w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-blue-500 text-black ${
                    errors.employeeName ? "border-red-400" : "border-gray-300"
                  }`}
                  {...register("employeeName")}
                />
                {errors.employeeName && (
                  <p className="mt-1 text-xs text-red-600">{errors.employeeName.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="employeeId" className="mb-1 block text-sm font-medium text-gray-700">
                  Employee ID *
                </label>
                <input
                  id="employeeId"
                  type="text"
                  className={`w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-blue-500 text-black ${
                    errors.employeeId ? "border-red-400" : "border-gray-300"
                  }`}
                  {...register("employeeId")}
                />
                {errors.employeeId && (
                  <p className="mt-1 text-xs text-red-600">{errors.employeeId.message}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="department" className="mb-1 block text-sm font-medium text-gray-700">
                  Designation *
                </label>
                <input
                  id="department"
                  type="text"
                  className={`w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-blue-500 text-black ${
                    errors.department ? "border-red-400" : "border-gray-300"
                  }`}
                  {...register("department")}
                />
                {errors.department && (
                  <p className="mt-1 text-xs text-red-600">{errors.department.message}</p>
                )}
              </div>
            </div>
          </section>

          {/* Leave Details */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-800">Leave Details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="leaveType" className="mb-1 block text-sm font-medium text-gray-700">
                  Leave Type *
                </label>
                <select
                  id="leaveType"
                  className={`w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-blue-500 text-black ${
                    errors.leaveType ? "border-red-400" : "border-gray-300"
                  }`}
                  {...register("leaveType")}
                >
                  <option value="Annual">Annual Leave</option>
                  <option value="Sick">Sick Leave</option>
                  <option value="Casual">Casual Leave</option>
                  <option value="Unpaid">Unpaid Leave</option>
                  <option value="Other">Other</option>
                </select>
                {errors.leaveType && (
                  <p className="mt-1 text-xs text-red-600">{errors.leaveType.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="totalDays" className="mb-1 block text-sm font-medium text-gray-700">
                  Total Days *
                </label>
                <input
                  id="totalDays"
                  type="number"
                  min={1}
                  className={`w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-blue-500 text-black ${
                    errors.totalDays ? "border-red-400" : "border-gray-300"
                  }`}
                  {...register("totalDays", { valueAsNumber: true })}
                />
                {errors.totalDays && (
                  <p className="mt-1 text-xs text-red-600">{errors.totalDays.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="startDate" className="mb-1 block text-sm font-medium text-gray-700">
                  Start Date *
                </label>
                <input
                  id="startDate"
                  type="date"
                  className={`w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-blue-500 text-black ${
                    errors.startDate ? "border-red-400" : "border-gray-300"
                  }`}
                  {...register("startDate")}
                />
                {errors.startDate && (
                  <p className="mt-1 text-xs text-red-600">{errors.startDate.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="endDate" className="mb-1 block text-sm font-medium text-gray-700">
                  End Date *
                </label>
                <input
                  id="endDate"
                  type="date"
                  className={`w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-blue-500 text-black ${
                    errors.endDate ? "border-red-400" : "border-gray-300"
                  }`}
                  {...register("endDate")}
                />
                {errors.endDate && (
                  <p className="mt-1 text-xs text-red-600">{errors.endDate.message}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="reason" className="mb-1 block text-sm font-medium text-black">
                  Reason for Leave *
                </label>
                <textarea
                  id="reason"
                  rows={4}
                  className={`w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-blue-500 text-black ${
                    errors.reason ? "border-red-400" : "border-gray-300"
                  }`}
                  {...register("reason")}
                />
                {errors.reason && (
                  <p className="mt-1 text-xs text-red-600">{errors.reason.message}</p>
                )}
              </div>              
            </div>
          </section>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                // Optional: reset form
                // reset();
                setSubmitStatus("idle");
                setErrorMessage(null);
              }}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`rounded-md px-4 py-2 text-sm font-medium text-white transition ${
                isSubmitting ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isSubmitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}