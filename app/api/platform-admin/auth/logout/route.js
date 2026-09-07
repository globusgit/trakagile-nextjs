import { cookies } from "next/headers";
import { PLATFORM_SESSION_COOKIE } from "@/lib/platformSession.mjs";

export async function POST() {
  (await cookies()).set(PLATFORM_SESSION_COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
  return Response.json({ message: "Signed out." });
}
