import { connectDB } from "@/lib/mongoose";
import Notification from "@/models/Notification";
import { errorResponse, requireAttendanceUser } from "../attendance/_lib/attendance";

export async function GET() {
  try {
    await connectDB();
    const { orgId, empId } = await requireAttendanceUser();
    const filter = { orgId, recipientEmpId: empId };
    const [notifications, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).limit(100).lean(),
      Notification.countDocuments({ ...filter, readAt: null }),
    ]);
    return Response.json({ notifications, unreadCount });
  } catch (error) {
    return errorResponse(error, "Unable to load notifications.");
  }
}

export async function PATCH(request) {
  try {
    await connectDB();
    const { orgId, empId } = await requireAttendanceUser();
    const body = await request.json();
    const filter = { orgId, recipientEmpId: empId, readAt: null };
    if (body.id) filter._id = body.id;
    await Notification.updateMany(filter, { $set: { readAt: new Date() } });
    return Response.json({ message: "Notifications marked as read." });
  } catch (error) {
    return errorResponse(error, "Unable to update notifications.");
  }
}
