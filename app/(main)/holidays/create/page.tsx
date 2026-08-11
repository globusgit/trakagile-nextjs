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

export default function CreateHoliday() {
  const router = useRouter();

  // TODO: replace with real orgId once auth/session is wired up
  const orgId = "ORG1";

  const [form, setForm] = useState({
    name: "",
    date: "",
    isRecurring: false,
    isOptional: false,
    year: new Date().getFullYear(),
    note: "",
  });

  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

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
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/holiday", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, orgId }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setServerError(
          typeof data === "string" ? data : data.error || "Failed to create holiday."
        );
        return;
      }

      router.push("/holidays");
      router.refresh();
    } catch (err) {
      console.error(err);
      setServerError("Something went wrong while saving the holiday.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 px-0 md:px-4 lg:px-8">
      <PageHeader title="Create Holiday" />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Holiday Information</CardTitle>
        </CardHeader>

        <CardContent className="space-y-8">
          {serverError && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
              {serverError}
            </div>
          )}

          {/* Row 1: Name spans wider, Date + Year share the rest */}
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
              <Input
                type="number"
                value={form.year}
                onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
              />
            </div>
          </div>

          {/* Row 2: Recurring + Optional toggles, side by side */}
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
                  Applies only to employees who choose to observe it (e.g. community/religious festivals)
                </p>
              </div>
            </div>
          </div>

          {/* Row 3: Note as a wide description-style textarea */}
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
              onClick={() => router.push("/holidays")}
              className="bg-orange-700 hover:bg-orange-500 text-white"
            >
              Cancel
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