"use client";

import Link from "next/link";
import {
  Home,
  User,
  Settings,
  ListCheckIcon,
  CalendarCheck2Icon,
  Bell,
  MapPinned,
  BriefcaseBusiness,
  House,
  BarChart3,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import styles from "./AppShell.module.css";

const employeeItems = [
  { label: "Dashboard", href: "/dashboard", icon: <Home size={20} /> },
  
  {
    label: "Attendance",
    href: "/attendance",
    icon: <CalendarCheck2Icon size={20} />,
  },
  { label: "Notifications", href: "/notifications", icon: <Bell size={20} /> },
  { label: "Field Trips", href: "/field-trips", icon: <BriefcaseBusiness size={20} /> },
  { label: "Work From Home", href: "/work-from-home", icon: <House size={20} /> },
  { label: "Leaves", href: "/leaves", icon: <ListCheckIcon size={20} /> },
  {
    label: "Holidays",
    href: "/holidays",
    icon: <CalendarCheck2Icon size={20} />,
  },
  { label: "Reports", href: "/reports", icon: <BarChart3 size={20} /> },
];

const teamItems = [
  ...employeeItems.slice(0, 2),
  { label: "Live Tracking", href: "/live-tracking", icon: <MapPinned size={20} /> },
  ...employeeItems.slice(2, 5),
  { label: "Employees", href: "/employees", icon: <User size={20} /> },
  ...employeeItems.slice(5),
];

export default function SideNav({ collapsed }: { collapsed: boolean }) {
  const { data: session } = useSession();
  const sessionEmpId = session?.user?.empId;
  const [unreadCount, setUnreadCount] = useState(0);
  const role = session?.user?.role;
  const visibleItems = role === "DIRECTOR" || role === "ADMIN"
    ? [...teamItems, { label: "Settings", href: "/settings", icon: <Settings size={20} /> }]
    : role === "MANAGER"
      ? teamItems
      : employeeItems;
  useEffect(() => {
    if (!sessionEmpId) return;
    const load = async () => {
      try {
        const response = await fetch("/api/notifications", { cache: "no-store" });
        if (response.ok) setUnreadCount((await response.json()).unreadCount || 0);
      } catch { /* Retry on the next interval. */ }
    };
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 30_000);
    window.addEventListener("notifications-updated", load);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); window.removeEventListener("notifications-updated", load); };
  }, [sessionEmpId]);
  return (
    <aside
      className={`${styles.sidebar} ${
        collapsed ? styles.sidebarCollapsed : ""
      }`}
    >
      <div className={styles.logo}>{collapsed ? "T" : "Trakagile"}</div>

      <nav className={styles.nav}>
        {visibleItems.map((item) => (
          <Link key={item.href} href={item.href} className={styles.navItem}>
            <span className={styles.icon}>{item.icon}</span>
            {!collapsed && <span className={`${styles.label} flex min-w-0 flex-1 items-center justify-between gap-2`}><span>{item.label}</span>{item.href === "/notifications" && unreadCount > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}</span>}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
