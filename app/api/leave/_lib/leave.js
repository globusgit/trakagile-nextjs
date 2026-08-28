import Holiday from "@/models/Holiday";
import LeavesInfo from "@/models/LeavesInfo";
import LeaveRequest from "@/models/LeaveRequest";
import { AttendanceError } from "../../attendance/_lib/attendance";

const usedFieldByType = {
  casual: "usedCasual",
  sick: "usedSick",
  earned: "usedEarned",
  maternity: "usedMaternity",
  paternity: "usedPaternity",
};

const dateKey = (date) => date.toISOString().slice(0, 10);
// Saturday is a working day except the 2nd Saturday of the month.
// The 1st Saturday always falls on the 1st–7th, so the 2nd Saturday
// always falls on the 8th–14th.
const isNonWorkingSaturday = (date) => {
  const day = date.getUTCDate();
  return day >= 8 && day <= 14;
};

export async function calculateLeaveDays(orgId, startDate, endDate, requestedDays) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    throw new AttendanceError("Enter a valid leave period.");
  }
  const startUtc = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const endUtc = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  if ((endUtc - startUtc) / 86400000 > 366) throw new AttendanceError("Leave period cannot exceed one year.");

  const holidays = await Holiday.find({
    orgId,
    date: { $gte: startUtc, $lte: new Date(endUtc.getTime() + 86400000 - 1) },
    isOptional: { $ne: true },
  }).select("date").lean();
  const holidayKeys = new Set(holidays.map((holiday) => dateKey(new Date(holiday.date))));
  let days = 0;
  for (let cursor = new Date(startUtc); cursor <= endUtc; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const weekDay = cursor.getUTCDay();
    const isSunday = weekDay === 0;
    const isOffSaturday = weekDay === 6 && isNonWorkingSaturday(cursor);
    const isHoliday = holidayKeys.has(dateKey(cursor));
    if (!isSunday && !isOffSaturday && !isHoliday) days += 1;
  }
  const isSingleDay = startUtc.getTime() === endUtc.getTime();
  if (isSingleDay && Number(requestedDays) === 0.5 && days === 1) return 0.5;
  if (days <= 0) throw new AttendanceError("The selected period contains no working days.");
  return days;
}

export async function assertNoLeaveOverlap({ orgId, userId, startDate, endDate, excludeId }) {
  const overlap = await LeaveRequest.exists({
    orgId,
    userId,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    status: { $in: ["pending", "approved", "cancellation_pending"] },
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  });
  if (overlap) throw new AttendanceError("A leave request already exists for the selected dates.", 409);
}

export async function ensureLeaveBalance(orgId, userId, year) {
  return LeavesInfo.findOneAndUpdate(
    { orgId, userId, year },
    { $setOnInsert: { orgId, userId, year } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

export async function applyLeaveBalance(leave, direction) {
  const usedField = usedFieldByType[leave.leaveType];
  if (!usedField) return;
  const year = new Date(leave.startDate).getUTCFullYear();
  const balance = await ensureLeaveBalance(leave.orgId, leave.userId, year);
  const amount = Number(leave.days);
  if (direction > 0) {
    const allocated = Number(balance[leave.leaveType] || 0);
    const used = Number(balance[usedField] || 0);
    if (allocated - used < amount) {
      throw new AttendanceError(`Insufficient ${leave.leaveType} leave balance.`, 409);
    }
  }
  balance[usedField] = Math.max(0, Number(balance[usedField] || 0) + amount * direction);
  await balance.save();
}

export const isLeaveReviewer = (role) => ["MANAGER", "ADMIN", "DIRECTOR"].includes(role);
