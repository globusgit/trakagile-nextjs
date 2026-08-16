import { NextResponse } from "next/server";
import connectDB from "@/lib/mongoose";
import Employee from "@/models/Employee";
import { deleteFromGridFS, uploadToGridFS } from "@/lib/gridfs";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../../attendance/_lib/attendance";
import { visibleEmployeeIds } from "@/lib/access";

const allowedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

export async function GET(req, { params }) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const { id } = await params;
    const employee = await Employee.findOne({ _id: id, orgId: identity.orgId });

    if (!employee) {
      return NextResponse.json({ message: "Employee not found" }, { status: 404 });
    }
    const allowedIds = await visibleEmployeeIds(identity, true);
    if (allowedIds && !allowedIds.includes(employee.empId)) {
      throw new AttendanceError("You are not allowed to view this employee.", 403);
    }

    return NextResponse.json(employee, { status: 200 });
  } catch (err) {
    if (err?.name === "AttendanceError") return errorResponse(err);
    console.error("Error fetching employee:", err);
    return NextResponse.json(
      { message: "Failed to fetch employee" },
      { status: 500 },
    );
  }
}

export async function PUT(req, { params }) {
  await connectDB();
  try {
    const identity = await requireAttendanceUser(["ADMIN", "DIRECTOR"]);
    const { id } = await params;
    const formData = await req.formData();
    const currentEmployee = await Employee.findOne({ _id: id, orgId: identity.orgId }).select("orgId empId photoFileId");
    if (!currentEmployee) throw new AttendanceError("Employee not found.", 404);
    const managerName = String(formData.get("managerName") || "").trim();
    const manager = managerName && currentEmployee
      ? await Employee.findOne({
          orgId: currentEmployee.orgId,
          status: "Active",
          _id: { $ne: id },
          $or: [{ empId: managerName }, { name: managerName }],
        }).select("_id")
      : null;

    const updateData = {
      name: formData.get("name"),
      empId: formData.get("employeeId"),
      phone: formData.get("phone"),
      email: formData.get("email"),
      designation: formData.get("designation"),
      isManager: formData.get("isManager") === "true",
      reportingManager: managerName,
      reportingTo: manager?._id || null,
      status: formData.get("status") || "Active",
    };

    const file = formData.get("photo");
    if (file && typeof file !== "string" && file.size > 0) {
      if (!allowedPhotoTypes.has(file.type) || file.size > 5 * 1024 * 1024) {
        throw new AttendanceError("Employee photo must be JPG, PNG or WebP and 5 MB or smaller.");
      }
      const originalName = sanitizeFileName(file.name || "upload.jpg");
      const fileName = `${Date.now()}-${originalName}`;
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const uploaded = await uploadToGridFS(buffer, { filename: fileName, contentType: file.type, metadata: { orgId: identity.orgId, empId: currentEmployee.empId, kind: "EMPLOYEE_PHOTO" } });
      updateData.photo = fileName;
      updateData.photoFileId = uploaded.id;
      await deleteFromGridFS(currentEmployee.photoFileId);
    }

    const updated = await Employee.findOneAndUpdate({ _id: id, orgId: identity.orgId }, updateData, {
      new: true,
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    if (err?.name === "AttendanceError") return errorResponse(err);
    console.error("Error updating employee:", err);
    return NextResponse.json(
      { message: "Failed to update employee" },
      { status: 500 },
    );
  }
}
