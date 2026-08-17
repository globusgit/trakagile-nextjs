import { connectDB } from "@/lib/mongoose";
import VisitedSite from "@/models/VisitedSite";
import {
  AttendanceError,
  errorResponse,
  getEmployee,
  requireAttendanceUser,
} from "../_lib/attendance";

export async function GET() {
  try {
    await connectDB();
    const { orgId } = await requireAttendanceUser();
    const clients = await VisitedSite.find({ orgId, status: "ACTIVE" })
      .sort({ clientName: 1, siteName: 1 })
      .lean();
    return Response.json({ data: clients });
  } catch (error) {
    return errorResponse(error, "Unable to load client sites.");
  }
}

export async function POST(request) {
  try {
    await connectDB();
    const { orgId, empId } = await requireAttendanceUser();
    const body = await request.json();
    const employee = await getEmployee(orgId, empId);
    const clientName = body.clientName?.trim();
    const siteName = body.siteName?.trim();

    if (!clientName || !siteName) {
      throw new AttendanceError("Client and site names are required.");
    }

    let location;
    const hasLatitude = body.siteLatitude !== undefined && body.siteLatitude !== "";
    const hasLongitude = body.siteLongitude !== undefined && body.siteLongitude !== "";
    if (hasLatitude !== hasLongitude) {
      throw new AttendanceError("Both site latitude and longitude are required.");
    }
    if (hasLatitude) {
      const latitude = Number(body.siteLatitude);
      const longitude = Number(body.siteLongitude);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        throw new AttendanceError("Site latitude must be between -90 and 90.");
      }
      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        throw new AttendanceError("Site longitude must be between -180 and 180.");
      }
      location = { latitude, longitude };
    }

    const radiusMeters = body.radiusMeters == null || body.radiusMeters === ""
      ? 300
      : Number(body.radiusMeters);
    if (!Number.isFinite(radiusMeters) || radiusMeters < 0) {
      throw new AttendanceError("Site radius must be a positive number.");
    }

    const client = await VisitedSite.create({
      clientName,
      siteName,
      address: body.address?.trim(),
      contactPerson: body.contactPerson?.trim(),
      mobile: body.mobile?.trim(),
      email: body.email?.trim(),
      location,
      radiusMeters,
      orgId,
      createdBy: employee.empId,
    });
    return Response.json({ data: client }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Unable to add client site.");
  }
}
