"use client";

import PageHeader from "@/app/_components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building2, MapPin, Plus, Receipt, Route } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useRegionalSettings } from "@/app/_components/RegionalSettingsProvider";
import { formatRegionalCurrency, formatRegionalDateTime } from "@/lib/regionalFormat.mjs";

type Site = { _id: string; clientName: string; siteName: string; address?: string };
type Trip = { _id: string; status: string; purpose: string; source: string; destination: string; travelMode: string; expectedReturnAt: string; advanceAmount: number; totalExpenses: number; clientSiteId: Site; hotel?: { name?: string; checkInAt?: string; checkOutAt?: string } };
type Event = { _id: string; type: string; createdAt: string; remarks?: string; location?: { latitude: number; longitude: number; accuracy?: number; locationName?: string } };
type Expense = { _id: string; category: string; amount: number; vendor?: string; receiptPath?: string; status: string; createdAt: string };

const nextAction: Record<string, { action: string; label: string }> = {
  PLANNED: { action: "START_TRAVEL", label: "Start Travel" }, TRAVELLING: { action: "ARRIVE_CLIENT", label: "Arrived at Client" },
  AT_CLIENT: { action: "START_WORK", label: "Start Site Work" }, WORKING: { action: "END_SITE", label: "Complete Site Work" },
  RETURNING: { action: "COMPLETE_TRIP", label: "Complete Trip" },
};
const travelModes = [
  ["COMPANY_VEHICLE", "Company vehicle"], ["PERSONAL_CAR", "Personal car"],
  ["BIKE", "Bike"], ["BUS", "Bus"], ["TRAIN", "Train"], ["FLIGHT", "Flight"],
  ["TAXI_AUTO", "Taxi / auto"], ["WALKING", "Walking"], ["OTHER", "Other"],
] as const;
const localValue = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

function gps() {
  return new Promise<Record<string, unknown>>((resolve, reject) => navigator.geolocation.getCurrentPosition(
    (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, capturedAt: new Date(position.timestamp).toISOString() }),
    () => reject(new Error("Fresh GPS location is mandatory. Allow location access and retry.")),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
  ));
}

export default function FieldTripsPage() {
  const regional = useRegionalSettings();
  const [active, setActive] = useState<Trip | null>(null); const [events, setEvents] = useState<Event[]>([]); const [expenses, setExpenses] = useState<Expense[]>([]); const [sites, setSites] = useState<Site[]>([]);
  const [createOpen, setCreateOpen] = useState(false); const [expenseOpen, setExpenseOpen] = useState(false); const [stayOpen, setStayOpen] = useState(false); const [busy, setBusy] = useState(false);
  const [createAttempted, setCreateAttempted] = useState(false);
  const [trip, setTrip] = useState(() => { const now = new Date(); return { clientSiteId: "", purpose: "", source: "", destination: "", travelMode: "COMPANY_VEHICLE", expectedStartAt: localValue(now), expectedReturnAt: localValue(new Date(now.getTime() + 86400000)), advanceAmount: "0" }; });
  const [stay, setStay] = useState(() => { const now = new Date(); return { hotelName: "", hotelAddress: "", expectedCheckOutAt: localValue(new Date(now.getTime() + 10 * 3600000)) }; });
  const [expense, setExpense] = useState({ category: "HOTEL", amount: "", vendor: "", paymentMethod: "Personal", remarks: "" }); const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const load = useCallback(async () => { const [tripResponse, siteResponse] = await Promise.all([fetch("/api/field-trips", { cache: "no-store" }), fetch("/api/attendance/clients", { cache: "no-store" })]); const tripData = await tripResponse.json(); const siteData = await siteResponse.json(); if (!tripResponse.ok) throw new Error(tripData.message); setActive(tripData.active); setEvents(tripData.events || []); setExpenses(tripData.expenses || []); setSites(siteData.data || []); }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load().catch((error) => toast.error(error.message)), 0); return () => window.clearTimeout(timer); }, [load]);
  const balance = useMemo(() => (active?.advanceAmount || 0) - (active?.totalExpenses || 0), [active]);

  const advanceAmount = Number(trip.advanceAmount);
  const validTripPeriod = Boolean(trip.expectedStartAt && trip.expectedReturnAt && new Date(trip.expectedReturnAt) > new Date(trip.expectedStartAt));
  const validAdvance = trip.advanceAmount.trim() !== "" && Number.isFinite(advanceAmount) && advanceAmount >= 0;
  const tripValid = Boolean(trip.clientSiteId && trip.purpose.trim() && trip.source.trim() && trip.destination.trim() && trip.travelMode && validTripPeriod && validAdvance);
  const tripDuration = useMemo(() => { const start = new Date(trip.expectedStartAt).getTime(); const end = new Date(trip.expectedReturnAt).getTime(); if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return "Select a valid start and return time"; const hours = Math.round((end - start) / 3600000); const days = Math.floor(hours / 24); return `${days ? `${days} day${days === 1 ? "" : "s"} ` : ""}${hours % 24} hour${hours % 24 === 1 ? "" : "s"}`; }, [trip.expectedStartAt, trip.expectedReturnAt]);
  const createTrip = async () => { setCreateAttempted(true); if (!tripValid) return toast.error("Complete all required trip details."); setBusy(true); try { const response = await fetch("/api/field-trips", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...trip, expectedStartAt: new Date(trip.expectedStartAt).toISOString(), expectedReturnAt: new Date(trip.expectedReturnAt).toISOString() }) }); const result = await response.json(); if (!response.ok) throw new Error(result.message); setCreateOpen(false); setCreateAttempted(false); await load(); toast.success("Field trip created."); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to create trip."); } finally { setBusy(false); } };
  const act = async (action: string, extra: Record<string, unknown> = {}) => { if (!active) return; setBusy(true); try { const location = await gps();
    if (action === "START_TRAVEL") {
      const todayResponse = await fetch("/api/attendance/today", { cache: "no-store" });
      const today = await todayResponse.json();
      if (!todayResponse.ok) throw new Error(today.message || "Unable to verify attendance.");
      if (today.attendance?.status !== "IN") {
        const now = new Date();
        const tripReturn = new Date(active.expectedReturnAt);
        const sessionEnd = new Date(Math.min(tripReturn.getTime(), now.getTime() + 12 * 60 * 60 * 1000));
        const markInResponse = await fetch("/api/attendance/mark-in", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...location, attendanceType: "FIELD_VISIT", clientSiteId: active.clientSiteId._id, purpose: active.purpose, expectedWorkEndAt: sessionEnd.toISOString(), overnightWork: sessionEnd.getDate() !== now.getDate() }) });
        const markInResult = await markInResponse.json();
        if (!markInResponse.ok) throw new Error(markInResult.message || "Unable to start field attendance.");
        toast.success("Field attendance marked in automatically.");
      }
    }
    const response = await fetch(`/api/field-trips/${active._id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...location, ...extra }) }); const result = await response.json(); if (!response.ok) throw new Error(result.message); setStayOpen(false); await load(); toast.success("Trip status updated."); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to update trip."); } finally { setBusy(false); } };
  const addExpense = async () => { if (!active) return; setBusy(true); try { const form = new FormData(); Object.entries(expense).forEach(([key, value]) => form.append(key, value)); if (receiptFile) form.append("receipt", receiptFile); const response = await fetch(`/api/field-trips/${active._id}/expenses`, { method: "POST", body: form }); const result = await response.json(); if (!response.ok) throw new Error(result.message); setExpenseOpen(false); await load(); toast.success("Expense submitted."); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to add expense."); } finally { setBusy(false); } };

  return <div className="space-y-6 pb-10"><PageHeader title="Field Trips" />
    {!active ? <Card><CardContent className="flex flex-col items-center gap-4 py-10 text-center"><Route className="size-10 text-muted-foreground" /><div><p className="font-semibold">No active field trip</p><p className="text-sm text-muted-foreground">Create a trip before starting long-distance client travel.</p></div><Button onClick={() => setCreateOpen(true)}><Plus /> Create Field Trip</Button></CardContent></Card>
    : <><Card className="border-blue-300"><CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-2"><span>{active.clientSiteId.clientName} · {active.clientSiteId.siteName}</span><Badge>{active.status.replaceAll("_", " ")}</Badge></CardTitle></CardHeader><CardContent className="space-y-4"><p>{active.source} → {active.destination}</p><p className="text-sm text-muted-foreground">{active.purpose} · {active.travelMode.replaceAll("_", " ")} · Expected return {formatRegionalDateTime(active.expectedReturnAt, regional)}</p>
      {nextAction[active.status] && <Button className="w-full" size="lg" disabled={busy} onClick={() => act(nextAction[active.status].action)}><MapPin />{busy ? "Checking GPS..." : nextAction[active.status].label}</Button>}
      {active.status === "SITE_COMPLETED" && <div className="grid gap-2 sm:grid-cols-2"><Button onClick={() => setStayOpen(true)} variant="outline"><Building2 /> Hotel Check In</Button><Button onClick={() => act("START_RETURN")}><Route /> Start Return Travel</Button></div>}
      {active.status === "STAYING" && <Button className="w-full" onClick={() => act("STAY_CHECK_OUT")}><Building2 /> Hotel Check Out</Button>}
    </CardContent></Card>
    <div className="grid gap-4 md:grid-cols-3"><Card><CardHeader><CardTitle className="text-sm">Advance</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{formatRegionalCurrency(active.advanceAmount, regional)}</CardContent></Card><Card><CardHeader><CardTitle className="text-sm">Expenses</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{formatRegionalCurrency(active.totalExpenses, regional)}</CardContent></Card><Card><CardHeader><CardTitle className="text-sm">Balance</CardTitle></CardHeader><CardContent className={`text-2xl font-semibold ${balance < 0 ? "text-red-600" : ""}`}>{formatRegionalCurrency(balance, regional)}</CardContent></Card></div>
    <div className="flex justify-end"><Button onClick={() => setExpenseOpen(true)}><Receipt /> Add Expense</Button></div>
    <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>Trip timeline</CardTitle></CardHeader><CardContent className="space-y-3">{events.length ? events.map((event) => <div key={event._id} className="border-l-2 pl-3"><p className="font-medium">{event.type.replaceAll("_", " ")}</p><p className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()} · {event.location?.locationName || `${event.location?.latitude.toFixed(5)}, ${event.location?.longitude.toFixed(5)}`}</p></div>) : <p className="text-sm text-muted-foreground">Start travel to create the timeline.</p>}</CardContent></Card>
    <Card><CardHeader><CardTitle>Expenses and receipts</CardTitle></CardHeader><CardContent className="space-y-3">{expenses.length ? expenses.map((item) => <div key={item._id} className="flex justify-between rounded-md border p-3"><div><p className="font-medium">{item.category} · ₹{item.amount.toFixed(2)}</p><p className="text-xs text-muted-foreground">{item.vendor || "No vendor"} · {item.status}</p></div>{item.receiptPath && <a className="text-sm underline" href={item.receiptPath} target="_blank" rel="noreferrer">Receipt</a>}</div>) : <p className="text-sm text-muted-foreground">No expenses submitted.</p>}</CardContent></Card></div></>}

    <Dialog open={createOpen} onOpenChange={(value) => { setCreateOpen(value); if (!value) setCreateAttempted(false); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Create field trip</DialogTitle><p className="text-sm text-muted-foreground">Plan client travel, expected timings and any advance required.</p></DialogHeader>
        <div className="grid gap-5 py-2">
          <div><Label htmlFor="tripSite">Client / site <span className="text-red-500">*</span></Label><select id="tripSite" aria-invalid={createAttempted && !trip.clientSiteId} className="mt-2 h-10 w-full rounded-md border bg-transparent px-3 text-sm aria-invalid:border-red-500" value={trip.clientSiteId} onChange={(event) => setTrip({ ...trip, clientSiteId: event.target.value })}><option value="">Select client / site</option>{sites.map((site) => <option key={site._id} value={site._id}>{site.clientName} — {site.siteName}</option>)}</select>{createAttempted && !trip.clientSiteId && <p className="mt-1 text-xs text-red-600">Select a client/site.</p>}</div>
          <div><Label htmlFor="tripPurpose">Purpose <span className="text-red-500">*</span></Label><Textarea id="tripPurpose" className="mt-2 min-h-24" aria-invalid={createAttempted && !trip.purpose.trim()} value={trip.purpose} onChange={(event) => setTrip({ ...trip, purpose: event.target.value })} placeholder="Installation, inspection, client support..." />{createAttempted && !trip.purpose.trim() && <p className="mt-1 text-xs text-red-600">Enter the trip purpose.</p>}</div>
          <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="tripSource">Source <span className="text-red-500">*</span></Label><Input id="tripSource" className="mt-2" aria-invalid={createAttempted && !trip.source.trim()} value={trip.source} onChange={(event) => setTrip({ ...trip, source: event.target.value })} placeholder="Hyderabad" /></div><div><Label htmlFor="tripDestination">Destination <span className="text-red-500">*</span></Label><Input id="tripDestination" className="mt-2" aria-invalid={createAttempted && !trip.destination.trim()} value={trip.destination} onChange={(event) => setTrip({ ...trip, destination: event.target.value })} placeholder="Client city / site" /></div></div>
          <div><Label htmlFor="tripMode">Travel mode <span className="text-red-500">*</span></Label><select id="tripMode" className="mt-2 h-10 w-full rounded-md border bg-transparent px-3 text-sm" value={trip.travelMode} onChange={(event) => setTrip({ ...trip, travelMode: event.target.value })}>{travelModes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="tripStart">Expected start <span className="text-red-500">*</span></Label><Input id="tripStart" className="mt-2" type="datetime-local" value={trip.expectedStartAt} onChange={(event) => setTrip({ ...trip, expectedStartAt: event.target.value })} /></div><div><Label htmlFor="tripReturn">Expected return <span className="text-red-500">*</span></Label><Input id="tripReturn" className="mt-2" type="datetime-local" min={trip.expectedStartAt} aria-invalid={!validTripPeriod} value={trip.expectedReturnAt} onChange={(event) => setTrip({ ...trip, expectedReturnAt: event.target.value })} /></div></div>{!validTripPeriod && <p className="mt-1 text-xs text-red-600">Expected return must be after the expected start.</p>}</div>
          <div className="rounded-lg border bg-muted/40 p-3 text-sm"><span className="text-muted-foreground">Estimated duration:</span> <span className="font-medium">{tripDuration}</span></div>
          <div><Label htmlFor="tripAdvance">Advance requested</Label><div className="relative mt-2"><span className="absolute left-3 top-2 text-sm text-muted-foreground">₹</span><Input id="tripAdvance" className="pl-7" type="number" min="0" step="0.01" aria-invalid={!validAdvance} value={trip.advanceAmount} onChange={(event) => setTrip({ ...trip, advanceAmount: event.target.value })} /></div>{validAdvance ? <p className="mt-1 text-xs text-muted-foreground">Enter 0 when no advance is needed.</p> : <p className="mt-1 text-xs text-red-600">Advance must be 0 or more.</p>}</div>
        </div>
        <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setCreateOpen(false)} disabled={busy}>Cancel</Button><Button disabled={busy || !tripValid} onClick={createTrip}>{busy ? "Creating..." : "Create Trip"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={stayOpen} onOpenChange={setStayOpen}><DialogContent><DialogHeader><DialogTitle>Hotel Check In</DialogTitle></DialogHeader><div className="space-y-3"><Label>Hotel name<Input value={stay.hotelName} onChange={(e) => setStay({ ...stay, hotelName: e.target.value })} /></Label><Label>Address<Input value={stay.hotelAddress} onChange={(e) => setStay({ ...stay, hotelAddress: e.target.value })} /></Label><Label>Expected checkout<Input type="datetime-local" value={stay.expectedCheckOutAt} onChange={(e) => setStay({ ...stay, expectedCheckOutAt: e.target.value })} /></Label></div><DialogFooter><Button disabled={busy || !stay.hotelName || !stay.expectedCheckOutAt} onClick={() => act("STAY_CHECK_IN", { ...stay, expectedCheckOutAt: new Date(stay.expectedCheckOutAt).toISOString() })}>Confirm with GPS</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}><DialogContent><DialogHeader><DialogTitle>Add trip expense</DialogTitle></DialogHeader><div className="space-y-3"><Label>Category<select className="mt-1 h-9 w-full rounded-md border bg-transparent px-3" value={expense.category} onChange={(e) => setExpense({ ...expense, category: e.target.value })}>{["HOTEL","FOOD","FUEL","TOLL","PARKING","TICKET","TAXI_AUTO","CLIENT","OTHER"].map((value) => <option key={value}>{value}</option>)}</select></Label><Label>Amount<Input type="number" min="0.01" step="0.01" value={expense.amount} onChange={(e) => setExpense({ ...expense, amount: e.target.value })} /></Label><Label>Vendor<Input value={expense.vendor} onChange={(e) => setExpense({ ...expense, vendor: e.target.value })} /></Label><Label>Payment method<Input value={expense.paymentMethod} onChange={(e) => setExpense({ ...expense, paymentMethod: e.target.value })} /></Label><Label>Remarks<Textarea value={expense.remarks} onChange={(e) => setExpense({ ...expense, remarks: e.target.value })} /></Label><Label>Receipt (JPG, PNG or PDF)<Input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} /></Label></div><DialogFooter><Button disabled={busy || !expense.amount} onClick={addExpense}>Submit Expense</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
