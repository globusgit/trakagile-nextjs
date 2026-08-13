import { connectDB } from "@/lib/mongoose";
import Employee from "@/models/Employee";

export async function GET(request) {
  await connectDB();
  const orgId = new URL(request.url).searchParams.get("orgId");
  if (!orgId) return Response.json({ message: "Organization is required." }, { status: 400 });
  const employees = await Employee.find({ orgId, status: "Active" }).select("name empId").sort({ name: 1 }).lean();
  return Response.json({ data: employees });
}
