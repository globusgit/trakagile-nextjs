"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import AppShell from "../_components/AppShell";

export default function MainLayoutClient({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return <div className="h-screen w-screen overflow-hidden"><QueryClientProvider client={queryClient}><AppShell>{children}</AppShell></QueryClientProvider></div>;
}
