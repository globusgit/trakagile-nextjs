export class TenantScopeError extends Error {
  constructor(message = "Organization scope is required.") {
    super(message);
    this.name = "TenantScopeError";
  }
}

export function tenantId(identity) {
  const value = String(identity?.orgId || "").trim();
  if (!value) throw new TenantScopeError();
  return value;
}

export function tenantFilter(identity, filter = {}) {
  return { ...filter, orgId: tenantId(identity) };
}

export function belongsToTenant(identity, resource) {
  if (!identity?.orgId || !resource?.orgId) return false;
  return String(identity.orgId) === String(resource.orgId);
}
