import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Bell,
  BriefcaseBusiness,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Home,
  MapPin,
  Route,
  UserRoundCheck,
  Users,
} from "lucide-react";

import PageHeader from "@/app/_components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import Employee from "@/models/Employee";
import EmployeeVisit from "@/models/EmployeeVisit";
import FieldTrip from "@/models/FieldTrip";
import Holiday from "@/models/Holiday";
import LeaveRequest from "@/models/LeaveRequest";
import Notification from "@/models/Notification";
import WorkFromHomeRequest from "@/models/WorkFromHomeRequest";

export const dynamic = "force-dynamic";

const activeTripStatuses = [
  "TRAVELLING",
  "AT_CLIENT",
  "WORKING",
  "SITE_COMPLETED",
  "STAYING",
  "RETURNING",
];

function indiaDayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatTime(value?: Date | string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value?: Date | string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function SummaryCard({
  title,
  value,
  helper,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  helper: string;
  icon: typeof Users;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        </div>
        <div className="rounded-xl bg-sky-100 p-3 text-sky-800">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default async function Dashboard() {
  const session = await auth();
  const user = session?.user;
  if (!user?.empId || !user.orgId) redirect("/");

  await connectDB();
  const today = indiaDayKey();
  const isManager = ["ADMIN", "MANAGER"].includes(user.role || "");
  const attendanceScope = isManager
    ? { orgId: user.orgId, attendanceDate: today }
    : { orgId: user.orgId, attendanceDate: today, empId: user.empId };
  const employeeScope = isManager
    ? { orgId: user.orgId }
    : { orgId: user.orgId, empId: user.empId };
  const tripScope = isManager
    ? { orgId: user.orgId }
    : { orgId: user.orgId, employeeId: user.empId };
  const leaveScope = isManager
    ? { orgId: user.orgId }
    : { orgId: user.orgId, userId: user.id };

  const [
    activeEmployees,
    markedIn,
    completedAttendance,
    todayAttendance,
    activeVisits,
    activeTrips,
    pendingLeaves,
    pendingWfh,
    nextHoliday,
    unreadNotifications,
    recentNotifications,
  ] = await Promise.all([
    Employee.countDocuments({ ...employeeScope, status: "Active" }),
    Attendance.countDocuments({ ...attendanceScope, status: "IN" }),
    Attendance.countDocuments({ ...attendanceScope, status: "OUT" }),
    Attendance.findOne({ ...attendanceScope, empId: user.empId }).lean(),
    EmployeeVisit.countDocuments({
      orgId: user.orgId,
      ...(isManager ? {} : { employeeId: user.empId }),
      status: "IN_PROGRESS",
    }),
    FieldTrip.countDocuments({ ...tripScope, status: { $in: activeTripStatuses } }),
    LeaveRequest.countDocuments({ ...leaveScope, status: { $in: ["pending", "cancellation_pending"] } }),
    WorkFromHomeRequest.countDocuments({
      ...tripScope,
      status: "PENDING",
    }),
    Holiday.findOne({ orgId: user.orgId, date: { $gte: new Date() } }).sort({ date: 1 }).lean(),
    Notification.countDocuments({ orgId: user.orgId, recipientEmpId: user.empId, readAt: null }),
    Notification.find({ orgId: user.orgId, recipientEmpId: user.empId })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
  ]);

  const attendance = todayAttendance as {
    status?: string;
    markIn?: { time?: Date };
    markOut?: { time?: Date };
    totalWorkedMinutes?: number;
    totalDistanceMeters?: number;
    attendanceType?: string;
  } | null;
  const workedMinutes = attendance?.totalWorkedMinutes || 0;
  const workedLabel = attendance?.status === "IN"
    ? `Started ${formatTime(attendance.markIn?.time)}`
    : attendance
      ? `${Math.floor(workedMinutes / 60)}h ${workedMinutes % 60}m worked`
      : "Not marked in yet";

  return (
    <div className="space-y-5 pb-10">
      <PageHeader title="Dashboard" />

      <section className="flex flex-col gap-4 rounded-2xl border bg-linear-to-r from-sky-50 to-background p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{formatDate(new Date())}</p>
          <h1 className="mt-1 text-2xl font-semibold">Welcome, {user.name || user.empId}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isManager ? "Here is your organization’s live work overview." : "Here is your work summary for today."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button render={<Link href="/attendance" />}><MapPin /> Open attendance</Button>
          {isManager && <Button variant="outline" render={<Link href="/live-tracking" />}><Route /> Live tracking</Button>}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isManager ? (
          <>
            <SummaryCard title="Active employees" value={activeEmployees} helper="Enabled employee profiles" icon={Users} />
            <SummaryCard title="Currently marked in" value={markedIn} helper={`${completedAttendance} completed today`} icon={UserRoundCheck} />
            <SummaryCard title="Active field work" value={activeVisits + activeTrips} helper={`${activeVisits} visits · ${activeTrips} trips`} icon={BriefcaseBusiness} />
            <SummaryCard title="Pending approvals" value={pendingLeaves + pendingWfh} helper={`${pendingLeaves} leave · ${pendingWfh} WFH`} icon={Clock3} />
          </>
        ) : (
          <>
            <SummaryCard title="Attendance" value={attendance?.status === "IN" ? "Marked in" : attendance ? "Completed" : "Not started"} helper={workedLabel} icon={CalendarCheck} />
            <SummaryCard title="Today’s visits" value={activeVisits} helper={activeVisits ? "Client/site visit in progress" : "No active visit"} icon={BriefcaseBusiness} />
            <SummaryCard title="Active trips" value={activeTrips} helper="Field trips currently underway" icon={Route} />
            <SummaryCard title="Distance recorded" value={`${((attendance?.totalDistanceMeters || 0) / 1000).toFixed(2)} km`} helper="Accuracy-filtered GPS distance" icon={MapPin} />
          </>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Today at a glance</CardTitle>
            <Badge variant="secondary">{today}</Badge>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border p-4"><div className="flex items-center gap-2 text-sm font-medium"><CalendarCheck className="size-4" /> Attendance</div><p className="mt-3 text-lg font-semibold">{attendance?.status === "IN" ? "Working now" : attendance ? "Day completed" : "Not started"}</p><p className="mt-1 text-xs text-muted-foreground">Mark in {formatTime(attendance?.markIn?.time)} · Mark out {formatTime(attendance?.markOut?.time)}</p></div>
            <div className="rounded-xl border p-4"><div className="flex items-center gap-2 text-sm font-medium"><Home className="size-4" /> Work mode</div><p className="mt-3 text-lg font-semibold">{attendance?.attendanceType?.replaceAll("_", " ") || "Not selected"}</p><p className="mt-1 text-xs text-muted-foreground">Pending WFH requests: {pendingWfh}</p></div>
            <div className="rounded-xl border p-4"><div className="flex items-center gap-2 text-sm font-medium"><CalendarDays className="size-4" /> Next holiday</div><p className="mt-3 text-lg font-semibold">{nextHoliday?.name || "No upcoming holiday"}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(nextHoliday?.date)}</p></div>
            <div className="rounded-xl border p-4"><div className="flex items-center gap-2 text-sm font-medium"><Bell className="size-4" /> Notifications</div><p className="mt-3 text-lg font-semibold">{unreadNotifications} unread</p><Button variant="link" className="h-auto p-0 text-xs" render={<Link href="/notifications" />}>View notifications</Button></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent activity</CardTitle>
            <Button variant="ghost" size="sm" render={<Link href="/notifications" />}>View all</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentNotifications.length ? recentNotifications.map((notice) => (
              <div key={notice._id.toString()} className="flex gap-3 rounded-xl border p-3">
                <div className="mt-0.5 rounded-full bg-muted p-2"><Bell className="size-4" /></div>
                <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-medium">{notice.title}</p>{!notice.readAt && <span className="size-2 rounded-full bg-blue-600" />}</div><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{notice.message}</p><p className="mt-2 text-[11px] text-muted-foreground">{formatDate(notice.createdAt)} · {formatTime(notice.createdAt)}</p></div>
              </div>
            )) : <div className="flex flex-col items-center py-8 text-center text-muted-foreground"><CheckCircle2 className="mb-3 size-8" /><p className="text-sm">No recent activity</p></div>}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
