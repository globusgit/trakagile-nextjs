import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import Employee from "@/models/Employee";
import TrackingLocation from "@/models/TrackingLocation";

export async function GET(req) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);

    const orgId = searchParams.get("orgId");
    const date = searchParams.get("date");
    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 10);
    const search = searchParams.get("search") || "";

    const skip = (page - 1) * limit;

    const match = {};

    if (orgId) {
      match.orgId = orgId;
    }

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);

      const end = new Date(date);
      end.setHours(23, 59, 59, 999);

      match.date = {
        $gte: start,
        $lte: end,
      };
    }

    const pipeline = [
      {
        $match: match,
      },
      {
        $lookup: {
          from: "employees",
          localField: "employeeId",
          foreignField: "_id",
          as: "employee",
        },
      },
      {
        $unwind: "$employee",
      },
    ];

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            {
              "employee.employeeName": {
                $regex: search,
                $options: "i",
              },
            },
            {
              "employee.employeeId": {
                $regex: search,
                $options: "i",
              },
            },
          ],
        },
      });
    }

    pipeline.push(
      {
        $project: {
          _id: 1,

          employeeName: "$employee.employeeName",
          employeeId: "$employee.employeeId",

          date: 1,
          inTime: 1,
          outTime: 1,
          status: 1,
          workingHrs: 1,
        },
      },
      {
        $sort: {
          employeeName: 1,
        },
      },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [
            {
              $count: "count",
            },
          ],
        },
      },
    );

    const result = await Attendance.aggregate(pipeline);

    return NextResponse.json({
      data: result[0].data,
      total: result[0].total[0]?.count || 0,
      page,
      limit,
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      {
        message: "Failed to fetch attendance.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(req) {
  try {
    await connectDB();
    const body = req.json();
    const lat = body.lat;
    const long = body.long;
    const empId = body.empId;
    const empName = body.empName;
    const checkIn = new Date(body.checkIn);
    const attendanceDate = body.date;
    const orgId = body.orgId;
    const officeStart = "Office Start Time";
    const officeGracePeriod = "Grace Period";
    //Get Office Start time and allowed grace time from config collection
    const officeStratConfig = await Config.findOne({
      name: officeStart,
      orgId: orgId,
    });
    const graceTimeConfig = await Config.findOne({
      name: officeGracePeriod,
      orgId: orgId,
    });
    //convert office Start time to mins
    const [hours, mins] = officeStratConfig.value.split(":").map(Number);
    const officeStartTotalMins = hours * 60 + mins;
    const gracePeriodMns = Number(graceTimeConfig.value);

    //Convert checkin time to mins
    const checkInHrs = checkIn.getHours();
    const checkInMins = checkIn.getMinutes();
    const checkInTotalMins = checkInHrs * 60 + checkInMins;
    //Calculate the difference in checkin time and office start time
    const differenceInTime = checkInTotalMins - officeStartTotalMins;
    let status = "Late";
    if (differenceInTime <= 5) {
      status = "Present";
    } else if (differenceInTime <= 30) {
      status = "Late";
    } else {
      status = "Half Day";
    }
    

    return NextResponse.json("Attendance marked successfully", { status: 201 });
  } catch (err) {
    return NextResponse.json("Something went wrong!", { status: 500 });
  }
}
