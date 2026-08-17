import { connectDB } from "@/lib/mongoose";
import {
  errorResponse,
  getAttendancePolicy,
  requireAttendanceUser,
} from "../_lib/attendance";

export async function GET() {
  try {
    await connectDB();
    const { orgId } = await requireAttendanceUser();
    return Response.json({ data: await getAttendancePolicy(orgId) });
  } catch (error) {
    return errorResponse(error, "Unable to load attendance policy.");
  }
}
