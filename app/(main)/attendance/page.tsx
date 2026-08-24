"use client";

import PageHeader from "@/app/_components/PageHeader";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  Clock3,
  LocateFixed,
  MapPin,
  Navigation,
  Plus,
  Route,
  TriangleAlert,
  UserRound,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import type { RouteMeta } from "./AttendanceRouteMap";

const AttendanceRouteMap = dynamic(() => import("./AttendanceRouteMap"), {
  ssr: false,
  loading: () => <div className="h-[430px] animate-pulse rounded-xl bg-slate-100" />,
});

/* =========================================================
   TYPES
========================================================= */

type SessionUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  empId?: string;
  orgId?: string;
  role?: string;
};

type Site = {
  _id: string;
  clientName: string;
  siteName: string;
  address?: string;
  contactPerson?: string;
  mobile?: string;
};

type Visit = {
  _id: string;

  purpose: string;
  remarks?: string;

  startTime: string;
  endTime?: string;

  durationMinutes?: number;

  status:
    | "IN_PROGRESS"
    | "COMPLETED";

  clientSiteId: Site;
};

type AttendanceLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  capturedAt?: string;
  locationName?: string;
};

type TrackingPoint = AttendanceLocation & {
  _id: string;
  receivedAt?: string;
  speed?: number;
  heading?: number;
  locationName?: string;
  locationNameRefreshed?: boolean;
};

type Attendance = {
  _id: string;

  attendanceDate?: string;

  markIn: {
    time: string;
    location?: AttendanceLocation;
  };

  markOut?: {
    time?: string;
    location?: AttendanceLocation;
  };

  status: "IN" | "OUT";

  trackingStatus: string;

  lastLocationReceivedAt?: string;

  lastKnownLocation?: AttendanceLocation;
  lastKnownLocationName?: string;

  totalVisits: number;

  totalWorkedMinutes?: number;

  totalDistanceMeters?: number;

  attendanceType?: "OFFICE" | "FIELD_VISIT" | "WORK_FROM_HOME";
  isEarlyStart?: boolean;
  expectedWorkEndAt?: string;
  overnightWork?: boolean;
  wfh?: { breakStartedAt?: string; totalBreakMinutes?: number; dailySummary?: string; pendingTasks?: string; blockers?: string };

  workMode?: "NORMAL" | "OVERTIME";

  overtime?: {
    active?: boolean;
    reason?: string;
    startedAt?: string;
    expectedEndAt?: string;
    endedAt?: string;
  };

  closureType?: "MANUAL" | "AUTO" | "REGULARIZED";

  autoMarkOutReason?: string;
};

type WorkStatus = {
  state: string;
  confidence: string;
  label: string;
  reason: string;
};

type AttendancePolicy = {
  timeZone: string;
  shiftStartMinutes: number;
  shiftEndMinutes: number;
  reminderBeforeMinutes: number;
  reminderAfterMinutes: number[];
  autoCloseMinutes: number;
  overtimeGraceMinutes: number;
};

/* =========================================================
   GPS
========================================================= */

function getPosition(): Promise<GeolocationPosition> {
  return new Promise(
    (resolve, reject) => {
      if (!navigator.geolocation) {
        reject(
          new Error(
            "Location is not supported by this browser."
          )
        );

        return;
      }

      navigator.geolocation.getCurrentPosition(
        resolve,
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            reject(
              new Error(
                "Location permission is blocked. Allow Location for localhost in browser settings and try again."
              )
            );
            return;
          }

          if (error.code === error.POSITION_UNAVAILABLE) {
            reject(
              new Error(
                "Your current location is unavailable. Turn on device location and try again."
              )
            );
            return;
          }

          if (error.code === error.TIMEOUT) {
            reject(
              new Error(
                "Location request timed out. Move near a window or enable precise location and try again."
              )
            );
            return;
          }

          reject(new Error("Unable to read your current location."));
        },
        {
          enableHighAccuracy: true,

          timeout: 10000,

          maximumAge: 15000,
        }
      );
    }
  );
}

function wfhDevicePayload() {
  let deviceId = window.localStorage.getItem("trakagile-wfh-device-id");
  if (!deviceId) {
    deviceId = window.crypto.randomUUID();
    window.localStorage.setItem("trakagile-wfh-device-id", deviceId);
  }
  const userAgent = navigator.userAgent;
  const deviceType = /Android|iPhone|iPad|Mobile/i.test(userAgent) ? "Mobile" : "Desktop";
  const browser = /Edg\//.test(userAgent) ? "Edge" : /Chrome\//.test(userAgent) ? "Chrome" : /Firefox\//.test(userAgent) ? "Firefox" : /Safari\//.test(userAgent) ? "Safari" : "Browser";
  return { deviceId, deviceType, platform: navigator.platform || "Unknown", browser };
}

function gps(
  position: GeolocationPosition
) {
  const {
    latitude,
    longitude,
    accuracy,
    speed,
    heading,
  } = position.coords;

  return {
    latitude,
    longitude,
    accuracy,

    speed:
      speed == null
        ? null
        : speed,

    heading:
      heading == null
        ? null
        : heading,

    capturedAt:
      new Date(
        position.timestamp
      ).toISOString(),
  };
}

/* =========================================================
   API HELPER
========================================================= */

async function api(
  url: string,
  options?: RequestInit
) {
  const response = await fetch(
    url,
    {
      ...options,

      cache: "no-store",
    }
  );

  let result;

  try {
    result =
      await response.json();
  } catch {
    result = {};
  }

  if (!response.ok) {
    throw new Error(
      result.message ||
        result.error ||
        "Request failed."
    );
  }

  return result;
}

/* =========================================================
   FORMATTERS
========================================================= */

const time = (
  value?: string
) => {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(
    new Date(value)
  );
};

function formatMinutes(
  minutes?: number
) {
  if (
    minutes == null ||
    minutes < 0
  ) {
    return "—";
  }

  const hours =
    Math.floor(minutes / 60);

  const mins =
    minutes % 60;

  if (hours === 0) {
    return `${mins} min`;
  }

  return `${hours}h ${mins}m`;
}

function formatDistance(meters?: number) {
  if (meters == null || meters < 0) return "0 m";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

function minutesInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value || 0);
  return value("hour") * 60 + value("minute");
}

function dateKeyInZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatPolicyTime(minutes: number) {
  const date = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60);
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function dateTimeLocalValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function accuracyDetails(accuracy?: number) {
  if (accuracy == null) {
    return { label: "Accuracy unavailable", className: "bg-muted text-muted-foreground" };
  }
  if (accuracy <= 25) {
    return { label: `Good · ±${Math.round(accuracy)} m`, className: "bg-emerald-100 text-emerald-800" };
  }
  if (accuracy <= 75) {
    return { label: `Fair · ±${Math.round(accuracy)} m`, className: "bg-amber-100 text-amber-800" };
  }
  return { label: `Low · ±${Math.round(accuracy)} m`, className: "bg-red-100 text-red-800" };
}

function mapUrls(location: AttendanceLocation) {
  const { latitude, longitude } = location;
  const offset = 0.004;
  const bbox = [
    longitude - offset,
    latitude - offset,
    longitude + offset,
    latitude + offset,
  ].join(",");

  return {
    embed: `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
      bbox
    )}&layer=mapnik&marker=${encodeURIComponent(`${latitude},${longitude}`)}`,
    full: `https://www.openstreetmap.org/?mlat=${encodeURIComponent(
      latitude
    )}&mlon=${encodeURIComponent(longitude)}#map=17/${latitude}/${longitude}`,
  };
}

function LocationMap({
  title,
  location,
  recordedAt,
}: {
  title: string;
  location: AttendanceLocation;
  recordedAt?: string;
}) {
  const urls = mapUrls(location);
  const accuracy = accuracyDetails(location.accuracy);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-2">
            <MapPin className="size-4 text-muted-foreground" />
            {title}
          </span>
          <span className="flex items-center gap-2">
            <Badge className={accuracy.className}>{accuracy.label}</Badge>
            <span className="font-normal text-muted-foreground">
              {time(recordedAt || location.capturedAt)}
            </span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {location.locationName && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Address</p>
            <p className="mt-1 leading-relaxed">{location.locationName}</p>
          </div>
        )}
        <iframe
          title={`${title} map`}
          src={urls.embed}
          className="h-52 w-full rounded-lg border"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
        <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Coordinates: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            {location.accuracy != null && ` · ±${Math.round(location.accuracy)} m`}
          </span>
          <a
            href={urls.full}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Open full map
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

function TodayRouteMap({ points, route }: { points: TrackingPoint[]; route: RouteMeta }) {
  return <AttendanceRouteMap points={points} route={route} />;
  /* Previous iframe overlay retained temporarily for an easy source comparison.
  const reliable = points.filter((point) => point.accuracy == null || point.accuracy <= 200);
  if (reliable.length === 0) return null;
  const latitudes = reliable.map((point) => point.latitude);
  const longitudes = reliable.map((point) => point.longitude);
  const minLat = Math.min(...latitudes); const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes); const maxLon = Math.max(...longitudes);
  const latPadding = Math.max((maxLat - minLat) * 0.2, 0.003);
  const lonPadding = Math.max((maxLon - minLon) * 0.2, 0.003);
  const south = minLat - latPadding; const north = maxLat + latPadding;
  const west = minLon - lonPadding; const east = maxLon + lonPadding;
  const line = reliable.map((point) => {
    const x = ((point.longitude - west) / (east - west)) * 100;
    const y = ((north - point.latitude) / (north - south)) * 100;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  const start = line.split(" ")[0]?.split(",").map(Number) || [50, 50];
  const end = line.split(" ").at(-1)?.split(",").map(Number) || [50, 50];
  const embed = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(`${west},${south},${east},${north}`)}&layer=mapnik`;
  const timeline = reliable.slice(-100).reverse();

  return <Card className="overflow-hidden"><CardHeader className="pb-3"><CardTitle className="flex flex-wrap items-center justify-between gap-2"><span>Today&apos;s location history</span><Badge variant="secondary">{reliable.length} GPS point{reliable.length === 1 ? "" : "s"}</Badge></CardTitle><p className="text-sm text-muted-foreground">Combined route from the first reliable position to the latest position.</p></CardHeader><CardContent className="space-y-4">
    <div className="relative h-80 overflow-hidden rounded-lg border bg-muted"><iframe title="Today's location route" src={embed} className="absolute inset-0 h-full w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /><svg aria-label="Today's GPS route" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={line} fill="none" stroke="#2563eb" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /><circle cx={start[0]} cy={start[1]} r="2" fill="#16a34a" stroke="white" strokeWidth="0.7" /><circle cx={end[0]} cy={end[1]} r="2" fill="#dc2626" stroke="white" strokeWidth="0.7" /></svg><div className="absolute left-3 top-3 flex gap-2 text-xs"><span className="rounded bg-white/95 px-2 py-1 shadow"><span className="text-green-600">●</span> Start</span><span className="rounded bg-white/95 px-2 py-1 shadow"><span className="text-red-600">●</span> Latest</span></div></div>
    <div className="grid gap-3 text-sm sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">First position</p><p className="font-medium">{time(reliable[0].capturedAt || reliable[0].receivedAt)}</p></div><div><p className="text-xs text-muted-foreground">Latest position</p><p className="font-medium">{time(reliable.at(-1)?.capturedAt || reliable.at(-1)?.receivedAt)}</p></div><div><p className="text-xs text-muted-foreground">Recorded distance</p><p className="font-medium">Route shown from saved GPS points</p></div></div>
    <details className="rounded-lg border"><summary className="cursor-pointer p-3 text-sm font-medium">View location timeline</summary><div className="max-h-80 divide-y overflow-y-auto border-t">{timeline.map((point, index) => <div key={point._id || `${point.capturedAt}-${index}`} className="grid gap-1 p-3 text-sm sm:grid-cols-[90px_1fr_auto]"><span className="font-medium">{time(point.capturedAt || point.receivedAt)}</span><span className="truncate text-muted-foreground">{point.locationName || `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`}</span><a className="text-xs font-medium text-primary hover:underline" href={mapUrls(point).full} target="_blank" rel="noreferrer">Open map</a></div>)}</div>{reliable.length > 100 && <p className="border-t p-3 text-xs text-muted-foreground">Showing the latest 100 of {reliable.length} points.</p>}</details>
  </CardContent></Card>;
  */
}

/* =========================================================
   PAGE
========================================================= */

export default function AttendancePage() {
  /* -------------------------
     NEXTAUTH
  ------------------------- */

  const {
    data: session,
    status: sessionStatus,
  } = useSession();

  const user =
    session?.user as
      | SessionUser
      | undefined;

  const empId =
    user?.empId || "";

  const orgId =
    user?.orgId || "";

  /* -------------------------
     STATE
  ------------------------- */

  const [
    attendance,
    setAttendance,
  ] =
    useState<Attendance | null>(
      null
    );

  const [
    visits,
    setVisits,
  ] =
    useState<Visit[]>([]);

  const [
    sites,
    setSites,
  ] =
    useState<Site[]>([]);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    initialLoading,
    setInitialLoading,
  ] =
    useState(true);

  const [
    visitOpen,
    setVisitOpen,
  ] =
    useState(false);

  const [
    clientOpen,
    setClientOpen,
  ] =
    useState(false);

  const [
    siteId,
    setSiteId,
  ] =
    useState("");

  const [
    purpose,
    setPurpose,
  ] =
    useState("");

  const [
    remarks,
    setRemarks,
  ] =
    useState("");

  const [
    currentTime,
    setCurrentTime,
  ] =
    useState(
      new Date()
    );

  const [
    client,
    setClient,
  ] =
    useState({
      clientName: "",
      siteName: "",
      address: "",
      contactPerson: "",
      mobile: "",
    });

  const [policy, setPolicy] = useState<AttendancePolicy | null>(null);
  const [workStatus, setWorkStatus] = useState<WorkStatus | null>(null);
  const [todayLocations, setTodayLocations] = useState<TrackingPoint[]>([]);
  const [todayRoute, setTodayRoute] = useState<RouteMeta | null>(null);
  const [wfhEnabled, setWfhEnabled] = useState(false);
  const [wfhDeviceAllowed, setWfhDeviceAllowed] = useState(true);
  const [wfhBoundDevice, setWfhBoundDevice] = useState<{ deviceType?: string; platform?: string; browser?: string; boundAt?: string } | null>(null);
  const [markInOpen, setMarkInOpen] = useState(false);
  const [attendanceType, setAttendanceType] = useState<"OFFICE" | "FIELD_VISIT" | "WORK_FROM_HOME">("OFFICE");
  const [fieldSiteId, setFieldSiteId] = useState("");
  const [fieldPurpose, setFieldPurpose] = useState("");
  const [fieldExpectedEndAt, setFieldExpectedEndAt] = useState(() =>
    dateTimeLocalValue(new Date(Date.now() + 8 * 60 * 60 * 1000))
  );
  const [overnightWork, setOvernightWork] = useState(false);
  const [wfhSummaryOpen, setWfhSummaryOpen] = useState(false);
  const [wfhSummary, setWfhSummary] = useState({ dailySummary: "", pendingTasks: "", blockers: "" });
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [overtimeReason, setOvertimeReason] = useState("");
  const [expectedEndAt, setExpectedEndAt] = useState(() =>
    dateTimeLocalValue(new Date(Date.now() + 60 * 60 * 1000))
  );
  const reminderKeys = useRef(new Set<string>());
  const autoClosePending = useRef(false);

  /* =========================================================
     ACTIVE VISIT
  ========================================================= */

  const activeVisit =
    useMemo(
      () =>
        visits.find(
          (visit) =>
            visit.status ===
            "IN_PROGRESS"
        ),
      [visits]
    );

  /* =========================================================
     WORKING MINUTES
  ========================================================= */

  const workingMinutes =
    useMemo(() => {
      if (
        !attendance?.markIn?.time
      ) {
        return undefined;
      }

      const start =
        new Date(
          attendance.markIn.time
        ).getTime();

      if (
        Number.isNaN(start)
      ) {
        return undefined;
      }

      const end =
        attendance.status ===
          "OUT" &&
        attendance.markOut?.time
          ? new Date(
              attendance.markOut.time
            ).getTime()
          : currentTime.getTime();

      return Math.max(
        0,
        Math.floor(
          (end - start) /
            60000
        )
      );
    }, [
      attendance,
      currentTime,
    ]);

  /* =========================================================
     CLOCK REFRESH
  ========================================================= */

  useEffect(() => {
    const timer =
      window.setInterval(
        () => {
          setCurrentTime(
            new Date()
          );
        },
        30000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, []);

  useEffect(() => {
    if (attendance?.status !== "IN" || attendance.attendanceType !== "WORK_FROM_HOME") return;
    const checkDevice = async () => {
      try {
        const result = await api("/api/wfh/device/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(wfhDevicePayload()) });
        setWfhDeviceAllowed(Boolean(result.allowed));
        setWfhBoundDevice(result.device || null);
      } catch { /* The next refresh retries without interrupting attendance. */ }
    };
    const initial = window.setTimeout(() => void checkDevice(), 0);
    const timer = window.setInterval(() => void checkDevice(), 30_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [attendance?.status, attendance?.attendanceType]);

  /* =========================================================
     REFRESH ATTENDANCE + VISITS + SITES
  ========================================================= */

  const refresh =
    useCallback(
      async () => {
        if (
          !empId ||
          !orgId
        ) {
          return;
        }

        const [
          today,
          clientResult,
          policyResult,
          wfhResult,
          locationsResult,
        ] =
          await Promise.all([
            api("/api/attendance/today"),

            api("/api/attendance/clients"),

            api("/api/attendance/policy"),

            api("/api/wfh/availability"),

            api("/api/attendance/locations/today"),
          ]);

        setAttendance(
          today.attendance ||
            null
        );
        setWorkStatus(today.workStatus || null);

        setVisits(
          Array.isArray(
            today.visits
          )
            ? today.visits
            : []
        );

        setSites(
          Array.isArray(
            clientResult.data
          )
            ? clientResult.data
            : []
        );

        setPolicy(policyResult.data || null);
        setWfhEnabled(Boolean(wfhResult.enabled));
        setTodayLocations(Array.isArray(locationsResult.locations) ? locationsResult.locations : []);
        setTodayRoute(locationsResult.route || null);
        if (today.attendance?.status === "IN" && today.attendance?.attendanceType === "WORK_FROM_HOME") {
          setWfhDeviceAllowed(false);
          const deviceStatus = await api("/api/wfh/device/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(wfhDevicePayload()) });
          setWfhDeviceAllowed(Boolean(deviceStatus.allowed));
          setWfhBoundDevice(deviceStatus.device || null);
        } else {
          setWfhDeviceAllowed(true);
          setWfhBoundDevice(null);
        }
      },
      [
        empId,
        orgId,
      ]
    );

  /* =========================================================
     INITIAL LOAD
  ========================================================= */

  useEffect(() => {
    if (
      sessionStatus ===
      "loading"
    ) {
      return;
    }

    if (sessionStatus !== "authenticated") return;

    if (
      !empId ||
      !orgId
    ) {
      toast.error(
        "Employee ID or organization is missing from login session."
      );

      return;
    }

    let cancelled =
      false;

    const load =
      async () => {
        try {
          await refresh();
        } catch (error) {
          if (
            cancelled
          ) {
            return;
          }

          toast.error(
            error instanceof
              Error
              ? error.message
              : "Unable to load attendance."
          );
        } finally {
          if (
            !cancelled
          ) {
            setInitialLoading(
              false
            );
          }
        }
      };

    load();

    return () => {
      cancelled =
        true;
    };
  }, [
    sessionStatus,
    empId,
    orgId,
    refresh,
  ]);

  /* =========================================================
     CONTINUOUS LOCATION TRACKING

     1. Starts when attendance = IN
     2. Sends immediately
     3. Sends every 60 seconds
     4. Automatically starts again after page refresh
     5. Stops when attendance becomes OUT
  ========================================================= */

  useEffect(() => {
    if (
      attendance?.status !==
        "IN" ||
      attendance.attendanceType === "WORK_FROM_HOME" ||
      !empId ||
      !orgId
    ) {
      return;
    }

    let stopped =
      false;

    const sendLocation =
      async () => {
        if (stopped) {
          return;
        }

        try {
          const position =
            await getPosition();

          if (stopped) {
            return;
          }

          const result = await api(
            "/api/attendance/location",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  {
                    ...gps(
                      position
                    ),
                  }
                ),
            }
          );

          setAttendance((current) =>
            current
              ? {
                  ...current,
                  lastKnownLocation: result.location || current.lastKnownLocation,
                  lastLocationReceivedAt:
                    result.receivedAt || current.lastLocationReceivedAt,
                  totalDistanceMeters:
                    result.totalDistanceMeters ?? current.totalDistanceMeters,
                  lastKnownLocationName:
                    result.locationName || current.lastKnownLocationName,
                  trackingStatus: "ACTIVE",
                }
              : current
          );
        } catch (error) {
          console.warn(
            "Attendance location update skipped:",
            error
          );
        }
      };

    /*
     * Send first location immediately.
     */
    sendLocation();

    /*
     * Continue every minute.
     */
    const interval =
      window.setInterval(
        sendLocation,
        60_000
      );

    return () => {
      stopped = true;

      window.clearInterval(
        interval
      );
    };
  }, [
    attendance?.status,
    attendance?.attendanceType,
    empId,
    orgId,
  ]);

  /* =========================================================
     COMMON GPS POST ACTION
  ========================================================= */

  const withLocation =
    async (
      url: string,
      extra: Record<
        string,
        unknown
      > = {}
    ) => {
      if (
        !empId ||
        !orgId
      ) {
        toast.error(
          "Employee session is not available."
        );

        return false;
      }

      setBusy(true);

      try {
        toast.info(
          "Requesting your current location. Allow location access if the browser asks."
        );

        const position =
          await getPosition();

        await api(
          url,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                ...gps(
                  position
                ),

                ...extra,
              }),
          }
        );

        await refresh();

        return true;
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Unable to update attendance."
        );

        return false;
      } finally {
        setBusy(false);
      }
    };

  /* =========================================================
     MARK IN
  ========================================================= */

  const markIn =
    async () => {
      if (attendanceType === "FIELD_VISIT") {
        if (!fieldSiteId || !fieldPurpose.trim() || !fieldExpectedEndAt) {
          toast.error("Select a client/site, enter the purpose, and expected completion time.");
          return false;
        }
      }

      const success =
        await withLocation(
          "/api/attendance/mark-in",
          attendanceType === "FIELD_VISIT"
            ? {
                attendanceType,
                clientSiteId: fieldSiteId,
                purpose: fieldPurpose.trim(),
                expectedWorkEndAt: new Date(fieldExpectedEndAt).toISOString(),
                overnightWork,
              }
            : attendanceType === "WORK_FROM_HOME"
              ? { attendanceType, ...wfhDevicePayload() }
              : { attendanceType }
        );

      if (success) {
        setMarkInOpen(false);
        setFieldPurpose("");
        toast.success(
          attendanceType === "FIELD_VISIT"
            ? "Field work started and the client/site visit is active."
            : attendanceType === "WORK_FROM_HOME"
              ? "WFH attendance started on this approved device. Continuous GPS is paused."
              : "Marked in successfully. Keep this page open until Mark Out so location tracking can continue.",
          { duration: 8000 }
        );
      }
      return success;
    };

  /* =========================================================
     MARK OUT
  ========================================================= */

  const markOut =
    async (extra: Record<string, unknown> = {}) => {
      if (
        activeVisit
      ) {
        toast.error(
          "Complete the active client visit before marking out."
        );

        return false;
      }

      const success =
        await withLocation(
          "/api/attendance/mark-out",
          attendance?.attendanceType === "WORK_FROM_HOME" ? { ...extra, ...wfhDevicePayload() } : extra
        );

      if (success) {
        toast.success(
          "Marked out successfully. Location tracking stopped."
        );
      }
      return success;
    };

  const updateWfhBreak = async (action: "START" | "END") => {
    setBusy(true);
    try {
      await api("/api/attendance/wfh-break", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...wfhDevicePayload() }) });
      await refresh();
      toast.success(action === "START" ? "Break started. GPS tracking remains paused." : "Work resumed.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to update break."); }
    finally { setBusy(false); }
  };

  const continueWorking = async () => {
    if (!overtimeReason.trim() || !expectedEndAt) {
      toast.error("Enter an overtime reason and expected completion time.");
      return;
    }

    setBusy(true);
    try {
      await api("/api/attendance/continue-working", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: overtimeReason.trim(),
          expectedEndAt: new Date(expectedEndAt).toISOString(),
        }),
      });
      await refresh();
      setShiftDialogOpen(false);
      setOvertimeReason("");
      toast.success("Continue Working enabled. Location tracking remains active.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to extend attendance.");
    } finally {
      setBusy(false);
    }
  };

  /* =========================================================
     START VISIT
  ========================================================= */

  const startVisit =
    async () => {
      if (
        !siteId ||
        !purpose.trim()
      ) {
        toast.error(
          "Select a client/site and enter visit purpose."
        );

        return;
      }

      const success =
        await withLocation(
          "/api/attendance/visits/start",
          {
            clientSiteId:
              siteId,

            purpose:
              purpose.trim(),
          }
        );

      if (success) {
        setVisitOpen(
          false
        );

        setPurpose("");

        setSiteId("");

        toast.success(
          "Client/site visit started."
        );
      }
    };

  /* =========================================================
     END VISIT
  ========================================================= */

  const endVisit =
    async () => {
      if (
        !activeVisit
      ) {
        return;
      }

      const success =
        await withLocation(
          "/api/attendance/visits/end",
          {
            remarks:
              remarks.trim(),
          }
        );

      if (success) {
        setRemarks("");

        toast.success(
          "Client/site visit completed."
        );
      }
    };

  /* =========================================================
     ADD CLIENT / SITE
  ========================================================= */

  const addClient =
    async () => {
      if (
        !empId ||
        !orgId
      ) {
        toast.error(
          "Employee session is not available."
        );

        return;
      }

      if (
        !client.clientName.trim() ||
        !client.siteName.trim()
      ) {
        toast.error(
          "Client name and site name are required."
        );

        return;
      }

      setBusy(true);

      try {
        await api(
          "/api/attendance/clients",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                clientName:
                  client.clientName.trim(),

                siteName:
                  client.siteName.trim(),

                address:
                  client.address.trim(),

                contactPerson:
                  client.contactPerson.trim(),

                mobile:
                  client.mobile.trim(),
              }),
          }
        );

        setClient({
          clientName: "",
          siteName: "",
          address: "",
          contactPerson: "",
          mobile: "",
        });

        setClientOpen(
          false
        );

        await refresh();

        toast.success(
          "Client/site added successfully."
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Unable to add client/site."
        );
      } finally {
        setBusy(false);
      }
    };

  useEffect(() => {
    if (attendance?.status !== "IN" || !policy) return;

    const notifyOnce = (key: string, message: string) => {
      const datedKey = `${dateKeyInZone(new Date(), policy.timeZone)}:${key}`;
      if (reminderKeys.current.has(datedKey)) return false;
      reminderKeys.current.add(datedKey);
      toast.warning(message, { duration: 10000 });
      return true;
    };

    const attemptAutoClose = async () => {
      if (autoClosePending.current) return;
      autoClosePending.current = true;
      try {
        await api("/api/attendance/auto-close", { method: "POST" });
        await refresh();
        setShiftDialogOpen(false);
        toast.warning("Attendance was automatically marked out using your last saved location.");
      } catch (error) {
        console.warn("Automatic Mark Out skipped:", error);
      } finally {
        autoClosePending.current = false;
      }
    };

    const checkShift = () => {
      const now = new Date();
      const currentMinutes = minutesInZone(now, policy.timeZone);
      const currentDateKey = dateKeyInZone(now, policy.timeZone);
      const oldAttendance = Boolean(
        attendance.attendanceDate && attendance.attendanceDate !== currentDateKey
      );

      if (attendance.overtime?.active && attendance.overtime.expectedEndAt) {
        const expected = new Date(attendance.overtime.expectedEndAt);
        const graceDeadline = new Date(
          expected.getTime() + policy.overtimeGraceMinutes * 60000
        );
        if (now >= expected) {
          if (notifyOnce("overtime-ended", "Your expected overtime completion time has arrived.")) {
            setShiftDialogOpen(true);
          }
        }
        if (now >= graceDeadline) void attemptAutoClose();
        return;
      }

      if (attendance.attendanceType === "FIELD_VISIT" && attendance.expectedWorkEndAt) {
        const expected = new Date(attendance.expectedWorkEndAt);
        const reminderAt = new Date(
          expected.getTime() - policy.reminderBeforeMinutes * 60000
        );
        const graceDeadline = new Date(
          expected.getTime() + policy.overtimeGraceMinutes * 60000
        );
        if (now >= reminderAt && now < expected) {
          notifyOnce(
            "field-ending",
            `Your field work is expected to finish at ${time(attendance.expectedWorkEndAt)}.`
          );
        }
        if (now >= expected) {
          if (notifyOnce("field-ended", "Your expected field-work completion time has arrived.")) {
            setShiftDialogOpen(true);
          }
        }
        if (now >= graceDeadline) void attemptAutoClose();
        return;
      }

      if (
        currentMinutes >= policy.shiftEndMinutes - policy.reminderBeforeMinutes &&
        currentMinutes < policy.shiftEndMinutes
      ) {
        notifyOnce(
          "shift-ending",
          `Your shift ends at ${formatPolicyTime(policy.shiftEndMinutes)}. Complete active visits and prepare to Mark Out.`
        );
      }

      if (currentMinutes >= policy.shiftEndMinutes) {
        if (notifyOnce("shift-ended", "Your shift has ended. Mark Out or choose Continue Working.")) {
          setShiftDialogOpen(true);
        }
      }

      for (const reminder of policy.reminderAfterMinutes) {
        if (currentMinutes >= policy.shiftEndMinutes + reminder) {
          if (notifyOnce(
            `after-${reminder}`,
            `You are still marked in ${reminder} minutes after shift end.`
          )) {
            setShiftDialogOpen(true);
          }
        }
      }

      if (oldAttendance || currentMinutes >= policy.autoCloseMinutes) {
        void attemptAutoClose();
      }
    };

    checkShift();
    const interval = window.setInterval(checkShift, 30_000);
    return () => window.clearInterval(interval);
  }, [attendance, policy, refresh]);

  /* =========================================================
     SESSION LOADING
  ========================================================= */

  if (
    sessionStatus ===
      "loading"
  ) {
    return (
      <div className="space-y-6 pb-10">
        <PageHeader title="My Attendance" />

        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Loading attendance...
          </CardContent>
        </Card>
      </div>
    );
  }

  /* =========================================================
     SESSION ERROR
  ========================================================= */

  if (
    sessionStatus !==
    "authenticated"
  ) {
    return (
      <div className="space-y-6 pb-10">
        <PageHeader title="My Attendance" />

        <Card>
          <CardContent className="py-8 text-center">
            <p className="font-medium">
              Please sign in to access attendance.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* =========================================================
     SESSION DOES NOT HAVE EMPLOYEE DETAILS
  ========================================================= */

  if (
    !empId ||
    !orgId
  ) {
    return (
      <div className="space-y-6 pb-10">
        <PageHeader title="My Attendance" />

        <Card>
          <CardContent className="space-y-2 py-8 text-center">
            <p className="font-medium">
              Employee information is missing from the login session.
            </p>

            <p className="text-sm text-muted-foreground">
              Employee ID and Organization ID must be added to the NextAuth session.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (initialLoading) {
    return (
      <div className="space-y-6 pb-10">
        <PageHeader title="My Attendance" />
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Loading attendance...
          </CardContent>
        </Card>
      </div>
    );
  }

  /* =========================================================
     MAIN UI
  ========================================================= */

  return (
    <div className="space-y-6 pb-10">
      <PageHeader title="My Attendance" />

      {/* ===============================================
          LOGGED IN EMPLOYEE
      =============================================== */}

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <UserRound className="size-5 text-muted-foreground" />

          <div>
            <p className="text-sm font-medium">
              {user?.name ||
                "Employee"}
            </p>

            <p className="text-xs text-muted-foreground">
              Employee ID:{" "}
              {empId}
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right">
          <p className="text-xs text-muted-foreground">
            Organization
          </p>

          <p className="text-sm font-medium">
            {orgId}
          </p>
        </div>
      </div>

      {attendance?.status === "IN" && (
        <div
          role="alert"
          className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"
        >
          <TriangleAlert className="mt-0.5 size-5 shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold">Keep the attendance page open until Mark Out</p>
            <p className="text-sm">
              Location is sent every minute while this page is open. A background tab may
              update less frequently, and tracking stops completely if the browser or tab is
              closed.
            </p>
          </div>
        </div>
      )}

      {attendance?.status === "IN" && attendance.overtime?.active && (
        <div className="flex flex-col gap-3 rounded-xl border border-blue-300 bg-blue-50 p-4 text-blue-950 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-700 text-white">OVERTIME</Badge>
              <p className="font-semibold">Continue Working is active</p>
            </div>
            <p className="mt-2 text-sm">Reason: {attendance.overtime.reason}</p>
          </div>
          <div className="text-sm sm:text-right">
            <p className="text-blue-700">Expected completion</p>
            <p className="font-semibold">{time(attendance.overtime.expectedEndAt)}</p>
          </div>
        </div>
      )}

      {attendance?.status === "IN" && attendance.attendanceType === "FIELD_VISIT" && (
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-950 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-700 text-white">FIELD VISIT</Badge>
              {attendance.isEarlyStart && <Badge variant="secondary">EARLY START</Badge>}
              {attendance.overnightWork && <Badge variant="secondary">OVERNIGHT</Badge>}
            </div>
            <p className="mt-2 text-sm">
              The normal 6:00 PM cutoff is disabled for this approved field schedule.
            </p>
          </div>
          <div className="text-sm sm:text-right">
            <p className="text-emerald-700">Expected completion</p>
            <p className="font-semibold">{time(attendance.expectedWorkEndAt)}</p>
          </div>
        </div>
      )}

      {attendance?.status === "IN" && attendance.attendanceType === "WORK_FROM_HOME" && (
        <div className="flex flex-col gap-3 rounded-xl border border-violet-300 bg-violet-50 p-4 text-violet-950 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="flex items-center gap-2"><Badge className="bg-violet-700 text-white">WORK FROM HOME</Badge><Badge variant="secondary">GPS PAUSED</Badge></div><p className="mt-2 text-sm">Continuous home-location tracking is disabled for privacy.</p><p className="mt-1 text-sm">Break time: {formatMinutes(attendance.wfh?.totalBreakMinutes || 0)}</p></div>
          <Button variant="outline" disabled={busy || !wfhDeviceAllowed} onClick={() => updateWfhBreak(attendance.wfh?.breakStartedAt ? "END" : "START")}>{attendance.wfh?.breakStartedAt ? "Resume Work" : "Start Break"}</Button>
        </div>
      )}

      {attendance?.status === "IN" && attendance.attendanceType === "WORK_FROM_HOME" && !wfhDeviceAllowed && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-950"><p className="font-semibold">WFH attendance is active on another device</p><p className="mt-1 text-sm">Active device: {wfhBoundDevice?.deviceType || "Unknown"} / {wfhBoundDevice?.browser || "Unknown"}. This device is view-only until your manager approves a transfer.</p><Button className="mt-3" variant="outline" onClick={async () => { const reason = window.prompt("Why do you need to change the WFH device?")?.trim(); if (!reason) return; setBusy(true); try { const position = await getPosition(); await api("/api/wfh/device-changes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...gps(position), ...wfhDevicePayload(), reason }) }); toast.success("Device-change request sent to your manager."); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to request device change."); } finally { setBusy(false); } }}>Request Device Change</Button></div>
      )}

      {/* ===============================================
          STATUS CARDS
      =============================================== */}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* STATUS */}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              Status

              <LocateFixed className="size-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>

          <CardContent>
            <Badge
              variant={
                attendance?.status ===
                "IN"
                  ? "default"
                  : "secondary"
              }
            >
              {attendance
                ? attendance.status ===
                  "IN"
                  ? "MARKED IN"
                  : "MARKED OUT"
                : "NOT MARKED IN"}
            </Badge>

            <p className="mt-3 text-xs text-muted-foreground">
              Tracking:{" "}
              {attendance?.trackingStatus ||
                "OFF"}
            </p>

            {attendance
              ?.lastLocationReceivedAt && (
              <p className="mt-1 text-xs text-muted-foreground">
                Last location:{" "}
                {time(
                  attendance.lastLocationReceivedAt
                )}
              </p>
            )}
            {attendance?.lastKnownLocationName && (
              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                {attendance.lastKnownLocationName}
              </p>
            )}
            {attendance && workStatus && (
              <div className={`mt-3 rounded-md border p-2 text-xs ${workStatus.state === "VERIFIED" ? "border-emerald-300 bg-emerald-50 text-emerald-950" : "border-amber-300 bg-amber-50 text-amber-950"}`}>
                <p className="font-semibold">Work status: {workStatus.label}</p>
                <p className="mt-1">Confidence: {workStatus.confidence}</p>
                <p className="mt-1 opacity-80">{workStatus.reason}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* WORKING DAY */}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              Working day

              <Clock3 className="size-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-2xl font-semibold">
              {time(
                attendance
                  ?.markIn.time
              )}
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Mark In: {time(attendance?.markIn.time)} · Mark Out:{" "}
              {time(attendance?.markOut?.time)}
            </p>

            {attendance && (
              <p className="mt-2 text-sm font-medium">
                Total worked: {formatMinutes(workingMinutes)}
              </p>
            )}
          </CardContent>
        </Card>

        {/* VISITS */}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              Today&apos;s visits

              <Route className="size-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-2xl font-semibold">
              {visits.length}
            </p>

            <p className="text-xs text-muted-foreground">
              {activeVisit
                ? "One visit in progress"
                : "No active visit"}
            </p>
          </CardContent>
        </Card>

        {/* DISTANCE */}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              Distance travelled
              <Navigation className="size-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {(attendance?.totalDistanceMeters || 0) > 0
                ? formatDistance(attendance?.totalDistanceMeters)
                : "No reliable movement"}
            </p>
            <p className="text-xs text-muted-foreground">
              {(attendance?.totalDistanceMeters || 0) > 0
                ? "GPS accuracy-filtered distance"
                : "Low-accuracy GPS drift is excluded"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ===============================================
          MARK IN
      =============================================== */}

      {!attendance && (
        <Button
          size="lg"
          disabled={
            busy ||
            !empId ||
            !orgId
          }
          onClick={() => setMarkInOpen(true)}
        >
          <MapPin />

          {busy
            ? "Getting GPS..."
            : "Mark In with GPS"}
        </Button>
      )}

      {/* ===============================================
          ACTIVE ATTENDANCE
      =============================================== */}

      {attendance?.status ===
        "IN" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
          {/* CURRENT VISIT */}

          <Card>
            <CardHeader>
              <CardTitle>
                Current visit
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              {activeVisit ? (
                <>
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">
                        {
                          activeVisit
                            .clientSiteId
                            .clientName
                        }
                      </p>

                      <Badge>
                        IN PROGRESS
                      </Badge>
                    </div>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {
                        activeVisit
                          .clientSiteId
                          .siteName
                      }{" "}
                      • Started{" "}
                      {time(
                        activeVisit.startTime
                      )}
                    </p>

                    {activeVisit
                      .clientSiteId
                      .address && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {
                          activeVisit
                            .clientSiteId
                            .address
                        }
                      </p>
                    )}

                    <p className="mt-3 text-sm">
                      {
                        activeVisit.purpose
                      }
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="remarks">
                      Completion remarks
                    </Label>

                    <Textarea
                      id="remarks"
                      className="mt-2"
                      placeholder="Optional remarks"
                      value={
                        remarks
                      }
                      onChange={(
                        e
                      ) =>
                        setRemarks(
                          e.target.value
                        )
                      }
                    />
                  </div>

                  <Button
                    className="w-full"
                    disabled={
                      busy
                    }
                    onClick={
                      endVisit
                    }
                  >
                    {busy
                      ? "Ending..."
                      : "End Visit"}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    You are currently travelling or available for a new client/site visit.
                  </p>

                  <Button
                    className="w-full"
                    disabled={
                      busy ||
                      sites.length ===
                        0
                    }
                    onClick={() =>
                      setVisitOpen(
                        true
                      )
                    }
                  >
                    <Route />

                    Start New Visit
                  </Button>
                </>
              )}

              <Button
                variant="outline"
                className="w-full"
                disabled={busy}
                onClick={() =>
                  setClientOpen(
                    true
                  )
                }
              >
                <Plus />

                Add Client / Site
              </Button>
            </CardContent>
          </Card>

          {/* TODAY VISITS */}

          <Card>
            <CardHeader>
              <CardTitle>
                Today&apos;s visits
              </CardTitle>
            </CardHeader>

            <CardContent>
              {visits.length ===
              0 ? (
                <p className="text-sm text-muted-foreground">
                  No visits recorded today.
                </p>
              ) : (
                <div className="space-y-3">
                  {visits.map(
                    (
                      visit,
                      index
                    ) => (
                      <div
                        key={
                          visit._id
                        }
                        className="flex gap-3 rounded-lg border p-3"
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                          {visits.length -
                            index}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium">
                              {
                                visit
                                  .clientSiteId
                                  .clientName
                              }{" "}
                              •{" "}
                              {
                                visit
                                  .clientSiteId
                                  .siteName
                              }
                            </p>

                            <Badge
                              variant={
                                visit.status ===
                                "IN_PROGRESS"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {visit.status ===
                              "IN_PROGRESS"
                                ? "IN PROGRESS"
                                : "COMPLETED"}
                            </Badge>
                          </div>

                          <p className="mt-1 text-sm text-muted-foreground">
                            {time(
                              visit.startTime
                            )}{" "}
                            –{" "}
                            {time(
                              visit.endTime
                            )}

                            {visit.durationMinutes !=
                              null &&
                              ` • ${visit.durationMinutes} min`}
                          </p>

                          <p className="mt-1 text-sm">
                            {
                              visit.purpose
                            }
                          </p>

                          {visit.remarks && (
                            <div className="mt-2 rounded-md bg-muted px-3 py-2 text-sm">
                              <span className="font-medium">
                                Remarks:{" "}
                              </span>
                              {visit.remarks}
                            </div>
                          )}

                          {visit
                            .clientSiteId
                            .address && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {
                                visit
                                  .clientSiteId
                                  .address
                              }
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===============================================
          MARK IN / MARK OUT MAPS
      =============================================== */}

      {attendance && todayRoute && (
        <TodayRouteMap points={todayLocations} route={todayRoute} />
      )}

      {attendance?.markIn.location && (
        <details
          open={attendance.status === "IN"}
          className="group rounded-xl border bg-card p-4"
        >
          <summary className="cursor-pointer list-none rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Attendance locations</h2>
                <p className="text-sm text-muted-foreground">
                  {attendance.status === "IN"
                    ? "Mark-in and live GPS positions."
                    : "Mark-in and mark-out GPS positions."}
                </p>
              </div>
              <span className="text-sm font-medium text-primary group-open:hidden">
                View maps
              </span>
              <span className="hidden text-sm font-medium text-primary group-open:inline">
                Hide maps
              </span>
            </div>
          </summary>

          <div className="mt-4 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            <LocationMap
              title="Mark-in location"
              location={attendance.markIn.location}
              recordedAt={attendance.markIn.time}
            />

            {attendance.status === "IN" && attendance.attendanceType !== "WORK_FROM_HOME" && attendance.lastKnownLocation && (
              <LocationMap
                title="Live location"
                location={attendance.lastKnownLocation}
                recordedAt={attendance.lastLocationReceivedAt}
              />
            )}

            {attendance.markOut?.location && (
              <LocationMap
                title="Mark-out location"
                location={attendance.markOut.location}
                recordedAt={attendance.markOut.time}
              />
            )}
          </div>
        </details>
      )}

      {/* ===============================================
          MARK OUT
      =============================================== */}

      {attendance?.status ===
        "IN" && (
        <div className="space-y-2">
          <Button
            variant="destructive"
            size="lg"
            disabled={
              busy ||
              !!activeVisit ||
              (attendance.attendanceType === "WORK_FROM_HOME" && !wfhDeviceAllowed)
            }
            onClick={() => attendance.attendanceType === "WORK_FROM_HOME" ? setWfhSummaryOpen(true) : void markOut()}
          >
            <MapPin />

            {busy
              ? "Getting Final GPS..."
              : "Mark Out with Final GPS"}
          </Button>

          {activeVisit && (
            <p className="text-sm text-muted-foreground">
              End the current client/site visit before marking out.
            </p>
          )}
        </div>
      )}

      {/* ===============================================
          COMPLETED ATTENDANCE
      =============================================== */}

      {attendance?.status ===
        "OUT" && (
        <Card>
          <CardContent className="py-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">
                  Attendance completed for today
                </p>

                <p className="text-sm text-muted-foreground">
                  Mark In:{" "}
                  {time(
                    attendance
                      .markIn.time
                  )}{" "}
                  • Mark Out:{" "}
                  {time(
                    attendance
                      .markOut?.time
                  )}
                </p>

                {attendance.closureType === "AUTO" && (
                  <p className="mt-2 text-sm text-amber-700">
                    Automatically marked out: {attendance.autoMarkOutReason}
                  </p>
                )}
              </div>

              <Badge variant="secondary">
                {attendance.closureType === "AUTO" ? "AUTO MARKED OUT" : "TRACKING STOPPED"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={markInOpen} onOpenChange={setMarkInOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start attendance</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="attendanceType">Work type</Label>
              <select
                id="attendanceType"
                className="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={attendanceType}
                onChange={(event) =>
                  setAttendanceType(event.target.value as "OFFICE" | "FIELD_VISIT" | "WORK_FROM_HOME")
                }
              >
                <option value="OFFICE">Office / normal shift</option>
                <option value="FIELD_VISIT">Field visit / early travel</option>
                {wfhEnabled && <option value="WORK_FROM_HOME">Work from home — manager approved</option>}
              </select>
            </div>

            {attendanceType === "WORK_FROM_HOME" && wfhEnabled && <div className="rounded-md border border-violet-200 bg-violet-50 p-3 text-sm text-violet-950">Manager approval is active for today. Mark In validates your approved work-location geofence; continuous GPS is then paused.</div>}

            {attendanceType === "FIELD_VISIT" && (
              <>
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                  Use this for early travel, distant sites, or work that may finish after the
                  normal shift. Mark In also starts the selected site visit.
                </div>

                <div>
                  <Label htmlFor="fieldSite">Client / site</Label>
                  <select
                    id="fieldSite"
                    className="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={fieldSiteId}
                    onChange={(event) => setFieldSiteId(event.target.value)}
                  >
                    <option value="">Select client / site</option>
                    {sites.map((site) => (
                      <option key={site._id} value={site._id}>
                        {site.clientName} - {site.siteName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="fieldPurpose">Purpose</Label>
                  <Textarea
                    id="fieldPurpose"
                    className="mt-2"
                    value={fieldPurpose}
                    onChange={(event) => setFieldPurpose(event.target.value)}
                    placeholder="Installation, inspection, client support..."
                  />
                </div>

                <div>
                  <Label htmlFor="fieldExpectedEndAt">Expected completion</Label>
                  <Input
                    id="fieldExpectedEndAt"
                    type="datetime-local"
                    className="mt-2"
                    min={dateTimeLocalValue(new Date())}
                    value={fieldExpectedEndAt}
                    onChange={(event) => setFieldExpectedEndAt(event.target.value)}
                  />
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={overnightWork}
                    onChange={(event) => setOvernightWork(event.target.checked)}
                  />
                  Work may continue overnight
                </label>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkInOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={markIn}
              disabled={
                busy ||
                (attendanceType === "FIELD_VISIT" &&
                  (!fieldSiteId || !fieldPurpose.trim() || !fieldExpectedEndAt))
              }
            >
              <MapPin />
              {busy ? "Getting GPS..." : "Confirm Mark In"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={wfhSummaryOpen} onOpenChange={setWfhSummaryOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Complete WFH day</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label htmlFor="wfhDailySummary">Work completed *</Label><Textarea id="wfhDailySummary" className="mt-2" value={wfhSummary.dailySummary} onChange={(event) => setWfhSummary({ ...wfhSummary, dailySummary: event.target.value })} placeholder="Summarize completed work..." /></div>
            <div><Label htmlFor="wfhPendingTasks">Pending tasks</Label><Textarea id="wfhPendingTasks" className="mt-2" value={wfhSummary.pendingTasks} onChange={(event) => setWfhSummary({ ...wfhSummary, pendingTasks: event.target.value })} /></div>
            <div><Label htmlFor="wfhBlockers">Blockers</Label><Textarea id="wfhBlockers" className="mt-2" value={wfhSummary.blockers} onChange={(event) => setWfhSummary({ ...wfhSummary, blockers: event.target.value })} /></div>
            <p className="text-xs text-muted-foreground">Final GPS is used only to validate the approved WFH location.</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setWfhSummaryOpen(false)}>Cancel</Button><Button disabled={busy || !wfhSummary.dailySummary.trim()} onClick={async () => { if (await markOut(wfhSummary)) setWfhSummaryOpen(false); }}>Submit Summary &amp; Mark Out</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shiftDialogOpen} onOpenChange={setShiftDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Shift completed — what would you like to do?</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Mark Out now, or continue working with an overtime reason and expected
              completion time. Location tracking remains active while you continue.
            </p>

            {activeVisit && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                Complete the active client/site visit before marking out.
              </div>
            )}

            <div>
              <Label htmlFor="overtimeReason">Overtime reason</Label>
              <Textarea
                id="overtimeReason"
                className="mt-2"
                value={overtimeReason}
                onChange={(event) => setOvertimeReason(event.target.value)}
                placeholder="Production support, urgent client work, deployment..."
              />
            </div>

            <div>
              <Label htmlFor="expectedEndAt">Expected completion time</Label>
              <Input
                id="expectedEndAt"
                type="datetime-local"
                className="mt-2"
                min={dateTimeLocalValue(new Date())}
                value={expectedEndAt}
                onChange={(event) => setExpectedEndAt(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="destructive"
              disabled={busy || Boolean(activeVisit)}
              onClick={async () => {
                if (attendance?.attendanceType === "WORK_FROM_HOME") {
                  setShiftDialogOpen(false);
                  setWfhSummaryOpen(true);
                } else if (await markOut()) setShiftDialogOpen(false);
              }}
            >
              Mark Out Now
            </Button>
            <Button
              disabled={busy || !overtimeReason.trim() || !expectedEndAt}
              onClick={continueWorking}
            >
              Continue Working
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===============================================
          START VISIT DIALOG
      =============================================== */}

      <Dialog
        open={visitOpen}
        onOpenChange={
          setVisitOpen
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Start client/site visit
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="site">
                Client / site
              </Label>

              <select
                id="site"
                className="mt-2 h-10 w-full rounded-lg border bg-background px-3 text-sm"
                value={
                  siteId
                }
                onChange={(
                  e
                ) =>
                  setSiteId(
                    e.target.value
                  )
                }
              >
                <option value="">
                  Select a site
                </option>

                {sites.map(
                  (site) => (
                    <option
                      key={
                        site._id
                      }
                      value={
                        site._id
                      }
                    >
                      {
                        site.clientName
                      }{" "}
                      •{" "}
                      {
                        site.siteName
                      }
                    </option>
                  )
                )}
              </select>

              {sites.length ===
                0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  No client/site available. Add one first.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="purpose">
                Purpose
              </Label>

              <Textarea
                id="purpose"
                className="mt-2"
                value={
                  purpose
                }
                onChange={(
                  e
                ) =>
                  setPurpose(
                    e.target.value
                  )
                }
                placeholder="Technical support, meeting, installation, site inspection..."
              />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setVisitOpen(
                  false
                );

                setClientOpen(
                  true
                );
              }}
            >
              <Plus />

              Add New Client / Site
            </Button>
          </div>

          <DialogFooter>
            <Button
              disabled={
                busy ||
                !siteId ||
                !purpose.trim()
              }
              onClick={
                startVisit
              }
            >
              {busy
                ? "Getting GPS..."
                : "Start Visit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===============================================
          ADD CLIENT DIALOG
      =============================================== */}

      <Dialog
        open={clientOpen}
        onOpenChange={
          setClientOpen
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add client / site
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            <div>
              <Label>
                Client name *
              </Label>

              <Input
                className="mt-1"
                value={
                  client.clientName
                }
                onChange={(
                  e
                ) =>
                  setClient(
                    (
                      previous
                    ) => ({
                      ...previous,

                      clientName:
                        e.target
                          .value,
                    })
                  )
                }
              />
            </div>

            <div>
              <Label>
                Site name *
              </Label>

              <Input
                className="mt-1"
                value={
                  client.siteName
                }
                onChange={(
                  e
                ) =>
                  setClient(
                    (
                      previous
                    ) => ({
                      ...previous,

                      siteName:
                        e.target
                          .value,
                    })
                  )
                }
              />
            </div>

            <div>
              <Label>
                Address
              </Label>

              <Textarea
                className="mt-1"
                value={
                  client.address
                }
                onChange={(
                  e
                ) =>
                  setClient(
                    (
                      previous
                    ) => ({
                      ...previous,

                      address:
                        e.target
                          .value,
                    })
                  )
                }
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>
                  Contact person
                </Label>

                <Input
                  className="mt-1"
                  value={
                    client.contactPerson
                  }
                  onChange={(
                    e
                  ) =>
                    setClient(
                      (
                        previous
                      ) => ({
                        ...previous,

                        contactPerson:
                          e.target
                            .value,
                      })
                    )
                  }
                />
              </div>

              <div>
                <Label>
                  Mobile
                </Label>

                <Input
                  className="mt-1"
                  value={
                    client.mobile
                  }
                  onChange={(
                    e
                  ) =>
                    setClient(
                      (
                        previous
                      ) => ({
                        ...previous,

                        mobile:
                          e.target
                            .value,
                      })
                    )
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              disabled={
                busy ||
                !client.clientName.trim() ||
                !client.siteName.trim()
              }
              onClick={
                addClient
              }
            >
              {busy
                ? "Adding..."
                : "Add Client / Site"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
