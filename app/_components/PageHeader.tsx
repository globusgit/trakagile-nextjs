"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft } from "lucide-react";
import { getDefaultHrefForRole } from "@/lib/moduleAccess";
import { useEnabledModules } from "./OrganizationModulesProvider";

// `backHref` overrides where the back arrow goes; pass null to hide it.
// When omitted the arrow goes to the user's home page (first module they
// have: Task Dashboard, Tasks, Notifications, Employees).
export default function PageHeader({ title, backHref }: { title: string; backHref?: string | null }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const enabledModules = useEnabledModules();
  const homeHref = getDefaultHrefForRole(session?.user?.role, enabledModules);
  const isHome = pathname === homeHref;
  const href = backHref === undefined ? homeHref : backHref;

  return (
    <div className="relative overflow-hidden rounded-xl bg-linear-to-r from-cyan-950 via-sky-800 to-sky-400 px-4 py-4 text-white shadow-md shadow-sky-950/10 sm:px-5">
      <div className="absolute -right-8 -top-12 size-32 rounded-full bg-white/10" />
      <div className="relative flex items-start gap-3">
        {!isHome && href && (
          <Link
            href={href}
            aria-label="Back"
            title="Back"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <ArrowLeft className="size-4" />
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight break-words sm:text-xl">{title}</h1>
          <p className="mt-0.5 text-xs text-sky-100">Manage and review your {title.toLowerCase()} workspace</p>
        </div>
      </div>
    </div>
  );
}