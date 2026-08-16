import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoose";
import LeavesInfo from "@/models/LeavesInfo";
import { errorResponse, requireAttendanceUser } from "../../attendance/_lib/attendance";

export async function GET(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get("userId");
    const userId = ["ADMIN", "DIRECTOR", "MANAGER"].includes(identity.role) && requestedUserId ? requestedUserId : identity.userId;
    const year = parseInt(searchParams.get("year")) || new Date().getFullYear();
    const defaults = { userId, year, orgId: identity.orgId, casual: 0, sick: 0, earned: 0, unpaid: 0, maternity: 0, paternity: 0, usedCasual: 0, usedSick: 0, usedEarned: 0, usedMaternity: 0, usedPaternity: 0 };
    if (!mongoose.isValidObjectId(userId)) return Response.json(defaults);
    return Response.json(await LeavesInfo.findOne({ userId, year, orgId: identity.orgId }) || defaults);
  } catch (error) {
    return errorResponse(error, "Unable to load leave balances.");
  }
}
