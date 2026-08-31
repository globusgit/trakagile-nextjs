"use client";

import PageHeader from "@/app/_components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";

type LiveEmployee = {
  employee?: { name?: string; empId: string; photo?: string };
  attendance: { totalDistanceMeters?: number };
  location?: { latitude: number; longitude: number; accuracy?: number; speed?: number; locationName?: string; receivedAt: string };
  workStatus: { state: string; confidence: string; label: string; reason: string };
  triggerPoints?: Array<{ latitude: number; longitude: number; accuracy?: number; speed?: number; locationName?: string; capturedAt?: string; receivedAt: string }>;
};

export default function LiveTrackingPage() {
  const searchParams = useSearchParams();
  const requestedEmpId = searchParams.get("empId") || "";
  const [employees, setEmployees] = useState<LiveEmployee[]>([]);
  const [query, setQuery] = useState("");
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/attendance/live", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Unable to load live tracking.");
    setEmployees(result.employees || []);
  }, []);

  useEffect(() => {
    const refresh = () => { void load().catch(() => undefined); };
    const initial = window.setTimeout(() => { void load().catch((error) => toast.error(error.message)); }, 0);
    const timer = window.setInterval(refresh, 30_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [load]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return employees;
    return employees.filter((item) => item.employee?.name?.toLowerCase().includes(value) || item.employee?.empId.toLowerCase().includes(value));
  }, [employees, query]);
  const activeEmpId = selectedEmpId || requestedEmpId;
  const selected = employees.find((item) => item.employee?.empId === activeEmpId);

  return <div className="space-y-6 pb-10">
    <PageHeader title="Live Employee Tracking" />
    <p className="text-sm text-muted-foreground">Search by employee name or ID, then select one employee. Location refreshes every 30 seconds.</p>
    {employees.length === 0 ? <Card><CardContent className="py-10 text-center text-muted-foreground">No reporting employees are currently marked in.</CardContent></Card> :
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit"><CardHeader><CardTitle className="text-base">Active employees</CardTitle></CardHeader><CardContent className="space-y-3">
          <div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or employee ID" /></div>
          <p className="text-xs text-muted-foreground">{filtered.length} active employee(s)</p>
          <div className="max-h-[520px] space-y-2 overflow-y-auto">{filtered.map((item) => {
            const stale = item.workStatus.state !== "VERIFIED";
            return <button type="button" key={item.employee?.empId} onClick={() => setSelectedEmpId(item.employee?.empId || "")} className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted ${activeEmpId === item.employee?.empId ? "border-primary bg-muted" : ""}`}>
              <Image src={item.employee?.photo ? `/api/files/employees/${encodeURIComponent(item.employee.photo)}` : "/default-avatar.jpg"} alt={item.employee?.name || "Employee"} width={36} height={36} unoptimized className="size-9 shrink-0 rounded-full object-cover" /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{item.employee?.name || "Employee"}</span><span className="block text-xs text-muted-foreground">{item.employee?.empId}</span></span><Badge variant={stale ? "destructive" : "default"}>{item.workStatus.label}</Badge>
            </button>;
          })}{filtered.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No matching employee.</p>}</div>
        </CardContent></Card>
        {!selected ? <Card><CardContent className="flex min-h-80 flex-col items-center justify-center gap-3 text-center text-muted-foreground"><UserRound className="size-10" /><p>Search and select an employee to open individual tracking.</p></CardContent></Card> : <EmployeeMap item={selected} />}
      </div>}
  </div>;
}

function EmployeeMap({ item }: { item: LiveEmployee }) {
  const stale = item.workStatus.state !== "VERIFIED";
  const lat = item.location?.latitude; const lon = item.location?.longitude;
  return <Card><CardHeader><CardTitle className="flex items-center justify-between"><span>{item.employee?.name || item.employee?.empId}</span><Badge variant={stale ? "destructive" : "default"}>{item.workStatus.label}</Badge></CardTitle></CardHeader><CardContent className="space-y-4">
    <div className={`rounded-lg border p-3 text-sm ${stale ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50"}`}><p className="font-medium">Confidence: {item.workStatus.confidence}</p><p className="mt-1 text-muted-foreground">{item.workStatus.reason}</p></div>
    <div className="grid gap-3 text-sm sm:grid-cols-2"><Detail label="Employee ID" value={item.employee?.empId || "—"} /><Detail label="Last update" value={item.location ? new Date(item.location.receivedAt).toLocaleString() : "—"} /><Detail label="Location" value={item.location?.locationName || "Location name pending"} /><Detail label="Distance travelled" value={`${((item.attendance.totalDistanceMeters || 0) / 1000).toFixed(2)} km`} /><Detail label="Coordinates" value={`${lat?.toFixed(6) || "—"}, ${lon?.toFixed(6) || "—"}`} /><Detail label="Accuracy / speed" value={`${item.location?.accuracy ? `±${Math.round(item.location.accuracy)} m` : "—"} · ${item.location?.speed != null ? `${(item.location.speed * 3.6).toFixed(1)} km/h` : "—"}`} /></div>
    {lat != null && lon != null ? <iframe title={`Map for ${item.employee?.empId}`} className="h-[420px] w-full rounded-md border" loading="lazy" src={`https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.01}%2C${lat - 0.01}%2C${lon + 0.01}%2C${lat + 0.01}&layer=mapnik&marker=${lat}%2C${lon}`} /> : <div className="flex h-64 items-center justify-center rounded-md border text-muted-foreground">No location received.</div>}
    <div><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Recent trigger points</h3><Badge variant="secondary">{item.triggerPoints?.length || 0} points</Badge></div><div className="max-h-96 divide-y overflow-y-auto rounded-lg border">{item.triggerPoints?.map((point, index) => <div key={`${point.receivedAt}-${index}`} className="grid gap-1 p-3 text-sm sm:grid-cols-[10rem_1fr_auto]"><time className="font-medium">{new Date(point.capturedAt || point.receivedAt).toLocaleString("en-IN")}</time><span>{point.locationName || `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`}</span><span className="text-xs text-muted-foreground">{point.accuracy != null ? `±${Math.round(point.accuracy)} m` : "Accuracy unavailable"}</span></div>)}{!item.triggerPoints?.length && <p className="p-4 text-sm text-muted-foreground">No GPS trigger points received.</p>}</div></div>
  </CardContent></Card>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>;
}
