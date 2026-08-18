import mongoose from "mongoose";

import Organization from "@/models/Organization";

export function normalizeOrganizationCode(value) {
  return String(value || "").trim().toUpperCase();
}

export async function organizationIdForCode(value) {
  const code = normalizeOrganizationCode(value);
  if (!code) return null;

  const organization = await Organization.findOne({ code, status: "ACTIVE" })
    .select("_id")
    .lean();
  return organization?._id?.toString() || null;
}

export function sameOrganization(identity, document) {
  return Boolean(
    identity?.orgId &&
      document?.orgId &&
      String(identity.orgId) === String(document.orgId),
  );
}

export function validOrganizationId(value) {
  return mongoose.isValidObjectId(String(value || ""));
}
