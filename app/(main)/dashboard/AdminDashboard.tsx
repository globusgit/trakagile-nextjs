"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MapPin, Maximize2, Minimize2, RefreshCw, UserCheck, UserRoundX, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EmployeeLocation } from "./EmployeeLocationMap";

const EmployeeLocationMap = dynamic(() => import("./EmployeeLocationMap"), {
  ssr: false,
  loading: () => <div className="h-[620px] animate-pulse rounded-xl bg-slate-100" />,
});

type DashboardData = {
  date: string;
  summary: { totalEmployees: number; present: number; absent: number; located: number; noLocation: number };
  locations: EmployeeLocation[];
};

export default function AdminDashboard({ name, role }: { name: string; role: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [fullScreen, setFullScreen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/dashboard/admin", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Unable to load dashboard");
      setData(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 60_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [load]);

  useEffect(() => {
    document.body.style.overflow = fullScreen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [fullScreen]);

  const cards = [
    { label: "Total Employees", value: data?.summary.totalEmployees ?? 0, icon: UsersRound, color: "bg-blue-50 text-blue-700" },
    { label: "Present Today", value: data?.summary.present ?? 0, icon: UserCheck, color: "bg-emerald-50 text-emerald-700" },
    { label: "Absent Today", value: data?.summary.absent ?? 0, icon: UserRoundX, color: "bg-amber-50 text-amber-700" },
    { label: "Known Locations", value: data?.summary.located ?? 0, icon: MapPin, color: "bg-violet-50 text-violet-700" },
  ];

  const mapWorkspace = (
    <Card className={fullScreen ? "fixed inset-3 z-[1000] gap-0 overflow-hidden bg-white py-0 shadow-2xl" : "gap-0 overflow-hidden py-0"}>
      <CardHeader className="flex-row items-center justify-between border-b bg-white py-4">
        <div><CardTitle>Employee location workspace</CardTitle><p className="mt-1 text-sm text-muted-foreground">Movement trails show direction from mark-in to the latest GPS point.</p><div className="mt-2 flex flex-wrap gap-3 text-[11px] font-medium text-slate-600"><span className="flex items-center gap-1"><i className="size-2 rounded-full bg-green-600" />Mark In</span><span className="flex items-center gap-1"><i className="size-2 rounded-full bg-violet-600" />Triggered Location</span><span className="flex items-center gap-1"><i className="size-2 rounded-full bg-amber-500" />Live / Latest</span><span className="flex items-center gap-1"><i className="size-2 rounded-full bg-red-600" />Mark Out</span></div></div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:block">Refreshes every 60 sec</span>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} />Refresh</Button>
          <Button variant="outline" size="sm" onClick={() => setFullScreen((value) => !value)}>{fullScreen ? <Minimize2 /> : <Maximize2 />}{fullScreen ? "Exit full screen" : "Full map"}</Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-0 p-0 lg:grid-cols-[310px_minmax(0,1fr)]">
        <aside className={`border-r bg-slate-50 p-3 ${fullScreen ? "max-h-[calc(100vh-86px)]" : "max-h-[620px]"} overflow-y-auto`}>
          <div className="mb-3 flex items-center justify-between px-1"><p className="text-sm font-semibold">Employees</p><span className="rounded-full bg-cyan-100 px-2 py-1 text-xs font-semibold text-cyan-900">{data?.locations.length ?? 0} located</span></div>
          <div className="space-y-2">
            {(data?.locations ?? []).map((employee) => (
              <Link href={`/live-tracking?empId=${encodeURIComponent(employee.empId)}`} key={employee.empId} className="flex items-center gap-3 rounded-xl border bg-white p-3 shadow-xs transition hover:border-cyan-400 hover:bg-cyan-50">
                <span className={`rounded-full border-2 p-0.5 ${employee.presentToday ? "border-emerald-500" : "border-amber-500"}`}><Image src={employee.photo ? `/api/files/employees/${encodeURIComponent(employee.photo)}` : "/default-avatar.jpg"} alt={employee.name} width={40} height={40} unoptimized className="size-10 rounded-full object-cover" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{employee.name}</span><span className="block text-xs text-muted-foreground">{employee.empId}</span><span className="mt-1 flex items-center gap-1 truncate text-xs text-cyan-800"><MapPin className="size-3 shrink-0" />{employee.locationName}</span></span>
                <span className="text-xs font-semibold text-cyan-800">Track</span>
              </Link>
            ))}
            {!data?.locations.length && <p className="py-8 text-center text-sm text-muted-foreground">No locations received.</p>}
          </div>
        </aside>
        <div className="min-w-0 bg-slate-100 p-3"><EmployeeLocationMap locations={data?.locations ?? []} fullScreen={fullScreen} /></div>
      </CardContent>
    </Card>
  );

  return <div className="space-y-5 pb-10">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-sky-700">{role} OVERVIEW</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Welcome, {name}</h1><p className="mt-1 text-sm text-muted-foreground">Organization attendance and last-known employee locations.</p></div></div>
    {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, icon: Icon, color }) => <Card key={label}><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold">{loading && !data ? "—" : value}</p></div><span className={`grid size-12 place-items-center rounded-xl ${color}`}><Icon className="size-6" /></span></CardContent></Card>)}</div>
    {mapWorkspace}
  </div>;
}
