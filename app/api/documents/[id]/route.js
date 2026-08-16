import fs from "fs/promises";
import mongoose from "mongoose";
import path from "path";
import { connectDB } from "@/lib/mongoose";
import { DOCUMENT_UPLOAD_DIR } from "@/lib/uploadConfig";
import { writeAudit } from "@/lib/audit";
import Employee from "@/models/Employee";
import EmployeeDocument from "@/models/EmployeeDocument";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../../attendance/_lib/attendance";

async function authorize(identity, document, allowManager = true) {
  if (document.employeeId === identity.empId || ["ADMIN", "DIRECTOR"].includes(identity.role)) return;
  if (allowManager && identity.role === "MANAGER") {
    const manager = await Employee.findOne({ orgId: identity.orgId, empId: identity.empId }).select("_id").lean();
    if (await Employee.exists({ orgId: identity.orgId, empId: document.employeeId, reportingTo: manager?._id })) return;
  }
  throw new AttendanceError("You are not allowed to access this document.", 403);
}

export async function GET(_request, { params }) {
  try {
    await connectDB(); const identity = await requireAttendanceUser(); const { id } = await params;
    if (!mongoose.isValidObjectId(id)) throw new AttendanceError("Invalid document.");
    const document = await EmployeeDocument.findOne({ _id: id, orgId: identity.orgId }).lean();
    if (!document) throw new AttendanceError("Document not found.", 404); await authorize(identity, document);
    const bytes = await fs.readFile(path.join(DOCUMENT_UPLOAD_DIR, path.basename(document.storedName)));
    return new Response(bytes, { headers: { "Content-Type": document.mimeType, "Content-Disposition": `inline; filename="${document.originalName.replaceAll('"', "")}"`, "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error, "Unable to open document."); }
}

export async function DELETE(_request, { params }) {
  try {
    await connectDB(); const identity = await requireAttendanceUser(); const { id } = await params;
    if (!mongoose.isValidObjectId(id)) throw new AttendanceError("Invalid document.");
    const document = await EmployeeDocument.findOne({ _id: id, orgId: identity.orgId });
    if (!document) throw new AttendanceError("Document not found.", 404); await authorize(identity, document, false);
    await fs.unlink(path.join(DOCUMENT_UPLOAD_DIR, path.basename(document.storedName))).catch((error) => { if (error.code !== "ENOENT") throw error; });
    await document.deleteOne(); await writeAudit({ identity, action: "DOCUMENT_DELETE", entityType: "EMPLOYEE_DOCUMENT", entityId: document._id, details: { employeeId: document.employeeId, title: document.title } });
    return Response.json({ message: "Document deleted." });
  } catch (error) { return errorResponse(error, "Unable to delete document."); }
}
