"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import AppShell from "../_components/AppShell";
import { RegionalSettingsProvider } from "../_components/RegionalSettingsProvider";

export default function MainLayoutClient({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return <div className="h-dvh w-full overflow-hidden"><QueryClientProvider client={queryClient}><RegionalSettingsProvider><AppShell>{children}</AppShell></RegionalSettingsProvider></QueryClientProvider></div>;
}
