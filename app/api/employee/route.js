import { NextResponse } from "next/server";
import connectDB from "@/lib/mongoose";
import Employee from "@/models/Employee";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { EMPLOYEE_UPLOAD_DIR } from "@/lib/uploadConfig";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../attendance/_lib/attendance";

const allowedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function GET(req) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser(["ADMIN", "DIRECTOR", "MANAGER"]);
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit")) || 20));
    const skip = (page - 1) * limit;
    const orgId = identity.orgId;

    const [employees, total] = await Promise.all([
      Employee.find({ orgId }).skip(skip).limit(limit),
      Employee.countDocuments({ orgId }),
    ]);

    return NextResponse.json(
      {
        employees,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      { status: 200 },
    );
  } catch (err) {
    if (err?.name === "AttendanceError") return errorResponse(err);
    console.error("Error fetching employees:", err);
    return NextResponse.json(
      { message: "Something went wrong!" },
      { status: 500 },
    );
  }
}

function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

export async function POST(req) {
  await connectDB();
  try {
    const identity = await requireAttendanceUser(["ADMIN", "DIRECTOR"]);
    const formData = await req.formData();

    const name = formData.get("name");
    const email = formData.get("email");
    const phone = formData.get("phone");
    const empId = formData.get("employeeId");
    const orgId = identity.orgId;

    const [existingEmpId, existingEmail] = await Promise.all([
      Employee.findOne({ empId, orgId }),
      Employee.findOne({ email, orgId }),
    ]);

    if (existingEmpId) {
      return NextResponse.json(
        { message: `Employee ID "${empId}" is already in use.` },
        { status: 409 },
      );
    }
    if (existingEmail) {
      return NextResponse.json(
        { message: `Email "${email}" is already in use.` },
        { status: 409 },
      );
    }

    const file = formData.get("photo");
    let fileName = "";
    if (file && typeof file !== "string" && file.size > 0) {
      if (!allowedPhotoTypes.has(file.type) || file.size > 5 * 1024 * 1024) {
        throw new AttendanceError("Employee photo must be JPG, PNG or WebP and 5 MB or smaller.");
      }
      if (!fs.existsSync(EMPLOYEE_UPLOAD_DIR)) {
        fs.mkdirSync(EMPLOYEE_UPLOAD_DIR, { recursive: true });
      }
      const originalName = sanitizeFileName(file.name || "upload.jpg");
      fileName = `${Date.now()}-${originalName}`;
      const filePath = path.join(EMPLOYEE_UPLOAD_DIR, fileName);

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      fs.writeFileSync(filePath, buffer);
    }

    const managerName = String(formData.get("managerName") || "").trim();
    const manager = managerName
      ? await Employee.findOne({
          orgId,
          status: "Active",
          $or: [{ empId: managerName }, { name: managerName }],
        }).select("_id")
      : null;

    const emp = await Employee.create({
      name,
      empId,
      phone,
      email,
      designation: formData.get("designation"),
      isManager: formData.get("isManager") === "true",
      reportingManager: managerName,
      reportingTo: manager?._id,
      orgId,
      photo: fileName,
    });

    if (emp) {
      const hashedPassword = await bcrypt.hash("emp@1", 10);

      let role = "USER";
      if (emp.isManager) role = "MANAGER";
      if (emp.designation?.trim().toUpperCase() === "DIRECTOR") role = "DIRECTOR";
      if (emp.designation === "ACCOUNTANT") role = "ACCOUNTANT";

      await User.create({
        username: emp.empId,
        password: hashedPassword,
        employeeName: emp.name,
        status: "Active",
        role,
        isFirstLogin: true,
        orgId: emp.orgId,
      });
    }

    return NextResponse.json(
      { message: "Employee created successfully", empId },
      { status: 201 },
    );
  } catch (err) {
    if (err?.name === "AttendanceError") return errorResponse(err);
    console.error("Error in employee creation:", err);

    if (err.code === 11000) {
      return NextResponse.json(
        { message: "An employee with this ID or email already exists." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { message: "Failed to create employee" },
      { status: 500 },
    );
  }
}
