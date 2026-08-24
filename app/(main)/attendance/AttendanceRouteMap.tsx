"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flag, MapPin, Navigation, Route } from "lucide-react";

export type RoutePoint = {
  _id?: string; latitude: number; longitude: number; accuracy?: number; capturedAt?: string;
  receivedAt?: string; locationName?: string; locationNameRefreshed?: boolean;
};
export type RouteEnd = RoutePoint & { recordedAt?: string };
export type RouteMeta = { status: "IN" | "OUT"; distanceMeters: number; start: RouteEnd | null; end: RouteEnd | null };

function FitRoute({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 1) map.setView(positions[0], 16);
    else if (positions.length > 1) map.fitBounds(positions, { padding: [40, 40], maxZoom: 16 });
  }, [map, positions]);
  return null;
}

function time(value?: string) {
  return value ? new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";
}

function place(point?: RoutePoint | null) {
  return point?.locationName || (point ? `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}` : "Location unavailable");
}

function distanceBetween(first: RoutePoint, second: RoutePoint) {
  const radians = (value: number) => value * Math.PI / 180;
  const latitude = radians(second.latitude - first.latitude);
  const longitude = radians(second.longitude - first.longitude);
  const a = Math.sin(latitude / 2) ** 2 + Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude)) * Math.sin(longitude / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pointTime(point: RoutePoint) {
  return new Date((point as RouteEnd).recordedAt || point.capturedAt || point.receivedAt || 0).getTime();
}

function shortPlace(point: RoutePoint) {
  const name = place(point).split(",")[0];
  return name.length > 28 ? `${name.slice(0, 27)}…` : name;
}

export default function AttendanceRouteMap({ points, route }: { points: RoutePoint[]; route: RouteMeta }) {
  const reliable = points.filter((point) => point.accuracy == null || point.accuracy <= 200);
  const stops: { point: RoutePoint; minutes: number }[] = [];
  let stopStart = 0;
  for (let index = 1; index <= reliable.length; index += 1) {
    const stillNear = index < reliable.length && distanceBetween(reliable[stopStart], reliable[index]) <= 75;
    if (stillNear) continue;
    const lastIndex = index - 1;
    const duration = (pointTime(reliable[lastIndex]) - pointTime(reliable[stopStart])) / 60000;
    if (duration >= 5) stops.push({ point: reliable[Math.floor((stopStart + lastIndex) / 2)], minutes: Math.round(duration) });
    stopStart = index;
  }
  const rawLinePoints = [route.start, ...reliable, route.end].filter(Boolean) as RoutePoint[];
  const linePoints = rawLinePoints.filter((point, index) => index === 0 || point.locationNameRefreshed || index === rawLinePoints.length - 1 || distanceBetween(rawLinePoints[index - 1], point) >= 10);
  const positions = linePoints.map((point) => [point.latitude, point.longitude] as [number, number]);
  const triggers = reliable.filter((point) => point.locationNameRefreshed);
  const latest = route.end || reliable.at(-1) || route.start;
  if (!route.start || !latest || !positions.length) return null;

  const continuousSegments: [number, number][][] = [];
  const gpsGaps: [number, number][][] = [];
  let segment: [number, number][] = [positions[0]];
  for (let index = 1; index < linePoints.length; index += 1) {
    const previous = linePoints[index - 1];
    const current = linePoints[index];
    const meters = distanceBetween(previous, current);
    const elapsedSeconds = Math.max(1, (pointTime(current) - pointTime(previous)) / 1000);
    const isGap = elapsedSeconds > 5 * 60 || meters / elapsedSeconds > 55;
    if (isGap) {
      if (segment.length > 1) continuousSegments.push(segment);
      gpsGaps.push([[previous.latitude, previous.longitude], [current.latitude, current.longitude]]);
      segment = [[current.latitude, current.longitude]];
    } else {
      segment.push([current.latitude, current.longitude]);
    }
  }
  if (segment.length > 1) continuousSegments.push(segment);

  return <Card className="overflow-hidden">
    <CardHeader className="pb-3"><CardTitle className="flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-2"><Route className="size-5 text-cyan-700" />Today&apos;s location history</span><div className="flex gap-2"><Badge variant="secondary">{reliable.length} GPS points</Badge><Badge className="bg-cyan-100 text-cyan-900 hover:bg-cyan-100">{(route.distanceMeters / 1000).toFixed(2)} km</Badge></div></CardTitle><p className="text-sm text-muted-foreground">Route, location triggers, start and {route.end ? "end" : "latest position"} from saved GPS updates.</p></CardHeader>
    <CardContent className="space-y-4">
      <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-600"><span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-emerald-600" />Start</span><span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-violet-600" />Triggered location</span><span className="flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-cyan-600" />5+ min stop</span><span className="flex items-center gap-1.5"><i className={`size-2.5 rounded-full ${route.end ? "bg-red-600" : "bg-amber-500"}`} />{route.end ? "End" : "Latest"}</span>{gpsGaps.length ? <span className="flex items-center gap-1.5"><i className="w-5 border-t-2 border-dashed border-slate-400" />GPS data gap</span> : null}<span className="text-muted-foreground">{triggers.length} triggers · {stops.length} stops</span></div>
      <MapContainer center={positions[0]} zoom={14} scrollWheelZoom className="h-[430px] w-full rounded-xl border">
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitRoute positions={positions} />
        {continuousSegments.map((routeSegment, index) => <Polyline key={`route-${index}`} positions={routeSegment} pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.82 }} />)}
        {gpsGaps.map((gap, index) => <Polyline key={`gap-${index}`} positions={gap} pathOptions={{ color: "#64748b", weight: 3, opacity: 0.7, dashArray: "8 10" }}><Tooltip>GPS updates are missing between these locations. This is not a confirmed travelled route.</Tooltip></Polyline>)}
        {stops.map((stop, index) => <CircleMarker key={`stop-${index}`} center={[stop.point.latitude, stop.point.longitude]} radius={7} pathOptions={{ color: "white", weight: 2, fillColor: "#0891b2", fillOpacity: 1 }}><Tooltip permanent direction="right" offset={[7, 0]}><strong>STOP {index + 1}</strong> · {stop.minutes} min</Tooltip><Popup><strong>Stationary for about {stop.minutes} minutes</strong><br />{place(stop.point)}<br /><span className="text-xs text-slate-500">Detected from consecutive GPS samples within 75 metres.</span></Popup></CircleMarker>)}
        <CircleMarker center={[route.start.latitude, route.start.longitude]} radius={9} pathOptions={{ color: "white", weight: 3, fillColor: "#059669", fillOpacity: 1 }}><Tooltip permanent direction="top" offset={[0, -7]}><strong>START</strong> · {shortPlace(route.start)}</Tooltip><Popup><strong>Start · {time(route.start.recordedAt)}</strong><br />{place(route.start)}</Popup></CircleMarker>
        {triggers.map((point, index) => <CircleMarker key={point._id || `trigger-${index}`} center={[point.latitude, point.longitude]} radius={7} pathOptions={{ color: "white", weight: 2, fillColor: "#7c3aed", fillOpacity: 1 }}><Tooltip permanent direction={index % 2 ? "bottom" : "top"} offset={[0, index % 2 ? 7 : -7]}><strong>T{index + 1}</strong> · {shortPlace(point)}</Tooltip><Popup><div className="min-w-52"><strong>Location trigger {index + 1}</strong><br />{place(point)}<br /><span className="text-xs text-slate-500">{time(point.capturedAt || point.receivedAt)}</span></div></Popup></CircleMarker>)}
        <CircleMarker center={[latest.latitude, latest.longitude]} radius={9} pathOptions={{ color: "white", weight: 3, fillColor: route.end ? "#dc2626" : "#f59e0b", fillOpacity: 1 }}><Tooltip permanent direction="top" offset={[0, -7]}><strong>{route.end ? "END" : "LATEST"}</strong> · {shortPlace(latest)}</Tooltip><Popup><strong>{route.end ? "End" : "Latest"} · {time(route.end?.recordedAt || latest.capturedAt || latest.receivedAt)}</strong><br />{place(latest)}</Popup></CircleMarker>
      </MapContainer>
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_180px]">
        <div className="rounded-xl border bg-emerald-50/60 p-4"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-800"><Navigation className="size-4" />Start · {time(route.start.recordedAt)}</p><p className="mt-2 text-sm leading-relaxed">{place(route.start)}</p></div>
        <div className={`rounded-xl border p-4 ${route.end ? "bg-red-50/60" : "bg-amber-50/60"}`}><p className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${route.end ? "text-red-800" : "text-amber-800"}`}><Flag className="size-4" />{route.end ? "End" : "Latest"} · {time(route.end?.recordedAt || latest.capturedAt || latest.receivedAt)}</p><p className="mt-2 text-sm leading-relaxed">{place(latest)}</p></div>
        <div className="rounded-xl border bg-cyan-50/60 p-4"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-900"><MapPin className="size-4" />Distance</p><p className="mt-2 text-2xl font-bold text-cyan-950">{(route.distanceMeters / 1000).toFixed(2)} km</p><p className="text-xs text-muted-foreground">Recorded GPS distance</p></div>
      </div>
      {gpsGaps.length ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>{gpsGaps.length} GPS data gap{gpsGaps.length === 1 ? "" : "s"} detected.</strong> Dashed lines only connect missing samples; they are not presented as the employee&apos;s actual road route.</p> : null}
      {triggers.length ? <details className="rounded-lg border" open><summary className="cursor-pointer p-3 text-sm font-medium">Triggered location sequence ({triggers.length})</summary><div className="max-h-72 divide-y overflow-y-auto border-t">{triggers.map((point, index) => <div key={point._id || index} className="grid gap-1 p-3 text-sm sm:grid-cols-[130px_1fr]"><span className="font-medium text-violet-700">T{index + 1} · {time(point.capturedAt || point.receivedAt)}</span><span className="text-muted-foreground">{place(point)}</span></div>)}</div></details> : <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No named location boundary was crossed yet. A trigger is recorded after a significant location change.</p>}
    </CardContent>
  </Card>;
}
