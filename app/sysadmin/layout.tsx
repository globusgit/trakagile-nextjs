
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

// Every /sysadmin page requires the System Admin session. Without one the
// visitor is sent to the normal login page, where sysadmin signs in.
export default function SysadminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [admin, setAdmin] = useState<{ name: string; username: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/platform-admin/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          router.replace("/");
          return;
        }
        const result = await response.json();
        if (active) setAdmin(result.admin);
      })
      .catch(() => router.replace("/"));
    return () => { active = false; };
  }, [router]);

  const signOut = async () => {
    await fetch("/api/platform-admin/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/");
    router.refresh();
  };

  if (!admin) return <div className="p-8 text-center text-gray-500">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm md:px-8">
        <div className="flex items-center gap-3 text-lg font-bold tracking-tight text-cyan-950">
          <span className="grid size-9 place-items-center rounded-xl bg-cyan-900 text-white"><Sparkles className="size-4" /></span>
          TrakAgile
          <span className="rounded-full bg-cyan-100 px-3 py-0.5 text-xs font-semibold text-cyan-900">System Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-600 sm:inline">{admin.name}</span>
          <Button variant="outline" onClick={signOut} className="gap-1.5"><LogOut className="size-4" />Sign out</Button>
        </div>
      </header>
      <main className="px-4 py-4 md:px-8">{children}</main>
    </div>
  );
}