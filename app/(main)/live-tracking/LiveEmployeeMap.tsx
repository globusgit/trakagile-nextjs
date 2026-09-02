"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";

export type LivePoint = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  locationName?: string;
  capturedAt?: string;
  receivedAt: string;
};

function FitPoints({ points }: { points: LivePoint[] }) {
  const map = useMap();
  useEffect(() => {
    const bounds = points.map((point) => [point.latitude, point.longitude] as [number, number]);
    if (bounds.length === 1) map.setView(bounds[0], 16);
    else map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, [map, points]);
  return null;
}

function label(point: LivePoint) {
  return point.locationName || `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`;
}

export default function LiveEmployeeMap({ latest, triggers, movements }: { latest: LivePoint; triggers: LivePoint[]; movements: LivePoint[] }) {
  const reliableMovements = movements.filter((point) => point.accuracy == null || point.accuracy <= 200);
  const points = [...reliableMovements, ...triggers, latest];
  return <MapContainer center={[latest.latitude, latest.longitude]} zoom={16} scrollWheelZoom className="h-[420px] w-full rounded-md border">
    <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <FitPoints points={points} />
    {reliableMovements.length > 1 && <Polyline positions={reliableMovements.map((point) => [point.latitude, point.longitude])} pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.8 }} />}
    {triggers.map((point, index) => <CircleMarker key={`${point.receivedAt}-${index}`} center={[point.latitude, point.longitude]} radius={7} pathOptions={{ color: "white", weight: 2, fillColor: "#7c3aed", fillOpacity: 1 }}>
      <Tooltip direction={index % 2 ? "bottom" : "top"}><strong>Trigger {index + 1}</strong></Tooltip>
      <Popup><strong>Triggered location</strong><br />{label(point)}<br />{new Date(point.capturedAt || point.receivedAt).toLocaleString("en-IN")}</Popup>
    </CircleMarker>)}
    <CircleMarker center={[latest.latitude, latest.longitude]} radius={10} pathOptions={{ color: "white", weight: 3, fillColor: "#f59e0b", fillOpacity: 1 }}>
      <Tooltip permanent direction="top"><strong>LIVE</strong></Tooltip>
      <Popup><strong>Latest location</strong><br />{label(latest)}<br />{new Date(latest.receivedAt).toLocaleString("en-IN")}</Popup>
    </CircleMarker>
  </MapContainer>;
}
