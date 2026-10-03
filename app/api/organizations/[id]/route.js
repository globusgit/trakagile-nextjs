
import mongoose from "mongoose";
import connectDB from "@/lib/mongoose";
import { platformRequestAuthorized } from "@/lib/platformAdminAuth";
import Organization from "@/models/Organization";
import { resolveEnabledModuleKeys } from "@/lib/moduleAccess";
import { validateOrganizationInput } from "@/lib/organizationOptions.mjs";

const FORBIDDEN = { message: "Platform administrator access is required." };

// Optional details: cleared (removed) when the field is left empty.
const OPTIONAL_FIELDS = [
  "contactPerson", "contactDesignation", "website", "district", "pincode",
  "city", "state", "country", "industryType", "registrationMode", "organizationType",
  "panNumber", "gstNumber",
];

function withModules(organization) {
  return { ...organization, enabledModules: resolveEnabledModuleKeys(organization.enabledModules) };
}

export async function GET(request, context) {
  try {
    await connectDB();
    if (!(await platformRequestAuthorized(request))) return Response.json(FORBIDDEN, { status: 403 });
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) return Response.json({ message: "Invalid organization." }, { status: 400 });
    const organization = await Organization.findById(id).lean();
    if (!organization) return Response.json({ message: "Organization not found." }, { status: 404 });
    return Response.json({ organization: withModules(organization) });
  } catch (error) {
    console.error("[ORGANIZATION_READ]", error);
    return Response.json({ message: "Unable to load organization." }, { status: 500 });
  }
}

export async function PATCH(request, context) {
  try {
    await connectDB();
    if (!(await platformRequestAuthorized(request))) return Response.json(FORBIDDEN, { status: 403 });
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) {
      return Response.json({ message: "Invalid organization." }, { status: 400 });
    }
    const body = await request.json();
    const { errors, value } = validateOrganizationInput(body, { partial: true });
    const status = String(body.status || "").trim().toUpperCase();
    if (!["ACTIVE", "INACTIVE"].includes(status)) errors.status = "Select a valid status.";
    if (Object.keys(errors).length) {
      return Response.json({ message: "Please correct the highlighted fields.", errors }, { status: 400 });
    }

    // The organization code, modules and regional settings are not edited here.
    const $set = {
      name: value.name,
      contactEmail: value.contactEmail,
      contactPhone: value.contactPhone,
      address: value.address,
      status,
    };
    const $unset = {};
    for (const field of OPTIONAL_FIELDS) {
      if (value[field]) $set[field] = value[field];
      else $unset[field] = 1;
    }
    const organization = await Organization.findByIdAndUpdate(
      id,
      { $set, ...(Object.keys($unset).length ? { $unset } : {}) },
      { new: true, runValidators: true },
    ).lean();
    if (!organization) return Response.json({ message: "Organization not found." }, { status: 404 });
    return Response.json({ organization: withModules(organization) });
  } catch (error) {
    console.error("[ORGANIZATION_UPDATE]", error);
    return Response.json({ message: error instanceof Error ? error.message : "Unable to update organization." }, { status: 500 });
  }
}