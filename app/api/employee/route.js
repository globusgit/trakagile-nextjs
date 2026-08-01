import { NextResponse } from "next/server";
import connectDB from "@/lib/mongoose";
import Employee from "@/models/Employee";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");

    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 10;
    const skip = (page - 1) * limit;

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
      },
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error fetching employee:", error);
    return NextResponse.json("Failed to fetch employee", { status: 500 });
  }
}

export async function POST(request) {
  try {
    await connectDB();
    const body = await request.json();
    const name = body.name;
    const email = body.email;
    const phone = body.phone;
    const photo = body.photo;
    const designation = body.designation;
    const isManager = body.isManager;
    const status = "Active";
    const reportingManager = body.reportingManager;
    const reportingTo = body.reportingTo;
    const orgId = body.orgId;
    let empId = "EMP" + Date.now(); // Simple ID generation
    const password = body.password;
    const configName = "EMP_ID";

    const config = await Config.findOne({ name: configName, orgId });
    if (config) {
      empId = config.prefix + config.suffix;
    }
    const employee = new Employee({
      name,
      empId,
      email,
      phone,
      photo,
      designation,
      isManager,
      status,
      reportingManager,
      reportingTo,
      orgId,
    });
    const createdEmployee = await employee.save();
    if (createdEmployee) {
      //increment the suffix in the config
      if (config) {
        config.suffix = (parseInt(config.suffix) + 1).toString();
        await config.save();
      }

      let role = "USER";

      if (createdEmployee.designation === "Manager") {
        role = "MANAGER";
      } else if (
        createdEmployee.designation === "DIRECTOR" ||
        createdEmployee.designation === "MANAGING DIRECTOR"
      ) {
        role = "ADMIN";
      }
      const user = new User({
        username: empId,
        password: bcrypt.hashSync(password, 10),
        role,
        status: "Active",
        isFirstLogin: true,
        employeeId: createdEmployee._id,
        orgId,
      });
      await user.save();
    }
    return NextResponse.json("Employee created successfully", { status: 201 });
  } catch (error) {
    console.error("Error creating employee:", error);
    return NextResponse.json("Failed to create employee", { status: 500 });
  }
}
