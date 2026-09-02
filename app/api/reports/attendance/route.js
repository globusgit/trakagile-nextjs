import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import Employee from "@/models/Employee";
import { errorResponse, getAttendancePolicy, minutesInTimeZone, requireAttendanceUser } from "../../attendance/_lib/attendance";
import { hasPermission, PERMISSIONS } from "@/lib/permissions.mjs";

const validMonth = (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value || "");
const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export async function GET(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const fallbackMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const month = validMonth(searchParams.get("month")) ? searchParams.get("month") : fallbackMonth;
    const requestedEmpId = searchParams.get("employeeId")?.trim();
    const isDirector = hasPermission(identity.role, PERMISSIONS.ATTENDANCE_REPORT_READ_ALL);
    const isManager = identity.role === "MANAGER";
    let employees;
    if (isDirector) {
      employees = await Employee.find({ orgId: identity.orgId, status: "Active" }).select("name empId designation").sort({ name: 1 }).lean();
    } else if (isManager) {
      const manager = await Employee.findOne({ orgId: identity.orgId, empId: identity.empId }).select("_id").lean();
      employees = await Employee.find({ orgId: identity.orgId, status: "Active", reportingTo: manager?._id }).select("name empId designation").sort({ name: 1 }).lean();
    } else {
      employees = await Employee.find({ orgId: identity.orgId, empId: identity.empId }).select("name empId designation").lean();
    }
    const allowedIds = employees.map((employee) => employee.empId);
    const selectedIds = requestedEmpId && allowedIds.includes(requestedEmpId) ? [requestedEmpId] : allowedIds;
    const [records, policy] = await Promise.all([
      Attendance.find({ orgId: identity.orgId, attendanceDate: { $regex: `^${month}` }, empId: { $in: selectedIds } }).sort({ attendanceDate: 1, empId: 1 }).lean(),
      getAttendancePolicy(identity.orgId),
    ]);
    const names = new Map(employees.map((employee) => [employee.empId, employee.name]));
    const rows = records.map((record) => {
      const markInMinutes = minutesInTimeZone(new Date(record.markIn.time), policy.timeZone);
      const markOutMinutes = record.markOut?.time ? minutesInTimeZone(new Date(record.markOut.time), policy.timeZone) : null;
      const workedMinutes = record.totalWorkedMinutes || 0;
      return { id: record._id.toString(), employeeId: record.empId, employeeName: names.get(record.empId) || record.empId, date: record.attendanceDate, status: record.status, markIn: record.markIn.time, markOut: record.markOut?.time || null, workedMinutes, overtimeMinutes: Math.max(0, workedMinutes - (policy.shiftEndMinutes - policy.shiftStartMinutes)), lateMinutes: Math.max(0, markInMinutes - policy.shiftStartMinutes), earlyMinutes: markOutMinutes == null ? 0 : Math.max(0, policy.shiftEndMinutes - markOutMinutes), attendanceType: record.attendanceType, distanceKm: Number(((record.totalDistanceMeters || 0) / 1000).toFixed(2)) };
    });
    const summary = rows.reduce((value, row) => { value.records += 1; value.workedMinutes += row.workedMinutes; value.overtimeMinutes += row.overtimeMinutes; if (row.lateMinutes) value.lateArrivals += 1; if (row.earlyMinutes) value.earlyDepartures += 1; return value; }, { records: 0, workedMinutes: 0, overtimeMinutes: 0, lateArrivals: 0, earlyDepartures: 0 });
    if (searchParams.get("format") === "csv") {
      const values = [["Employee ID", "Employee", "Date", "Mode", "Status", "Mark In", "Mark Out", "Worked Minutes", "Late Minutes", "Early Minutes", "Overtime Minutes", "Distance KM"], ...rows.map((row) => [row.employeeId, row.employeeName, row.date, row.attendanceType, row.status, row.markIn, row.markOut || "", row.workedMinutes, row.lateMinutes, row.earlyMinutes, row.overtimeMinutes, row.distanceKm])];
      return new Response(values.map((line) => line.map(csvCell).join(",")).join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="attendance-${month}.csv"` } });
    }
    return Response.json({ month, employees, rows, summary });
  } catch (error) { return errorResponse(error, "Unable to build attendance report."); }
}
