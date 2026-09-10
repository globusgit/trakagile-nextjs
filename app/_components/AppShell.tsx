"use client";

import { useEffect, useState, ReactNode } from "react";
import { usePathname } from "next/navigation";
import styles from "./AppShell.module.css";
import SideNav from "./SideNav";
import NavBar from "./NavBar";

const MOBILE_QUERY = "(max-width: 768px)";

export default function AppShell({ children }: { children: ReactNode }) {
  // `collapsed` is dual-purpose, resolved differently per breakpoint in
  // AppShell.module.css: on desktop it narrows the sidebar to an icon rail;
  // on mobile (<=768px) it's reused as the "drawer is open" state, since the
  // sidebar becomes an off-canvas overlay there instead of a permanent rail.
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();
  const [previousView, setPreviousView] = useState({ pathname, isMobile });

  // Lets SideNav tell the two meanings of "collapsed" apart (icon-rail vs.
  // open drawer) so it renders full labels in the mobile drawer instead of
  // icon-only, which is what a plain `collapsed` check would otherwise give it.
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  const toggleSidebar = () => {
    setCollapsed((prev) => !prev);
  };

  // Reset before rendering children when navigation or the breakpoint changes.
  // Desktop keeps the user's icon-rail preference across navigation.
  if (previousView.pathname !== pathname || previousView.isMobile !== isMobile) {
    setPreviousView({ pathname, isMobile });
    if (isMobile) setCollapsed(false);
  }

  return (
    <div className={styles.layout}>
      <SideNav collapsed={collapsed} isMobile={isMobile} />

      {/* Tap-to-close backdrop behind the mobile drawer - a no-op on desktop
          widths, where AppShell.module.css keeps it hidden. */}
      {collapsed && <div className={styles.backdrop} onClick={toggleSidebar} />}

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
