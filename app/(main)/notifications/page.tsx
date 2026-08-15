"use client";

import PageHeader from "@/app/_components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Bell, Check, ExternalLink, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Notice = { _id: string; title: string; message: string; employeeEmpId: string; type: string; createdAt: string; readAt?: string };
type Filter = "ALL" | "UNREAD" | "ATTENDANCE" | "TRIPS" | "WFH" | "DEVICE";
const tripTypes = new Set(["TRAVEL_STARTED", "SITE_REACHED", "VISIT_COMPLETED", "HOTEL_CHECK_IN", "HOTEL_CHECK_OUT", "TRIP_COMPLETED", "EXPENSE_SUBMITTED"]);
const attendanceTypes = new Set(["LOCATION_STALE", "POSSIBLE_DELAY", "ATTENDANCE_COMPLETED"]);
const wfhTypes = new Set(["WFH_REQUEST", "WFH_REVIEWED"]);
const deviceTypes = new Set(["DEVICE_CHANGE_REQUEST", "DEVICE_CHANGE_REVIEWED"]);

function relatedPage(type: string) {
  if (wfhTypes.has(type) || deviceTypes.has(type)) return "/work-from-home";
  if (tripTypes.has(type)) return "/field-trips";
  return "/attendance";
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Notice[]>([]); const [unreadCount, setUnreadCount] = useState(0); const [filter, setFilter] = useState<Filter>("ALL"); const [query, setQuery] = useState("");
  const load = useCallback(async () => { const response = await fetch("/api/notifications", { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.message || "Unable to load notifications."); setItems(result.notifications || []); setUnreadCount(result.unreadCount || 0); }, []);
  useEffect(() => { const initial = window.setTimeout(() => void load().catch((error) => toast.error(error.message)), 0); const timer = window.setInterval(() => void load().catch(() => undefined), 30_000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, [load]);
  const filtered = useMemo(() => items.filter((item) => {
    const categoryMatch = filter === "ALL" || (filter === "UNREAD" && !item.readAt) || (filter === "ATTENDANCE" && attendanceTypes.has(item.type)) || (filter === "TRIPS" && tripTypes.has(item.type)) || (filter === "WFH" && wfhTypes.has(item.type)) || (filter === "DEVICE" && deviceTypes.has(item.type));
    const value = query.trim().toLowerCase(); const searchMatch = !value || item.employeeEmpId.toLowerCase().includes(value) || item.title.toLowerCase().includes(value) || item.message.toLowerCase().includes(value);
    return categoryMatch && searchMatch;
  }), [items, filter, query]);

  const markRead = async (id?: string) => { const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { id } : {}) }); if (!response.ok) return toast.error("Unable to update notifications."); await load(); window.dispatchEvent(new Event("notifications-updated")); };

  return <div className="space-y-5 pb-10"><PageHeader title="Notifications" />
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="font-semibold">{unreadCount} unread notification{unreadCount === 1 ? "" : "s"}</p><p className="text-xs text-muted-foreground">Attendance, trips, WFH and device approvals</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="w-full pl-9 sm:w-72" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employee ID or message" /></div><Button variant="outline" disabled={!unreadCount} onClick={() => markRead()}><Check /> Mark all read</Button></div></div>
    <div className="flex gap-2 overflow-x-auto pb-1">{(["ALL", "UNREAD", "ATTENDANCE", "TRIPS", "WFH", "DEVICE"] as Filter[]).map((value) => <Button key={value} size="sm" variant={filter === value ? "default" : "outline"} onClick={() => setFilter(value)}>{value === "DEVICE" ? "Device Changes" : value.charAt(0) + value.slice(1).toLowerCase()}</Button>)}</div>
    {filtered.length === 0 ? <Card><CardContent className="py-10 text-center text-muted-foreground">No matching notifications.</CardContent></Card> : <div className="grid gap-3 xl:grid-cols-2">{filtered.map((item) => <Card key={item._id} className={item.readAt ? "opacity-70" : "border-blue-300 bg-blue-50/30"}><CardContent className="flex gap-3 p-4"><div className={`mt-0.5 rounded-full p-2 ${item.readAt ? "bg-muted" : "bg-blue-100 text-blue-700"}`}><Bell className="size-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.title}</p>{!item.readAt && <Badge>NEW</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{item.message}</p><div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground"><span>Employee {item.employeeEmpId}</span><span>{new Date(item.createdAt).toLocaleString()}</span><Link href={relatedPage(item.type)} className="inline-flex items-center gap-1 font-medium text-primary hover:underline"><ExternalLink className="size-3" /> Open related page</Link>{!item.readAt && <button className="font-medium text-primary hover:underline" onClick={() => markRead(item._id)}>Mark as read</button>}</div></div></CardContent></Card>)}</div>}
  </div>;
}
