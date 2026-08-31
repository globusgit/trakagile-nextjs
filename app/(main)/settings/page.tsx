"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/app/_components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarPlus, MapPinned } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const router = useRouter();
  const nextYear = new Date().getFullYear() + 1;
  const [saving, setSaving] = useState(false);
  const [office, setOffice] = useState({ enabled: false, name: "Main Office", latitude: "", longitude: "", radiusMeters: "300", maximumAccuracyMeters: "100" });

  useEffect(() => {
    void fetch("/api/attendance/policy", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || "Unable to load attendance settings.");
        const value = body.data?.officeGeofence || {};
        setOffice({
          enabled: value.enabled === true,
          name: value.name || "Main Office",
          latitude: value.latitude == null ? "" : String(value.latitude),
          longitude: value.longitude == null ? "" : String(value.longitude),
          radiusMeters: String(value.radiusMeters || 300),
          maximumAccuracyMeters: String(value.maximumAccuracyMeters || 100),
        });
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Unable to load attendance settings."));
  }, []);

  const saveOffice = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/attendance/policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ officeGeofence: office }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Unable to save office location.");
      toast.success(body.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save office location.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 px-0 md:px-4 lg:px-8">
      <PageHeader title="Settings" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card
          onClick={() => router.push("/settings/future-holidays")}
          className="shadow-sm cursor-pointer hover:shadow-md hover:border-cyan-700 transition"
        >
          <CardContent className="p-5 flex items-start gap-4">
            <div className="rounded-lg bg-cyan-50 p-3">
              <CalendarPlus className="h-6 w-6 text-cyan-900" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Future Holidays</p>
              <p className="text-xs text-gray-500 mt-1">
                Add holidays for {nextYear}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm sm:col-span-2 lg:col-span-2">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-emerald-50 p-3"><MapPinned className="h-6 w-6 text-emerald-800" /></div>
              <div><p className="font-semibold">Office attendance area</p><p className="text-sm text-muted-foreground">Office mark-in is accepted only inside this radius. Keep disabled until coordinates are verified.</p></div>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={office.enabled} onChange={(event) => setOffice({ ...office, enabled: event.target.checked })} />Enable office geofence</label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Label>Office name<Input className="mt-1" value={office.name} onChange={(event) => setOffice({ ...office, name: event.target.value })} /></Label>
              <Label>Allowed radius (metres)<Input className="mt-1" type="number" min="50" max="2000" value={office.radiusMeters} onChange={(event) => setOffice({ ...office, radiusMeters: event.target.value })} /></Label>
              <Label>Latitude<Input className="mt-1" type="number" step="any" value={office.latitude} onChange={(event) => setOffice({ ...office, latitude: event.target.value })} /></Label>
              <Label>Longitude<Input className="mt-1" type="number" step="any" value={office.longitude} onChange={(event) => setOffice({ ...office, longitude: event.target.value })} /></Label>
              <Label>Maximum GPS error (metres)<Input className="mt-1" type="number" min="10" max="500" value={office.maximumAccuracyMeters} onChange={(event) => setOffice({ ...office, maximumAccuracyMeters: event.target.value })} /></Label>
            </div>
            <Button disabled={saving} onClick={() => void saveOffice()}>{saving ? "Saving..." : "Save attendance area"}</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
