"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import PageHeader from "@/app/_components/PageHeader";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

// Roles allowed to create/manage holidays — keep in sync with
// HOLIDAY_MANAGE_ROLES in app/api/holiday/[id]/route.js
const HOLIDAY_MANAGE_ROLES = ["ADMIN", "DIRECTOR", "MANAGER"];

const toDateInputValue = (dateStr: string) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

export default function EditHoliday() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const holidayId = params?.id as string;
  const { data: session, status } = useSession();

  const canManageHolidays = HOLIDAY_MANAGE_ROLES.includes(session?.user?.role ?? "");

  useEffect(() => {
    if (status === "authenticated" && !canManageHolidays) {
      router.replace("/holidays");
    }
  }, [status, canManageHolidays, router]);

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
  const [fetching, setFetching] = useState(true);
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    if (!holidayId || !canManageHolidays) return;

    (async () => {
      setFetching(true);
      setServerError("");
      try {
        const res = await fetch(`/api/holiday/${holidayId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setServerError(typeof data === "string" ? data : data.message || "Failed to load holiday.");
          return;
        }
        setForm({
          name: data.name ?? "",
          date: toDateInputValue(data.date),
          isRecurring: !!data.isRecurring,
          isOptional: !!data.isOptional,
          year: data.year ?? new Date().getFullYear(),
          note: data.note ?? "",
        });
      } catch (err) {
        console.error(err);
        setServerError("Something went wrong while loading the holiday.");
      } finally {
        setFetching(false);
      }
    })();
  }, [holidayId, canManageHolidays]);

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
      const res = await fetch(`/api/holiday/${holidayId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setServerError(typeof data === "string" ? data : data.message || "Failed to update holiday.");
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

  if (status === "loading" || (status === "authenticated" && !canManageHolidays) || fetching) {
    return (
      <div className="space-y-4 px-0 md:px-4 lg:px-8">
        <PageHeader title="Edit Holiday" />
      </div>
    );
  }

  return (
    <div className="space-y-4 px-0 md:px-4 lg:px-8">
      <PageHeader title="Edit Holiday" />

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

          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 w-fit">
              <Checkbox
                checked={form.isRecurring}
                onCheckedChange={(checked) => setForm({ ...form, isRecurring: checked === true })}
                className="border-2 border-gray-500 data-[state=checked]:border-cyan-900 data-[state=checked]:bg-cyan-900"
              />
              <div>
                <Label className="cursor-pointer">Recurring every year</Label>
                <p className="text-xs text-gray-500">This holiday repeats annually on the same date</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 w-fit">
              <Checkbox
                checked={form.isOptional}
                onCheckedChange={(checked) => setForm({ ...form, isOptional: checked === true })}
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
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}