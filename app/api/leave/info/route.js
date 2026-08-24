import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoose";
import LeavesInfo from "@/models/LeavesInfo";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../../attendance/_lib/attendance";
import { isOrganizationRole, userIdsForEmployeeIds, visibleEmployeeIds } from "@/lib/access";
import User from "@/models/User";

export async function GET(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get("userId");
    let userId = identity.userId;
    if (requestedUserId && isOrganizationRole(identity.role)) {
      userId = requestedUserId;
    } else if (requestedUserId && identity.role === "MANAGER") {
      const employeeIds = await visibleEmployeeIds(identity, true);
      const userIds = await userIdsForEmployeeIds(identity.orgId, employeeIds);
      if (!userIds.some((id) => String(id) === requestedUserId)) {
        throw new AttendanceError("You are not allowed to view this leave balance.", 403);
      }
      userId = requestedUserId;
    }
    const year = parseInt(searchParams.get("year")) || new Date().getFullYear();
    const defaults = { userId, year, orgId: identity.orgId, casual: 0, sick: 0, earned: 0, unpaid: 0, maternity: 0, paternity: 0, usedCasual: 0, usedSick: 0, usedEarned: 0, usedMaternity: 0, usedPaternity: 0 };
    if (!mongoose.isValidObjectId(userId)) return Response.json(defaults);
    const leaveInfo = await LeavesInfo.findOneAndUpdate(
      { userId, year, orgId: identity.orgId },
      { $setOnInsert: defaults },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    return Response.json(leaveInfo);
  } catch (error) {
    return errorResponse(error, "Unable to load leave balances.");
  }
}

export async function PATCH(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser(["ADMIN", "DIRECTOR"]);
    const body = await request.json();
    const userId = String(body.userId || "");
    const year = Number(body.year || new Date().getFullYear());
    if (!mongoose.isValidObjectId(userId) || !Number.isInteger(year)) {
      throw new AttendanceError("Select a valid employee and year.");
    }
    const allocation = {};
    for (const key of ["casual", "sick", "earned", "unpaid", "maternity", "paternity"]) {
      const value = Number(body[key]);
      if (!Number.isFinite(value) || value < 0 || value > 366) {
        throw new AttendanceError(`Enter a valid ${key} allocation.`);
      }
      allocation[key] = value;
    }
    const belongsToOrganization = await User.exists({ _id: userId, orgId: identity.orgId });
    if (!belongsToOrganization) throw new AttendanceError("Employee is unavailable.", 404);
    const info = await LeavesInfo.findOneAndUpdate(
      { orgId: identity.orgId, userId, year },
      { $set: allocation, $setOnInsert: { orgId: identity.orgId, userId, year } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    return Response.json(info);
  } catch (error) {
    return errorResponse(error, "Unable to update leave allocations.");
  }
}
