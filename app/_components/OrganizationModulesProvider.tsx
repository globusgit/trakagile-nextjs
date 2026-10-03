
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { defaultEnabledModuleKeys } from "@/lib/moduleAccess";

// Until the organization's own list arrives (or if the request fails) the
// app behaves exactly as before, using the globally enabled modules.
const DEFAULT_MODULES: readonly string[] = defaultEnabledModuleKeys();
const Context = createContext<readonly string[] | null>(null);

export function OrganizationModulesProvider({ children }: { children: React.ReactNode }) {
  const [modules, setModules] = useState<readonly string[] | null>(null);
  useEffect(() => {
    void fetch("/api/organization/modules", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json();
        if (Array.isArray(result.modules)) setModules(result.modules);
      })
      .catch(() => {});
  }, []);
  return <Context.Provider value={modules}>{children}</Context.Provider>;
}

/** Module keys enabled for the signed-in user's organization. */
export function useEnabledModules(): readonly string[] {
  return useContext(Context) ?? DEFAULT_MODULES;
}