"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EmployeeLocation } from "../dashboard/EmployeeLocationMap";

const EmployeeLocationMap = dynamic(() => import("./LiveEmployeeMap"), {
  ssr: false,
  loading: () => <div className="h-[calc(100dvh-155px)] min-h-[620px] animate-pulse rounded-2xl bg-slate-200" />,
});

type Point = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  capturedAt?: string;
  receivedAt?: string;
  locationName?: string;
  speed?: number | null;
  heading?: number | null;
  minuteTrigger?: boolean;
  type?: "MARK_IN" | "LOCATION_TRIGGER";
};

type LiveEmployee = {
  employee?: { name?: string; empId: string; photo?: string; designation?: string };
  attendance: {
    attendanceDate?: string;
    totalDistanceMeters?: number;
    trackingStatus?: EmployeeLocation["trackingStatus"];
    markIn?: { time?: string };
  };
  location?: Point & { receivedAt: string };
  workStatus: { state: string; label: string };
  schedule?: { dispatchedAt?: string | null };
  triggerPoints?: Point[];
  movementPoints?: Point[];
  filteredDistanceMeters?: number;
};

function toMapLocation(item: LiveEmployee): EmployeeLocation | null {
  const employee = item.employee;
  const latest = item.location;
  if (!employee?.empId || latest?.latitude == null || latest?.longitude == null) return null;

  const movement = (item.movementPoints || []).map((point) => ({
    latitude: point.latitude,
    longitude: point.longitude,
    capturedAt: point.capturedAt || point.receivedAt || latest.receivedAt,
    locationName: point.locationName || null,
    speed: point.speed,
    heading: point.heading,
    accuracy: point.accuracy,
    type: "TRACK" as const,
  }));
  const triggers = (item.triggerPoints || []).map((point) => ({
    latitude: point.latitude,
    longitude: point.longitude,
    capturedAt: point.capturedAt || point.receivedAt || latest.receivedAt,
    locationName: point.locationName || null,
    speed: point.speed,
    heading: point.heading,
    accuracy: point.accuracy,
    type: point.type === "MARK_IN" ? "MARK_IN" as const : "TRIGGER" as const,
  }));
  // Minute and named trigger records are also present in movementPoints. Replace their
  // display type in-place so the route does not double back over duplicate data.
  const triggerKey = (point: { latitude: number; longitude: number; capturedAt: string }) =>
    `${point.latitude.toFixed(6)}:${point.longitude.toFixed(6)}:${new Date(point.capturedAt).getTime()}`;
  const triggerByKey = new Map(triggers.map((point) => [triggerKey(point), point]));
  const route: EmployeeLocation["route"] = movement.map((point) => triggerByKey.get(triggerKey(point)) || point);
  // Triggers are markers on the movement trail, never extra line vertices.
  route.sort((first, second) => new Date(first.capturedAt).getTime() - new Date(second.capturedAt).getTime());

  return {
    empId: employee.empId,
    name: employee.name || employee.empId,
    designation: employee.designation || "Employee",
    photo: employee.photo || null,
    latitude: latest.latitude,
    longitude: latest.longitude,
    locationName: latest.locationName || "Location name pending",
    receivedAt: latest.receivedAt,
    presentToday: true,
    attendanceDate: item.attendance.attendanceDate || new Date().toISOString().slice(0, 10),
    markInAt: item.schedule?.dispatchedAt || item.attendance.markIn?.time || null,
    markOutAt: null,
    attendanceStatus: "IN",
    trackingStatus: item.attendance.trackingStatus || (item.workStatus.state === "VERIFIED" ? "ACTIVE" : "DELAYED"),
    totalDistanceMeters: item.filteredDistanceMeters ?? item.attendance.totalDistanceMeters ?? 0,
    route,
    events: triggers,
    accuracy: latest.accuracy,
  };
}

export default function LiveTrackingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedEmpId = searchParams.get("empId") || "";
  const [employees, setEmployees] = useState<LiveEmployee[]>([]);
  const [query, setQuery] = useState("");
  const [selectedEmpId, setSelectedEmpId] = useState(requestedEmpId);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (notify = false) => {
    setLoading(true);
    try {
      const response = await fetch("/api/attendance/live", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to load live tracking.");
      setEmployees(result.employees || []);
      if (notify) toast.success("Live locations refreshed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load live tracking.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 30_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [load]);

  const locations = useMemo(() => employees.map(toMapLocation).filter((item): item is EmployeeLocation => Boolean(item)), [employees]);
  const filteredLocations = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return locations;
    return locations.filter((employee) => employee.name.toLowerCase().includes(value) || employee.empId.toLowerCase().includes(value) || employee.locationName.toLowerCase().includes(value));
  }, [locations, query]);

  const chooseEmployee = (empId: string) => {
    setSelectedEmpId(empId);
    router.replace(`/live-tracking?empId=${encodeURIComponent(empId)}`, { scroll: false });
  };

  return <div className="space-y-3 pb-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-xl font-bold tracking-tight text-slate-900">Live tracking</h1><p className="text-sm text-slate-500">Live routes, location triggers and GPS health</p></div>
      <div className="flex gap-2">
        <div className="relative min-w-0 sm:w-72"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employee or location" className="bg-white pl-9" /></div>
        <Button variant="outline" className="bg-white" onClick={() => void load(true)} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} /><span className="hidden sm:inline">Refresh</span></Button>
      </div>
    </div>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <EmployeeLocationMap locations={filteredLocations} selectedEmpId={selectedEmpId} onSelectEmployee={chooseEmployee} loading={loading} />
    </div>
  </div>;
}
