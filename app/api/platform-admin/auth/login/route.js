import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import connectDB from "@/lib/mongoose";
import { serverEnvironment } from "@/lib/env.mjs";
import { createPlatformSession, PLATFORM_SESSION_COOKIE, PLATFORM_SESSION_SECONDS } from "@/lib/platformSession.mjs";
import PlatformAdmin from "@/models/PlatformAdmin";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export async function POST(request) {
  try {
    await connectDB();
    const body = await request.json();
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    const admin = await PlatformAdmin.findOne({ username }).select("+password +failedLoginAttempts +lockedUntil name username status");
    const now = new Date();
    if (!admin || admin.status !== "ACTIVE" || (admin.lockedUntil && admin.lockedUntil > now) || !(await bcrypt.compare(password, admin.password))) {
      if (admin && (!admin.lockedUntil || admin.lockedUntil <= now)) {
        const attempts = (admin.failedLoginAttempts || 0) + 1;
        admin.failedLoginAttempts = attempts;
        if (attempts >= MAX_ATTEMPTS) admin.lockedUntil = new Date(now.getTime() + LOCK_MINUTES * 60_000);
        await admin.save();
      }
      return Response.json({ message: "Invalid System Admin credentials." }, { status: 401 });
    }
    admin.failedLoginAttempts = 0;
    admin.lockedUntil = null;
    admin.lastLoginAt = now;
    await admin.save();
    const token = createPlatformSession({ sub: admin._id, username: admin.username }, serverEnvironment().authSecret);
    (await cookies()).set(PLATFORM_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: serverEnvironment().nodeEnv === "production",
      sameSite: "strict",
      path: "/",
      maxAge: PLATFORM_SESSION_SECONDS,
      priority: "high",
    });
    return Response.json({ admin: { name: admin.name, username: admin.username } });
  } catch (error) {
    console.error("[PLATFORM_ADMIN_LOGIN]", error);
    return Response.json({ message: "Unable to sign in." }, { status: 500 });
  }
}
