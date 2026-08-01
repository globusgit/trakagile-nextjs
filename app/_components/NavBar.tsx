"use client";

import { Menu } from "lucide-react";
import styles from "./NavBar.module.css";

interface NavBarProps {
  onToggleSidebar: () => void;
}

export default function NavBar({ onToggleSidebar }: NavBarProps) {
  return (
    <nav className={styles.navbar}>
      <button onClick={onToggleSidebar} className={styles.toggleButton}>
        <Menu size={22} color="white" />
      </button>
      <h1 className={styles.title}></h1>
      <div className={styles.userMenu}>{/* User menu items */}</div>
    </nav>
  );
}
