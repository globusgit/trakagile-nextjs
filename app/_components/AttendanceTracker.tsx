"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { createAttendanceTracker } from "@/lib/browserAttendanceTracking.mjs";

export default function AttendanceTracker() {
  const { data: session, status } = useSession();
  const empId = session?.user?.empId;
  const orgId = session?.user?.orgId;

  useEffect(() => {
    if (status !== "authenticated" || !empId || !orgId) return;
    const controller = new AbortController();
    const request = async (url: string, options: RequestInit = {}) => {
      const response = await fetch(url, {
        ...options,
        cache: "no-store",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to sync attendance location.");
      return result;
    };
    const tracker = createAttendanceTracker({
      getAttendance: async () => (await request("/api/attendance/today")).attendance,
      getPosition: () => new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("This browser does not support location tracking."));
        navigator.geolocation.getCurrentPosition(resolve, (error) => reject(new Error(
          error.code === 1
            ? "Tracking paused. Allow Location for this site in browser settings."
            : "GPS update failed. Check device location and keep TrakAgile open; retrying every minute.",
        )), { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 });
      }),
      sendLocation: (point: Record<string, unknown>) => request("/api/attendance/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(point),
      }),
      onUpdate: (result: Record<string, unknown>) => {
        toast.dismiss("attendance-tracking");
        window.dispatchEvent(new CustomEvent("attendance-location-updated", { detail: result }));
      },
      onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Location sync failed; retrying every minute.", { id: "attendance-tracking" }),
    });
    const tick = () => { void tracker.tick(); };
    const resume = () => { if (document.visibilityState === "visible") tick(); };
    tick();
    const timer = window.setInterval(tick, 60_000);
    window.addEventListener("attendance-changed", tick);
    window.addEventListener("online", tick);
    document.addEventListener("visibilitychange", resume);
    return () => {
      tracker.stop();
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("attendance-changed", tick);
      window.removeEventListener("online", tick);
      document.removeEventListener("visibilitychange", resume);
      toast.dismiss("attendance-tracking");
    };
  }, [status, empId, orgId]);

  return null;
}
