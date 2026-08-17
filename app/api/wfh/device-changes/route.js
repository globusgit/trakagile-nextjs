import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import Employee from "@/models/Employee";
import WfhDeviceChange from "@/models/WfhDeviceChange";
import { AttendanceError, errorResponse, locationFrom, requireAttendanceUser } from "../../attendance/_lib/attendance";
import { notifyAttendance, reverseGeocode } from "../../attendance/_lib/notifications";
import { deviceFrom } from "../_lib/device";

export async function GET(request) {
  try {
    await connectDB(); const identity = await requireAttendanceUser();
    const team = new URL(request.url).searchParams.get("team") === "1";
    let filter = { orgId: identity.orgId, employeeId: identity.empId };
    if (team) {
      if (!["MANAGER", "DIRECTOR", "ADMIN"].includes(identity.role)) throw new AttendanceError("Manager access is required.", 403);
      if (["ADMIN", "DIRECTOR"].includes(identity.role)) filter = { orgId: identity.orgId };
      else { const manager = await Employee.findOne({ orgId: identity.orgId, empId: identity.empId }).select("_id").lean(); const reports = await Employee.find({ orgId: identity.orgId, reportingTo: manager?._id }).select("empId").lean(); filter = { orgId: identity.orgId, employeeId: { $in: reports.map((item) => item.empId) } }; }
    }
    const changes = await WfhDeviceChange.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    return Response.json({ changes });
  } catch (error) { return errorResponse(error, "Unable to load device changes."); }
}

export async function POST(request) {
  try {
    await connectDB(); const identity = await requireAttendanceUser(); const body = await request.json();
    const reason = String(body.reason || "").trim(); if (!reason) throw new AttendanceError("Device-change reason is required.");
    const location = locationFrom(body); location.locationName = await reverseGeocode(location.latitude, location.longitude) || undefined;
    const newDevice = deviceFrom(body, request);
    const attendance = await Attendance.findOne({ orgId: identity.orgId, empId: identity.empId, status: "IN", attendanceType: "WORK_FROM_HOME" }).select("+wfhDevice.deviceIdHash +wfhDevice.ipHash");
    if (!attendance) throw new AttendanceError("No active WFH attendance found.", 404);
    if (attendance.wfhDevice?.deviceIdHash === newDevice.deviceIdHash) throw new AttendanceError("This is already the active WFH device.", 409);
    if (await WfhDeviceChange.exists({ attendanceId: attendance._id, status: "PENDING" })) throw new AttendanceError("A device-change request is already pending.", 409);
    const change = await WfhDeviceChange.create({ orgId: identity.orgId, employeeId: identity.empId, attendanceId: attendance._id, oldDevice: attendance.wfhDevice, newDevice, requestLocation: location, reason });
    await notifyAttendance({ orgId: identity.orgId, empId: identity.empId, attendanceId: attendance._id, type: "DEVICE_CHANGE_REQUEST", title: "WFH device change requested", message: `${identity.empId} requested transfer to ${newDevice.deviceType} / ${newDevice.browser}. Reason: ${reason}`, dedupeKey: `${change._id}:requested` });
    return Response.json({ data: change }, { status: 201 });
  } catch (error) { return errorResponse(error, "Unable to request device change."); }
}
