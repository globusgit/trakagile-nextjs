"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, ChevronDown, LogOut } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "./NavBar.module.css";

interface NavBarProps {
  onToggleSidebar: () => void;
}

interface EmployeeProfile {
  name: string;
  empId: string;
  photo?: string;
  designation?: string;
}

export default function NavBar({ onToggleSidebar }: NavBarProps) {
  const { status } = useSession();
  const router = useRouter();

  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch the logged-in employee's own details
  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    fetch("/api/employee/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setProfile(data);
      })
      .catch((err) => console.error("Failed to load profile:", err));

    return () => {
      cancelled = true;
    };
  }, [status]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  };

  const photoSrc = profile?.photo
    ? `/api/files/employees/${encodeURIComponent(profile.photo)}`
    : "/default-avatar.jpg";

  return (
    <nav className={styles.navbar}>
      <button onClick={onToggleSidebar} className={styles.toggleButton}>
        <Menu size={22} color="white" />
      </button>

      <h1 className={styles.title}></h1>

      <div className={styles.userMenu} ref={menuRef}>
        <button
          className={styles.profileButton}
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <img src={photoSrc} alt={profile?.name ?? "Profile"} className={styles.avatar} />
          <span className={styles.profileName}>{profile?.name ?? "..."}</span>
          <ChevronDown size={16} color="white" />
        </button>

        {isOpen && (
          <div className={styles.dropdown}>
            <div className={styles.dropdownHeader}>
              <img src={photoSrc} alt={profile?.name ?? "Profile"} className={styles.dropdownAvatar} />
              <div>
                <p className={styles.dropdownName}>{profile?.name ?? "Employee"}</p>
                <p className={styles.dropdownEmpId}>ID: {profile?.empId ?? "—"}</p>
              </div>
            </div>

            <button className={styles.logoutButton} onClick={handleLogout}>
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}