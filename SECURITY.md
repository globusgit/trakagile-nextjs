# Security model

## Trust boundaries

- All browser and mobile input is untrusted.
- Route handlers and server-side data access enforce authentication, permission, ownership, and `orgId` scope.
- Mobile bearer tokens and web sessions are rechecked against active database records for protected workforce operations.
- UI role checks improve usability but do not grant access.

## Mandatory rules for changes

1. Add `orgId` to every organization-owned read, update, and delete filter.
2. Use a named permission from `lib/permissions.mjs` for privileged operations.
3. Apply team or resource ownership checks after permission checks where required.
4. Return only fields needed by the client; never serialize password hashes or authentication secrets.
5. Validate file contents, size, and authorization independently of client-provided MIME types and names.
6. Record security-relevant mutations without recording credentials or raw tokens.
7. Test both permitted and denied access before expanding a role's authority.

## Deployment requirements

- HTTPS is mandatory in production.
- Authentication, platform-administration, and scheduler secrets must be long, random, and independent.
- MongoDB must not be publicly accessible and must use least-privilege credentials.
- Production logs must not contain passwords, bearer tokens, full documents, or unnecessary location payloads.
- Backups must be encrypted, access-controlled, and restoration-tested.

## Known hardening roadmap

- Administrator-assisted password reset with identity verification
- Dedicated session/device inventory and selective token revocation
- MFA and enterprise identity federation
- Central rate limiting for sensitive APIs
- Full integration tests for tenant isolation and permissions
- Configurable GPS consent, retention, export, and deletion controls
- Dependency, secret, and static application security scanning in CI
- Security monitoring and incident-response runbooks
