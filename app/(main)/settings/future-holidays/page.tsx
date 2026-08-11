"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/app/_components/PageHeader";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

export default function AddFutureHoliday() {
  const router = useRouter();

  // TODO: replace with real orgId once auth/session is wired up
  const orgId = "ORG1";

  // Locked to next year — this page exists specifically for planning
  // ahead, not for the current year (use the regular Create Holiday
  // page under /holidays/create for that).
  const targetYear = new Date().getFullYear() + 1;

  const [form, setForm] = useState({
    name: "",
    date: "",
    isRecurring: false,
    isOptional: false,
    note: "",
  });

  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success">("idle");

  const validate = () => {
    const newErrors: Record<string, boolean> = {
      name: !form.name.trim(),
      date: !form.date,
    };
    setErrors(newErrors);
    return !Object.values(newErrors).some(Boolean);
  };

  const handleSubmit = async () => {
    setServerError("");
    setSubmitStatus("idle");
    if (!validate()) return;

    // Safety check: the date picked must actually fall within the target year
    const pickedYear = new Date(form.date).getFullYear();
    if (pickedYear !== targetYear) {
      setServerError(
        `The selected date must be in ${targetYear} — you picked a date in ${pickedYear}.`
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/holiday", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, year: targetYear, orgId }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setServerError(
          typeof data === "string" ? data : data.error || "Failed to create holiday."
        );
        return;
      }

      setSubmitStatus("success");
      setForm({ name: "", date: "", isRecurring: false, isOptional: false, note: "" });
    } catch (err) {
      console.error(err);
      setServerError("Something went wrong while saving the holiday.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 px-0 md:px-4 lg:px-8">
      <PageHeader title={`Add Holidays for ${targetYear}`} />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Future Holiday</CardTitle>
        </CardHeader>

        <CardContent className="space-y-8">
          {serverError && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
              {serverError}
            </div>
          )}

          {submitStatus === "success" && (
            <div className="rounded-md bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3">
              Holiday added for {targetYear}. You can add another below, or go back to Settings.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-2 space-y-2">
              <Label>Holiday Name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. New Year's Day"
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value });
                  if (errors.name) setErrors({ ...errors, name: false });
                }}
                className={errors.name ? "border-red-500" : ""}
              />
              {errors.name && <p className="text-red-500 text-xs">* This is Mandatory</p>}
            </div>

            <div className="space-y-2">
              <Label>Date <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                min={`${targetYear}-01-01`}
                max={`${targetYear}-12-31`}
                value={form.date}
                onChange={(e) => {
                  setForm({ ...form, date: e.target.value });
                  if (errors.date) setErrors({ ...errors, date: false });
                }}
                className={errors.date ? "border-red-500" : ""}
              />
              {errors.date && <p className="text-red-500 text-xs">* This is Mandatory</p>}
            </div>

            <div className="space-y-2">
              <Label>Year</Label>
              <Input value={targetYear} disabled className="bg-gray-50" />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 w-fit">
              <Checkbox
                checked={form.isRecurring}
                onCheckedChange={(checked) =>
                  setForm({ ...form, isRecurring: checked === true })
                }
                className="border-2 border-gray-500 data-[state=checked]:border-cyan-900 data-[state=checked]:bg-cyan-900"
              />
              <div>
                <Label className="cursor-pointer">Recurring every year</Label>
                <p className="text-xs text-gray-500">
                  This holiday repeats annually on the same date
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 w-fit">
              <Checkbox
                checked={form.isOptional}
                onCheckedChange={(checked) =>
                  setForm({ ...form, isOptional: checked === true })
                }
                className="border-2 border-gray-500 data-[state=checked]:border-cyan-900 data-[state=checked]:bg-cyan-900"
              />
              <div>
                <Label className="cursor-pointer">Optional holiday</Label>
                <p className="text-xs text-gray-500">
                  Applies only to employees who choose to observe it
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Note</Label>
            <Textarea
              placeholder="Add any additional details about this holiday..."
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              rows={4}
              className="w-full resize-none"
            />
          </div>

          <div className="flex justify-end gap-4 border-t border-gray-100 pt-6">
            <Button
              variant="outline"
              onClick={() => router.push("/settings")}
              className="bg-orange-700 hover:bg-orange-500 text-white"
            >
              Back to Settings
            </Button>
            <Button onClick={handleSubmit} disabled={loading} className="bg-cyan-900 hover:bg-cyan-700">
              {loading ? "Saving..." : "Save Holiday"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}