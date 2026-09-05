"use client";

import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import Image from "next/image";
import { Fragment, useEffect, useState } from "react";
import { BatteryMedium, CheckCircle2, Clock3, Crosshair, Gauge, MapPin, Navigation, Radio, Route, Satellite } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";

type RoutePoint = {
  latitude: number; longitude: number; capturedAt: string; locationName?: string | null;
  speed?: number | null; heading?: number | null; type: "MARK_IN" | "TRACK" | "TRIGGER" | "LIVE" | "MARK_OUT";
  accuracy?: number | null;
};

export type EmployeeLocation = {
  empId: string; name: string; designation: string; photo?: string | null;
  latitude: number; longitude: number; locationName: string; receivedAt: string; presentToday: boolean;
  attendanceDate: string; markInAt?: string | null; markOutAt?: string | null; attendanceStatus: "IN" | "OUT";
  trackingStatus?: "ACTIVE" | "DELAYED" | "OFFLINE" | "STOPPED"; totalDistanceMeters?: number; route: RoutePoint[];
  accuracy?: number | null; events?: RoutePoint[];
};

const routeColors = ["#22d3ee", "#a855f7", "#f59e0b", "#84cc16", "#3b82f6", "#f43f5e"];
const colorForEmployee = (empId: string) => routeColors[[...empId].reduce((sum, character) => sum + character.charCodeAt(0), 0) % routeColors.length];
const timeText = (value?: string | null) => value ? new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";

function FitLocations({ locations }: { locations: EmployeeLocation[] }) {
  const map = useMap();
  useEffect(() => {
    if (!locations.length) return;
    map.fitBounds(L.latLngBounds(locations.map((item) => [item.latitude, item.longitude])), { paddingTopLeft: [50, 50], paddingBottomRight: [360, 130], maxZoom: 14 });
  }, [locations, map]);
  return null;
}

function ResizeMap({ fullScreen }: { fullScreen: boolean }) {
  const map = useMap();
  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 120);
    return () => window.clearTimeout(timer);
  }, [fullScreen, map]);
  return null;
}

function FocusEmployee({ employee, focusKey }: { employee?: EmployeeLocation; focusKey?: string | null }) {
  const map = useMap();
  useEffect(() => {
    if (!employee) return;
    const bounds = employee.route.length > 1 ? L.latLngBounds(employee.route.map((point) => [point.latitude, point.longitude])) : null;
    if (bounds?.isValid()) map.fitBounds(bounds, { paddingTopLeft: [70, 70], paddingBottomRight: [370, 150], maxZoom: 15 });
    else map.flyTo([employee.latitude, employee.longitude], 15, { duration: 0.7 });
  }, [employee, focusKey, map]);
  return null;
}

function employeeIcon(employee: EmployeeLocation, selected: boolean) {
  const photo = employee.photo ? `/api/files/employees/${encodeURIComponent(employee.photo)}` : "/default-avatar.jpg";
  const color = colorForEmployee(employee.empId);
  return L.divIcon({
    className: "team-live-marker",
    html: `<div class="team-live-marker__pulse${selected ? " is-selected" : ""}" style="--marker-color:${color}"><div class="team-live-marker__photo"><img src="${photo}" alt="" /></div><span></span></div>`,
    iconSize: [60, 70], iconAnchor: [30, 61],
  });
}

const clusterIcon = (cluster: { getChildCount: () => number }) => L.divIcon({
  className: "team-live-cluster", html: `<div><strong>${cluster.getChildCount()}</strong><span>people</span></div>`, iconSize: [62, 62], iconAnchor: [31, 31],
});

function movementBearing(route: RoutePoint[]) {
  const last = route.at(-1);
  if (last?.heading != null) return last.heading;
  const previous = route.at(-2);
  if (!last || !previous) return 0;
  const lat1 = previous.latitude * Math.PI / 180;
  const lat2 = last.latitude * Math.PI / 180;
  const delta = (last.longitude - previous.longitude) * Math.PI / 180;
  const y = Math.sin(delta) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(delta);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function directionIcon(employee: EmployeeLocation, emphasized: boolean) {
  const color = colorForEmployee(employee.empId);
  return L.divIcon({
    className: "employee-direction-marker",
    html: `<div style="color:${color};filter:drop-shadow(0 0 ${emphasized ? 8 : 3}px ${color});transform:rotate(${movementBearing(employee.route)}deg)">${renderToStaticMarkup(<Navigation size={emphasized ? 25 : 19} fill="currentColor" />)}</div>`,
    iconSize: [28, 28], iconAnchor: [14, 14],
  });
}

function statusFor(employee: EmployeeLocation) {
  if (employee.attendanceStatus === "OUT" || employee.trackingStatus === "STOPPED") return { label: "Off duty", tone: "text-slate-300", dot: "bg-slate-400" };
  if (employee.trackingStatus === "DELAYED" || employee.trackingStatus === "OFFLINE") return { label: "Signal delayed", tone: "text-amber-300", dot: "bg-amber-400" };
  return { label: "On duty", tone: "text-emerald-300", dot: "bg-emerald-400" };
}

function elapsedTime(employee: EmployeeLocation) {
  if (!employee.markInAt) return "—";
  const end = employee.markOutAt ? new Date(employee.markOutAt).getTime() : Date.now();
  const minutes = Math.max(0, Math.floor((end - new Date(employee.markInAt).getTime()) / 60_000));
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

function latestSpeed(employee: EmployeeLocation) {
  const speed = [...employee.route].reverse().find((point) => point.speed != null)?.speed;
  return speed == null ? "—" : `${Math.round(speed * 3.6)} km/h`;
}

export default function EmployeeLocationMap({ locations, fullScreen = false, selectedEmpId, onSelectEmployee }: { locations: EmployeeLocation[]; fullScreen?: boolean; selectedEmpId?: string | null; onSelectEmployee?: (empId: string) => void }) {
  const [lightMap, setLightMap] = useState(false);
  const [focusKey, setFocusKey] = useState(0);
  const selectedEmployee = locations.find((employee) => employee.empId === selectedEmpId) || locations[0];
  const selectedStatus = selectedEmployee ? statusFor(selectedEmployee) : null;
  if (!locations.length) return <div className={`grid place-items-center bg-slate-950 text-slate-400 ${fullScreen ? "h-[calc(100vh-110px)]" : "h-[620px]"}`}>No employee location has been received yet.</div>;

  return <div className={`team-live-map ${lightMap ? "is-light-map" : ""} relative overflow-hidden bg-[#071524] ${fullScreen ? "h-[calc(100vh-110px)]" : "h-[620px]"}`}>
    <MapContainer center={[locations[0].latitude, locations[0].longitude]} zoom={12} scrollWheelZoom zoomControl={false} className="size-full">
      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitLocations locations={locations} />
      <ResizeMap fullScreen={fullScreen} />
      <FocusEmployee employee={selectedEmployee} focusKey={`${selectedEmpId || selectedEmployee.empId}-${focusKey}`} />
      {locations.map((employee) => {
        if (employee.route.length < 2) return null;
        const selected = employee.empId === selectedEmployee.empId;
        const color = colorForEmployee(employee.empId);
        const lastPoint = employee.route.at(-1)!;
        return <Fragment key={`${employee.empId}-route`}>
          {selected && <Polyline positions={employee.route.map((point) => [point.latitude, point.longitude])} pathOptions={{ color, weight: 11, opacity: 0.18 }} />}
          <Polyline positions={employee.route.map((point) => [point.latitude, point.longitude])} pathOptions={{ color, weight: selected ? 5 : 3, opacity: selected ? 0.96 : 0.38 }} />
          {selected && employee.route.map((point, index) => {
            if (point.type === "TRACK" && index % 6 !== 0) return null;
            const pointColor = point.type === "MARK_IN" ? "#22c55e" : point.type === "MARK_OUT" ? "#f43f5e" : point.type === "TRIGGER" ? "#a855f7" : color;
            return <CircleMarker key={`${employee.empId}-${index}`} center={[point.latitude, point.longitude]} radius={point.type === "TRACK" ? 3 : 7} pathOptions={{ color: "#e0f2fe", weight: 2, fillColor: pointColor, fillOpacity: 1 }}><Tooltip><strong>{point.type.replaceAll("_", " ")}</strong><br />{timeText(point.capturedAt)}{point.locationName ? <><br />{point.locationName}</> : null}</Tooltip></CircleMarker>;
          })}
          <Marker position={[lastPoint.latitude, lastPoint.longitude]} icon={directionIcon(employee, selected)} interactive={false} />
        </Fragment>;
      })}
      <MarkerClusterGroup chunkedLoading showCoverageOnHover={false} maxClusterRadius={45} iconCreateFunction={clusterIcon}>
        {locations.map((employee) => <Marker key={employee.empId} position={[employee.latitude, employee.longitude]} icon={employeeIcon(employee, employee.empId === selectedEmployee.empId)} eventHandlers={{ click: () => onSelectEmployee?.(employee.empId) }}><Tooltip direction="top" offset={[0, -60]} className="team-live-tooltip"><strong>{employee.name}</strong><br />{employee.locationName}</Tooltip></Marker>)}
      </MarkerClusterGroup>
    </MapContainer>
    <div className="pointer-events-none absolute inset-0 z-[500] bg-[linear-gradient(90deg,rgba(2,8,23,.16),transparent_30%,transparent_70%,rgba(2,8,23,.28))]" />
    <div className="absolute left-4 top-4 z-[600] flex gap-2"><button type="button" className="team-map-control" onClick={() => setLightMap((value) => !value)}><Satellite className="size-4" />{lightMap ? "Dark map" : "Light map"}</button><button type="button" className="team-map-control" aria-label="Center selected employee" onClick={() => setFocusKey((value) => value + 1)}><Crosshair className="size-4" /></button></div>
    {selectedEmployee && selectedStatus && <aside className="absolute bottom-24 right-4 top-4 z-[600] hidden w-[290px] overflow-y-auto rounded-2xl border border-cyan-300/20 bg-slate-950/90 p-4 text-white shadow-2xl backdrop-blur-xl lg:block">
      <div className="flex items-center gap-3"><Image src={selectedEmployee.photo ? `/api/files/employees/${encodeURIComponent(selectedEmployee.photo)}` : "/default-avatar.jpg"} alt={selectedEmployee.name} width={48} height={48} unoptimized className="size-12 rounded-full border-2 border-cyan-300 object-cover" /><div className="min-w-0 flex-1"><p className="truncate font-semibold">{selectedEmployee.name}</p><p className={`mt-0.5 flex items-center gap-1.5 text-xs ${selectedStatus.tone}`}><span className={`size-2 rounded-full ${selectedStatus.dot}`} />{selectedStatus.label}</p></div></div>
      <div className="mt-5 rounded-xl border border-cyan-300/15 bg-cyan-400/5 p-4 text-center"><Clock3 className="mx-auto size-5 text-cyan-300" /><p className="mt-2 text-3xl font-semibold tracking-tight">{elapsedTime(selectedEmployee)}</p><p className="mt-1 text-xs text-cyan-200/70">Today on duty</p></div>
      <div className="mt-4 grid grid-cols-2 gap-2"><div className="team-map-stat"><Route /><strong>{((selectedEmployee.totalDistanceMeters || 0) / 1000).toFixed(1)} km</strong><span>Distance</span></div><div className="team-map-stat"><Gauge /><strong>{latestSpeed(selectedEmployee)}</strong><span>Current speed</span></div></div>
      <div className="mt-4 space-y-2 border-y border-white/10 py-4 text-sm"><div className="flex items-center justify-between"><span className="flex items-center gap-2 text-slate-400"><Radio className="size-4" />GPS signal</span><strong className="text-emerald-300">Strong</strong></div><div className="flex items-center justify-between"><span className="flex items-center gap-2 text-slate-400"><BatteryMedium className="size-4" />Last sync</span><strong>{new Date(selectedEmployee.receivedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</strong></div></div>
      <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Today&apos;s route</p><div className="mt-3 space-y-3"><RouteEvent icon={<MapPin className="size-4" />} label="Mark in" value={timeText(selectedEmployee.markInAt)} tone="bg-emerald-500" /><RouteEvent icon={<Navigation className="size-4" />} label="Current location" value={selectedEmployee.locationName} tone="bg-cyan-500" /><RouteEvent icon={<CheckCircle2 className="size-4" />} label="Mark out" value={selectedEmployee.markOutAt ? timeText(selectedEmployee.markOutAt) : "Still working"} tone="bg-slate-600" /></div></div>
    </aside>}
    <div className="absolute bottom-3 left-3 right-3 z-[600] overflow-x-auto rounded-2xl border border-cyan-300/20 bg-slate-950/90 p-2 shadow-2xl backdrop-blur-xl lg:right-[322px]"><div className="flex min-w-max items-center gap-1">{locations.map((employee) => {
      const selected = employee.empId === selectedEmployee.empId;
      const status = statusFor(employee);
      return <button type="button" key={employee.empId} onClick={() => onSelectEmployee?.(employee.empId)} className={`flex min-w-44 items-center gap-2.5 rounded-xl px-3 py-2 text-left text-white transition ${selected ? "bg-cyan-400/15 ring-1 ring-cyan-300" : "hover:bg-white/8"}`}><Image src={employee.photo ? `/api/files/employees/${encodeURIComponent(employee.photo)}` : "/default-avatar.jpg"} alt="" width={36} height={36} unoptimized className="size-9 rounded-full border-2 object-cover" style={{ borderColor: colorForEmployee(employee.empId) }} /><span className="min-w-0"><span className="block max-w-28 truncate text-sm font-semibold">{employee.name}</span><span className={`mt-0.5 flex items-center gap-1.5 text-[11px] ${status.tone}`}><span className={`size-1.5 rounded-full ${status.dot}`} />{status.label}</span></span></button>;
    })}</div></div>
  </div>;
}

function RouteEvent({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return <div className="flex gap-3"><span className={`grid size-8 shrink-0 place-items-center rounded-full text-white ${tone}`}>{icon}</span><span className="min-w-0"><span className="block text-xs font-semibold">{label}</span><span className="mt-0.5 block truncate text-[11px] text-slate-400">{value}</span></span></div>;
}
