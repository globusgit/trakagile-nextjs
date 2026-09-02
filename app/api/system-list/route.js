import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import SystemList from "@/models/SystemList";
import { errorResponse, requireAttendanceUser } from "../attendance/_lib/attendance";
import { PERMISSIONS, rolesForPermission } from "@/lib/permissions.mjs";

export async function GET(req) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const { searchParams } = new URL(req.url);
    const listName = searchParams.get("listName");
    const systemLists = await SystemList.find({ listName, orgId: identity.orgId });
    return NextResponse.json(
      {
        data: [systemLists],
      },
      { status: 200 },
    );
  } catch (err) {
    return errorResponse(err, "Unable to load system list.");
  }
}

export async function POST(req) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser(rolesForPermission(PERMISSIONS.SYSTEM_LIST_MANAGE));
    const body = await req.json();
    const orgId = identity.orgId;
    const listName = String(body.listName || "").trim();
    const listItem = String(body.listItem || "").trim();
    if (!listName || !listItem) {
      return NextResponse.json({ message: "List name and item are required." }, { status: 400 });
    }
    const list = await SystemList.findOne({
      listName: listName,
      listItem: listItem,
      orgId: orgId,
    });
    if (list) {
      return NextResponse.json(
        { message: "System List already exists!" },
        { status: 400 },
      );
    }
    await SystemList.create({ listName, listItem, orgId, status: body.status });
    return NextResponse.json(
      { message: "System List created successfully!" },
      { status: 200 },
    );
  } catch (err) {
    return errorResponse(err, "Unable to create system list item.");
  }
}
