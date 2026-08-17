"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, User, Settings, Mail, ListCheckIcon, CalendarCheck2Icon, } from "lucide-react";
import styles from "./AppShell.module.css";

const menuItems = [
  { label: "Dashboard", href: "/dashboard", icon: <Home size={20} /> },

  { label: "Attendance", href: "/attendance", icon: <CalendarCheck2Icon size={20} />, },

  { label: "Employees", href: "/employees", icon: <User size={20} /> },

  { label: "Leaves", href: "/leaves", icon: <ListCheckIcon size={20} /> },

  { label: "Holidays", href: "/holidays", icon: <CalendarCheck2Icon size={20} />, },

  { label: "Settings", href: "/settings", icon: <Settings size={20} /> },
];

export default function SideNav({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();

  return (
    <aside
      className={`${styles.sidebar} ${
        collapsed ? styles.sidebarCollapsed : ""
      }`}
    >
      <div className={styles.logo}>{collapsed ? "M" : "My App"}</div>

      <nav className={styles.nav}>
        {menuItems.map((item) => {
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
