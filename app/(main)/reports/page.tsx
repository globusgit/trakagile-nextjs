"use client";
import PageHeader from "@/app/_components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Download, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type Employee = { empId: string; name: string };
type Row = { id: string; employeeId: string; employeeName: string; date: string; status: string; markIn: string; markOut?: string; workedMinutes: number; overtimeMinutes: number; lateMinutes: number; earlyMinutes: number; attendanceType: string; distanceKm: number };
type Report = { employees: Employee[]; rows: Row[]; summary: { records: number; workedMinutes: number; overtimeMinutes: number; lateArrivals: number; earlyDepartures: number } };
const time = (value?: string) => value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
const hours = (minutes = 0) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

export default function ReportsPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [employeeId, setEmployeeId] = useState(""); const [report, setReport] = useState<Report | null>(null); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); try { const params = new URLSearchParams({ month }); if (employeeId) params.set("employeeId", employeeId); const response = await fetch(`/api/reports/attendance?${params}`, { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.message); setReport(result); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to load report."); } finally { setLoading(false); } }, [month, employeeId]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const download = () => { const params = new URLSearchParams({ month, format: "csv" }); if (employeeId) params.set("employeeId", employeeId); window.location.href = `/api/reports/attendance?${params}`; };
  return <div className="space-y-5 pb-10"><PageHeader title="Attendance Reports" />
    <Card><CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-end"><label className="text-sm">Month<Input className="mt-1" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label><label className="text-sm">Employee<select className="mt-1 h-8 min-w-56 rounded-lg border bg-background px-3" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="">All visible employees</option>{report?.employees.map((employee) => <option key={employee.empId} value={employee.empId}>{employee.name} ({employee.empId})</option>)}</select></label><Button variant="outline" onClick={load} disabled={loading}><RefreshCw /> Refresh</Button><Button onClick={download}><Download /> Download CSV</Button></CardContent></Card>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{[["Records", report?.summary.records || 0], ["Worked", hours(report?.summary.workedMinutes)], ["Late arrivals", report?.summary.lateArrivals || 0], ["Early departures", report?.summary.earlyDepartures || 0], ["Overtime", hours(report?.summary.overtimeMinutes)]].map(([label, value]) => <Card key={label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle className="text-base">Monthly attendance</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-240 text-sm"><thead><tr className="border-b text-left">{["Employee", "Date", "Mode", "Mark in", "Mark out", "Worked", "Late", "Early", "Overtime", "Distance"].map((heading) => <th key={heading} className="p-3 font-medium">{heading}</th>)}</tr></thead><tbody>{report?.rows.length ? report.rows.map((row) => <tr key={row.id} className="border-b"><td className="p-3"><b>{row.employeeName}</b><small className="block text-muted-foreground">{row.employeeId}</small></td><td className="p-3">{row.date}</td><td className="p-3">{row.attendanceType?.replaceAll("_", " ")}</td><td className="p-3">{time(row.markIn)}</td><td className="p-3">{time(row.markOut)}</td><td className="p-3">{hours(row.workedMinutes)}</td><td className="p-3">{row.lateMinutes ? `${row.lateMinutes}m` : "—"}</td><td className="p-3">{row.earlyMinutes ? `${row.earlyMinutes}m` : "—"}</td><td className="p-3">{row.overtimeMinutes ? `${row.overtimeMinutes}m` : "—"}</td><td className="p-3">{row.distanceKm} km</td></tr>) : <tr><td colSpan={10} className="p-10 text-center text-muted-foreground">{loading ? "Loading report..." : "No attendance records for this month."}</td></tr>}</tbody></table></CardContent></Card>
  </div>;
}
