import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { readFromGridFS } from "@/lib/gridfs";
import GroupAttendance from "@/models/GroupAttendance";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../../../_lib/attendance";
import { PERMISSIONS, rolesForPermission } from "@/lib/permissions.mjs";

export async function GET(_request, { params }) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser(rolesForPermission(PERMISSIONS.ATTENDANCE_GROUP_READ));
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) throw new AttendanceError("Invalid group attendance.");
    const record = await GroupAttendance.findOne({ _id: id, orgId: identity.orgId, ...(identity.role === "MANAGER" ? { managerEmpId: identity.empId } : {}) }).lean();
    if (!record) throw new AttendanceError("Group attendance not found.", 404);
    const stored = await readFromGridFS(record.selfieFileId);
    if (!stored) throw new AttendanceError("Group selfie not found.", 404);
    return new Response(stored.buffer, { headers: { "content-type": record.selfieMimeType, "content-disposition": `inline; filename="group-attendance-${id}.jpg"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  } catch (error) { return errorResponse(error, "Unable to load group selfie."); }
}
