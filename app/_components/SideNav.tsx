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
import { MODULES, ModuleKey, isModuleEnabledForRole } from "@/lib/moduleAccess";

// Every nav item the app *can* show. Whether one actually renders is driven
// entirely by lib/moduleAccess.ts (MODULES[key].enabled / .roles) — nothing
// here needs to be commented out to turn a module off, and nothing is
// deleted, so re-enabling a module later is just a one-line config change.
const NAV_ITEMS: { key: ModuleKey; label: string; href: string; icon: React.ReactNode }[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: <Home size={20} /> },
  { key: "attendance", label: "Attendance", href: "/attendance", icon: <CalendarCheck2 size={20} /> },
  { key: "attendance-calendar", label: "Attendance Calendar", href: "/attendance/calendar", icon: <CalendarCheck2 size={20} /> },
  { key: "history", label: "My History", href: "/attendance/history", icon: <ScrollText size={20} /> },
  { key: "tasks", label: "Tasks", href: "/tasks", icon: <ListTodo size={20} /> },
  { key: "notifications", label: "Notifications", href: "/notifications", icon: <Bell size={20} /> },
  { key: "live-tracking", label: "Live Tracking", href: "/live-tracking", icon: <MapPinned size={20} /> },
  { key: "employees", label: "Employees", href: "/employees", icon: <User size={20} /> },
  { key: "field-trips", label: "Field Trips", href: "/field-trips", icon: <BriefcaseBusiness size={20} /> },
  { key: "work-from-home", label: "Work From Home", href: "/work-from-home", icon: <House size={20} /> },
  { key: "leaves", label: "Leaves", href: "/leaves", icon: <ListCheckIcon size={20} /> },
  { key: "holidays", label: "Holidays", href: "/holidays", icon: <CalendarCheck2 size={20} /> },
  { key: "reports", label: "Reports", href: "/reports", icon: <BarChart3 size={20} /> },
  { key: "documents", label: "Documents", href: "/documents", icon: <Files size={20} /> },
  { key: "audit-logs", label: "Audit Logs", href: "/audit-logs", icon: <ScrollText size={20} /> },
  { key: "settings", label: "Settings", href: "/settings", icon: <Settings size={20} /> },
];

export default function SideNav({ collapsed, isMobile }: { collapsed: boolean; isMobile: boolean }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const role = session?.user?.role;

  // "collapsed" means two different things depending on viewport: an icon-only
  // rail on desktop, or an open full-width drawer on mobile. Only the desktop
  // case should hide labels/shrink the logo.
  const isIconRail = collapsed && !isMobile;

  const visibleItems = NAV_ITEMS.filter((item) => {
    const moduleConfig = MODULES.find((m) => m.key === item.key);
    return moduleConfig ? isModuleEnabledForRole(moduleConfig, role) : false;
  });

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
      <div className={styles.logo}>{isIconRail ? "T" : "Trakagile"}</div>
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
              {!isIconRail && (
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