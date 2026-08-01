"use client";

import { useState, ReactNode } from "react";
import styles from "./AppShell.module.css";
import SideNav from "./SideNav";
import NavBar from "./NavBar";

export default function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  const toggleSidebar = () => {
    setCollapsed((prev) => !prev);
  };

  return (
    <div className={styles.layout}>
      <SideNav collapsed={collapsed} />

      <div
        className={`${styles.mainArea} ${
          collapsed ? styles.mainAreaCollapsed : ""
        }`}
      >
        <NavBar onToggleSidebar={toggleSidebar} />
        <main className={styles.pageContent}>{children}</main>
      </div>
    </div>
  );
}
