import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import { errorResponse, requireAttendanceUser } from "../../../attendance/_lib/attendance";
import { deviceFrom } from "../../_lib/device";

export async function POST(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const body = await request.json(); const device = deviceFrom(body, request);
    const attendance = await Attendance.findOne({ orgId: identity.orgId, empId: identity.empId, status: "IN", attendanceType: "WORK_FROM_HOME" }).select("+wfhDevice.deviceIdHash");
    if (!attendance) return Response.json({ active: false, allowed: false });
    const allowed = attendance.wfhDevice?.deviceIdHash === device.deviceIdHash;
    if (allowed) {
      attendance.set("wfhDevice.lastSeenAt", new Date());
      await attendance.save();
    }
    return Response.json({
      active: true,
      allowed,
      device: { deviceType: attendance.wfhDevice?.deviceType, platform: attendance.wfhDevice?.platform, browser: attendance.wfhDevice?.browser, boundAt: attendance.wfhDevice?.boundAt, lastSeenAt: attendance.wfhDevice?.lastSeenAt },
    });
  } catch (error) { return errorResponse(error, "Unable to verify WFH device."); }
}
