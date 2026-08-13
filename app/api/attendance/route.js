import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";

export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) return Response.json({ message: "Organization is required." }, { status: 400 });
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 10));
    const search = searchParams.get("search")?.trim() || "";
    const match = { orgId };
    const date = searchParams.get("date");
    if (date) match.attendanceDate = date;
    const employeeMatch = search
      ? { $or: [{ name: { $regex: search, $options: "i" } }, { empId: { $regex: search, $options: "i" } }] }
      : {};
    const [result] = await Attendance.aggregate([
      { $match: match },
      { $lookup: { from: "employees", localField: "empObjId", foreignField: "_id", as: "employee" } },
      { $unwind: "$employee" },
      { $match: employeeMatch },
      { $sort: { attendanceDate: -1, "markIn.time": -1 } },
      { $facet: {
        data: [{ $skip: (page - 1) * limit }, { $limit: limit }, { $project: { empId: 1, employeeName: "$employee.name", attendanceDate: 1, markIn: 1, markOut: 1, status: 1, trackingStatus: 1, totalVisits: 1, totalWorkedMinutes: 1 } }],
        total: [{ $count: "count" }],
      } },
    ]);
    return Response.json({ data: result?.data || [], total: result?.total[0]?.count || 0, page, limit });
  } catch (error) {
    console.error("Attendance list failed", error);
    return Response.json({ message: "Failed to fetch attendance." }, { status: 500 });
  }
}
