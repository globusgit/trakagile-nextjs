"use client";

import PageHeader from "@/app/_components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Clock3, LocateFixed, MapPin, Plus, Route, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const ORG_ID = "ORG1";
type Employee = { _id: string; name: string; empId: string };
type Site = { _id: string; clientName: string; siteName: string; address?: string };
type Visit = { _id: string; purpose: string; startTime: string; endTime?: string; durationMinutes?: number; status: "IN_PROGRESS" | "COMPLETED"; clientSiteId: Site };
type Attendance = { _id: string; markIn: { time: string }; markOut?: { time?: string }; status: "IN" | "OUT"; trackingStatus: string; lastLocationReceivedAt?: string; totalVisits: number };

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Location is not supported by this browser."));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 15000 });
  });
}
function gps(position: GeolocationPosition) {
  const { latitude, longitude, accuracy, speed, heading } = position.coords;
  return { latitude, longitude, accuracy, speed, heading, capturedAt: new Date(position.timestamp).toISOString() };
}
async function api(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Request failed.");
  return result;
}
const time = (value?: string) => value ? new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—";

export default function AttendancePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empId, setEmpId] = useState("");
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [busy, setBusy] = useState(false);
  const [visitOpen, setVisitOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [siteId, setSiteId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [remarks, setRemarks] = useState("");
  const [client, setClient] = useState({ clientName: "", siteName: "", address: "", contactPerson: "", mobile: "" });
  const activeVisit = useMemo(() => visits.find((visit) => visit.status === "IN_PROGRESS"), [visits]);

  const refresh = useCallback(async (employeeId: string) => {
    if (!employeeId) return;
    const [today, clientResult] = await Promise.all([
      api(`/api/attendance/today?orgId=${ORG_ID}&empId=${encodeURIComponent(employeeId)}`),
      api(`/api/attendance/clients?orgId=${ORG_ID}`),
    ]);
    setAttendance(today.attendance); setVisits(today.visits); setSites(clientResult.data);
  }, []);

  useEffect(() => {
    api(`/api/attendance/employees?orgId=${ORG_ID}`).then(({ data }) => {
      setEmployees(data);
      if (data[0]) {
        setEmpId(data[0].empId);
        refresh(data[0].empId).catch((error) => toast.error(error.message));
      }
    }).catch((error) => toast.error(error.message));
  }, [refresh]);

  useEffect(() => {
    if (attendance?.status !== "IN" || !empId) return;
    const send = async () => {
      try {
        const position = await getPosition();
        await api("/api/attendance/location", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgId: ORG_ID, empId, ...gps(position) }) });
      } catch (error) { console.warn("Attendance location update skipped", error); }
    };
    const interval = window.setInterval(send, 60_000);
    return () => window.clearInterval(interval);
  }, [attendance?.status, empId]);

  const withLocation = async (url: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      const position = await getPosition();
      await api(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgId: ORG_ID, empId, ...gps(position), ...extra }) });
      await refresh(empId); toast.success("Attendance updated successfully.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to update attendance."); }
    finally { setBusy(false); }
  };

  const addClient = async () => {
    setBusy(true);
    try {
      await api("/api/attendance/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgId: ORG_ID, empId, ...client }) });
      setClientOpen(false); setClient({ clientName: "", siteName: "", address: "", contactPerson: "", mobile: "" }); await refresh(empId); toast.success("Client/site added.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to add client."); }
    finally { setBusy(false); }
  };

  return <div className="space-y-6 pb-10">
    <PageHeader title="My Attendance" />
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3"><UserRound className="size-5 text-muted-foreground" /><div><p className="text-sm font-medium">Employee</p><p className="text-xs text-muted-foreground">Select the employee using this device</p></div></div>
      <select className="h-9 min-w-60 rounded-lg border bg-background px-3 text-sm" value={empId} onChange={(e) => { setEmpId(e.target.value); refresh(e.target.value).catch((error) => toast.error(error.message)); }} disabled={attendance?.status === "IN"}>
        {employees.length === 0 && <option value="">No active employees</option>}
        {employees.map((employee) => <option key={employee._id} value={employee.empId}>{employee.name} ({employee.empId})</option>)}
      </select>
    </div>

    <div className="grid gap-4 md:grid-cols-3">
      <Card><CardHeader className="pb-2"><CardTitle className="flex items-center justify-between text-sm">Status <LocateFixed className="size-4 text-muted-foreground" /></CardTitle></CardHeader><CardContent><Badge variant={attendance?.status === "IN" ? "default" : "secondary"}>{attendance ? (attendance.status === "IN" ? "MARKED IN" : "MARKED OUT") : "NOT MARKED IN"}</Badge><p className="mt-3 text-xs text-muted-foreground">Tracking: {attendance?.trackingStatus || "OFF"}</p></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="flex items-center justify-between text-sm">Working day <Clock3 className="size-4 text-muted-foreground" /></CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{time(attendance?.markIn.time)}</p><p className="text-xs text-muted-foreground">Mark in · Mark out {time(attendance?.markOut?.time)}</p></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="flex items-center justify-between text-sm">Today&apos;s visits <Route className="size-4 text-muted-foreground" /></CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{visits.length}</p><p className="text-xs text-muted-foreground">{activeVisit ? "One visit in progress" : "No active visit"}</p></CardContent></Card>
    </div>

    {!attendance && <Button size="lg" disabled={!empId || busy} onClick={() => withLocation("/api/attendance/mark-in")}><MapPin /> Mark In with GPS</Button>}

    {attendance?.status === "IN" && <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
      <Card><CardHeader><CardTitle>Current visit</CardTitle></CardHeader><CardContent className="space-y-4">
        {activeVisit ? <><div><p className="font-semibold">{activeVisit.clientSiteId.clientName}</p><p className="text-sm text-muted-foreground">{activeVisit.clientSiteId.siteName} · Started {time(activeVisit.startTime)}</p><p className="mt-2 text-sm">{activeVisit.purpose}</p></div><Textarea placeholder="Completion remarks (optional)" value={remarks} onChange={(e) => setRemarks(e.target.value)} /><Button className="w-full" disabled={busy} onClick={() => withLocation("/api/attendance/visits/end", { remarks })}>End Visit</Button></> : <><p className="text-sm text-muted-foreground">You are currently travelling or available for a new visit.</p><Button className="w-full" onClick={() => setVisitOpen(true)} disabled={busy || sites.length === 0}>Start New Visit</Button></>}
        <Button variant="outline" className="w-full" onClick={() => setClientOpen(true)}><Plus /> Add Client / Site</Button>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Today&apos;s visits</CardTitle></CardHeader><CardContent>{visits.length === 0 ? <p className="text-sm text-muted-foreground">No visits recorded today.</p> : <div className="space-y-3">{visits.map((visit, index) => <div key={visit._id} className="flex gap-3 rounded-lg border p-3"><div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">{visits.length - index}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{visit.clientSiteId.clientName} · {visit.clientSiteId.siteName}</p><Badge variant={visit.status === "IN_PROGRESS" ? "default" : "secondary"}>{visit.status === "IN_PROGRESS" ? "IN PROGRESS" : "COMPLETED"}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{time(visit.startTime)} – {time(visit.endTime)}{visit.durationMinutes != null ? ` · ${visit.durationMinutes} min` : ""}</p><p className="mt-1 text-sm">{visit.purpose}</p></div></div>)}</div>}</CardContent></Card>
    </div>}

    {attendance?.status === "IN" && <Button variant="destructive" size="lg" disabled={busy || !!activeVisit} onClick={() => withLocation("/api/attendance/mark-out")}>Mark Out with Final GPS</Button>}

    <Dialog open={visitOpen} onOpenChange={setVisitOpen}><DialogContent><DialogHeader><DialogTitle>Start client/site visit</DialogTitle></DialogHeader><div className="space-y-4"><div><Label htmlFor="site">Client / site</Label><select id="site" className="mt-2 h-9 w-full rounded-lg border bg-background px-3 text-sm" value={siteId} onChange={(e) => setSiteId(e.target.value)}><option value="">Select a site</option>{sites.map((site) => <option key={site._id} value={site._id}>{site.clientName} · {site.siteName}</option>)}</select></div><div><Label htmlFor="purpose">Purpose</Label><Textarea id="purpose" className="mt-2" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Technical support, sales meeting…" /></div></div><DialogFooter><Button disabled={busy || !siteId || !purpose.trim()} onClick={async () => { await withLocation("/api/attendance/visits/start", { clientSiteId: siteId, purpose }); setVisitOpen(false); setPurpose(""); setSiteId(""); }}>Start Visit</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={clientOpen} onOpenChange={setClientOpen}><DialogContent><DialogHeader><DialogTitle>Add client / site</DialogTitle></DialogHeader><div className="grid gap-3"><div><Label>Client name</Label><Input className="mt-1" value={client.clientName} onChange={(e) => setClient({ ...client, clientName: e.target.value })} /></div><div><Label>Site name</Label><Input className="mt-1" value={client.siteName} onChange={(e) => setClient({ ...client, siteName: e.target.value })} /></div><div><Label>Address</Label><Textarea className="mt-1" value={client.address} onChange={(e) => setClient({ ...client, address: e.target.value })} /></div><div className="grid grid-cols-2 gap-3"><div><Label>Contact person</Label><Input className="mt-1" value={client.contactPerson} onChange={(e) => setClient({ ...client, contactPerson: e.target.value })} /></div><div><Label>Mobile</Label><Input className="mt-1" value={client.mobile} onChange={(e) => setClient({ ...client, mobile: e.target.value })} /></div></div></div><DialogFooter><Button disabled={busy || !client.clientName.trim() || !client.siteName.trim()} onClick={addClient}>Add Client / Site</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
