"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AppShell from "../_components/AppShell";
import { useState } from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <div className="h-screen w-screen overflow-hidden">
      <QueryClientProvider client={queryClient}>
        <AppShell>{children}</AppShell>
      </QueryClientProvider>
    </div>
  );
}
