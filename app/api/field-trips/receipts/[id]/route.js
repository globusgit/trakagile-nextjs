import fs from "fs/promises";
import mongoose from "mongoose";
import path from "path";
import { connectDB } from "@/lib/mongoose";
import { TRIP_UPLOAD_DIR } from "@/lib/uploadConfig";
import Employee from "@/models/Employee";
import FieldTrip from "@/models/FieldTrip";
import TripExpense from "@/models/TripExpense";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../../../attendance/_lib/attendance";

export async function GET(_request, { params }) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) throw new AttendanceError("Invalid receipt.");
    const expense = await TripExpense.findOne({ _id: id, orgId: identity.orgId }).lean();
    if (!expense?.receiptName) throw new AttendanceError("Receipt not found.", 404);
    const trip = await FieldTrip.findById(expense.tripId).select("employeeId").lean();
    let allowed = trip?.employeeId === identity.empId || identity.role === "ADMIN";
    if (!allowed && identity.role === "MANAGER" && trip) {
      const manager = await Employee.findOne({ orgId: identity.orgId, empId: identity.empId }).select("_id").lean();
      allowed = Boolean(await Employee.exists({ orgId: identity.orgId, empId: trip.employeeId, reportingTo: manager?._id }));
    }
    if (!allowed) throw new AttendanceError("You are not allowed to view this receipt.", 403);
    const safeName = path.basename(expense.receiptName);
    const buffer = await fs.readFile(path.join(TRIP_UPLOAD_DIR, safeName));
    const extension = path.extname(safeName).toLowerCase();
    const contentType = extension === ".pdf" ? "application/pdf" : extension === ".png" ? "image/png" : "image/jpeg";
    return new Response(buffer, { headers: { "Content-Type": contentType, "Content-Disposition": `inline; filename="${safeName}"`, "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error, "Unable to load receipt."); }
}
