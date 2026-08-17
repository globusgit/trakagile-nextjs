import ActivityLog from "@/models/ActivityLog";

export async function writeAudit({ identity, action, entityType, entityId, details }) {
  try {
    await ActivityLog.create({
      action,
      userId: identity.userId,
      details: typeof details === "string" ? details : JSON.stringify(details || {}),
      entityType,
      entityId,
      orgId: identity.orgId,
    });
  } catch (error) {
    console.error("Unable to write audit log:", error);
  }
}
