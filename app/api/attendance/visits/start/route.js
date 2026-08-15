import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import EmployeeVisit from "@/models/EmployeeVisit";
import VisitedSite from "@/models/VisitedSite";
import {
  AttendanceError,
  errorResponse,
  getActiveAttendance,
  locationFrom,
  requireAttendanceUser,
} from "../../_lib/attendance";

export async function POST(request) {
  let dbSession;
  try {
    await connectDB();
    dbSession = await mongoose.startSession();
    const identity = await requireAttendanceUser();
    const body = await request.json();
    const purpose = body.purpose?.trim();
    if (!purpose) throw new AttendanceError("Visit purpose is required.");
    if (!mongoose.isValidObjectId(body.clientSiteId)) {
      throw new AttendanceError("A valid client/site is required.");
    }

    const now = new Date();
    const location = locationFrom(body, now);
    let visit;

    await dbSession.withTransaction(async () => {
      const attendance = await getActiveAttendance(identity.orgId, identity.empId, dbSession);
      if (!attendance) throw new AttendanceError("Mark in before starting a visit.", 409);

      const site = await VisitedSite.findOne({
        _id: body.clientSiteId,
        orgId: identity.orgId,
        status: "ACTIVE",
      }).session(dbSession);
      if (!site) throw new AttendanceError("Client/site not found.", 404);

      const [created] = await EmployeeVisit.create(
        [{
          attendanceId: attendance._id,
          employeeId: identity.empId,
          clientSiteId: site._id,
          orgId: identity.orgId,
          purpose,
          startTime: now,
          startLocation: location,
        }],
        { session: dbSession },
      );
      visit = created;
      await Attendance.updateOne(
        { _id: attendance._id, status: "IN" },
        { $inc: { totalVisits: 1 } },
        { session: dbSession },
      );
    });

    return Response.json({ data: visit }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Unable to start visit.");
  } finally {
    await dbSession?.endSession();
  }
}
