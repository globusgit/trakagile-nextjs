import Attendance from "@/models/Attendance";
import EmployeeVisit from "@/models/EmployeeVisit";
import { notifyAttendance } from "./notifications";

export async function closeAttendanceAfterNoResponse(attendance, closedAt, reason) {
  const location = attendance.lastKnownLocation || attendance.markIn?.location;
  if (!location) return false;

  const activeVisit = await EmployeeVisit.findOne({
    attendanceId: attendance._id,
    orgId: attendance.orgId,
    employeeId: attendance.empId,
    status: "IN_PROGRESS",
  });
  if (activeVisit) {
    activeVisit.set({
      endTime: closedAt,
      endLocation: location,
      durationMinutes: Math.max(
        0,
        Math.round((closedAt.getTime() - activeVisit.startTime.getTime()) / 60000),
      ),
      status: "COMPLETED",
      remarks: activeVisit.remarks || "Client/site visit automatically completed after no response.",
    });
    await activeVisit.save();
  }

  const totalWorkedMinutes = Math.max(
    0,
    Math.round((closedAt.getTime() - attendance.markIn.time.getTime()) / 60000),
  );
  const updated = await Attendance.findOneAndUpdate(
    { _id: attendance._id, status: "IN" },
    {
      $set: {
        markOut: { time: closedAt, location },
        status: "OUT",
        trackingStatus: "STOPPED",
        totalWorkedMinutes,
        closureType: "AUTO",
        autoMarkOutReason: reason,
        "overtime.active": false,
        "overtime.endedAt": closedAt,
      },
    },
    { new: true },
  );
  if (!updated) return false;

  await notifyAttendance({
    orgId: attendance.orgId,
    empId: attendance.empId,
    attendanceId: attendance._id,
    type: "ATTENDANCE_COMPLETED",
    title: "Attendance automatically marked out",
    message: `${attendance.empId}'s active client/site work was completed and attendance was marked out because the Mark Out reminder received no response.`,
    dedupeKey: `${attendance._id}:no-response-auto-close`,
  });
  return true;
}
