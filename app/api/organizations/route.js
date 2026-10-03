
import connectDB from "@/lib/mongoose";
import { auth } from "@/lib/auth";
import { organizationIdentityFilter } from "@/lib/organization";
import { availableOrganizationCode } from "@/lib/organizationCode.mjs";
import Organization from "@/models/Organization";
import Employee from "@/models/Employee";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { normalizeInternationalSettings } from "@/lib/internationalSettings.mjs";
import { platformRequestAuthorized } from "@/lib/platformAdminAuth";
import { defaultEnabledModuleKeys, resolveEnabledModuleKeys } from "@/lib/moduleAccess";
import { seedOrganizationDesignations } from "@/lib/organizationDefaults";
import { DEFAULT_EMPLOYEE_PASSWORD, internationalDefaultsForCountry, validateOrganizationInput } from "@/lib/organizationOptions.mjs";
import SystemList from "@/models/SystemList";

export async function GET(request) {
  await connectDB();
  if (await platformRequestAuthorized(request)) {
    const organizations = await Organization.find().sort({ createdAt: -1 }).lean();
    return Response.json({
      organizations: organizations.map((item) => ({ ...item, enabledModules: resolveEnabledModuleKeys(item.enabledModules) })),
    });
  }
  const session = await auth();
  if (!session?.user?.orgId) return Response.json({ message: "Unauthorized." }, { status: 401 });
  const organization = await Organization.findOne(organizationIdentityFilter(session.user.orgId)).lean();
  return Response.json({ organizations: organization ? [organization] : [] });
}

export async function POST(request) {
  let organization;
  try {
    if (!(await platformRequestAuthorized(request))) {
      return Response.json({ message: "Platform administrator access is required." }, { status: 403 });
    }
    await connectDB();
    const body = await request.json();
    const { errors, value } = validateOrganizationInput(body);
    if (Object.keys(errors).length) {
      return Response.json({ message: "Please correct the highlighted fields.", errors }, { status: 400 });
    }

    // The organization's first user is a Director who signs in with the
    // contact's mobile number and the default password (changed on first login).
    const adminEmpId = String(body.adminEmpId || "").trim() || value.loginId;
    const adminName = String(body.adminName || "").trim() || value.contactPerson || value.name;
    const adminEmail = String(body.adminEmail || "").trim().toLowerCase() || value.contactEmail;
    const customPassword = String(body.adminPassword || "");
    if (customPassword && customPassword.length < 8) {
      return Response.json({ message: "A custom password must contain at least 8 characters." }, { status: 400 });
    }
    // Without an organization code on the login page, an ID must belong to a
    // single user across all organizations, so refuse one that is already taken.
    if (await User.exists({ username: adminEmpId })) {
      return Response.json({
        message: "This mobile number is already used as an Employee ID in an organization. Use a different contact mobile number.",
        errors: { contactPhone: "Already used as an Employee ID." },
      }, { status: 409 });
    }

    const code = await availableOrganizationCode(value.name, (candidate) => Organization.exists({ code: candidate }));
    const international = normalizeInternationalSettings({ ...internationalDefaultsForCountry(value.country), ...body });
    organization = await Organization.create({
      name: value.name,
      code,
      status: "ACTIVE",
      address: value.address,
      contactPerson: value.contactPerson || undefined,
      contactEmail: value.contactEmail,
      contactPhone: value.contactPhone,
      contactDesignation: value.contactDesignation || undefined,
      website: value.website || undefined,
      gstNumber: value.gstNumber || undefined,
      panNumber: value.panNumber || undefined,
      city: value.city,
      district: value.district || undefined,
      state: value.state,
      country: value.country,
      pincode: value.pincode || undefined,
      industryType: value.industryType,
      registrationMode: value.registrationMode,
      organizationType: value.organizationType,
      // Every new organization starts with the modules that are enabled now.
      // Modules that are disabled stay disabled (and untouched) for it too.
      enabledModules: defaultEnabledModuleKeys(),
      ...international,
    });
    const orgId = organization._id.toString();
    const employee = await Employee.create({
      name: adminName,
      empId: adminEmpId,
      email: adminEmail,
      phone: value.contactPhone,
      designation: "DIRECTOR",
      isManager: true,
      status: "Active",
      orgId,
    });
    await User.create({
      username: adminEmpId,
      employeeName: adminName,
      password: await bcrypt.hash(customPassword || DEFAULT_EMPLOYEE_PASSWORD, 12),
      role: "DIRECTOR",
      status: "Active",
      isFirstLogin: true,
      orgId,
    });
    // Designation data, so the Director can create employees straight away.
    const designationCount = await seedOrganizationDesignations(orgId);
    return Response.json({
      organization,
      director: { id: employee._id, empId: adminEmpId, name: adminName },
      login: { employeeId: adminEmpId, password: customPassword ? undefined : DEFAULT_EMPLOYEE_PASSWORD, organizationCode: code },
      designationCount,
    }, { status: 201 });
  } catch (error) {
    if (organization?._id) {
      const orgId = organization._id.toString();
      await Promise.allSettled([
        SystemList.deleteMany({ orgId }),
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