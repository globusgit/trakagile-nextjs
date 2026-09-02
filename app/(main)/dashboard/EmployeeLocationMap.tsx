"use client";

import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { Fragment, useEffect } from "react";
import { Clock3, MapPin, Navigation } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";

type RoutePoint = {
  latitude: number; longitude: number; capturedAt: string; locationName?: string | null;
  speed?: number | null; heading?: number | null; type: "MARK_IN" | "TRACK" | "TRIGGER" | "LIVE" | "MARK_OUT";
};

export type EmployeeLocation = {
  empId: string; name: string; designation: string; photo?: string | null;
  latitude: number; longitude: number; locationName: string; receivedAt: string; presentToday: boolean;
  attendanceDate: string; markInAt?: string | null; markOutAt?: string | null; attendanceStatus: "IN" | "OUT";
  route: RoutePoint[];
};

const timeText = (value?: string | null) => value
  ? new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
  : "—";

function FitLocations({ locations }: { locations: EmployeeLocation[] }) {
  const map = useMap();
  useEffect(() => {
    if (!locations.length) return;
    const bounds = L.latLngBounds(locations.map((item) => [item.latitude, item.longitude]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
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

function FocusEmployee({ employee }: { employee?: EmployeeLocation }) {
  const map = useMap();
  useEffect(() => { if (employee) map.flyTo([employee.latitude, employee.longitude], 16, { duration: 0.7 }); }, [employee, map]);
  return null;
}

function employeeIcon(employee: EmployeeLocation) {
  const photo = employee.photo
    ? `/api/files/employees/${encodeURIComponent(employee.photo)}`
    : "/default-avatar.jpg";
  const status = employee.presentToday ? "#16a34a" : "#f59e0b";
  return L.divIcon({
    className: "employee-map-marker",
    html: `<div style="width:46px;height:46px;border-radius:50%;padding:3px;background:white;border:3px solid ${status};box-shadow:0 6px 18px rgba(15,23,42,.28)"><img src="${photo}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover" /></div>`,
    iconSize: [46, 46], iconAnchor: [23, 46], popupAnchor: [0, -48],
  });
}

const clusterIcon = (cluster: { getChildCount: () => number }) => L.divIcon({
  className: "employee-location-cluster",
  html: `<div><strong>${cluster.getChildCount()}</strong><span>employees</span></div>`,
  iconSize: [64, 64],
  iconAnchor: [32, 32],
});

const routeColors = ["#0284c7", "#7c3aed", "#dc2626", "#0891b2", "#c2410c", "#4f46e5"];
const colorForEmployee = (empId: string) => routeColors[[...empId].reduce((sum, character) => sum + character.charCodeAt(0), 0) % routeColors.length];

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

function directionIcon(employee: EmployeeLocation) {
  const color = colorForEmployee(employee.empId);
  const bearing = movementBearing(employee.route);
  return L.divIcon({
    className: "employee-direction-marker",
    html: `<div style="color:${color};transform:rotate(${bearing}deg)">${renderToStaticMarkup(<Navigation size={24} fill="currentColor" />)}</div>`,
    iconSize: [28, 28], iconAnchor: [14, 14],
  });
}

export default function EmployeeLocationMap({ locations, fullScreen = false, selectedEmpId, onSelectEmployee }: { locations: EmployeeLocation[]; fullScreen?: boolean; selectedEmpId?: string | null; onSelectEmployee?: (empId: string) => void }) {
  const selectedEmployee = locations.find((employee) => employee.empId === selectedEmpId);
  if (!locations.length) return <div className={`grid place-items-center rounded-xl bg-slate-100 text-slate-500 ${fullScreen ? "h-[calc(100vh-110px)]" : "h-[620px]"}`}>No employee location has been received yet.</div>;
  return (
    <MapContainer center={[locations[0].latitude, locations[0].longitude]} zoom={12} scrollWheelZoom className={`w-full rounded-xl ${fullScreen ? "h-[calc(100vh-110px)]" : "h-[620px]"}`}>
      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitLocations locations={locations} />
      <ResizeMap fullScreen={fullScreen} />
      <FocusEmployee employee={selectedEmployee} />
      {locations.filter((employee) => employee.empId === selectedEmpId).map((employee) => {
        if (employee.route.length < 2) return null;
        const color = colorForEmployee(employee.empId);
        const lastPoint = employee.route.at(-1)!;
        return <Fragment key={`${employee.empId}-route`}>
          <Polyline positions={employee.route.map((point) => [point.latitude, point.longitude])} pathOptions={{ color, weight: 5, opacity: 0.82 }} />
          {employee.route.map((point, index) => {
            if (point.type === "TRACK" && index % 4 !== 0) return null;
            const pointColor = point.type === "MARK_IN" ? "#16a34a" : point.type === "MARK_OUT" ? "#dc2626" : point.type === "LIVE" ? "#f59e0b" : point.type === "TRIGGER" ? "#7c3aed" : color;
            return <CircleMarker key={`${employee.empId}-${index}`} center={[point.latitude, point.longitude]} radius={point.type === "TRACK" ? 3 : 6} pathOptions={{ color: "#fff", weight: 2, fillColor: pointColor, fillOpacity: 1 }}><Tooltip><strong>{employee.name}</strong><br />{point.type.replaceAll("_", " ")} · {new Date(point.capturedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}{point.locationName ? <><br />{point.locationName}</> : null}</Tooltip></CircleMarker>;
          })}
          <Marker position={[lastPoint.latitude, lastPoint.longitude]} icon={directionIcon(employee)} interactive={false} />
        </Fragment>;
      })}
      <MarkerClusterGroup
        chunkedLoading
        spiderfyOnMaxZoom
        showCoverageOnHover={false}
        zoomToBoundsOnClick
        maxClusterRadius={45}
        iconCreateFunction={clusterIcon}
      >
      {locations.map((employee) => (
        <Marker key={employee.empId} position={[employee.latitude, employee.longitude]} icon={employeeIcon(employee)} eventHandlers={{ click: () => onSelectEmployee?.(employee.empId) }}>
          <Tooltip permanent direction="top" offset={[0, -46]} opacity={1} className="employee-location-label">
            <button type="button" className="min-w-52 max-w-64 text-left" title="Click to live track this employee">
              <span className="block truncate font-bold text-slate-900">{employee.name}</span>
              <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-600"><MapPin className="size-3 shrink-0 text-cyan-700" />{employee.locationName}</span>
              <span className="mt-2 block border-t pt-1.5 text-[11px] font-semibold text-slate-500">Attendance · {employee.attendanceDate}</span>
              <span className="mt-1 grid grid-cols-2 gap-2 text-xs text-slate-700">
                <span className="flex items-center gap-1"><Clock3 className="size-3 text-emerald-600" />In: {timeText(employee.markInAt)}</span>
                <span className="flex items-center gap-1"><Clock3 className="size-3 text-amber-600" />Out: {employee.markOutAt ? timeText(employee.markOutAt) : employee.attendanceStatus === "IN" ? "Working" : "—"}</span>
              </span>
            </button>
          </Tooltip>
          <Popup><div className="min-w-52"><p className="font-bold">{employee.name}</p><p>{employee.empId} · {employee.designation}</p><p className="mt-2 text-xs">{employee.locationName}</p><p className="mt-2 text-xs"><strong>Mark In:</strong> {timeText(employee.markInAt)} · <strong>Mark Out:</strong> {employee.markOutAt ? timeText(employee.markOutAt) : employee.attendanceStatus === "IN" ? "Currently working" : "—"}</p><p className="mt-1 text-xs text-slate-500">Last known: {new Date(employee.receivedAt).toLocaleString("en-IN")}</p></div></Popup>
        </Marker>
      ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
