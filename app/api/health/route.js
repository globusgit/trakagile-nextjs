import { connectDB } from "@/lib/mongoose";

export const dynamic = "force-dynamic";

export async function GET() {
  const checkedAt = new Date().toISOString();

  try {
    const connection = await connectDB();
    await connection.connection.db.admin().ping();

    return Response.json(
      {
        status: "ok",
        service: "trakagile-api",
        database: "reachable",
        checkedAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        status: "unavailable",
        service: "trakagile-api",
        database: "unreachable",
        checkedAt,
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
