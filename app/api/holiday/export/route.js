import connectDB from "@/lib/mongoose";
import { escapeRegex } from "@/lib/query.mjs";
import Holiday from "@/models/Holiday";
import { errorResponse, requireAttendanceUser } from "../../attendance/_lib/attendance";

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const { searchParams } = new URL(request.url);
    const year = Number.parseInt(searchParams.get("year") || "", 10);
    const search = String(searchParams.get("q") || "").trim();
    const query = { orgId: identity.orgId };

    if (Number.isFinite(year)) query.year = year;
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      query.$or = [{ name: regex }, { note: regex }];
    }

    const holidays = await Holiday.find(query)
      .select("name date year isRecurring isOptional note")
      .sort({ date: 1 })
      .lean();
    const rows = [
      ["Name", "Date", "Year", "Recurring", "Optional", "Note"],
      ...holidays.map((holiday) => [
        holiday.name,
        holiday.date ? new Date(holiday.date).toISOString().slice(0, 10) : "",
        holiday.year ?? "",
        holiday.isRecurring ? "Yes" : "No",
        holiday.isOptional ? "Yes" : "No",
        holiday.note ?? "",
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    const suffix = Number.isFinite(year) ? `-${year}` : "";

    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="holidays${suffix}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error, "Unable to export holidays.");
  }
}
