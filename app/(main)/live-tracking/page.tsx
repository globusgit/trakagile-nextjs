"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

import PageHeader from "@/app/_components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EmployeeLocation } from "../dashboard/EmployeeLocationMap";

const EmployeeLocationMap = dynamic(() => import("../dashboard/EmployeeLocationMap"), {
  ssr: false,
  loading: () => <div className="h-[calc(100vh-270px)] min-h-[560px] animate-pulse rounded-2xl bg-slate-900" />,
});

type Point = {
  latitude: number;
  longitude: number;
  capturedAt?: string;
  receivedAt?: string;
  locationName?: string;
  speed?: number | null;
  heading?: number | null;
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
    type: "TRACK" as const,
  }));
  const triggers = (item.triggerPoints || []).map((point) => ({
    latitude: point.latitude,
    longitude: point.longitude,
    capturedAt: point.capturedAt || point.receivedAt || latest.receivedAt,
    locationName: point.locationName || null,
    speed: point.speed,
    heading: point.heading,
    type: point.type === "MARK_IN" ? "MARK_IN" as const : "TRIGGER" as const,
  }));
  const route: EmployeeLocation["route"] = [...movement, ...triggers]
    .sort((first, second) => new Date(first.capturedAt).getTime() - new Date(second.capturedAt).getTime());
  route.push({
    latitude: latest.latitude,
    longitude: latest.longitude,
    capturedAt: latest.capturedAt || latest.receivedAt,
    locationName: latest.locationName || null,
    speed: latest.speed,
    heading: latest.heading,
    type: "LIVE",
  });

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
    totalDistanceMeters: item.attendance.totalDistanceMeters || 0,
    route,
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

  return <div className="space-y-4 pb-8">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div><PageHeader title="Team Live Map" /><p className="mt-1 text-sm text-muted-foreground">Monitor active employee routes, GPS freshness and today&apos;s movement.</p></div>
      <div className="flex gap-2">
        <div className="relative min-w-0 sm:w-80"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employee or location" className="pl-9" /></div>
        <Button variant="outline" onClick={() => void load(true)} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} /><span className="hidden sm:inline">Refresh</span></Button>
      </div>
    </div>
    <div className="overflow-hidden rounded-2xl border border-slate-800 shadow-2xl">
      <EmployeeLocationMap locations={filteredLocations} selectedEmpId={selectedEmpId} onSelectEmployee={chooseEmployee} />
    </div>
  </div>;
}
