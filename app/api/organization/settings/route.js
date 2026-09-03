import { connectDB } from "@/lib/mongoose";
import { normalizeInternationalSettings } from "@/lib/internationalSettings.mjs";
import { organizationIdentityFilter } from "@/lib/organization";
import { PERMISSIONS, rolesForPermission } from "@/lib/permissions.mjs";
import Organization from "@/models/Organization";
import AttendancePolicy from "@/models/AttendancePolicy";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../../attendance/_lib/attendance";

export async function GET() {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const organization = await Organization.findOne(organizationIdentityFilter(identity.orgId)).select("timeZone locale currency countryCode weekStartsOn").lean();
    if (!organization) throw new AttendanceError("Organization not found.", 404);
    return Response.json({ settings: normalizeInternationalSettings(organization) });
  } catch (error) { return errorResponse(error, "Unable to load organization settings."); }
}

export async function PUT(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser(rolesForPermission(PERMISSIONS.ORGANIZATION_SETTINGS_MANAGE));
    let settings;
    try { settings = normalizeInternationalSettings(await request.json()); }
    catch (error) { throw new AttendanceError(error.message); }
    const organization = await Organization.findOneAndUpdate(organizationIdentityFilter(identity.orgId), { $set: settings }, { new: true }).lean();
    if (!organization) throw new AttendanceError("Organization not found.", 404);
    await AttendancePolicy.updateOne({ orgId: identity.orgId }, { $set: { timeZone: settings.timeZone } }, { upsert: true });
    return Response.json({ message: "International settings saved.", settings });
  } catch (error) { return errorResponse(error, "Unable to save organization settings."); }
}
