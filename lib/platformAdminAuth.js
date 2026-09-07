import "server-only";

import { cookies } from "next/headers";
import { serverEnvironment } from "@/lib/env.mjs";
import { PLATFORM_SESSION_COOKIE, verifyPlatformSession } from "@/lib/platformSession.mjs";
import PlatformAdmin from "@/models/PlatformAdmin";

export async function platformAdminFromSession() {
  const token = (await cookies()).get(PLATFORM_SESSION_COOKIE)?.value;
  const payload = verifyPlatformSession(token, serverEnvironment().authSecret);
  if (!payload) return null;
  return PlatformAdmin.findOne({ _id: payload.sub, username: payload.username, status: "ACTIVE" })
    .select("name username status lastLoginAt")
    .lean();
}

export async function platformRequestAuthorized(request, { allowApiKey = true } = {}) {
  if (allowApiKey) {
    const expected = serverEnvironment().platformAdminKey;
    if (expected && request.headers.get("x-platform-admin-key") === expected) return true;
  }
  return Boolean(await platformAdminFromSession());
}
