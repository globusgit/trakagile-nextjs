
import DefaultList from "@/models/DefaultList";
import SystemList from "@/models/SystemList";
import { DEFAULT_DESIGNATIONS } from "@/lib/organizationOptions.mjs";

export const DESIGNATION_LIST = "Designation";

// The Employees module maps this exact designation to the DIRECTOR role, and
// every organization's first user is a DIRECTOR, so it must always exist.
const REQUIRED_DESIGNATION = "DIRECTOR";

/**
 * Designation names new organizations start with.
 * DefaultList (global, not tied to any organization) is the template: it is
 * filled with the built-in list the first time it is needed, and can then be
 * edited directly in the database to change what future organizations get.
 */
export async function defaultDesignations() {
  const active = await DefaultList.find({ listName: DESIGNATION_LIST, status: "active" }).sort({ createdAt: 1, _id: 1 }).lean();
  let items = active.map((entry) => entry.listItem);
  if (!items.length && !(await DefaultList.exists({ listName: DESIGNATION_LIST }))) {
    await DefaultList.insertMany(DEFAULT_DESIGNATIONS.map((listItem) => ({ listName: DESIGNATION_LIST, listItem, status: "active" })));
    items = [...DEFAULT_DESIGNATIONS];
  }
  const unique = [...new Set(items.map((item) => String(item).trim()).filter(Boolean))];
  if (!unique.includes(REQUIRED_DESIGNATION)) unique.unshift(REQUIRED_DESIGNATION);
  return unique;
}

/** Copies the default designations into one organization's own Designation list. */
export async function seedOrganizationDesignations(orgId) {
  const designations = await defaultDesignations();
  await SystemList.insertMany(
    designations.map((listItem) => ({ listName: DESIGNATION_LIST, listItem, orgId: String(orgId), status: "active" })),
  );
  return designations.length;
}