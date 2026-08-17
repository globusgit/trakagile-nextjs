"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Home,
  User,
  Settings,
  Mail,
  ListCheckIcon,
  CalendarCheck2Icon,
} from "lucide-react";
import styles from "./AppShell.module.css";

// Roles allowed to see/access the Employees module.
// Keep this in sync with requireAttendanceUser(["ADMIN", "DIRECTOR", "MANAGER"])
// used in app/api/employee/search/route.js
const EMPLOYEE_MODULE_ROLES = ["ADMIN", "DIRECTOR", "MANAGER"];

const employeeItems = [
  { label: "Dashboard", href: "/dashboard", icon: <Home size={20} /> },
  {
    label: "Attendance",
    href: "/attendance",
    icon: <CalendarCheck2Icon size={20} />,
  },
  {
    label: "Employees",
    href: "/employees",
    icon: <User size={20} />,
    roles: EMPLOYEE_MODULE_ROLES,
  },
  { label: "Leaves", href: "/leaves", icon: <ListCheckIcon size={20} /> },
  {
    label: "Holidays",
    href: "/holidays",
    icon: <CalendarCheck2Icon size={20} />,
  },
  { label: "Settings", href: "/settings", icon: <Settings size={20} /> },
];

export default function SideNav({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const role = session?.user?.role;

  const visibleItems = employeeItems.filter((item) => {
    if (!item.roles) return true; // no restriction on this item
    if (status !== "authenticated") return false; // hide until we know the role
    return item.roles.includes(role as string);
  });

  return (
    <aside
      className={`${styles.sidebar} ${
        collapsed ? styles.sidebarCollapsed : ""
      }`}
    >
      <div className={styles.logo}>{collapsed ? "T" : "Trakagile"}</div>

      <nav className={styles.nav}>
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`cursor-pointer flex items-center ${
                collapsed ? "justify-center" : "justify-start"
              } gap-4 py-3 px-3 transition-colors ${
                isActive
                  ? "bg-cyan-100 text-black font-semibold rounded-md"
                  : "text-white hover:bg-cyan-100 hover:text-black rounded-md"
              }`}
            >
              <span className={styles.icon}>{item.icon}</span>
              {!collapsed && <span className={styles.label}>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
