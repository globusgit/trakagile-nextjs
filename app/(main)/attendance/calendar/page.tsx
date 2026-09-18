"use client";

import PageHeader from "@/app/_components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { escapeCsvValue } from "@/lib/dashboardExport.mjs";

type AttendanceCell = {
  date: string;
  status: "PRESENT" | "ABSENT" | "HALF" | "WEEKEND" | "LEAVE" | "HOLIDAY";
  time?: string;
  worked?: string;
};

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

function dayKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AttendanceCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [records, setRecords] = useState<AttendanceCell[]>([]);
  const [loading, setLoading] = useState(true);

  const exportCsv = () => {
    const rows = [["Date", "Status", "Mark in", "Worked"], ...records.map((record) => [record.date, record.status, record.time, record.worked])];
    const url = URL.createObjectURL(new Blob([rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-calendar-${dayKey(currentMonth).slice(0, 7)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const month = `${currentMonth.getFullYear()}-${`${currentMonth.getMonth() + 1}`.padStart(2, "0")}`;
    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/attendance?month=${encodeURIComponent(month)}&mine=true&limit=100`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Unable to load attendance calendar.");
        setRecords(Array.isArray(result.data) ? result.data.map((entry: { attendanceDate: string; status: string; markIn?: { time?: string }; totalWorkedMinutes?: number }) => ({
          date: entry.attendanceDate,
          status: entry.markIn?.time ? "PRESENT" : "ABSENT",
          time: entry.markIn?.time ? new Date(entry.markIn.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined,
          worked: entry.totalWorkedMinutes ? `${Math.floor((entry.totalWorkedMinutes || 0) / 60)}h ${((entry.totalWorkedMinutes || 0) % 60)}m` : undefined,
        })) : []);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load attendance calendar.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [currentMonth]);

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const leadingDays = (monthStart.getDay() + 6) % 7;
    const totalCells = Math.ceil((leadingDays + monthEnd.getDate()) / 7) * 7;
    const cells: { date: Date; inMonth: boolean }[] = [];

    for (let index = 0; index < totalCells; index += 1) {
      const date = new Date(monthStart);
      date.setDate(1 - leadingDays + index);
      cells.push({ date, inMonth: date.getMonth() === currentMonth.getMonth() });
    }

    return cells;
  }, [currentMonth]);

  const recordMap = useMemo(() => {
    const map = new Map<string, AttendanceCell>();
    for (const record of records) if (record.date) map.set(record.date, record);
    return map;
  }, [records]);

  const statusTone: Record<AttendanceCell["status"], string> = {
    PRESENT: "bg-emerald-100 text-emerald-900 border-emerald-200",
    ABSENT: "bg-rose-100 text-rose-900 border-rose-200",
    HALF: "bg-amber-100 text-amber-900 border-amber-200",
    WEEKEND: "bg-slate-100 text-slate-600 border-slate-200",
    LEAVE: "bg-violet-100 text-violet-900 border-violet-200",
    HOLIDAY: "bg-cyan-100 text-cyan-900 border-cyan-200",
  };

  return (
    <div className="space-y-5 pb-10">
      <PageHeader title="Attendance Calendar" />

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[180px] text-center font-medium">{monthLabel(currentMonth)}</div>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Input type="month" value={`${currentMonth.getFullYear()}-${`${currentMonth.getMonth() + 1}`.padStart(2, "0")}`} onChange={(event) => {
              const [year, month] = event.target.value.split("-").map(Number);
              if (year && month) setCurrentMonth(new Date(year, month - 1, 1));
            }} />
            <Button variant="outline" onClick={exportCsv} disabled={loading || !records.length}><Download className="mr-2 h-4 w-4" />Export</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
              <div key={label} className="mb-1 font-medium">{label}</div>
            ))}

            {days.map(({ date, inMonth }, index) => {
              const key = dayKey(date);
              const record = recordMap.get(key);
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              const status = record?.status || (isWeekend ? "WEEKEND" : inMonth ? "ABSENT" : "WEEKEND");

              return (
                <div key={`${key}-${index}`} className={`min-h-[110px] rounded-xl border p-2 ${inMonth ? "bg-white" : "bg-slate-50/60 text-slate-400"}`}>
                  <div className="mb-2 flex items-center justify-between text-xs font-medium">
                    <span>{date.getDate()}</span>
                    {record && <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px]">{record.status}</span>}
                  </div>
                  <div className={`rounded-lg border px-2 py-1 text-[10px] ${statusTone[status]}`}>
                    {record ? record.time || "Present" : status === "WEEKEND" ? "Off" : "No record"}
                  </div>
                  {record?.worked && <div className="mt-2 text-[10px] text-slate-600">{record.worked}</div>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(statusTone).map(([key, tone]) => (
          <span key={key} className={`rounded-full border px-2 py-1 ${tone}`}>{key}</span>
        ))}
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading attendance calendar…</div>}
    </div>
  );
}
