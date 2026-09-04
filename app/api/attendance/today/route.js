import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import EmployeeVisit from "@/models/EmployeeVisit";
// Register the populate target before EmployeeVisit.clientSiteId is resolved.
import "@/models/VisitedSite";
import { dayKey, errorResponse, getAttendancePolicy, requireAttendanceUser } from "../_lib/attendance";
import { workStatusFor } from "../_lib/work-status";
import { reverseGeocode } from "../_lib/notifications";

export async function GET() {
  try {
    await connectDB();
    const { orgId, empId } = await requireAttendanceUser();
    const policy = await getAttendancePolicy(orgId);

    const attendance = await Attendance.findOne({
      orgId,
      empId,
      $or: [{ status: "IN" }, { attendanceDate: dayKey(new Date(), policy.timeZone) }],
    })
      .sort({ status: 1, "markIn.time": -1 })
      .lean();

    if (attendance) {
      const updates = {};
      if (attendance.markIn?.location && !attendance.markIn.location.locationName) {
        const name = await reverseGeocode(attendance.markIn.location.latitude, attendance.markIn.location.longitude);
        if (name) { attendance.markIn.location.locationName = name; updates["markIn.location.locationName"] = name; }
      }
      if (attendance.markOut?.location && !attendance.markOut.location.locationName) {
        const name = await reverseGeocode(attendance.markOut.location.latitude, attendance.markOut.location.longitude);
        if (name) { attendance.markOut.location.locationName = name; updates["markOut.location.locationName"] = name; }
      }
      if (Object.keys(updates).length) await Attendance.updateOne({ _id: attendance._id }, { $set: updates });
    }

    const visits = attendance
      ? await EmployeeVisit.find({ attendanceId: attendance._id })
          .populate("clientSiteId", "clientName siteName address")
          .sort({ startTime: -1 })
          .lean()
      : [];

    return Response.json({ attendance, visits, workStatus: workStatusFor(attendance, null) });
  } catch (error) {
    return errorResponse(error, "Unable to load today's attendance.");
  }
}
