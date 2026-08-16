import fs from "fs/promises";
import path from "path";
import { connectDB } from "@/lib/mongoose";
import { EMPLOYEE_UPLOAD_DIR } from "@/lib/uploadConfig";
import Employee from "@/models/Employee";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../../attendance/_lib/attendance";

const contentTypes = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

export async function GET(_request, context) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const { path: fileParts } = await context.params;
    if (!Array.isArray(fileParts) || fileParts.length !== 2 || fileParts[0] !== "employees") throw new AttendanceError("Invalid file path.", 400);
    const fileName = path.basename(decodeURIComponent(fileParts[1]));
    if (fileName !== decodeURIComponent(fileParts[1])) throw new AttendanceError("Invalid file path.", 400);
    const employee = await Employee.findOne({ orgId: identity.orgId, photo: fileName }).select("_id").lean();
    if (!employee) throw new AttendanceError("File not found.", 404);
    const extension = path.extname(fileName).toLowerCase();
    const contentType = contentTypes[extension];
    if (!contentType) throw new AttendanceError("Unsupported file type.", 415);
    const fileBuffer = await fs.readFile(path.join(EMPLOYEE_UPLOAD_DIR, fileName));
    return new Response(fileBuffer, { headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    if (error?.code === "ENOENT") return Response.json({ message: "File not found." }, { status: 404 });
    return errorResponse(error, "Unable to load file.");
  }
}
