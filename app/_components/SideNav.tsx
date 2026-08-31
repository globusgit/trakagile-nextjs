"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CalendarCheck2,
  Files,
  Home,
  House,
  ListCheckIcon,
  ListTodo,
  MapPinned,
  ScrollText,
  Settings,
  User,
} from "lucide-react";
import styles from "./AppShell.module.css";

const employeeItems = [
  { label: "Dashboard", href: "/dashboard", icon: <Home size={20} /> },
  { label: "Attendance", href: "/attendance", icon: <CalendarCheck2 size={20} /> },
  { label: "Tasks", href: "/tasks", icon: <ListTodo size={20} /> },
  { label: "Notifications", href: "/notifications", icon: <Bell size={20} /> },
  { label: "Field Trips", href: "/field-trips", icon: <BriefcaseBusiness size={20} /> },
  { label: "Work From Home", href: "/work-from-home", icon: <House size={20} /> },
  { label: "Leaves", href: "/leaves", icon: <ListCheckIcon size={20} /> },
  { label: "Holidays", href: "/holidays", icon: <CalendarCheck2 size={20} /> },
  { label: "Reports", href: "/reports", icon: <BarChart3 size={20} /> },
  { label: "Documents", href: "/documents", icon: <Files size={20} /> },
];

const teamOnlyItems = [
  { label: "Live Tracking", href: "/live-tracking", icon: <MapPinned size={20} /> },
  { label: "Employees", href: "/employees", icon: <User size={20} /> },
];

const adminOnlyItems = [
  { label: "Audit Logs", href: "/audit-logs", icon: <ScrollText size={20} /> },
  { label: "Settings", href: "/settings", icon: <Settings size={20} /> },
];

export default function SideNav({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const role = session?.user?.role;
  const isTeamRole = ["MANAGER", "ADMIN", "DIRECTOR"].includes(role || "");
  const isAdminRole = ["ADMIN", "DIRECTOR"].includes(role || "");
  const visibleItems = [
    ...employeeItems.slice(0, 3),
    ...(isTeamRole ? teamOnlyItems.slice(0, 1) : []),
    ...employeeItems.slice(3, 6),
    ...(isTeamRole ? teamOnlyItems.slice(1) : []),
    ...employeeItems.slice(6),
    ...(isAdminRole ? adminOnlyItems : []),
  ];

  useEffect(() => {
    if (!session?.user?.empId) return;
    const load = async () => {
      try {
        const response = await fetch("/api/notifications", { cache: "no-store" });
        if (response.ok) setUnreadCount((await response.json()).unreadCount || 0);
      } catch {
        // Retry on the next interval.
      }
    };
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 30_000);
    window.addEventListener("notifications-updated", load);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener("notifications-updated", load);
    };
  }, [session?.user?.empId]);

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ""}`}>
      <div className={styles.logo}>{collapsed ? "T" : "Trakagile"}</div>
      <nav className={styles.nav}>
        {visibleItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${
                active ? "bg-cyan-100 font-semibold !text-cyan-950 shadow-[inset_3px_0_0_#22d3ee]" : ""
              }`}
            >
              <span className={styles.icon}>{item.icon}</span>
              {!collapsed && (
                <span className={`${styles.label} flex min-w-0 flex-1 items-center justify-between gap-2`}>
                  <span>{item.label}</span>
                  {item.href === "/notifications" && unreadCount > 0 && (
                    <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}