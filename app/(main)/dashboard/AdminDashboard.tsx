"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, ListTodo, Maximize2, Minimize2, RefreshCw, UserCheck, UserRoundX, UsersRound, MapPin } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildAttendanceCsv } from "@/lib/dashboardExport.mjs";
import type { EmployeeLocation } from "./EmployeeLocationMap";
import DashboardAttendanceCard from "./DashboardAttendanceCard";

const EmployeeLocationMap = dynamic(() => import("./EmployeeLocationMap"), { ssr: false, loading: () => <div className="h-[620px] animate-pulse rounded-xl bg-slate-100" /> });
type EmployeeSummary = { empId: string; name: string; designation: string; photo?: string | null; presentToday: boolean; located: boolean };
type DashboardData = { date: string; summary: { totalEmployees: number; present: number; absent: number; located: number; noLocation: number }; employees: EmployeeSummary[]; locations: EmployeeLocation[] };
type CardFilter = "TOTAL" | "PRESENT" | "ABSENT" | "LOCATED";

export default function AdminDashboard({ name, role }: { name: string; role: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [fullScreen, setFullScreen] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [cardFilter, setCardFilter] = useState<CardFilter | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [employeeSearch, setEmployeeSearch] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { const response = await fetch(`/api/dashboard/admin?date=${encodeURIComponent(selectedDate)}`, { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.message || "Unable to load dashboard"); setData(body); } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard"); } finally { setLoading(false); } }, [selectedDate]);
  useEffect(() => { const initial = window.setTimeout(() => void load(), 0); const timer = window.setInterval(() => void load(), 15_000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, [load]);
  useEffect(() => { document.body.style.overflow = fullScreen ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [fullScreen]);
  const cards = [
    { filter: "TOTAL" as const, label: "Total Employees", value: data?.summary.totalEmployees ?? 0, icon: UsersRound, color: "bg-blue-50 text-blue-700" },
    { filter: "PRESENT" as const, label: "Present Today", value: data?.summary.present ?? 0, icon: UserCheck, color: "bg-emerald-50 text-emerald-700" },
    { filter: "ABSENT" as const, label: "Absent Today", value: data?.summary.absent ?? 0, icon: UserRoundX, color: "bg-amber-50 text-amber-700" },
    { filter: "LOCATED" as const, label: "Known Locations", value: data?.summary.located ?? 0, icon: MapPin, color: "bg-violet-50 text-violet-700" },
  ];
  const cardEmployees = useMemo(() => (data?.employees ?? []).filter((employee) => {
    const matchesFilter = cardFilter === "PRESENT" ? employee.presentToday : cardFilter === "ABSENT" ? !employee.presentToday : cardFilter === "LOCATED" ? employee.located : true;
    if (!matchesFilter) return false;
    const query = employeeSearch.trim().toLowerCase();
    if (!query) return true;
    return [employee.name, employee.empId, employee.designation].some((value) => value?.toLowerCase().includes(query));
  }), [cardFilter, data?.employees, employeeSearch]);
  const absentEmployees = useMemo(() => (data?.employees ?? []).filter((employee) => !employee.presentToday).slice(0, 5), [data?.employees]);
  const noLocationEmployees = useMemo(() => (data?.employees ?? []).filter((employee) => !employee.located && !employee.presentToday).slice(0, 5), [data?.employees]);

  const exportAttendanceCsv = useCallback(() => {
    if (!data) return;

    const rows = data.employees.map((employee) => {
      const location = data.locations.find((item) => item.empId === employee.empId);
      const status = employee.presentToday ? "Present" : "Absent";
      return {
        empId: employee.empId,
        name: employee.name,
        designation: employee.designation,
        status,
        locationName: location?.locationName ?? "",
        markInAt: location?.markInAt ? new Date(location.markInAt).toISOString() : "",
        markOutAt: location?.markOutAt ? new Date(location.markOutAt).toISOString() : "",
        distanceMeters: location?.totalDistanceMeters ?? 0,
      };
    });

    const csv = buildAttendanceCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `attendance-dashboard-${data.date || "today"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [data]);

  return <div className="space-y-5 pb-10">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-sky-700">{role} OVERVIEW</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Welcome, {name}</h1><p className="mt-1 text-sm text-muted-foreground">Organization attendance, team locations and task progress.</p></div><div className="flex items-center gap-2"><Button type="button" variant="outline" onClick={exportAttendanceCsv} disabled={!data}><Download className="size-4" />Export CSV</Button><Link href="/tasks" className={buttonVariants()}><ListTodo />Open Tasks</Link></div></div>
    <Card>
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-700">Attendance snapshot</p>
          <p className="text-xs text-muted-foreground">Review attendance and locations for a selected day.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          Date
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value || new Date().toISOString().slice(0, 10))}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-cyan-500 focus:outline-none"
          />
        </label>
      </CardContent>
    </Card>
    {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {(absentEmployees.length > 0 || noLocationEmployees.length > 0) && (
      <Card className="border-amber-200 bg-amber-50/70">
        <CardContent className="space-y-2 p-3">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="size-4" />
            <p className="text-sm font-semibold">Attention</p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-lg border border-amber-200 bg-white/60 p-2">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700">Absent today</p>
              <div className="space-y-1 text-sm text-amber-900">
                {absentEmployees.length ? absentEmployees.slice(0, 4).map((employee) => (
                  <div key={employee.empId} className="flex items-center justify-between rounded-md bg-amber-50 px-2 py-1 text-xs">
                    <span className="truncate pr-2">{employee.name}</span>
                    <span className="shrink-0 font-medium text-amber-700">{employee.empId}</span>
                  </div>
                )) : <div className="text-xs text-amber-700">No absent employees.</div>}
                {absentEmployees.length > 4 && <div className="text-[10px] font-medium text-amber-700">+{absentEmployees.length - 4} more</div>}
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-white/60 p-2">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700">No live location</p>
              <div className="space-y-1 text-sm text-amber-900">
                {noLocationEmployees.length ? noLocationEmployees.slice(0, 4).map((employee) => (
                  <div key={employee.empId} className="flex items-center justify-between rounded-md bg-amber-50 px-2 py-1 text-xs">
                    <span className="truncate pr-2">{employee.name}</span>
                    <span className="shrink-0 font-medium text-amber-700">{employee.empId}</span>
                  </div>
                )) : <div className="text-xs text-amber-700">All present employees have location data.</div>}
                {noLocationEmployees.length > 4 && <div className="text-[10px] font-medium text-amber-700">+{noLocationEmployees.length - 4} more</div>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )}
    <DashboardAttendanceCard />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ filter, label, value, icon: Icon, color }) => <button type="button" key={label} onClick={() => setCardFilter(filter)} className="rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"><Card className="h-full transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md"><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold">{loading && !data ? "—" : value}</p><p className="mt-2 text-xs font-semibold text-cyan-800">View employees</p></div><span className={`grid size-12 place-items-center rounded-xl ${color}`}><Icon className="size-6" /></span></CardContent></Card></button>)}</div>
    <Card className={fullScreen ? "fixed inset-3 z-[1000] gap-0 overflow-hidden bg-white py-0 shadow-2xl" : "gap-0 overflow-hidden py-0"}>
      <CardHeader className="flex-row items-center justify-between border-b bg-white py-4"><div><CardTitle>Present employee live map</CardTitle><p className="mt-1 text-sm text-muted-foreground">Select an employee to show mark-in, five-minute GPS updates, triggers and live position.</p><div className="mt-2 flex flex-wrap gap-3 text-[11px] font-medium text-slate-600"><span>🟢 Mark in</span><span>🟣 Trigger</span><span>🟠 Live/latest</span><span>🔴 Mark out</span></div></div><div className="flex items-center gap-2"><span className="hidden text-xs text-muted-foreground sm:block">GPS every 5 min · Map refresh every 15 sec</span><Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} />Refresh</Button><Button variant="outline" size="sm" onClick={() => setFullScreen((value) => !value)}>{fullScreen ? <Minimize2 /> : <Maximize2 />}{fullScreen ? "Exit" : "Full map"}</Button></div></CardHeader>
      <CardContent className="min-w-0 bg-slate-950 p-0"><EmployeeLocationMap locations={data?.locations ?? []} fullScreen={fullScreen} selectedEmpId={selectedEmpId} onSelectEmployee={setSelectedEmpId} /></CardContent>
    </Card>
    <Dialog open={cardFilter !== null} onOpenChange={(open) => { if (!open) { setCardFilter(null); setEmployeeSearch(""); } }}><DialogContent overlayClassName="z-[2000]" className="z-[2001] max-h-[80vh] overflow-hidden sm:max-w-2xl"><DialogHeader><DialogTitle>{cards.find((card) => card.filter === cardFilter)?.label || "Employees"} ({cardEmployees.length})</DialogTitle></DialogHeader><div className="space-y-3"><div className="flex items-center gap-2 rounded-lg border bg-slate-50 px-3 py-2"><input value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder="Search by name, ID or role" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" /><button type="button" className="text-xs font-medium text-slate-500 hover:text-slate-700" onClick={() => setEmployeeSearch("")}>Clear</button></div><div className="max-h-[58vh] space-y-2 overflow-y-auto pr-1">{cardEmployees.map((employee) => { const location = data?.locations.find((item) => item.empId === employee.empId); return <button type="button" key={employee.empId} onClick={() => { setCardFilter(null); setEmployeeSearch(""); if (location) setSelectedEmpId(employee.empId); }} className="flex w-full items-center gap-3 rounded-xl border p-3 text-left hover:border-cyan-400 hover:bg-cyan-50"><Image src={employee.photo ? `/api/files/employees/${encodeURIComponent(employee.photo)}` : "/default-avatar.jpg"} alt={employee.name} width={42} height={42} unoptimized className="size-11 rounded-full object-cover" /><span className="min-w-0 flex-1"><span className="block font-semibold">{employee.name}</span><span className="block text-xs text-muted-foreground">{employee.empId} · {employee.designation}</span>{location && <span className="mt-1 block truncate text-xs text-cyan-800">{location.locationName}</span>}</span><span className={`rounded-full px-2 py-1 text-xs font-semibold ${employee.presentToday ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{employee.presentToday ? "Present" : "Absent"}</span></button>; })}{!cardEmployees.length && <p className="py-10 text-center text-muted-foreground">No employees match this search in this category.</p>}</div></div></DialogContent></Dialog>
  </div>;
}
