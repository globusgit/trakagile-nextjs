"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { getDefaultHrefForRole, isPathAllowed } from "@/lib/moduleAccess";

/**
 * Hiding a link in the sidebar does not stop someone from typing (or
 * bookmarking) the URL directly — the page still renders. This guard
 * catches that case for every route under app/(main): if the current
 * path belongs to a module that's disabled (or not enabled for this
 * role), it redirects to the first module the user IS allowed to see,
 * instead of rendering the page.
 */
export default function ModuleAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const role = session?.user?.role;

  const allowed = status !== "authenticated" || isPathAllowed(pathname, role);

  useEffect(() => {
    if (status === "authenticated" && !isPathAllowed(pathname, role)) {
      router.replace(getDefaultHrefForRole(role));
    }
  }, [status, pathname, role, router]);

  // While we haven't confirmed the session yet, or once we know the page
  // is off-limits and a redirect is in flight, render nothing rather than
  // flashing the disabled page's content.
  if (!allowed) return null;

  return <>{children}</>;
}