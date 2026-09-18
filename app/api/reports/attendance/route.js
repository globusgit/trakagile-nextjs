import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import Break from "@/models/Break";
import Employee from "@/models/Employee";
import FieldTrip from "@/models/FieldTrip";
import TripExpense from "@/models/TripExpense";
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
    const selectedAttendanceIds = await Attendance.find({ orgId: identity.orgId, attendanceDate: { $regex: `^${month}` }, empId: { $in: selectedIds } }).select("_id").lean();
    const fieldTrips = await FieldTrip.find({ orgId: identity.orgId, employeeId: { $in: selectedIds }, attendanceId: { $in: selectedAttendanceIds.map((a) => a._id) } }).select("_id attendanceId purpose").lean();
    const [records, policy, breakAgg, tripExpenses] = await Promise.all([
      Attendance.find({ orgId: identity.orgId, attendanceDate: { $regex: `^${month}` }, empId: { $in: selectedIds } }).sort({ attendanceDate: 1, empId: 1 }).lean(),
      getAttendancePolicy(identity.orgId),
      Break.aggregate([
        { $match: { orgId: identity.orgId, attendanceId: { $in: selectedAttendanceIds.map((a) => a._id) } } },
        { $group: { _id: "$attendanceId", totalBreakMinutes: { $sum: "$durationMinutes" } } },
      ]),
      TripExpense.aggregate([
        { $match: { orgId: identity.orgId, tripId: { $in: fieldTrips.map((trip) => trip._id) } } },
        { $group: { _id: "$tripId", totalExpenses: { $sum: "$amount" } } },
      ]),
    ]);
    const names = new Map(employees.map((employee) => [employee.empId, employee.name]));
    const breakByAttendanceId = new Map(breakAgg.map((item) => [String(item._id), item.totalBreakMinutes || 0]));
    const tripExpenseByTripId = new Map(tripExpenses.map((item) => [String(item._id), Number(item.totalExpenses || 0)]));
    // A shift can include multiple trips, including trips planned in an earlier month.
    const tripsByAttendanceId = new Map();
    for (const trip of fieldTrips) {
      const key = String(trip.attendanceId);
      tripsByAttendanceId.set(key, [...(tripsByAttendanceId.get(key) || []), trip]);
    }
    const rows = records.map((record) => {
      const markInMinutes = minutesInTimeZone(new Date(record.markIn.time), policy.timeZone);
      const markOutMinutes = record.markOut?.time ? minutesInTimeZone(new Date(record.markOut.time), policy.timeZone) : null;
      const workedMinutes = record.totalWorkedMinutes || 0;
      const breakMinutes = Math.max(record.totalBreakMinutes || 0, breakByAttendanceId.get(String(record._id)) || 0);
      const trips = tripsByAttendanceId.get(String(record._id)) || [];
      const trip = { purpose: trips.map((item) => item.purpose).filter(Boolean).join("; ") };
      const tripExpenses = trips.reduce((total, item) => total + (tripExpenseByTripId.get(String(item._id)) || 0), 0);
      return { id: record._id.toString(), employeeId: record.empId, employeeName: names.get(record.empId) || record.empId, date: record.attendanceDate, status: record.status, markIn: record.markIn.time, markOut: record.markOut?.time || null, workedMinutes, overtimeMinutes: Math.max(0, workedMinutes - (policy.shiftEndMinutes - policy.shiftStartMinutes)), lateMinutes: Math.max(0, markInMinutes - policy.shiftStartMinutes), earlyMinutes: markOutMinutes == null ? 0 : Math.max(0, policy.shiftEndMinutes - markOutMinutes), attendanceType: record.attendanceType, distanceKm: Number(((record.totalDistanceMeters || 0) / 1000).toFixed(2)), breakMinutes, tripExpenses, tripPurpose: trip?.purpose || null };
    });
    const summary = rows.reduce((value, row) => { value.records += 1; value.workedMinutes += row.workedMinutes; value.breakMinutes += row.breakMinutes || 0; value.overtimeMinutes += row.overtimeMinutes; value.tripExpenses += row.tripExpenses || 0; if (row.lateMinutes) value.lateArrivals += 1; if (row.earlyMinutes) value.earlyDepartures += 1; return value; }, { records: 0, workedMinutes: 0, breakMinutes: 0, overtimeMinutes: 0, tripExpenses: 0, lateArrivals: 0, earlyDepartures: 0 });
    if (searchParams.get("format") === "csv") {
      const values = [["Employee ID", "Employee", "Date", "Mode", "Status", "Mark In", "Mark Out", "Worked Minutes", "Break Minutes", "Late Minutes", "Early Minutes", "Overtime Minutes", "Distance KM", "Trip Expense", "Trip Purpose"], ...rows.map((row) => [row.employeeId, row.employeeName, row.date, row.attendanceType, row.status, row.markIn, row.markOut || "", row.workedMinutes, row.breakMinutes, row.lateMinutes, row.earlyMinutes, row.overtimeMinutes, row.distanceKm, row.tripExpenses, row.tripPurpose || ""] )];
      return new Response(values.map((line) => line.map(csvCell).join(",")).join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="attendance-${month}.csv"` } });
    }
    return Response.json({ month, employees, rows, summary });
  } catch (error) { return errorResponse(error, "Unable to build attendance report."); }
}
