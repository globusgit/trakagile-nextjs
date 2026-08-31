import crypto from "crypto";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { deleteFromGridFS, uploadToGridFS } from "@/lib/gridfs";
import { directReportEmployeeIds } from "@/lib/access";
import { writeAudit } from "@/lib/audit";
import Attendance from "@/models/Attendance";
import Employee from "@/models/Employee";
import GroupAttendance from "@/models/GroupAttendance";
import TrackingLocation from "@/models/TrackingLocation";
import VisitedSite from "@/models/VisitedSite";
import { detectDocumentType } from "@/lib/documentFile.mjs";
import { AttendanceError, dayKey, distanceBetween, errorResponse, locationFrom, requireAttendanceUser } from "../_lib/attendance";
import { reverseGeocode } from "../_lib/notifications";

const CONTEXTS = new Set(["FIELD_TRIP", "SITE_VISIT", "TRAINING", "EVENT", "TEAM_SHIFT"]);
const MAX_SELFIE_BYTES = 8 * 1024 * 1024;

export async function GET(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser(["MANAGER", "HR", "ADMIN", "DIRECTOR"]);
    const mode = new URL(request.url).searchParams.get("mode");
    if (mode === "team") {
      if (identity.role !== "MANAGER") return Response.json({ employees: [] });
      const ids = await directReportEmployeeIds(identity);
      const employees = await Employee.find({ orgId: identity.orgId, empId: { $in: ids }, status: "Active" })
        .sort({ name: 1 }).select("name empId designation photo").lean();
      return Response.json({ employees });
    }
    const query = { orgId: identity.orgId, ...(identity.role === "MANAGER" ? { managerEmpId: identity.empId } : {}) };
    const records = await GroupAttendance.find(query).sort({ createdAt: -1 }).limit(100)
      .populate("clientSiteId", "clientName siteName address").lean();
    return Response.json({ records });
  } catch (error) { return errorResponse(error, "Unable to load group attendance."); }
}

export async function POST(request) {
  let uploadedId;
  let session;
  try {
    await connectDB();
    const identity = await requireAttendanceUser(["MANAGER"]);
    const form = await request.formData();
    const contextType = String(form.get("contextType") || "").trim();
    const purpose = String(form.get("purpose") || "").trim();
    const employeeIds = [...new Set(String(form.get("employeeIds") || "").split(",").map((value) => value.trim()).filter(Boolean))];
    if (!CONTEXTS.has(contextType)) throw new AttendanceError("Select a valid group attendance type.");
    if (!purpose) throw new AttendanceError("Enter the group attendance purpose.");
    if (!employeeIds.length) throw new AttendanceError("Select at least one assigned employee.");
    const allowedIds = await directReportEmployeeIds(identity);
    if (employeeIds.some((id) => !allowedIds.includes(id))) throw new AttendanceError("You can select only employees assigned to you.", 403);

    const now = new Date();
    const location = locationFrom({ latitude: form.get("latitude"), longitude: form.get("longitude"), accuracy: form.get("accuracy"), capturedAt: form.get("capturedAt") }, now);
    location.locationName = await reverseGeocode(location.latitude, location.longitude);
    const clientSiteId = String(form.get("clientSiteId") || "").trim();
    let site;
    if (["FIELD_TRIP", "SITE_VISIT"].includes(contextType)) {
      if (!mongoose.isValidObjectId(clientSiteId)) throw new AttendanceError("Select a client/site for field group attendance.");
      site = await VisitedSite.findOne({ _id: clientSiteId, orgId: identity.orgId, status: "ACTIVE" }).lean();
      if (!site) throw new AttendanceError("The selected client/site is unavailable.", 404);
      if (site.location?.latitude != null && distanceBetween(location, site.location) > (site.radiusMeters || 300)) {
        throw new AttendanceError(`Group attendance must be within ${site.radiusMeters || 300} m of the selected site.`, 409);
      }
    }

    const selfie = form.get("selfie");
    if (!selfie || typeof selfie === "string" || !selfie.size) throw new AttendanceError("Capture a group selfie.");
    if (selfie.size > MAX_SELFIE_BYTES) throw new AttendanceError("Group selfie must be 8 MB or smaller.");
    const bytes = Buffer.from(await selfie.arrayBuffer());
    const detected = detectDocumentType(bytes);
    if (!detected || !["image/jpeg", "image/png"].includes(detected.mimeType)) throw new AttendanceError("Group selfie must be a valid JPG or PNG image.");
    const selfieHash = crypto.createHash("sha256").update(bytes).digest("hex");
    const uploaded = await uploadToGridFS(bytes, { filename: `${Date.now()}-${crypto.randomUUID()}${detected.extension}`, contentType: detected.mimeType, metadata: { orgId: identity.orgId, managerEmpId: identity.empId, kind: "GROUP_ATTENDANCE_SELFIE" } });
    uploadedId = uploaded.id;

    session = await mongoose.startSession();
    let group;
    await session.withTransaction(async () => {
      const employees = await Employee.find({ orgId: identity.orgId, empId: { $in: employeeIds }, status: "Active" }).session(session);
      if (employees.length !== employeeIds.length) throw new AttendanceError("One or more selected employees are unavailable.");
      const date = dayKey(now);
      if (await Attendance.exists({ orgId: identity.orgId, empId: { $in: employeeIds }, $or: [{ status: "IN" }, { attendanceDate: date }] }).session(session)) {
        throw new AttendanceError("One or more selected employees already have attendance for today.", 409);
      }
      [group] = await GroupAttendance.create([{ orgId: identity.orgId, managerEmpId: identity.empId, employeeIds, contextType, purpose, clientSiteId: site?._id, selfieFileId: uploaded.id, selfieMimeType: detected.mimeType, selfieHash, location }], { session });
      // Group attendance is point-in-time evidence, not continuous tracking.
      // Close its linked records immediately so selected employees do not show
      // false GPS-overdue alerts when their own phones are not tracking.
      const attendanceDocs = employees.map((employee) => ({ empObjId: employee._id, empId: employee.empId, orgId: identity.orgId, attendanceDate: date, markIn: { time: now, location }, markOut: { time: now, location }, lastKnownLocation: location, lastKnownLocationName: location.locationName, lastLocationReceivedAt: now, status: "OUT", trackingStatus: "STOPPED", closureType: "REGULARIZED", attendanceType: ["FIELD_TRIP", "SITE_VISIT"].includes(contextType) ? "FIELD_VISIT" : "OFFICE", attendanceSource: "GROUP", groupAttendanceId: group._id }));
      const created = await Attendance.insertMany(attendanceDocs, { session });
      await TrackingLocation.insertMany(created.map((attendance) => ({ attendanceId: attendance._id, employeeId: attendance.empId, orgId: identity.orgId, ...location })), { session });
      group.attendanceIds = created.map((attendance) => attendance._id);
      await group.save({ session });
    });
    uploadedId = null;
    await writeAudit({ identity, action: "GROUP_ATTENDANCE_CREATE", entityType: "GROUP_ATTENDANCE", entityId: group._id, details: { contextType, employeeIds, purpose } });
    return Response.json({ record: group }, { status: 201 });
  } catch (error) {
    if (uploadedId) await deleteFromGridFS(uploadedId).catch(() => {});
    return errorResponse(error, "Unable to submit group attendance.");
  } finally { await session?.endSession(); }
}
