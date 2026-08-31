import crypto from "crypto";
import path from "path";
import { connectDB } from "@/lib/mongoose";
import { deleteFromGridFS, uploadToGridFS } from "@/lib/gridfs";
import { writeAudit } from "@/lib/audit";
import Employee from "@/models/Employee";
import EmployeeDocument from "@/models/EmployeeDocument";
import Notification from "@/models/Notification";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../attendance/_lib/attendance";
import { detectDocumentType, MAX_DOCUMENT_BYTES } from "@/lib/documentFile.mjs";

const categories = new Set(["IDENTITY", "CERTIFICATE", "TRAVEL", "HOTEL", "CLIENT", "MEDICAL", "OTHER"]);
const cleanName = (name) => path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
const DAY_MS = 24 * 60 * 60 * 1000;

function expiryStatus(expiresAt, now = new Date()) {
  if (!expiresAt) return "NO_EXPIRY";
  const remainingDays = Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / DAY_MS);
  if (remainingDays < 0) return "EXPIRED";
  if (remainingDays <= 30) return "EXPIRING_SOON";
  return "VALID";
}

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
    const now = new Date();
    const enriched = documents.map((document) => ({ ...document, expiryStatus: expiryStatus(document.expiresAt, now) }));
    const ownExpiring = enriched.filter((document) => document.employeeId === identity.empId && ["EXPIRED", "EXPIRING_SOON"].includes(document.expiryStatus));
    for (const document of ownExpiring) {
      await Notification.updateOne(
        { orgId: identity.orgId, recipientEmpId: identity.empId, dedupeKey: `document-expiry:${document._id}:${document.expiryStatus}` },
        { $setOnInsert: { orgId: identity.orgId, recipientEmpId: identity.empId, employeeEmpId: identity.empId, type: "DOCUMENT_EXPIRING", title: document.expiryStatus === "EXPIRED" ? "Document expired" : "Document expiring soon", message: `${document.title} ${document.expiryStatus === "EXPIRED" ? "has expired" : "expires within 30 days"}.`, dedupeKey: `document-expiry:${document._id}:${document.expiryStatus}` } },
        { upsert: true },
      );
    }
    return Response.json({ documents: enriched, summary: { total: enriched.length, expired: enriched.filter((document) => document.expiryStatus === "EXPIRED").length, expiringSoon: enriched.filter((document) => document.expiryStatus === "EXPIRING_SOON").length } });
  } catch (error) { return errorResponse(error, "Unable to load documents."); }
}

export async function POST(request) {
  try {
    await connectDB(); const identity = await requireAttendanceUser(); const form = await request.formData();
    const employeeId = String(form.get("employeeId") || identity.empId).trim();
    if (employeeId !== identity.empId && !["ADMIN", "DIRECTOR"].includes(identity.role)) throw new AttendanceError("You can upload only your own documents.", 403);
    if (!await Employee.exists({ orgId: identity.orgId, empId: employeeId, status: "Active" })) throw new AttendanceError("Employee is unavailable.", 404);
    const title = String(form.get("title") || "").trim(); const category = String(form.get("category") || "OTHER"); const file = form.get("file");
    const expiresAtValue = String(form.get("expiresAt") || "").trim();
    const expiresAt = expiresAtValue ? new Date(`${expiresAtValue}T23:59:59.999Z`) : undefined;
    if (!title) throw new AttendanceError("Document title is required.");
    if (!categories.has(category)) throw new AttendanceError("Select a valid document category.");
    if (expiresAtValue && Number.isNaN(expiresAt.getTime())) throw new AttendanceError("Select a valid document expiry date.");
    if (!file || typeof file === "string" || !file.size) throw new AttendanceError("Select a document to upload.");
    if (file.size > MAX_DOCUMENT_BYTES) throw new AttendanceError("Document must be 10 MB or smaller.");
    const bytes = Buffer.from(await file.arrayBuffer());
    // Mobile and desktop clients often report uploads as application/octet-stream.
    // Verify the actual file signature so valid files work without trusting client MIME data.
    const detectedType = detectDocumentType(bytes);
    if (!detectedType) throw new AttendanceError("Document must be a valid JPG, PNG or PDF file.");
    const fileHash = crypto.createHash("sha256").update(bytes).digest("hex");
    if (await EmployeeDocument.exists({ orgId: identity.orgId, employeeId, fileHash })) throw new AttendanceError("This document was already uploaded.", 409);
    const suppliedName = cleanName(file.name || `document${detectedType.extension}`);
    const storedName = `${Date.now()}-${crypto.randomUUID()}-${suppliedName}`;
    const uploaded = await uploadToGridFS(bytes, { filename: storedName, contentType: detectedType.mimeType, metadata: { orgId: identity.orgId, employeeId, kind: "EMPLOYEE_DOCUMENT" } });
    let document;
    try { document = await EmployeeDocument.create({ orgId: identity.orgId, employeeId, category, title, description: String(form.get("description") || "").trim(), expiresAt, gridFsFileId: uploaded.id, originalName: suppliedName, mimeType: detectedType.mimeType, size: bytes.length, fileHash, uploadedBy: identity.userId }); }
    catch (error) { await deleteFromGridFS(uploaded.id); throw error; }
    await writeAudit({ identity, action: "DOCUMENT_UPLOAD", entityType: "EMPLOYEE_DOCUMENT", entityId: document._id, details: { employeeId, category, title } });
    return Response.json({ document }, { status: 201 });
  } catch (error) { return errorResponse(error, "Unable to upload document."); }
}
