"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import AppShell from "../_components/AppShell";
import AttendanceTracker from "../_components/AttendanceTracker";
import ModuleAccessGuard from "../_components/ModuleAccessGuard";
import { RegionalSettingsProvider } from "../_components/RegionalSettingsProvider";

export default function MainLayoutClient({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return <div className="h-dvh w-full overflow-hidden"><QueryClientProvider client={queryClient}><RegionalSettingsProvider><AttendanceTracker /><AppShell><ModuleAccessGuard>{children}</ModuleAccessGuard></AppShell></RegionalSettingsProvider></QueryClientProvider></div>;
}