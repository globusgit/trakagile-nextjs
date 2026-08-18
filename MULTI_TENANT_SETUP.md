# Multi-organization setup

TrakAgile scopes authenticated data by the `orgId` stored in the web session or mobile token. Employee IDs and email addresses are unique inside an organization, not globally.

## 1. Configure platform provisioning

Add a long random value to the deployment environment:

```env
PLATFORM_ADMIN_KEY=replace-with-a-long-random-secret
```

## 2. Migrate existing indexes

Back up MongoDB, then run once:

```powershell
$env:DEFAULT_ORG_CODE="GLOBUS"
npm run migrate:multi-tenant
```

This gives an existing organization a code, removes legacy global employee/user indexes, and creates organization-scoped indexes.

## 3. Provision another organization

Send `POST /api/organizations` with the `x-platform-admin-key` header. Example JSON:

```json
{
  "code": "CLIENT2",
  "name": "Client Two",
  "address": "Hyderabad",
  "contactPerson": "Operations",
  "contactEmail": "operations@example.com",
  "contactPhone": "9999999999",
  "adminEmpId": "DIRECTOR1",
  "adminName": "Client Director",
  "adminEmail": "director@example.com",
  "adminPassword": "change-this-password"
}
```

The response contains the new organization and its first Director account. Users enter only Employee ID and password. The organization context is resolved automatically from a production subdomain, an organization login link such as `/?org=GLOBUS`, `NEXT_PUBLIC_ORGANIZATION_CODE`, or the mobile `ORGANIZATION_CODE` build definition. When no context is configured, login succeeds only if the Employee ID belongs to exactly one organization; ambiguous IDs are rejected.
