import crypto from "crypto";
import mongoose from "mongoose";
import path from "path";
import { connectDB } from "@/lib/mongoose";
import { deleteFromGridFS, uploadToGridFS } from "@/lib/gridfs";
import FieldTrip from "@/models/FieldTrip";
import TripExpense from "@/models/TripExpense";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../../../attendance/_lib/attendance";
import { notifyAttendance } from "../../../attendance/_lib/notifications";

const allowedTypes = new Set(["image/jpeg", "image/png", "application/pdf"]);
const cleanName = (name) => path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");

export async function POST(request, { params }) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) throw new AttendanceError("Invalid trip.");
    const trip = await FieldTrip.findOne({ _id: id, orgId: identity.orgId, employeeId: identity.empId });
    if (!trip || ["COMPLETED", "CANCELLED"].includes(trip.status)) throw new AttendanceError("Expenses can only be added to an active trip.", 409);
    const form = await request.formData();
    const amount = Number(form.get("amount"));
    const category = String(form.get("category") || "");
    if (!Number.isFinite(amount) || amount <= 0) throw new AttendanceError("Enter a valid expense amount.");
    const receipt = form.get("receipt");
    let receiptPath;
    let receiptName;
    let receiptHash;
    let receiptFileId;
    if (receipt && typeof receipt !== "string" && receipt.size > 0) {
      if (!allowedTypes.has(receipt.type)) throw new AttendanceError("Receipt must be JPG, PNG or PDF.");
      if (receipt.size > 10 * 1024 * 1024) throw new AttendanceError("Receipt must be 10 MB or smaller.");
      const bytes = Buffer.from(await receipt.arrayBuffer());
      receiptHash = crypto.createHash("sha256").update(bytes).digest("hex");
      if (await TripExpense.exists({ tripId: trip._id, receiptHash })) throw new AttendanceError("This receipt was already submitted.", 409);
      receiptName = `${Date.now()}-${cleanName(receipt.name || "receipt")}`;
      receiptFileId = (await uploadToGridFS(bytes, { filename: receiptName, contentType: receipt.type, metadata: { orgId: identity.orgId, employeeId: identity.empId, kind: "TRIP_RECEIPT" } })).id;
    }
    const expense = await TripExpense.create({
      tripId: trip._id, orgId: identity.orgId, employeeId: identity.empId,
      category, amount, vendor: form.get("vendor"), paymentMethod: form.get("paymentMethod"),
      remarks: form.get("remarks"), receiptPath, receiptName, receiptHash, receiptFileId,
    }).catch(async (error) => { await deleteFromGridFS(receiptFileId); throw error; });
    if (receiptName) {
      expense.receiptPath = `/api/field-trips/receipts/${expense._id}`;
      await expense.save();
    }
    trip.totalExpenses = (trip.totalExpenses || 0) + amount;
    await trip.save();
    await notifyAttendance({
      orgId: identity.orgId, empId: identity.empId, attendanceId: trip.attendanceId,
      type: "EXPENSE_SUBMITTED", title: "Trip expense submitted",
      message: `${identity.empId} submitted ${category} expense of ₹${amount.toFixed(2)}.`,
      dedupeKey: `${expense._id}:submitted`,
    });
    return Response.json({ data: expense }, { status: 201 });
  } catch (error) { return errorResponse(error, "Unable to save expense."); }
}
