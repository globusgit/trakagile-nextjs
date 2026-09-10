import { TRACKING_INTERVAL_MS } from "./trackingPolicy.mjs";

// Owned by the shared layout: changing pages must not stop an active shift.
export function createAttendanceTracker({ getAttendance, getPosition, sendLocation, onUpdate, onError }) {
  let stopped = false;
  let busy = false;

  return {
    async tick() {
      if (stopped || busy) return;
      busy = true;
      try {
        const attendance = await getAttendance();
        if (stopped || attendance?.status !== "IN" || attendance.attendanceType === "WORK_FROM_HOME") return;
        // Focus/online events and multiple tabs must not create extra captures
        // between scheduled updates. Mark-in's initial fix starts the cadence.
        const lastCapture = new Date(attendance.lastLocationReceivedAt || 0).getTime();
        if (lastCapture > 0 && Date.now() - lastCapture < TRACKING_INTERVAL_MS) return;
        const position = await getPosition();
        if (stopped) return;
        const result = await sendLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          heading: position.coords.heading,
          capturedAt: new Date(position.timestamp).toISOString(),
          clientPointId: `browser-${attendance._id}-${position.timestamp}`,
          minuteTrigger: true,
        });
        if (stopped) return;
        if (result.accepted === false) throw new Error(result.message || `Location rejected: ${result.reason}`);
        onUpdate(result);
      } catch (error) {
        if (!stopped) onError(error);
      } finally {
        busy = false;
      }
    },
    stop() { stopped = true; },
  };
}
