"use client";

import PageHeader from "@/app/_components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Camera, MapPin, UsersRound } from "lucide-react";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type Employee = { empId: string; name: string; designation?: string };
type Site = { _id: string; clientName: string; siteName: string };
type RecordItem = { _id: string; managerEmpId: string; employeeIds: string[]; contextType: string; purpose: string; createdAt: string; location?: { locationName?: string; latitude: number; longitude: number }; clientSiteId?: Site };

const position = () => new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }));

export default function GroupAttendancePage() {
  const { data: session } = useSession();
  const role = session?.user?.role || "";
  const isManager = role === "MANAGER";
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [contextType, setContextType] = useState("SITE_VISIT");
  const [clientSiteId, setClientSiteId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [selfie, setSelfie] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [recordsResponse, teamResponse, sitesResponse] = await Promise.all([
      fetch("/api/attendance/group", { cache: "no-store" }),
      isManager ? fetch("/api/attendance/group?mode=team", { cache: "no-store" }) : null,
      isManager ? fetch("/api/attendance/clients", { cache: "no-store" }) : null,
    ]);
    if (recordsResponse.ok) setRecords((await recordsResponse.json()).records || []);
    if (teamResponse?.ok) setEmployees((await teamResponse.json()).employees || []);
    if (sitesResponse?.ok) setSites((await sitesResponse.json()).data || []);
  }, [isManager]);
  useEffect(() => { void load(); }, [load]);

  async function submit() {
    setBusy(true);
    try {
      if (!selected.length || !purpose.trim() || !selfie) throw new Error("Select employees, enter purpose, and capture the group selfie.");
      if (["FIELD_TRIP", "SITE_VISIT"].includes(contextType) && !clientSiteId) throw new Error("Select the client/site.");
      if (!window.isSecureContext && window.location.hostname !== "localhost") throw new Error("Browser GPS requires HTTPS. Use the Flutter app until the HTTPS domain is configured.");
      const gps = await position();
      const form = new FormData();
      form.set("employeeIds", selected.join(",")); form.set("contextType", contextType); form.set("purpose", purpose.trim()); form.set("clientSiteId", clientSiteId); form.set("selfie", selfie);
      form.set("latitude", String(gps.coords.latitude)); form.set("longitude", String(gps.coords.longitude)); form.set("accuracy", String(gps.coords.accuracy)); form.set("capturedAt", new Date(gps.timestamp).toISOString());
      const response = await fetch("/api/attendance/group", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to submit group attendance.");
      toast.success("Group attendance marked successfully.");
      setSelected([]); setPurpose(""); setSelfie(null); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to submit group attendance."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6 pb-10"><PageHeader title="Group Attendance" />
    {isManager && <Card><CardHeader><CardTitle className="flex items-center gap-2"><UsersRound className="size-5" />Mark assigned team attendance</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2"><Label>Attendance type<select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={contextType} onChange={(event) => setContextType(event.target.value)}>{[["SITE_VISIT","Site visit"],["FIELD_TRIP","Field trip"],["TRAINING","Training"],["EVENT","Event"],["TEAM_SHIFT","Team shift"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Label>{["FIELD_TRIP", "SITE_VISIT"].includes(contextType) && <Label>Client / site<select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={clientSiteId} onChange={(event) => setClientSiteId(event.target.value)}><option value="">Select site</option>{sites.map((site) => <option key={site._id} value={site._id}>{site.clientName} - {site.siteName}</option>)}</select></Label>}</div>
      <div><p className="mb-2 text-sm font-medium">Assigned employees</p><div className="grid gap-2 sm:grid-cols-2">{employees.map((employee) => <label key={employee.empId} className="flex items-center gap-3 rounded-md border p-3"><input type="checkbox" checked={selected.includes(employee.empId)} onChange={(event) => setSelected(event.target.checked ? [...selected, employee.empId] : selected.filter((id) => id !== employee.empId))} /><span><span className="block font-medium">{employee.name}</span><span className="text-xs text-muted-foreground">{employee.empId} · {employee.designation || "Employee"}</span></span></label>)}</div>{!employees.length && <p className="text-sm text-muted-foreground">No employees are assigned to this manager.</p>}</div>
      <Label>Purpose<Textarea className="mt-1" value={purpose} onChange={(event) => setPurpose(event.target.value)} /></Label>
      <Label className="block">Group selfie<Input className="mt-1" type="file" accept="image/jpeg,image/png" capture="environment" onChange={(event) => setSelfie(event.target.files?.[0] || null)} /></Label><p className="text-xs text-muted-foreground"><Camera className="mr-1 inline size-4" />Capture the team together. GPS and time are added automatically.</p>
      <Button disabled={busy || !selected.length || !purpose.trim() || !selfie} onClick={() => void submit()}><MapPin />{busy ? "Checking GPS..." : `Confirm ${selected.length} employee${selected.length === 1 ? "" : "s"}`}</Button>
    </CardContent></Card>}
    <Card><CardHeader><CardTitle>{isManager ? "My group submissions" : "HR / Admin audit"}</CardTitle></CardHeader><CardContent className="space-y-3">{records.map((item) => <div key={item._id} className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_auto]"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.purpose}</p><Badge variant="secondary">{item.contextType.replaceAll("_", " ")}</Badge></div><p className="mt-1 text-sm">{item.employeeIds.join(", ")}</p><p className="text-xs text-muted-foreground">Manager: {item.managerEmpId} · {new Date(item.createdAt).toLocaleString("en-IN")}</p><p className="text-xs text-muted-foreground">{item.clientSiteId ? `${item.clientSiteId.clientName} - ${item.clientSiteId.siteName}` : item.location?.locationName || "GPS recorded"}</p></div><Button nativeButton={false} variant="outline" render={<a href={`/api/attendance/group/${item._id}/selfie`} target="_blank" rel="noreferrer" />}>View selfie</Button></div>)}{!records.length && <p className="text-sm text-muted-foreground">No group attendance submitted yet.</p>}</CardContent></Card>
  </div>;
}
