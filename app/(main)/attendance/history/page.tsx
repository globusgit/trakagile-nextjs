"use client";

import PageHeader from "@/app/_components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Download, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { escapeCsvValue } from "@/lib/dashboardExport.mjs";

type HistoryItem = {
  empId: string;
  employeeName: string;
  attendanceDate: string;
  markIn: { time?: string };
  markOut?: { time?: string };
  status: string;
  totalWorkedMinutes?: number;
  totalBreakMinutes?: number;
  attendanceType?: string;
};

function formatTime(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatMinutes(value?: number) {
  if (!value) return "—";
  const total = Math.max(0, Number(value));
  return `${Math.floor(total / 60)}h ${total % 60}m`;
}

export default function AttendanceHistoryPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [records, setRecords] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
    try {
      const params = new URLSearchParams({ month, mine: "true", limit: "100" });
      const response = await fetch(`/api/attendance?${params}`, { cache: "no-store", signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to load attendance history.");
      if (!controller.signal.aborted) setRecords(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      if (!controller.signal.aborted) toast.error(error instanceof Error ? error.message : "Unable to load attendance history.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };
    void load();
    return () => controller.abort();
  }, [month, refresh]);

  const exportCsv = () => {
    const rows = [["Date", "Mode", "Mark in", "Mark out", "Status", "Worked minutes", "Break minutes"],
      ...records.map((record) => [record.attendanceDate, record.attendanceType, record.markIn?.time, record.markOut?.time, record.status, record.totalWorkedMinutes, record.totalBreakMinutes])];
    const url = URL.createObjectURL(new Blob([rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-${month}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 pb-10">
      <PageHeader title="My Attendance History" />

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-end">
          <label className="text-sm">Month
            <Input className="mt-1" type="month" value={month} onChange={(event) => { if (event.target.value) { setLoading(true); setMonth(event.target.value); } }} />
          </label>
          <Button variant="outline" onClick={() => { setLoading(true); setRefresh((value) => value + 1); }} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
          <Button onClick={exportCsv} disabled={loading || !records.length}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attendance log</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left">
                {['Date', 'Mode', 'Mark in', 'Mark out', 'Status', 'Worked', 'Break'].map((heading) => (
                  <th key={heading} className="p-3 font-medium">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.length ? records.map((record) => (
                <tr key={`${record.attendanceDate}-${record.empId}`} className="border-b align-top">
                  <td className="p-3">{record.attendanceDate}</td>
                  <td className="p-3">{record.attendanceType?.replaceAll("_", " ") || "Office"}</td>
                  <td className="p-3">{formatTime(record.markIn?.time)}</td>
                  <td className="p-3">{formatTime(record.markOut?.time)}</td>
                  <td className="p-3">{record.status}</td>
                  <td className="p-3">{formatMinutes(record.totalWorkedMinutes)}</td>
                  <td className="p-3">{formatMinutes(record.totalBreakMinutes)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-muted-foreground">{loading ? "Loading history..." : "No attendance records found for this month."}</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
