import { NextResponse } from "next/server";
import connectDB from "@/lib/mongoose";
import Holiday from "@/models/Holiday";
import { errorResponse, requireAttendanceUser } from "../../attendance/_lib/attendance";
import { escapeRegex, pagination } from "@/lib/query.mjs";

export async function GET(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year"));
    const q = searchParams.get("q");
    const { page, limit } = pagination(searchParams);
    const skip = (page - 1) * limit;

    const query = { orgId: identity.orgId };
    if (!isNaN(year)) {
      query.year = year;
    }

    if (q && q.trim() !== "") {
      const term = q.trim();
      const regex = new RegExp(escapeRegex(term), "i");
      // "Yes"/"No" search support for the boolean fields
      const wantsYes = /^y(es)?$/i.test(term);
      const wantsNo = /^n(o)?$/i.test(term);

      query.$or = [
        { name: regex }, 
        { note: regex },
        {
          $expr: {
            $regexMatch: {
              input: {
                $dateToString: { format: "%Y-%m-%d", date: "$date" },
              },
              regex: escapeRegex(term),
              options: "i",
            },
          },
        },
        ...(wantsYes ? [{ isRecurring: true }, { isOptional: true }] : []),
        ...(wantsNo ? [{ isRecurring: false }, { isOptional: false }] : []),

      ];
    }

    const [holidays, total] = await Promise.all([
      Holiday.find(query).skip(skip).limit(limit),
      Holiday.countDocuments(query),
    ]);

    return NextResponse.json(
      { holidays, page, limit, total, totalPages: Math.ceil(total / limit) },
      { status: 200 },
    );
  } catch (error) {
    if (error?.name === "AttendanceError") return errorResponse(error);
    console.error("Error searching holidays:", error);
    return NextResponse.json(
      { error: "Failed to search holidays" },
      { status: 500 },
    );
  }
}
