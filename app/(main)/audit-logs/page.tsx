"use client";
import PageHeader from "@/app/_components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
type Log = { _id: string; action: string; entityType: string; details?: string; timestamp: string; userId: string };
export default function AuditLogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  useEffect(() => { const timer = window.setTimeout(() => void fetch("/api/audit-logs", { cache: "no-store" }).then((response) => response.ok ? response.json() : Promise.reject()).then((result) => setLogs(result.logs || [])).catch(() => setLogs([])), 0); return () => window.clearTimeout(timer); }, []);
  return <div className="space-y-5 pb-10"><PageHeader title="Audit Logs" /><Card><CardContent className="overflow-x-auto p-0"><table className="w-full min-w-180 text-sm"><thead><tr className="border-b text-left"><th className="p-4">Time</th><th className="p-4">Action</th><th className="p-4">Entity</th><th className="p-4">User</th><th className="p-4">Details</th></tr></thead><tbody>{logs.length ? logs.map((log) => <tr key={log._id} className="border-b"><td className="p-4">{new Date(log.timestamp).toLocaleString()}</td><td className="p-4 font-medium">{log.action.replaceAll("_", " ")}</td><td className="p-4">{log.entityType}</td><td className="p-4 font-mono text-xs">{log.userId}</td><td className="max-w-md truncate p-4 text-muted-foreground">{log.details || "—"}</td></tr>) : <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">No audit activity recorded yet.</td></tr>}</tbody></table></CardContent></Card></div>;
}
