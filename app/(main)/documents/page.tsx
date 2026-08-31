"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Download, FileText, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/app/_components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Document = { _id: string; employeeId: string; category: string; title: string; description?: string; originalName: string; size: number; createdAt: string; expiresAt?: string; expiryStatus: "NO_EXPIRY" | "VALID" | "EXPIRING_SOON" | "EXPIRED" };
const emptyForm = { title: "", category: "OTHER", description: "", expiresAt: "" };

export default function DocumentsPage() {
  const { data: session } = useSession();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [summary, setSummary] = useState({ total: 0, expired: 0, expiringSoon: 0 });
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm); const [file, setFile] = useState<File | null>(null);
  const load = useCallback(async () => { const response = await fetch("/api/documents", { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.message); setDocuments(result.documents || []); setSummary(result.summary || { total: 0, expired: 0, expiringSoon: 0 }); }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load().catch((error) => toast.error(error.message)), 0); return () => window.clearTimeout(timer); }, [load]);

  const upload = async () => {
    if (!file) return toast.error("Select a file.");
    if (file.size > 10 * 1024 * 1024) return toast.error("Document must be 10 MB or smaller.");
    setBusy(true);
    try {
      const data = new FormData(); Object.entries(form).forEach(([key, value]) => data.set(key, value.trim())); data.set("file", file, file.name);
      const response = await fetch("/api/documents", { method: "POST", body: data }); const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Upload failed.");
      setOpen(false); setForm(emptyForm); setFile(null); await load(); toast.success("Document uploaded.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Upload failed."); } finally { setBusy(false); }
  };
  const remove = async (id: string) => { if (!window.confirm("Delete this document permanently?")) return; const response = await fetch(`/api/documents/${id}`, { method: "DELETE" }); const result = await response.json(); if (!response.ok) return toast.error(result.message); await load(); toast.success("Document deleted."); };

  return <div className="space-y-5 pb-10"><PageHeader title="Documents" />
    <div className="grid gap-3 sm:grid-cols-3"><Summary label="Documents" value={summary.total} /><Summary label="Expiring within 30 days" value={summary.expiringSoon} color="text-amber-700" /><Summary label="Expired" value={summary.expired} color="text-red-700" /></div>
    <div className="flex justify-end"><Button onClick={() => setOpen(true)}><Plus />Upload document</Button></div>
    {documents.length ? <div className="grid gap-3 lg:grid-cols-2">{documents.map((document) => <Card key={document._id}><CardContent className="flex gap-3 p-4"><div className="rounded-xl bg-muted p-3"><FileText className="size-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{document.title}</p><Badge variant="secondary">{document.category}</Badge><ExpiryBadge status={document.expiryStatus} /></div><p className="truncate text-sm text-muted-foreground">{document.originalName} · {(document.size / 1024).toFixed(1)} KB</p>{document.description && <p className="mt-1 text-sm">{document.description}</p>}{document.expiresAt && <p className="mt-1 text-sm">Expires: {new Date(document.expiresAt).toLocaleDateString()}</p>}<p className="mt-2 text-xs text-muted-foreground">Employee {document.employeeId} · {new Date(document.createdAt).toLocaleString()}</p><div className="mt-3 flex gap-2"><Button nativeButton={false} size="sm" variant="outline" render={<a href={`/api/documents/${document._id}`} target="_blank" rel="noreferrer" />}><Download />Open</Button>{(document.employeeId === session?.user?.empId || ["ADMIN", "DIRECTOR"].includes(session?.user?.role || "")) && <Button size="sm" variant="destructive" onClick={() => void remove(document._id)}><Trash2 />Delete</Button>}</div></div></CardContent></Card>)}</div> : <Card><CardContent className="py-12 text-center text-muted-foreground">No documents uploaded.</CardContent></Card>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Upload document</DialogTitle></DialogHeader><div className="space-y-3"><Label>Title<Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Label><Label>Category<select className="mt-1 h-9 w-full rounded-md border bg-background px-3" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{["IDENTITY", "CERTIFICATE", "TRAVEL", "HOTEL", "CLIENT", "MEDICAL", "OTHER"].map((value) => <option key={value}>{value}</option>)}</select></Label><Label>Expiry date (optional)<Input type="date" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} /></Label><Label>Description<Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Label><Label>File<Input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} /></Label><p className="text-xs text-muted-foreground">JPG, PNG or PDF · Maximum 10 MB</p></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy || !form.title.trim() || !file} onClick={() => void upload()}>{busy ? "Uploading..." : "Upload"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function Summary({ label, value, color = "" }: { label: string; value: number; color?: string }) { return <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className={`text-2xl font-bold ${color}`}>{value}</p></CardContent></Card>; }
function ExpiryBadge({ status }: { status: Document["expiryStatus"] }) { if (status === "EXPIRED") return <Badge variant="destructive">Expired</Badge>; if (status === "EXPIRING_SOON") return <Badge className="bg-amber-100 text-amber-900">Expiring soon</Badge>; return null; }
