"use client";

import LiveEmployeeMap from "../live-tracking/LiveEmployeeMap";

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

// Dashboard and Live Tracking share the same map, status and event presentation.
export default function EmployeeLocationMap({ locations, fullScreen = false, selectedEmpId, onSelectEmployee }: {
  locations: EmployeeLocation[];
  fullScreen?: boolean;
  selectedEmpId?: string | null;
  onSelectEmployee?: (empId: string) => void;
}) {
  return <LiveEmployeeMap locations={locations} fullScreen={fullScreen} selectedEmpId={selectedEmpId} onSelectEmployee={onSelectEmployee} />;
}