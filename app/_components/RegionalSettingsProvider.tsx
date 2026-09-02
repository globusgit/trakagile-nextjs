"use client";

import { createContext, useContext, useEffect, useState } from "react";

type RegionalSettings = { timeZone: string; locale: string; currency: string; countryCode: string; weekStartsOn: number };
const defaults: RegionalSettings = { timeZone: "Asia/Kolkata", locale: "en-IN", currency: "INR", countryCode: "IN", weekStartsOn: 1 };
const Context = createContext<RegionalSettings>(defaults);

export function RegionalSettingsProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState(defaults);
  useEffect(() => { void fetch("/api/organization/settings", { cache: "no-store" }).then(async (response) => { if (response.ok) setValue((await response.json()).settings); }).catch(() => {}); }, []);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useRegionalSettings() { return useContext(Context); }
