# TrakAgile

TrakAgile is a multi-organization workforce operations platform for attendance, employee administration, field work, live location tracking, leave and work-from-home workflows, tasks, documents, expenses, notifications, reporting, and audit activity.

The repository contains a Next.js 16 web application and API, MongoDB persistence through Mongoose, Auth.js credential sessions, signed mobile bearer tokens, and a Flutter client under `mobile/`.

## Core modules

| Domain | Capabilities |
| --- | --- |
| Identity | Organization-scoped users, employees, roles, managers and active-status enforcement |
| Attendance | Mark in/out, policy, history, reminders, automatic close, visits, WFH breaks and group attendance |
| Location | Live employee state, location ingestion, daily routes and field tracking |
| Workforce | Employee records, documents, holidays, leave, WFH and notifications |
| Operations | Tasks, field trips, expenses, receipts and attendance reporting |
| Governance | Organization provisioning and audit logs |

## Requirements

- Node.js 20 or newer
- npm
- MongoDB
- Flutter toolchain when building the mobile client

## Local setup

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env.local` and replace every example secret.
3. Start MongoDB and set `MONGODB_URI` to the intended database.
4. Run `npm run dev` and open `http://localhost:3000`.

Never commit environment files, production credentials, database exports, uploaded documents, or signed mobile builds.

## Environment configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `AUTH_SECRET` | Yes | Web session and mobile token signing secret |
| `PLATFORM_ADMIN_KEY` | Provisioning | Authorizes organization provisioning |
| `CRON_SECRET` | Scheduled jobs | Authorizes attendance reminder jobs |
| `NEXT_PUBLIC_ORGANIZATION_CODE` | No | Default organization context for a dedicated deployment |

`NEXTAUTH_SECRET` remains accepted as a compatibility fallback for `AUTH_SECRET`. Use independent, randomly generated values for authentication, platform administration, and scheduled jobs.

## Quality gates

Run these before merging or deploying:

```powershell
npm test
npm run lint
npm run build
```

The production build includes TypeScript checking. Tests use the Node.js test runner and live in `tests/`.

## Authorization model

Server routes are the enforcement boundary. Hiding a control in the web or mobile UI is not authorization.

Shared role permissions are defined in `lib/permissions.mjs`. Organization and team visibility helpers are in `lib/access.js`. Authenticated API identities are revalidated against active User and Employee records before protected workforce operations proceed.

Web and mobile credential checks share the same persistent account policy. Five failed password attempts lock the account for 15 minutes. Temporary passwords must be replaced with a 12+ character mixed-case password, and changing a password increments the account token version so existing web and mobile sessions are rejected.

Every organization-owned query must include `orgId`. An object identifier alone must never retrieve organization data. New privileged operations should receive a named permission in the centralized matrix rather than introduce another inline role array.

Use `tenantFilter(identity, additionalFilter)` from `lib/tenantScope.mjs` when constructing organization-owned queries. It overwrites any caller-provided `orgId` with the authenticated organization and fails closed when organization context is missing.

Current standard roles are `USER`, `MANAGER`, `ACCOUNTANT`, `HR`, `ADMIN`, and `DIRECTOR`. Manager access remains constrained further by reporting relationships where a resource is team-scoped.

## Multi-organization provisioning

See `MULTI_TENANT_SETUP.md` for migration and provisioning instructions. Back up the database and test restoration before running a production migration.

## Repository structure

```text
app/          Next.js pages, route handlers and application components
components/   Shared UI components
lib/          Authentication, authorization, persistence and domain utilities
models/       Mongoose schemas and indexes
mobile/       Flutter client
scripts/      Operational and migration scripts
tests/        Automated tests
```

## Release checklist

- Tests, lint and production build pass from a clean checkout
- Database migration and rollback procedures are reviewed
- Required secrets exist and are not shared across purposes
- Organization-isolation and permission tests cover changed endpoints
- Mobile and server API versions remain compatible
- Backup restoration has been tested
- Monitoring, alerting and rollback ownership are assigned
- GPS/privacy changes have product and compliance approval

## Security reporting

Do not place credentials or personal employee/location data in an issue, log excerpt, screenshot, or chat message. Report vulnerabilities privately to the project owner with the affected route, reproduction steps, and impact.
