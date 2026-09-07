import mongoose from "mongoose";
import connectDB from "@/lib/mongoose";
import { normalizeInternationalSettings } from "@/lib/internationalSettings.mjs";
import { platformRequestAuthorized } from "@/lib/platformAdminAuth";
import Organization from "@/models/Organization";

export async function PATCH(request, context) {
  try {
    await connectDB();
    if (!(await platformRequestAuthorized(request))) {
      return Response.json({ message: "Platform administrator access is required." }, { status: 403 });
    }
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) {
      return Response.json({ message: "Invalid organization." }, { status: 400 });
    }
    const body = await request.json();
    const name = String(body.name || "").trim();
    const contactPerson = String(body.contactPerson || "").trim();
    const contactEmail = String(body.contactEmail || "").trim().toLowerCase();
    const contactPhone = String(body.contactPhone || "").trim();
    const address = String(body.address || "").trim();
    const status = String(body.status || "").trim().toUpperCase();
    if (!name || !contactPerson || !contactEmail || !contactPhone || !address || !["ACTIVE", "INACTIVE"].includes(status)) {
      return Response.json({ message: "Name, contact details, address and a valid status are required." }, { status: 400 });
    }
    const international = normalizeInternationalSettings(body);
    const organization = await Organization.findByIdAndUpdate(
      id,
      {
        $set: {
          name,
          contactPerson,
          contactEmail,
          contactPhone,
          address,
          status,
          contactDesignation: String(body.contactDesignation || "").trim() || undefined,
          website: String(body.website || "").trim() || undefined,
          gstNumber: String(body.gstNumber || "").trim() || undefined,
          panNumber: String(body.panNumber || "").trim() || undefined,
          registrationNumber: String(body.registrationNumber || "").trim() || undefined,
          ...international,
        },
      },
      { new: true, runValidators: true },
    ).lean();
    if (!organization) return Response.json({ message: "Organization not found." }, { status: 404 });
    return Response.json({ organization });
  } catch (error) {
    console.error("[ORGANIZATION_UPDATE]", error);
    return Response.json({ message: error instanceof Error ? error.message : "Unable to update organization." }, { status: 500 });
  }
}
