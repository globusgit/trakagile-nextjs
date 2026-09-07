import connectDB from "@/lib/mongoose";
import { platformAdminFromSession } from "@/lib/platformAdminAuth";

export async function GET() {
  await connectDB();
  const admin = await platformAdminFromSession();
  if (!admin) return Response.json({ message: "Unauthorized." }, { status: 401 });
  return Response.json({ admin });
}
