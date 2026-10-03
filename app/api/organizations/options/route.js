
import connectDB from "@/lib/mongoose";
import { defaultDesignations } from "@/lib/organizationDefaults";
import { platformRequestAuthorized } from "@/lib/platformAdminAuth";

// Options for the System Admin organization form (Designation dropdown).
export async function GET(request) {
  try {
    await connectDB();
    if (!(await platformRequestAuthorized(request))) {
      return Response.json({ message: "Platform administrator access is required." }, { status: 403 });
    }
    return Response.json({ designations: await defaultDesignations() });
  } catch (error) {
    console.error("[ORGANIZATION_OPTIONS]", error);
    return Response.json({ message: "Unable to load options." }, { status: 500 });
  }
}