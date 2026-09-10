import { TRACKING_INTERVAL_MS } from "./trackingPolicy.mjs";

const EARTH_RADIUS_METERS = 6_371_000;

// Upload order is not capture order when a device reconnects with queued fixes.
export function latestLocation(...points) {
  return points.filter((point) => validCoordinate(point))
    .sort((first, second) => pointTime(second) - pointTime(first))[0] || null;
}

export function locationTriggerPoints(points, start) {
  return [
    ...(start ? [{ ...start, type: "MARK_IN" }] : []),
    ...(points || []).filter((point) => validCoordinate(point) && (
      point.minuteTrigger || !start ||
      Math.abs(point.latitude - start.latitude) >= 0.000001 ||
      Math.abs(point.longitude - start.longitude) >= 0.000001
    )).sort((first, second) => pointTime(first) - pointTime(second))
      .map((point) => ({ ...point, type: "LOCATION_TRIGGER" })),
  ];
}

export function trackDistanceMeters(from, to) {
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const firstLatitude = toRadians(from.latitude);
  const secondLatitude = toRadians(to.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude)
    * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
}

function pointTime(point) {
  return new Date(point.capturedAt || point.receivedAt || 0).getTime();
}

function validCoordinate(point) {
  return Number.isFinite(point?.latitude)
    && point.latitude >= -90
    && point.latitude <= 90
    && Number.isFinite(point?.longitude)
    && point.longitude >= -180
    && point.longitude <= 180;
}

export function cleanLocationTrack(points, options = {}) {
  const maximumAccuracyMeters = options.maximumAccuracyMeters ?? 50;
  const maximumSpeedMetersPerSecond = options.maximumSpeedMetersPerSecond ?? 45;
  const minimumMovementMeters = options.minimumMovementMeters ?? 12;
  const sorted = [...(points || [])]
    .filter((point) => validCoordinate(point)
      && Number.isFinite(pointTime(point))
      && (point.accuracy == null || point.accuracy <= maximumAccuracyMeters))
    .sort((first, second) => pointTime(first) - pointTime(second));

  const accepted = [];
  for (const point of sorted) {
    const previous = accepted.at(-1);
    if (!previous) {
      accepted.push(point);
      continue;
    }

    const elapsedSeconds = (pointTime(point) - pointTime(previous)) / 1000;
    if (elapsedSeconds <= 0) continue;
    const distance = trackDistanceMeters(previous, point);
    const uncertainty = Math.max(
      minimumMovementMeters,
      Math.hypot(Number(previous.accuracy) || 0, Number(point.accuracy) || 0) * 1.5,
    );
    if (distance <= uncertainty) continue;

    const impliedSpeed = distance / elapsedSeconds;
    if (impliedSpeed > maximumSpeedMetersPerSecond) continue;
    const reportedSpeed = point.speed == null ? NaN : Number(point.speed);
    if (Number.isFinite(reportedSpeed) && reportedSpeed >= 0 && reportedSpeed < 0.5 && distance < 100) continue;
    if (Number.isFinite(reportedSpeed) && reportedSpeed >= 0 && reportedSpeed < 0.8 && impliedSpeed > 2) continue;
    accepted.push(point);
  }
  return accepted;
}

export function trackLengthMeters(points) {
  return (points || []).reduce((total, point, index) => {
    if (index === 0) return 0;
    const elapsedSeconds = (pointTime(point) - pointTime(points[index - 1])) / 1000;
    // Never invent travel across a period where the device did not report GPS.
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0 || elapsedSeconds > 2 * TRACKING_INTERVAL_MS / 1000) return total;
    return total + trackDistanceMeters(points[index - 1], point);
  }, 0);
}

export function splitLocationTrack(points, maximumGapSeconds = 2 * TRACKING_INTERVAL_MS / 1000) {
  const segments = [];
  for (const point of points || []) {
    const segment = segments.at(-1);
    const previous = segment?.at(-1);
    const elapsedSeconds = previous ? (pointTime(point) - pointTime(previous)) / 1000 : 0;
    if (!segment || elapsedSeconds <= 0 || elapsedSeconds > maximumGapSeconds) {
      segments.push([point]);
    } else {
      segment.push(point);
    }
  }
  return segments;
}
