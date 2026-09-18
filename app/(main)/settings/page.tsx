"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/app/_components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarPlus, Globe2, MapPinned, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type GeofenceEntry = {
  enabled: boolean;
  name: string;
  latitude: string;
  longitude: string;
  radiusMeters: string;
  maximumAccuracyMeters: string;
};

const emptyGeofence = (): GeofenceEntry => ({
  enabled: false,
  name: "Main Office",
  latitude: "",
  longitude: "",
  radiusMeters: "300",
  maximumAccuracyMeters: "100",
});

export default function SettingsPage() {
  const router = useRouter();
  const nextYear = new Date().getFullYear() + 1;
  const [saving, setSaving] = useState(false);
  const [geofences, setGeofences] = useState<GeofenceEntry[]>([emptyGeofence()]);
  const [regional, setRegional] = useState({ timeZone: "Asia/Kolkata", locale: "en-IN", currency: "INR", countryCode: "IN", weekStartsOn: "1" });

  const updateGeofence = (index: number, field: keyof GeofenceEntry, value: string | boolean) => {
    setGeofences((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  };

  const addGeofence = () => setGeofences((current) => [...current, emptyGeofence()]);

  const removeGeofence = (index: number) => {
    setGeofences((current) => current.length === 1 ? [emptyGeofence()] : current.filter((_, itemIndex) => itemIndex !== index));
  };

  useEffect(() => {
    void fetch("/api/attendance/policy", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || "Unable to load attendance settings.");
        const policyGeofences = Array.isArray(body.data?.geofences) && body.data.geofences.length
          ? body.data.geofences
          : [body.data?.officeGeofence || emptyGeofence()];
        setGeofences(policyGeofences.map((item: Partial<Record<keyof GeofenceEntry, string | number | boolean>>) => ({
          enabled: item.enabled === true,
          name: String(item.name || "Main Office"),
          latitude: item.latitude == null ? "" : String(item.latitude),
          longitude: item.longitude == null ? "" : String(item.longitude),
          radiusMeters: String(item.radiusMeters ?? 300),
          maximumAccuracyMeters: String(item.maximumAccuracyMeters ?? 100),
        })));
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Unable to load attendance settings."));
  }, []);

  useEffect(() => { void fetch("/api/organization/settings", { cache: "no-store" }).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.message); setRegional({ ...body.settings, weekStartsOn: String(body.settings.weekStartsOn) }); }).catch((error) => toast.error(error instanceof Error ? error.message : "Unable to load regional settings.")); }, []);

  const saveRegional = async () => { setSaving(true); try { const response = await fetch("/api/organization/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...regional, weekStartsOn: Number(regional.weekStartsOn) }) }); const body = await response.json(); if (!response.ok) throw new Error(body.message || "Unable to save regional settings."); toast.success(body.message); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to save regional settings."); } finally { setSaving(false); } };

  const saveOffice = async () => {
    setSaving(true);
    try {
      const payload = geofences.map((geofence) => ({
        enabled: geofence.enabled,
        name: geofence.name || "Main Office",
        latitude: geofence.latitude === "" ? undefined : Number(geofence.latitude),
        longitude: geofence.longitude === "" ? undefined : Number(geofence.longitude),
        radiusMeters: Number(geofence.radiusMeters || 300),
        maximumAccuracyMeters: Number(geofence.maximumAccuracyMeters || 100),
      }));
      const response = await fetch("/api/attendance/policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geofences: payload }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Unable to save attendance locations.");
      toast.success(body.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save attendance locations.");
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
              <p className="text-xs text-gray-500 mt-1">Add holidays for {nextYear}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm sm:col-span-2 lg:col-span-2">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-emerald-50 p-3"><MapPinned className="h-6 w-6 text-emerald-800" /></div>
              <div>
                <p className="font-semibold">Attendance geofences</p>
                <p className="text-sm text-muted-foreground">Add one or more valid attendance zones. Mark-in is accepted when the device enters any enabled area.</p>
              </div>
            </div>

            {geofences.map((geofence, index) => (
              <div key={`${geofence.name}-${index}`} className="rounded-xl border bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={geofence.enabled} onChange={(event) => updateGeofence(index, "enabled", event.target.checked)} />Enable area</label>
                  {geofences.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeGeofence(index)} aria-label="Remove geofence">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Label>Geofence name<Input className="mt-1" value={geofence.name} onChange={(event) => updateGeofence(index, "name", event.target.value)} /></Label>
                  <Label>Allowed radius (metres)<Input className="mt-1" type="number" min="50" max="2000" value={geofence.radiusMeters} onChange={(event) => updateGeofence(index, "radiusMeters", event.target.value)} /></Label>
                  <Label>Latitude<Input className="mt-1" type="number" step="any" value={geofence.latitude} onChange={(event) => updateGeofence(index, "latitude", event.target.value)} /></Label>
                  <Label>Longitude<Input className="mt-1" type="number" step="any" value={geofence.longitude} onChange={(event) => updateGeofence(index, "longitude", event.target.value)} /></Label>
                  <Label className="sm:col-span-2">Maximum GPS error (metres)<Input className="mt-1" type="number" min="10" max="500" value={geofence.maximumAccuracyMeters} onChange={(event) => updateGeofence(index, "maximumAccuracyMeters", event.target.value)} /></Label>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={addGeofence}><Plus className="mr-2 h-4 w-4" />Add geofence</Button>
              <Button disabled={saving} onClick={() => void saveOffice()}>{saving ? "Saving..." : "Save geofences"}</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm sm:col-span-2 lg:col-span-3"><CardContent className="space-y-4 p-5"><div className="flex items-start gap-4"><div className="rounded-lg bg-violet-50 p-3"><Globe2 className="h-6 w-6 text-violet-800" /></div><div><p className="font-semibold">International and regional settings</p><p className="text-sm text-muted-foreground">Controls attendance dates and organization formatting. Use IANA timezone and ISO country/currency codes.</p></div></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Label>Time zone<Input className="mt-1" value={regional.timeZone} onChange={(event) => setRegional({ ...regional, timeZone: event.target.value })} /></Label><Label>Locale<Input className="mt-1" value={regional.locale} onChange={(event) => setRegional({ ...regional, locale: event.target.value })} /></Label><Label>Currency<Input className="mt-1" maxLength={3} value={regional.currency} onChange={(event) => setRegional({ ...regional, currency: event.target.value.toUpperCase() })} /></Label><Label>Country<Input className="mt-1" maxLength={2} value={regional.countryCode} onChange={(event) => setRegional({ ...regional, countryCode: event.target.value.toUpperCase() })} /></Label><Label>Week starts (0–6)<Input className="mt-1" type="number" min="0" max="6" value={regional.weekStartsOn} onChange={(event) => setRegional({ ...regional, weekStartsOn: event.target.value })} /></Label></div><Button disabled={saving} onClick={() => void saveRegional()}>{saving ? "Saving..." : "Save regional settings"}</Button></CardContent></Card>
      </div>
    </div>
  );
}
