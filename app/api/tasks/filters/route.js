import { connectDB } from "@/lib/mongoose";
import Task from "@/models/Task";
import { errorResponse, requireAttendanceUser } from "../../attendance/_lib/attendance";
import { scopedTaskQuery } from "../_lib/tasks";

// GET /api/tasks/filters?taskSource=IT&taskSource=Sales&taskVertical=Highways&taskType=Survey
// Returns the distinct values available at each level of the Task Source ->
// Task Vertical -> Task Type -> Sub-Task Type hierarchy, scoped to the tasks
// the caller is allowed to see (same visibility rules as GET /api/tasks) and
// narrowed by whatever has already been picked in the dropdowns above it.
// Powers the cascading Tasks-list filter bar: each dropdown's options only
// reflect values that actually occur among the caller's visible tasks.
export async function GET(request) {
  try {
    await connectDB();
    const identity = await requireAttendanceUser();
    const { searchParams } = new URL(request.url);
    const taskSources = searchParams.getAll("taskSource").map((value) => value.trim()).filter(Boolean);
    const taskVertical = searchParams.get("taskVertical")?.trim() || "";
    const taskType = searchParams.get("taskType")?.trim() || "";

    const baseQuery = await scopedTaskQuery(identity);

    const verticalQuery = { ...baseQuery, taskSource: taskSources[0] };
    const typeQuery = {
      ...baseQuery,
      ...(taskSources.length ? { taskSource: { $in: taskSources } } : {}),
      ...(taskVertical ? { taskVertical } : {}),
    };
    const subTypeQuery = { ...typeQuery, ...(taskType ? { taskType } : {}) };

    const [taskSourceOptions, taskVerticalOptions, taskTypeOptions, subTaskTypeOptions] = await Promise.all([
      Task.distinct("taskSource", baseQuery),
      // Verticals only make sense once exactly one Task Source is picked.
      taskSources.length === 1 ? Task.distinct("taskVertical", verticalQuery) : Promise.resolve([]),
      taskSources.length ? Task.distinct("taskType", typeQuery) : Promise.resolve([]),
      taskType ? Task.distinct("subTaskType", subTypeQuery) : Promise.resolve([]),
    ]);

    const clean = (values) => values.filter(Boolean).sort((a, b) => a.localeCompare(b));

    return Response.json({
      taskSources: clean(taskSourceOptions),
      taskVerticals: clean(taskVerticalOptions),
      taskTypes: clean(taskTypeOptions),
      subTaskTypes: clean(subTaskTypeOptions),
    });
  } catch (error) {
    return errorResponse(error, "Unable to load task filter options.");
  }
}