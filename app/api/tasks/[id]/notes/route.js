import { connectDB } from "@/lib/mongoose";
import { AttendanceError, errorResponse, requireAttendanceUser } from "../../../attendance/_lib/attendance";
import { resolveEmployeeName, scopedTask } from "../../_lib/tasks";

// POST /api/tasks/:id/notes
// Appends a note to the task's notes log. Anyone who can already see the task
// (creator, assignee, their manager, or an org-wide role) may add a note -
// this is a shared log, not restricted to the TASK_MANAGE_ROLES that can edit
// the rest of the task. Notes are never edited or removed here - append only.
export async function POST(request, { params }) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const { id } = await params;
    const body = await request.json();
    const text = String(body.text || "").trim();
    if (!text) throw new AttendanceError("Note text is required.");
    if (text.length > 4000) throw new AttendanceError("Note is too long (4000 characters max).");

    const task = await scopedTask(id, identity);
    const authorName = await resolveEmployeeName(identity.orgId, identity.empId);

    task.notes.push({
      text,
      authorEmpId: identity.empId,
      authorName,
      createdAt: new Date(),
    });
    await task.save();

    const note = task.notes[task.notes.length - 1];
    return Response.json({ message: "Note added.", note }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Unable to add note.");
  }
}