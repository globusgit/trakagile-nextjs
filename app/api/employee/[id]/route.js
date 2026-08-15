import { NextResponse } from "next/server";
import connectDB from "@/lib/mongoose";
import Employee from "@/models/Employee";
import fs from "fs";
import path from "path";
import { EMPLOYEE_UPLOAD_DIR } from "@/lib/uploadConfig";

function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

export async function GET(req, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const employee = await Employee.findById(id);

    if (!employee) {
      return NextResponse.json({ message: "Employee not found" }, { status: 404 });
    }

    return NextResponse.json(employee, { status: 200 });
  } catch (err) {
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
    const { id } = await params;
    const formData = await req.formData();
    const currentEmployee = await Employee.findById(id).select("orgId");
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
      if (!fs.existsSync(EMPLOYEE_UPLOAD_DIR)) {
        fs.mkdirSync(EMPLOYEE_UPLOAD_DIR, { recursive: true });
      }
      const originalName = sanitizeFileName(file.name || "upload.jpg");
      const fileName = `${Date.now()}-${originalName}`;
      const filePath = path.join(EMPLOYEE_UPLOAD_DIR, fileName);
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      fs.writeFileSync(filePath, buffer);
      updateData.photo = fileName;
    }

    const updated = await Employee.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    console.error("Error updating employee:", err);
    return NextResponse.json(
      { message: "Failed to update employee" },
      { status: 500 },
    );
  }
}
