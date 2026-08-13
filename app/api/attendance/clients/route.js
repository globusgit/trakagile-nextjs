import { connectDB } from "@/lib/mongoose";
import VisitedSite from "@/models/VisitedSite";
import { errorResponse, getEmployee } from "../_lib/attendance";

export async function GET(request) {
  await connectDB();
  const orgId = new URL(request.url).searchParams.get("orgId");
  if (!orgId) return Response.json({ message: "Organization is required." }, { status: 400 });
  const clients = await VisitedSite.find({ orgId, status: "ACTIVE" }).sort({ clientName: 1, siteName: 1 }).lean();
  return Response.json({ data: clients });
}

export async function POST(request) {
  try {
    await connectDB();
    const body = await request.json();
    const employee = await getEmployee(body.orgId, body.empId);
    if (!body.clientName?.trim() || !body.siteName?.trim()) throw new Error("Client and site names are required.");
    const client = await VisitedSite.create({
      clientName: body.clientName, siteName: body.siteName, address: body.address,
      contactPerson: body.contactPerson, mobile: body.mobile, email: body.email,
      location: body.siteLatitude !== "" && body.siteLongitude !== "" ? { latitude: Number(body.siteLatitude), longitude: Number(body.siteLongitude) } : undefined,
      radiusMeters: body.radiusMeters || 300, orgId: body.orgId, createdBy: employee.empId,
    });
    return Response.json({ data: client }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
