"use client";

import Link from "next/link";
import {
  Home,
  User,
  Settings,
  Mail,
  ListCheckIcon,
  CalendarCheck2Icon,
} from "lucide-react";
import styles from "./AppShell.module.css";

const menuItems = [
  { label: "Dashboard", href: "/dashboard", icon: <Home size={20} /> },
  
  {
    label: "Attendance",
    href: "/attendance",
    icon: <CalendarCheck2Icon size={20} />,
  },
  { label: "Employees", href: "/employees", icon: <User size={20} /> },
  { label: "Leaves", href: "/leaves", icon: <ListCheckIcon size={20} /> },
  {
    label: "Holidays",
    href: "/holidays",
    icon: <CalendarCheck2Icon size={20} />,
  },
  { label: "Settings", href: "/settings", icon: <Settings size={20} /> },
];

export default function SideNav({ collapsed }: { collapsed: boolean }) {
  return (
    <aside
      className={`${styles.sidebar} ${
        collapsed ? styles.sidebarCollapsed : ""
      }`}
    >
      <div className={styles.logo}>{collapsed ? "M" : "My App"}</div>

      <nav className={styles.nav}>
        {menuItems.map((item) => (
          <Link key={item.href} href={item.href} className={styles.navItem}>
            <span className={styles.icon}>{item.icon}</span>
            {!collapsed && <span className={styles.label}>{item.label}</span>}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
