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
    const geofence = body.officeGeofence || {};
    const enabled = geofence.enabled === true;
    const latitude = geofence.latitude === "" || geofence.latitude == null ? undefined : Number(geofence.latitude);
    const longitude = geofence.longitude === "" || geofence.longitude == null ? undefined : Number(geofence.longitude);
    const radiusMeters = Number(geofence.radiusMeters ?? 300);
    const maximumAccuracyMeters = Number(geofence.maximumAccuracyMeters ?? 100);

    // Enabling the rule without coordinates would lock every employee out.
    if (enabled && (!Number.isFinite(latitude) || !Number.isFinite(longitude))) {
      throw new AttendanceError("Office latitude and longitude are required before enabling the geofence.");
    }
    if (latitude != null && (latitude < -90 || latitude > 90)) throw new AttendanceError("Office latitude must be between -90 and 90.");
    if (longitude != null && (longitude < -180 || longitude > 180)) throw new AttendanceError("Office longitude must be between -180 and 180.");
    if (!Number.isFinite(radiusMeters) || radiusMeters < 50 || radiusMeters > 2000) throw new AttendanceError("Office radius must be between 50 and 2000 metres.");
    if (!Number.isFinite(maximumAccuracyMeters) || maximumAccuracyMeters < 10 || maximumAccuracyMeters > 500) throw new AttendanceError("Maximum GPS accuracy must be between 10 and 500 metres.");

    const policy = await AttendancePolicy.findOneAndUpdate(
      { orgId },
      {
        $set: {
          officeGeofence: {
            enabled,
            name: String(geofence.name || "Main Office").trim(),
            latitude,
            longitude,
            radiusMeters,
            maximumAccuracyMeters,
          },
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    return Response.json({ message: "Office attendance location saved.", data: policy });
  } catch (error) {
    return errorResponse(error, "Unable to save attendance policy.");
  }
}
