"use client";

import PageHeader from "@/app/_components/PageHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Activity, ChevronLeft, ChevronRight, Eye, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Actor = { name: string; empId: string; role: string; photo?: string };
type Log = { _id: string; action: string; entityType: string; details?: string; timestamp: string; actor: Actor };
type Filters = { actions: string[]; entityTypes: string[] };

function readable(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "SY";
}

function parseDetails(details?: string): Record<string, string> {
  if (!details) return {};
  try {
    const parsed = JSON.parse(details);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, typeof value === "object" ? JSON.stringify(value) : String(value)]));
    }
  } catch { /* Plain text is a valid audit detail. */ }
  return { information: details };
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [filters, setFilters] = useState<Filters>({ actions: [], entityTypes: [] });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Log | null>(null);
  const limit = 10;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (action) params.set("action", action);
    if (entityType) params.set("entityType", entityType);
    try {
      const response = await fetch(`/api/audit-logs?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load activity history.");
      const result = await response.json();
      setLogs(result.logs || []);
      setTotal(result.total || 0);
      setFilters(result.filters || { actions: [], entityTypes: [] });
    } catch (requestError) {
      setLogs([]);
      setError(requestError instanceof Error ? requestError.message : "Unable to load activity history.");
    } finally { setLoading(false); }
  }, [action, debouncedSearch, entityType, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadLogs(), 0);
    return () => window.clearTimeout(timer);
  }, [loadLogs]);
  const selectedDetails = useMemo(() => parseDetails(selected?.details), [selected]);

  return (
    <div className="space-y-5 pb-10">
      <PageHeader title="Audit Logs" />

      <section className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 p-4"><span className="rounded-xl bg-sky-100 p-3 text-sky-700"><Activity className="size-5" /></span><div><p className="text-2xl font-semibold">{total}</p><p className="text-xs text-muted-foreground">Matching activities</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><span className="rounded-xl bg-emerald-100 p-3 text-emerald-700"><ShieldCheck className="size-5" /></span><div><p className="text-sm font-semibold">Organization secured</p><p className="text-xs text-muted-foreground">Only your workspace history</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><span className="rounded-xl bg-violet-100 p-3 text-violet-700"><RefreshCw className="size-5" /></span><div><p className="text-sm font-semibold">Latest activity</p><p className="text-xs text-muted-foreground">{logs[0] ? new Date(logs[0].timestamp).toLocaleString("en-IN") : "No activity yet"}</p></div></CardContent></Card>
      </section>

      <Card><CardContent className="p-0">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employee, action or details..." className="pl-9" /></div>
          <select value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} className="h-9 rounded-md border bg-background px-3 text-sm"><option value="">All actions</option>{filters.actions.map((item) => <option key={item} value={item}>{readable(item)}</option>)}</select>
          <select value={entityType} onChange={(event) => { setEntityType(event.target.value); setPage(1); }} className="h-9 rounded-md border bg-background px-3 text-sm"><option value="">All modules</option>{filters.entityTypes.map((item) => <option key={item} value={item}>{readable(item)}</option>)}</select>
          <Button variant="outline" onClick={() => void loadLogs()} disabled={loading}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
        </div>
        {error ? <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
        <div className="overflow-x-auto"><table className="w-full min-w-220 text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3">Date & time</th><th className="px-5 py-3">Activity</th><th className="px-5 py-3">Module</th><th className="px-5 py-3">Performed by</th><th className="px-5 py-3 text-right">Details</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={5} className="p-12 text-center text-muted-foreground">Loading activity history...</td></tr> : logs.length ? logs.map((log) => {
            const date = new Date(log.timestamp);
            const badgeColor = log.action.includes("MARK_IN") ? "bg-emerald-100 text-emerald-800" : log.action.includes("MARK_OUT") ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800";
            return <tr key={log._id} className="border-b transition-colors last:border-0 hover:bg-sky-50/50"><td className="px-5 py-4"><p className="font-medium">{date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p><p className="text-xs text-muted-foreground">{date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p></td><td className="px-5 py-4"><Badge variant="secondary" className={badgeColor}>{readable(log.action)}</Badge></td><td className="px-5 py-4 font-medium">{readable(log.entityType)}</td><td className="px-5 py-4"><div className="flex items-center gap-3"><Avatar className="size-9 border"><AvatarImage src={log.actor.photo || undefined} alt={log.actor.name} /><AvatarFallback className="bg-cyan-50 text-xs text-cyan-800">{initials(log.actor.name)}</AvatarFallback></Avatar><div><p className="font-medium">{log.actor.name}</p><p className="text-xs text-muted-foreground">{log.actor.empId} · {readable(log.actor.role)}</p></div></div></td><td className="px-5 py-4 text-right"><Button variant="ghost" size="sm" onClick={() => setSelected(log)}><Eye className="size-4" />View</Button></td></tr>;
          }) : <tr><td colSpan={5} className="p-14 text-center"><Activity className="mx-auto mb-3 size-8 text-muted-foreground/50" /><p className="font-medium">No activity found</p><p className="mt-1 text-sm text-muted-foreground">Try changing the search or filters.</p></td></tr>}</tbody>
        </table></div>
        <div className="flex flex-col gap-3 border-t px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"><p className="text-muted-foreground">Showing {total ? (page - 1) * limit + 1 : 0}–{Math.min(page * limit, total)} of {total}</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="size-4" />Previous</Button><span className="px-2 text-xs">Page {page} of {totalPages}</span><Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>Next<ChevronRight className="size-4" /></Button></div></div>
      </CardContent></Card>

      {selected ? <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-[1px]" onClick={() => setSelected(null)}><aside className="h-full w-full max-w-md overflow-y-auto bg-background p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-widest text-sky-700">Audit activity</p><h2 className="mt-1 text-xl font-semibold">{readable(selected.action)}</h2></div><Button variant="ghost" size="icon" onClick={() => setSelected(null)}><X className="size-5" /></Button></div><div className="mt-6 flex items-center gap-3 rounded-xl border bg-muted/30 p-4"><Avatar className="size-11"><AvatarImage src={selected.actor.photo || undefined} /><AvatarFallback>{initials(selected.actor.name)}</AvatarFallback></Avatar><div><p className="font-semibold">{selected.actor.name}</p><p className="text-sm text-muted-foreground">{selected.actor.empId} · {readable(selected.actor.role)}</p></div></div><dl className="mt-6 grid grid-cols-2 gap-4 rounded-xl border p-4 text-sm"><div><dt className="text-xs text-muted-foreground">Module</dt><dd className="mt-1 font-medium">{readable(selected.entityType)}</dd></div><div><dt className="text-xs text-muted-foreground">Date & time</dt><dd className="mt-1 font-medium">{new Date(selected.timestamp).toLocaleString("en-IN")}</dd></div></dl><div className="mt-6"><h3 className="font-semibold">Activity details</h3><div className="mt-3 divide-y rounded-xl border">{Object.keys(selectedDetails).length ? Object.entries(selectedDetails).map(([key, value]) => <div key={key} className="grid grid-cols-[8rem_1fr] gap-3 p-3 text-sm"><span className="text-muted-foreground">{readable(key)}</span><span className="break-words font-medium">{value}</span></div>) : <p className="p-4 text-sm text-muted-foreground">No additional details were recorded.</p>}</div></div><p className="mt-6 break-all text-xs text-muted-foreground">Record ID: {selected._id}</p></aside></div> : null}
    </div>
  );
}
