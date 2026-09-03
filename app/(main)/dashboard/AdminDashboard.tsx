"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ListTodo, Maximize2, Minimize2, RefreshCw, UserCheck, UserRoundX, UsersRound, MapPin } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EmployeeLocation } from "./EmployeeLocationMap";

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
  const load = useCallback(async () => { setLoading(true); setError(""); try { const response = await fetch("/api/dashboard/admin", { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.message || "Unable to load dashboard"); setData(body); } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard"); } finally { setLoading(false); } }, []);
  useEffect(() => { const initial = window.setTimeout(() => void load(), 0); const timer = window.setInterval(() => void load(), 60_000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, [load]);
  useEffect(() => { document.body.style.overflow = fullScreen ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [fullScreen]);
  const cards = [
    { filter: "TOTAL" as const, label: "Total Employees", value: data?.summary.totalEmployees ?? 0, icon: UsersRound, color: "bg-blue-50 text-blue-700" },
    { filter: "PRESENT" as const, label: "Present Today", value: data?.summary.present ?? 0, icon: UserCheck, color: "bg-emerald-50 text-emerald-700" },
    { filter: "ABSENT" as const, label: "Absent Today", value: data?.summary.absent ?? 0, icon: UserRoundX, color: "bg-amber-50 text-amber-700" },
    { filter: "LOCATED" as const, label: "Known Locations", value: data?.summary.located ?? 0, icon: MapPin, color: "bg-violet-50 text-violet-700" },
  ];
  const cardEmployees = useMemo(() => (data?.employees ?? []).filter((employee) => cardFilter === "PRESENT" ? employee.presentToday : cardFilter === "ABSENT" ? !employee.presentToday : cardFilter === "LOCATED" ? employee.located : true), [cardFilter, data?.employees]);

  return <div className="space-y-5 pb-10">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-sky-700">{role} OVERVIEW</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Welcome, {name}</h1><p className="mt-1 text-sm text-muted-foreground">Organization attendance, team locations and task progress.</p></div><Link href="/tasks" className={buttonVariants()}><ListTodo />Open Tasks</Link></div>
    {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ filter, label, value, icon: Icon, color }) => <button type="button" key={label} onClick={() => setCardFilter(filter)} className="rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"><Card className="h-full transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md"><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold">{loading && !data ? "—" : value}</p><p className="mt-2 text-xs font-semibold text-cyan-800">View employees</p></div><span className={`grid size-12 place-items-center rounded-xl ${color}`}><Icon className="size-6" /></span></CardContent></Card></button>)}</div>
    <Card className={fullScreen ? "fixed inset-3 z-[1000] gap-0 overflow-hidden bg-white py-0 shadow-2xl" : "gap-0 overflow-hidden py-0"}>
      <CardHeader className="flex-row items-center justify-between border-b bg-white py-4"><div><CardTitle>Present employee live map</CardTitle><p className="mt-1 text-sm text-muted-foreground">Select an employee to show mark-in, minute GPS trail, triggers and live position.</p><div className="mt-2 flex flex-wrap gap-3 text-[11px] font-medium text-slate-600"><span>🟢 Mark in</span><span>🟣 Trigger</span><span>🟠 Live/latest</span><span>🔴 Mark out</span></div></div><div className="flex items-center gap-2"><span className="hidden text-xs text-muted-foreground sm:block">Refreshes every minute</span><Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} />Refresh</Button><Button variant="outline" size="sm" onClick={() => setFullScreen((value) => !value)}>{fullScreen ? <Minimize2 /> : <Maximize2 />}{fullScreen ? "Exit" : "Full map"}</Button></div></CardHeader>
      <CardContent className="min-w-0 bg-slate-950 p-0"><EmployeeLocationMap locations={data?.locations ?? []} fullScreen={fullScreen} selectedEmpId={selectedEmpId} onSelectEmployee={setSelectedEmpId} /></CardContent>
    </Card>
    <Dialog open={cardFilter !== null} onOpenChange={(open) => { if (!open) setCardFilter(null); }}><DialogContent className="max-h-[80vh] overflow-hidden sm:max-w-2xl"><DialogHeader><DialogTitle>{cards.find((card) => card.filter === cardFilter)?.label || "Employees"} ({cardEmployees.length})</DialogTitle></DialogHeader><div className="max-h-[62vh] space-y-2 overflow-y-auto pr-1">{cardEmployees.map((employee) => { const location = data?.locations.find((item) => item.empId === employee.empId); return <button type="button" key={employee.empId} onClick={() => { setCardFilter(null); if (location) setSelectedEmpId(employee.empId); }} className="flex w-full items-center gap-3 rounded-xl border p-3 text-left hover:border-cyan-400 hover:bg-cyan-50"><Image src={employee.photo ? `/api/files/employees/${encodeURIComponent(employee.photo)}` : "/default-avatar.jpg"} alt={employee.name} width={42} height={42} unoptimized className="size-11 rounded-full object-cover" /><span className="min-w-0 flex-1"><span className="block font-semibold">{employee.name}</span><span className="block text-xs text-muted-foreground">{employee.empId} · {employee.designation}</span>{location && <span className="mt-1 block truncate text-xs text-cyan-800">{location.locationName}</span>}</span><span className={`rounded-full px-2 py-1 text-xs font-semibold ${employee.presentToday ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{employee.presentToday ? "Present" : "Absent"}</span></button>; })}{!cardEmployees.length && <p className="py-10 text-center text-muted-foreground">No employees in this category.</p>}</div></DialogContent></Dialog>
  </div>;
}
