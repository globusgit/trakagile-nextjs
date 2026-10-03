
import { connectDB } from "@/lib/mongoose";
import { resolveEnabledModuleKeys } from "@/lib/moduleAccess";
import { organizationIdentityFilter } from "@/lib/organization";
import Organization from "@/models/Organization";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../../attendance/_lib/attendance";

// Modules enabled for the signed-in user's own organization. Scoped strictly
// by the orgId in the session / mobile token, never by a request parameter.
export async function GET() {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const organization = await Organization.findOne(organizationIdentityFilter(identity.orgId)).select("enabledModules").lean();
    if (!organization) throw new AttendanceError("Organization not found.", 404);
    return Response.json({ modules: resolveEnabledModuleKeys(organization.enabledModules) });
  } catch (error) { return errorResponse(error, "Unable to load organization modules."); }
}