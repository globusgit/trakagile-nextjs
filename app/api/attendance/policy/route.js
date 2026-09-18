import { connectDB } from "@/lib/mongoose";
import {
  AttendanceError,
  errorResponse,
  getAttendancePolicy,
  requireAttendanceUser,
} from "../_lib/attendance";
import AttendancePolicy from "@/models/AttendancePolicy";
import { PERMISSIONS, rolesForPermission } from "@/lib/permissions.mjs";

export async function GET() {
  try {
    await connectDB();
    const { orgId } = await requireAttendanceUser();
    return Response.json({ data: await getAttendancePolicy(orgId) });
  } catch (error) {
    return errorResponse(error, "Unable to load attendance policy.");
  }
}

export async function PUT(request) {
  try {
    await connectDB();
    const { orgId } = await requireAttendanceUser(rolesForPermission(PERMISSIONS.ATTENDANCE_POLICY_MANAGE));
    const body = await request.json();
    const providedGeofences = Array.isArray(body.geofences) && body.geofences.length ? body.geofences : [body.officeGeofence || {}];

    const normalizedGeofences = providedGeofences.map((geofence, index) => {
      const value = geofence || {};
      const enabled = value.enabled === true;
      const latitude = value.latitude === "" || value.latitude == null ? undefined : Number(value.latitude);
      const longitude = value.longitude === "" || value.longitude == null ? undefined : Number(value.longitude);
      const radiusMeters = Number(value.radiusMeters ?? 300);
      const maximumAccuracyMeters = Number(value.maximumAccuracyMeters ?? 100);

      if (enabled && (!Number.isFinite(latitude) || !Number.isFinite(longitude))) {
        throw new AttendanceError(`Geofence ${index + 1} requires a latitude and longitude before it can be enabled.`);
      }
      if (latitude != null && (latitude < -90 || latitude > 90)) throw new AttendanceError(`Geofence ${index + 1} latitude must be between -90 and 90.`);
      if (longitude != null && (longitude < -180 || longitude > 180)) throw new AttendanceError(`Geofence ${index + 1} longitude must be between -180 and 180.`);
      if (!Number.isFinite(radiusMeters) || radiusMeters < 50 || radiusMeters > 2000) throw new AttendanceError(`Geofence ${index + 1} radius must be between 50 and 2000 metres.`);
      if (!Number.isFinite(maximumAccuracyMeters) || maximumAccuracyMeters < 10 || maximumAccuracyMeters > 500) throw new AttendanceError(`Geofence ${index + 1} GPS accuracy must be between 10 and 500 metres.`);

      return {
        enabled,
        name: String(value.name || `Office ${index + 1}`).trim() || `Office ${index + 1}`,
        latitude,
        longitude,
        radiusMeters,
        maximumAccuracyMeters,
      };
    });

    const primary = normalizedGeofences[0] || {
      enabled: false,
      name: "Main Office",
      latitude: undefined,
      longitude: undefined,
      radiusMeters: 300,
      maximumAccuracyMeters: 100,
    };

    const policy = await AttendancePolicy.findOneAndUpdate(
      { orgId },
      {
        $set: {
          officeGeofence: primary,
          geofences: normalizedGeofences,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    return Response.json({ message: "Office attendance locations saved.", data: policy });
  } catch (error) {
    return errorResponse(error, "Unable to save attendance policy.");
  }
}
