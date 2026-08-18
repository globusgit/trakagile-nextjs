import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoose";
import LeavesInfo from "@/models/LeavesInfo";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../../attendance/_lib/attendance";
import { isOrganizationRole, userIdsForEmployeeIds, visibleEmployeeIds } from "@/lib/access";

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
