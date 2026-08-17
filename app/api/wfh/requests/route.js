import { connectDB } from "@/lib/mongoose";
import Employee from "@/models/Employee";
import WorkFromHomeRequest from "@/models/WorkFromHomeRequest";
import { AttendanceError, errorResponse, locationFrom, requireAttendanceUser } from "../../attendance/_lib/attendance";
import { notifyAttendance, reverseGeocode } from "../../attendance/_lib/notifications";

export async function GET(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const team = new URL(request.url).searchParams.get("team") === "1";
    let filter = { orgId: identity.orgId, employeeId: identity.empId };
    if (team) {
      if (!["MANAGER", "DIRECTOR", "ADMIN"].includes(identity.role)) throw new AttendanceError("Manager access is required.", 403);
      if (["ADMIN", "DIRECTOR"].includes(identity.role)) filter = { orgId: identity.orgId };
      else {
        const manager = await Employee.findOne({ orgId: identity.orgId, empId: identity.empId }).select("_id").lean();
        const reports = await Employee.find({ orgId: identity.orgId, reportingTo: manager?._id }).select("empId").lean();
        filter = { orgId: identity.orgId, employeeId: { $in: reports.map((item) => item.empId) } };
      }
    }
    const requests = await WorkFromHomeRequest.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    return Response.json({ requests });
  } catch (error) { return errorResponse(error, "Unable to load WFH requests."); }
}

export async function POST(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const body = await request.json();
    const now = new Date();
    const location = locationFrom(body, now);
    const fromDate = String(body.fromDate || ""); const toDate = String(body.toDate || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate) || toDate < fromDate) throw new AttendanceError("Enter a valid WFH date range.");
    const reason = String(body.reason || "").trim(); const plannedTasks = String(body.plannedTasks || "").trim();
    if (!reason || !plannedTasks) throw new AttendanceError("Reason and planned tasks are required.");
    const overlap = await WorkFromHomeRequest.exists({ orgId: identity.orgId, employeeId: identity.empId, status: { $in: ["PENDING", "APPROVED"] }, fromDate: { $lte: toDate }, toDate: { $gte: fromDate } });
    if (overlap) throw new AttendanceError("A WFH request already exists for these dates.", 409);
    location.locationName = await reverseGeocode(location.latitude, location.longitude) || undefined;
    const created = await WorkFromHomeRequest.create({ orgId: identity.orgId, employeeId: identity.empId, fromDate, toDate, dayType: body.dayType, reason, plannedTasks, workLocation: location, radiusMeters: 500 });
    await notifyAttendance({ orgId: identity.orgId, empId: identity.empId, type: "WFH_REQUEST", title: "WFH approval requested", message: `${identity.empId} requested WFH from ${fromDate} to ${toDate}.`, dedupeKey: `${created._id}:requested` });
    return Response.json({ data: created }, { status: 201 });
  } catch (error) { return errorResponse(error, "Unable to submit WFH request."); }
}
