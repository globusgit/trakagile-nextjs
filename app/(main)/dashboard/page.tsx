import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CalendarCheck2,
  Files,
  House,
  ListCheckIcon,
  ListTodo,
  MapPinned,
  ScrollText,
  Settings,
  User,
} from "lucide-react";

import PageHeader from "@/app/_components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import AdminDashboard from "./AdminDashboard";

const employeeModules = [
  { title: "Attendance", description: "Mark in and track your workday", href: "/attendance", icon: CalendarCheck2 },
  { title: "Tasks", description: "Review assignments and update progress", href: "/tasks", icon: ListTodo },
  { title: "Notifications", description: "Review your latest updates", href: "/notifications", icon: Bell },
  { title: "Field Trips", description: "Trips, locations and expenses", href: "/field-trips", icon: BriefcaseBusiness },
  { title: "Work From Home", description: "Requests and approvals", href: "/work-from-home", icon: House },
  { title: "Leaves", description: "Apply and view requests", href: "/leaves", icon: ListCheckIcon },
  { title: "Holidays", description: "Organization holiday calendar", href: "/holidays", icon: CalendarCheck2 },
  { title: "Reports", description: "Attendance and work reports", href: "/reports", icon: BarChart3 },
  { title: "Documents", description: "Employee documents", href: "/documents", icon: Files },
];

const teamModules = [
  { title: "Live Tracking", description: "View active team locations", href: "/live-tracking", icon: MapPinned },
  { title: "Employees", description: "View and manage employees", href: "/employees", icon: User },
];

const adminModules = [
  { title: "Audit Logs", description: "Review system activity", href: "/audit-logs", icon: ScrollText },
  { title: "Settings", description: "Configure organization options", href: "/settings", icon: Settings },
];

export default async function Dashboard() {
  const session = await auth();
  const user = session?.user;
  if (!user?.empId || !user.orgId) redirect("/");

  const isTeamRole = ["MANAGER", "ADMIN", "DIRECTOR"].includes(user.role || "");
  const isAdminRole = ["ADMIN", "DIRECTOR"].includes(user.role || "");
  if (isAdminRole) return <AdminDashboard name={user.name || user.empId} role={user.role || "ADMIN"} />;
  const modules = [
    ...employeeModules.slice(0, 2),
    ...(isTeamRole ? teamModules.slice(0, 1) : []),
    ...employeeModules.slice(2, 5),
    ...(isTeamRole ? teamModules.slice(1) : []),
    ...employeeModules.slice(5),
    ...(isAdminRole ? adminModules : []),
  ];

  return (
    <div className="space-y-6 pb-10">
      <PageHeader title="Dashboard" />
      <section className="relative overflow-hidden rounded-2xl border border-sky-100 bg-linear-to-r from-white via-sky-50 to-cyan-100 p-7 shadow-sm">
        <div className="absolute -right-12 -top-20 size-52 rounded-full bg-sky-300/20" />
        <p className="text-sm font-medium text-sky-700">{user.role || "USER"}</p>
        <h1 className="relative mt-1 text-3xl font-semibold tracking-tight text-slate-900">
          Hello, {user.name || user.empId}
        </h1>
        <p className="relative mt-2 text-sm text-muted-foreground">
          {user.empId} · Choose a module to continue your work.
        </p>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Link key={module.href} href={module.href} className="group">
              <Card className="h-full border-slate-200 bg-white transition-all group-hover:-translate-y-1 group-hover:border-sky-300 group-hover:shadow-lg">
                <CardContent className="flex min-h-40 flex-col justify-between p-5">
                  <div className="w-fit rounded-xl bg-linear-to-br from-cyan-100 to-sky-100 p-3 text-cyan-900 shadow-sm">
                    <Icon className="size-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">{module.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{module.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
