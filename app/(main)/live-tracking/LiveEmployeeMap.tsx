"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { AlertTriangle, Clock3, Crosshair, Gauge, MapPin, Navigation, Radio, Route, Search, Users } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";

import type { EmployeeLocation } from "../dashboard/EmployeeLocationMap";

type Props = { locations: EmployeeLocation[]; selectedEmpId?: string | null; onSelectEmployee?: (empId: string) => void; loading?: boolean };
type TrackStatus = ReturnType<typeof status>;

const time = (value?: string | null) => value ? new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Pending";
const ageMinutes = (value: string) => Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
const coordinates = (latitude: number, longitude: number) => `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

function status(employee: EmployeeLocation) {
  const stale = ageMinutes(employee.receivedAt);
  if (employee.trackingStatus === "OFFLINE" || employee.trackingStatus === "STOPPED" || stale > 30) return { label: "Offline", badge: "bg-slate-100 text-slate-600" };
  if (employee.trackingStatus === "DELAYED" || stale > 5) return { label: "Delayed", badge: "bg-amber-50 text-amber-700" };
  return { label: "On time", badge: "bg-emerald-50 text-emerald-700" };
}

function FitRoute({ employee, focusKey }: { employee: EmployeeLocation; focusKey: number }) {
  const map = useMap();
  useEffect(() => {
    const points = employee.route.length ? employee.route : [{ latitude: employee.latitude, longitude: employee.longitude }];
    const bounds = L.latLngBounds(points.map((point) => [point.latitude, point.longitude]));
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [55, 55], maxZoom: 16 });
  }, [employee, focusKey, map]);
  return null;
}

function avatarIcon(employee: EmployeeLocation) {
  const src = employee.photo ? `/api/files/employees/${encodeURIComponent(employee.photo)}` : "/default-avatar.jpg";
  return L.divIcon({ className: "ops-avatar-marker", html: `<div><img src="${src}" alt=""><span></span></div>`, iconSize: [54, 66], iconAnchor: [27, 62] });
}

function triggerIcon(index: number, kind: string) {
  const color = kind === "MARK_IN" ? "#10b981" : kind === "MARK_OUT" ? "#64748b" : "#0ea5e9";
  return L.divIcon({ className: "ops-trigger-marker", html: `<div style="--trigger:${color}"><span>${kind === "MARK_IN" ? "IN" : kind === "MARK_OUT" ? "OUT" : index}</span></div>`, iconSize: [32, 38], iconAnchor: [16, 36] });
}

function liveIcon(heading = 0) {
  return L.divIcon({ className: "ops-live-marker", html: `<div><span>${renderToStaticMarkup(<Navigation size={20} fill="currentColor" style={{ transform: `rotate(${heading}deg)` }} />)}</span></div>`, iconSize: [48, 48], iconAnchor: [24, 24] });
}

function distance(employee: EmployeeLocation) { return `${((employee.totalDistanceMeters || 0) / 1000).toFixed(1)} km`; }
function speed(employee: EmployeeLocation) { const value = [...employee.route].reverse().find((point) => point.speed != null)?.speed; return value == null ? "—" : `${Math.round(value * 3.6)} km/h`; }
function duration(employee: EmployeeLocation) { if (!employee.markInAt) return "—"; const end = employee.markOutAt ? new Date(employee.markOutAt).getTime() : Date.now(); const mins = Math.max(0, Math.floor((end - new Date(employee.markInAt).getTime()) / 60000)); return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`; }

export default function LiveEmployeeMap({ locations, selectedEmpId, onSelectEmployee, loading }: Props) {
  const [teamQuery, setTeamQuery] = useState("");
  const [focusKey, setFocusKey] = useState(0);
  const [panel, setPanel] = useState<"team" | "employee">("team");
  const [showAccuracy, setShowAccuracy] = useState(false);
  const selected = locations.find((employee) => employee.empId === selectedEmpId) || locations[0];
  const visibleTeam = useMemo(() => locations.filter((employee) => `${employee.name} ${employee.empId}`.toLowerCase().includes(teamQuery.toLowerCase())), [locations, teamQuery]);
  const triggerPoints = selected?.events || [];
  const triggerNumber = (index: number) => triggerPoints.slice(0, index + 1).filter((point) => point.type === "TRIGGER").length;
  const latestAccuracy = selected?.accuracy;
  const delayed = locations.filter((employee) => status(employee).label !== "On time").length;
  const totalDistance = locations.reduce((sum, employee) => sum + (employee.totalDistanceMeters || 0), 0) / 1000;

  if (!selected) return <div className="grid h-[calc(100dvh-155px)] min-h-[620px] place-items-center bg-slate-50"><div className="text-center"><MapPin className="mx-auto size-9 text-slate-300" /><p className="mt-3 font-medium text-slate-700">No live employee location received</p><p className="mt-1 text-sm text-slate-500">Locations appear after an employee marks in from the mobile app.</p></div></div>;

  const selectedStatus = status(selected);
  return <div className="ops-console h-[calc(100dvh-155px)] min-h-[620px] bg-slate-50">
    <section className="ops-kpis">
      <Kpi icon={<Users />} tone="emerald" label="Active now" value={locations.length} note="On duty" />
      <Kpi icon={<Clock3 />} tone="amber" label="Delayed" value={delayed} note="GPS needs attention" />
      <Kpi icon={<Route />} tone="blue" label="Distance today" value={`${totalDistance.toFixed(1)} km`} note="Team total" />
      <Kpi icon={<AlertTriangle />} tone="rose" label="Triggers" value={locations.reduce((sum, employee) => sum + employee.route.filter((point) => point.type === "TRIGGER").length, 0)} note="Location changes" />
    </section>
    <div className="ops-workspace">
      <div className="ops-map-wrap">
        <MapContainer center={[selected.latitude, selected.longitude]} zoom={14} scrollWheelZoom zoomControl className="size-full">
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitRoute employee={selected} focusKey={focusKey} />
          {selected.route.length > 1 && <><Polyline positions={selected.route.map((point) => [point.latitude, point.longitude])} pathOptions={{ color: "#38bdf8", weight: 8, opacity: .18, lineCap: "round", lineJoin: "round" }} /><Polyline positions={selected.route.map((point) => [point.latitude, point.longitude])} pathOptions={{ color: "#0284c7", weight: 4, opacity: .92, lineCap: "round", lineJoin: "round" }} /></>}
          {triggerPoints.map((point, index) => { const number = triggerNumber(index); const label = point.type === "MARK_IN" ? "Marked in" : point.type === "MARK_OUT" ? "Marked out" : `Trigger ${number}`; return <Marker key={`${point.capturedAt}-${index}`} position={[point.latitude, point.longitude]} icon={triggerIcon(number, point.type)}><Popup><strong>{label}</strong><br />{point.locationName || "Location change detected"}<br /><span className="font-mono text-xs">{coordinates(point.latitude, point.longitude)}</span><br />{time(point.capturedAt)}{point.accuracy != null ? <><br />Accuracy ±{Math.round(point.accuracy)} m</> : null}</Popup><Tooltip direction="top">{label}</Tooltip></Marker>; })}
          {showAccuracy && latestAccuracy != null && <Circle center={[selected.latitude, selected.longitude]} radius={Math.min(60, Math.max(5, latestAccuracy))} pathOptions={{ color: "#0ea5e9", fillColor: "#38bdf8", fillOpacity: .08, weight: 1 }} />}
          {locations.filter((employee) => employee.empId !== selected.empId).map((employee) => <Marker key={employee.empId} position={[employee.latitude, employee.longitude]} icon={avatarIcon(employee)} eventHandlers={{ click: () => onSelectEmployee?.(employee.empId) }}><Tooltip direction="top">{employee.name}</Tooltip></Marker>)}
          <Marker position={[selected.latitude, selected.longitude]} icon={liveIcon(selected.route.at(-1)?.heading || 0)}><Popup><strong>Live position</strong><br />{selected.locationName}<br /><span className="font-mono text-xs">{coordinates(selected.latitude, selected.longitude)}</span><br />Last sync {time(selected.receivedAt)}</Popup><Tooltip permanent direction="top" offset={[0, -24]}>LIVE</Tooltip></Marker>
        </MapContainer>
        <button className="ops-locate" type="button" onClick={() => setFocusKey((key) => key + 1)} aria-label="Center selected employee"><Crosshair /></button>
        <button className={`ops-accuracy ${showAccuracy ? "active" : ""}`} type="button" onClick={() => setShowAccuracy((value) => !value)} disabled={latestAccuracy == null} aria-pressed={showAccuracy}>GPS ±{latestAccuracy == null ? "--" : `${Math.round(latestAccuracy)} m`}</button>
        <div className="ops-legend"><span><i className="bg-emerald-500" />Mark in</span><span><i className="bg-sky-500" />Trigger</span><span><i className="bg-cyan-300" />Route</span><span><i className="bg-slate-400" />Mark out</span></div>
        {loading && <div className="absolute right-4 top-4 z-[500] rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-600 shadow">Updating live data…</div>}
      </div>
      <aside className="ops-panel">
        <div className="ops-tabs"><button className={panel === "team" ? "active" : ""} onClick={() => setPanel("team")}>Team</button><button className={panel === "employee" ? "active" : ""} onClick={() => setPanel("employee")}>Selected employee</button></div>
        <div className="ops-panel-body">
          {panel === "team" ? <>
            <div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-slate-400" /><input value={teamQuery} onChange={(event) => setTeamQuery(event.target.value)} placeholder="Search employees" className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-sky-400" /></div>
            <div className="ops-team-list">{visibleTeam.map((employee) => { const itemStatus = status(employee); const employeeTriggers = employee.route.filter((point) => point.type === "TRIGGER").length; return <button key={employee.empId} type="button" className={`ops-team-row ${employee.empId === selected.empId ? "selected" : ""}`} onClick={() => { onSelectEmployee?.(employee.empId); setPanel("employee"); }}><Image src={employee.photo ? `/api/files/employees/${encodeURIComponent(employee.photo)}` : "/default-avatar.jpg"} alt="" width={40} height={40} unoptimized /><span className="min-w-0 flex-1"><strong>{employee.name}</strong><small>{employee.empId} · {employee.designation}</small><small className="text-sky-600">{employeeTriggers} trigger{employeeTriggers === 1 ? "" : "s"} · {distance(employee)}</small></span><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${itemStatus.badge}`}>{itemStatus.label}</span></button>; })}</div>
          </> : <EmployeeDetails employee={selected} triggerPoints={triggerPoints} selectedStatus={selectedStatus} />}
        </div>
      </aside>
    </div>
  </div>;
}

function Kpi({ icon, tone, label, value, note }: { icon: React.ReactNode; tone: string; label: string; value: string | number; note: string }) { return <div className="ops-kpi"><span className={`ops-kpi-icon ${tone}`}>{icon}</span><span><small>{label}</small><strong>{value}</strong><em>{note}</em></span></div>; }

function EmployeeDetails({ employee, triggerPoints, selectedStatus }: { employee: EmployeeLocation; triggerPoints: EmployeeLocation["route"]; selectedStatus: TrackStatus }) {
  const events = [...triggerPoints, { latitude: employee.latitude, longitude: employee.longitude, capturedAt: employee.receivedAt, locationName: employee.locationName, type: "LIVE" as const }];
  return <div className="space-y-4">
    <div className="flex items-center gap-3"><Image src={employee.photo ? `/api/files/employees/${encodeURIComponent(employee.photo)}` : "/default-avatar.jpg"} alt={employee.name} width={52} height={52} unoptimized className="size-13 rounded-full border-2 border-sky-400 object-cover" /><div className="min-w-0"><h2 className="truncate font-bold text-slate-900">{employee.name}</h2><p className="text-xs text-slate-500">{employee.designation} · {employee.empId}</p><span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${selectedStatus.badge}`}>{selectedStatus.label}</span></div></div>
    <div className="grid grid-cols-2 gap-2"><Metric icon={<Clock3 />} label="On duty" value={duration(employee)} /><Metric icon={<Route />} label="Distance" value={distance(employee)} /><Metric icon={<Gauge />} label="Speed" value={speed(employee)} /><Metric icon={<Radio />} label="Last sync" value={time(employee.receivedAt)} /></div>
    <div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Current location</p><div className="rounded-xl bg-sky-50 p-3 text-sm text-slate-700"><MapPin className="mb-2 size-4 text-sky-600" /><p>{employee.locationName}</p><code className="mt-2 block text-[11px] font-semibold text-sky-700">{coordinates(employee.latitude, employee.longitude)}</code></div></div>
    <div><div className="mb-3 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Today&apos;s route events</p><span className="text-xs font-semibold text-sky-600">{events.length} points</span></div><div className="ops-timeline">{events.map((point, index) => { const isLive = point.type === "LIVE"; const number = events.slice(0, index + 1).filter((event) => event.type === "TRIGGER").length; return <div key={`${point.capturedAt}-${index}`} className="ops-event"><span className={isLive ? "live" : point.type === "MARK_IN" ? "start" : "trigger"}>{isLive ? <Navigation /> : point.type === "MARK_IN" ? <MapPin /> : number}</span><span><strong>{isLive ? "Live position" : point.type === "MARK_IN" ? "Marked in" : point.type === "MARK_OUT" ? "Marked out" : `Location trigger ${number}`}</strong><small>{point.locationName || "Location recorded"}</small><code>{coordinates(point.latitude, point.longitude)}</code></span><time>{time(point.capturedAt)}</time></div>; })}</div></div>
  </div>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="ops-metric"><span>{icon}</span><strong>{value}</strong><small>{label}</small></div>; }
