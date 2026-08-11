// Temporary placeholder until auth/session is wired up.
// Once next-auth (or similar) is added, this should be replaced with
// the actual logged-in user's ID (e.g. session.user.id) everywhere
// it's currently imported.
export const ORG_ID = "ORG1";

// Must be a valid 24-character MongoDB ObjectId format, since it's used
// as a real userId reference in LeaveRequest / LeavesInfo documents.
export const CURRENT_USER_ID = "000000000000000000000001";