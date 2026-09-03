import connectDB from "@/lib/mongoose";
import { auth } from "@/lib/auth";
import { normalizeOrganizationCode, organizationIdentityFilter } from "@/lib/organization";
import Organization from "@/models/Organization";
import Employee from "@/models/Employee";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { serverEnvironment } from "@/lib/env.mjs";
import { normalizeInternationalSettings } from "@/lib/internationalSettings.mjs";

function platformAuthorized(request) {
  const expected = serverEnvironment().platformAdminKey;
  return Boolean(expected && request.headers.get("x-platform-admin-key") === expected);
}

export async function GET(request) {
  await connectDB();
  if (platformAuthorized(request)) {
    return Response.json({ organizations: await Organization.find().sort({ name: 1 }).lean() });
  }
  const session = await auth();
  if (!session?.user?.orgId) return Response.json({ message: "Unauthorized." }, { status: 401 });
  const organization = await Organization.findOne(organizationIdentityFilter(session.user.orgId)).lean();
  return Response.json({ organizations: organization ? [organization] : [] });
}

export async function POST(request) {
  let organization;
  try {
    if (!platformAuthorized(request)) {
      return Response.json({ message: "Platform administrator access is required." }, { status: 403 });
    }
    await connectDB();
    const body = await request.json();
    const code = normalizeOrganizationCode(body.code);
    const name = String(body.name || "").trim();
    const adminEmpId = String(body.adminEmpId || "").trim();
    const adminName = String(body.adminName || "").trim();
    const adminEmail = String(body.adminEmail || "").trim().toLowerCase();
    const adminPassword = String(body.adminPassword || "");
    if (!code || !/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(code) || !name || !adminEmpId || !adminName || !adminEmail || adminPassword.length < 8) {
      return Response.json({ message: "Organization details and a first Director with an 8+ character password are required." }, { status: 400 });
    }
    const international = normalizeInternationalSettings(body);
    organization = await Organization.create({
      name,
      code,
      status: "ACTIVE",
      address: String(body.address || "Not provided").trim(),
      contactPerson: String(body.contactPerson || "Not provided").trim(),
      contactEmail: String(body.contactEmail || "not-provided@example.invalid").trim().toLowerCase(),
      contactPhone: String(body.contactPhone || "Not provided").trim(),
      contactDesignation: body.contactDesignation,
      website: body.website,
      gstNumber: body.gstNumber,
      panNumber: body.panNumber,
      registrationNumber: body.registrationNumber,
      ...international,
    });
    const orgId = organization._id.toString();
    const employee = await Employee.create({
      name: adminName,
      empId: adminEmpId,
      email: adminEmail,
      phone: body.adminPhone,
      designation: "DIRECTOR",
      isManager: true,
      status: "Active",
      orgId,
    });
    await User.create({
      username: adminEmpId,
      employeeName: adminName,
      password: await bcrypt.hash(adminPassword, 12),
      role: "DIRECTOR",
      status: "Active",
      isFirstLogin: true,
      orgId,
    });
    return Response.json({ organization, director: { id: employee._id, empId: adminEmpId, name: adminName } }, { status: 201 });
  } catch (error) {
    if (organization?._id) {
      const orgId = organization._id.toString();
      await Promise.allSettled([
        User.deleteMany({ orgId }),
        Employee.deleteMany({ orgId }),
        Organization.deleteOne({ _id: organization._id }),
      ]);
    }
    if (error?.code === 11000) return Response.json({ message: "Organization code already exists." }, { status: 409 });
    console.error("[ORGANIZATIONS] Create failed:", error);
    return Response.json({ message: "Unable to create organization." }, { status: 500 });
  }
}
