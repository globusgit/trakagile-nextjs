import crypto from "crypto";
import path from "path";
import { connectDB } from "@/lib/mongoose";
import { deleteFromGridFS, uploadToGridFS } from "@/lib/gridfs";
import { writeAudit } from "@/lib/audit";
import Employee from "@/models/Employee";
import EmployeeDocument from "@/models/EmployeeDocument";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../attendance/_lib/attendance";

const allowedTypes = new Set(["image/jpeg", "image/png", "application/pdf"]);
const categories = new Set(["IDENTITY", "CERTIFICATE", "TRAVEL", "HOTEL", "CLIENT", "MEDICAL", "OTHER"]);
const cleanName = (name) => path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");

async function allowedEmployeeIds(identity) {
  if (["ADMIN", "DIRECTOR"].includes(identity.role)) return null;
  if (identity.role !== "MANAGER") return [identity.empId];
  const manager = await Employee.findOne({ orgId: identity.orgId, empId: identity.empId }).select("_id").lean();
  const team = await Employee.find({ orgId: identity.orgId, reportingTo: manager?._id }).select("empId").lean();
  return [identity.empId, ...team.map((employee) => employee.empId)];
}

export async function GET(request) {
  try {
    await connectDB(); const identity = await requireAttendanceUser(); const allowed = await allowedEmployeeIds(identity);
    const requested = new URL(request.url).searchParams.get("employeeId")?.trim();
    const query = { orgId: identity.orgId };
    if (allowed) query.employeeId = requested && allowed.includes(requested) ? requested : { $in: allowed };
    else if (requested) query.employeeId = requested;
    const documents = await EmployeeDocument.find(query).sort({ createdAt: -1 }).limit(200).lean();
    return Response.json({ documents });
  } catch (error) { return errorResponse(error, "Unable to load documents."); }
}

export async function POST(request) {
  try {
    await connectDB(); const identity = await requireAttendanceUser(); const form = await request.formData();
    const employeeId = String(form.get("employeeId") || identity.empId).trim();
    if (employeeId !== identity.empId && !["ADMIN", "DIRECTOR"].includes(identity.role)) throw new AttendanceError("You can upload only your own documents.", 403);
    if (!await Employee.exists({ orgId: identity.orgId, empId: employeeId, status: "Active" })) throw new AttendanceError("Employee is unavailable.", 404);
    const title = String(form.get("title") || "").trim(); const category = String(form.get("category") || "OTHER"); const file = form.get("file");
    if (!title) throw new AttendanceError("Document title is required.");
    if (!categories.has(category)) throw new AttendanceError("Select a valid document category.");
    if (!file || typeof file === "string" || !file.size) throw new AttendanceError("Select a document to upload.");
    if (!allowedTypes.has(file.type)) throw new AttendanceError("Document must be JPG, PNG or PDF.");
    if (file.size > 10 * 1024 * 1024) throw new AttendanceError("Document must be 10 MB or smaller.");
    const bytes = Buffer.from(await file.arrayBuffer()); const fileHash = crypto.createHash("sha256").update(bytes).digest("hex");
    if (await EmployeeDocument.exists({ orgId: identity.orgId, employeeId, fileHash })) throw new AttendanceError("This document was already uploaded.", 409);
    const storedName = `${Date.now()}-${crypto.randomUUID()}-${cleanName(file.name || "document")}`;
    const uploaded = await uploadToGridFS(bytes, { filename: storedName, contentType: file.type, metadata: { orgId: identity.orgId, employeeId, kind: "EMPLOYEE_DOCUMENT" } });
    let document;
    try { document = await EmployeeDocument.create({ orgId: identity.orgId, employeeId, category, title, description: String(form.get("description") || "").trim(), gridFsFileId: uploaded.id, originalName: cleanName(file.name), mimeType: file.type, size: file.size, fileHash, uploadedBy: identity.userId }); }
    catch (error) { await deleteFromGridFS(uploaded.id); throw error; }
    await writeAudit({ identity, action: "DOCUMENT_UPLOAD", entityType: "EMPLOYEE_DOCUMENT", entityId: document._id, details: { employeeId, category, title } });
    return Response.json({ document }, { status: 201 });
  } catch (error) { return errorResponse(error, "Unable to upload document."); }
}
