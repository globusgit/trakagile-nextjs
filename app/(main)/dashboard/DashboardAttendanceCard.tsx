"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, Fingerprint, Loader2, LogOut, MapPin } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

type TodayAttendance = { status: "IN" | "OUT"; attendanceType?: string; markIn?: { time?: string; location?: { locationName?: string } }; markOut?: { time?: string }; totalWorkedMinutes?: number };

const clock = (value?: string) => value ? new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";

export default function DashboardAttendanceCard() {
  const [attendance, setAttendance] = useState<TodayAttendance | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { try { const response = await fetch("/api/attendance/today", { cache: "no-store" }); const body = await response.json(); if (response.ok) setAttendance(body.attendance || null); } finally { setLoading(false); } }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  if (loading) return <section className="flex min-h-36 items-center justify-center rounded-2xl border bg-white"><Loader2 className="size-6 animate-spin text-sky-600" /></section>;
  const active = attendance?.status === "IN";
  const completed = attendance?.status === "OUT";
  return <section className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm ${active ? "border-emerald-200 bg-emerald-50" : completed ? "border-sky-200 bg-sky-50" : "border-cyan-200 bg-white"}`}>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4"><span className={`grid size-12 shrink-0 place-items-center rounded-xl ${active ? "bg-emerald-600 text-white" : completed ? "bg-sky-600 text-white" : "bg-cyan-100 text-cyan-800"}`}>{active ? <Clock3 /> : completed ? <CheckCircle2 /> : <Fingerprint />}</span><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Today&apos;s attendance</p><h2 className="mt-1 text-xl font-bold text-slate-900">{active ? "You are on duty" : completed ? "Workday completed" : "Ready to start your workday"}</h2><p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">{active ? <><MapPin className="size-4" />{attendance.markIn?.location?.locationName || `Marked in at ${clock(attendance.markIn?.time)}`}</> : completed ? `Mark in ${clock(attendance.markIn?.time)} · Mark out ${clock(attendance.markOut?.time)}` : "GPS location will be captured securely."}</p></div></div>
      <Link href="/attendance" className={buttonVariants({ className: active ? "bg-red-600 hover:bg-red-700" : "bg-slate-950 hover:bg-slate-800" })}>{active ? <LogOut /> : <Fingerprint />}{active ? "Mark Out" : completed ? "View Summary" : "Mark In"}</Link>
    </div>
  </section>;
}
