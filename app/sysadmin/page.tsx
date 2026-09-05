"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Building2, LogOut, Plus, RefreshCw, ShieldCheck, Users } from "lucide-react";

type Admin = { name: string; username: string };
type Organization = {
  _id: string;
  name: string;
  code: string;
  status: "ACTIVE" | "INACTIVE";
  contactPerson?: string;
  contactEmail?: string;
  timeZone?: string;
  createdAt?: string;
};

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...init });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Request failed.");
  return result;
}

export default function SystemAdminPage() {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const loadOrganizations = useCallback(async () => {
    const result = await jsonRequest("/api/organizations");
    setOrganizations(result.organizations || []);
  }, []);

  useEffect(() => {
    void jsonRequest("/api/platform-admin/auth/session")
      .then(async (result) => {
        setAdmin(result.admin);
        await loadOrganizations();
      })
      .catch(() => setAdmin(null))
      .finally(() => setChecking(false));
  }, [loadOrganizations]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    try {
      const result = await jsonRequest("/api/platform-admin/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      });
      setAdmin(result.admin);
      await loadOrganizations();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Unable to sign in." });
    } finally {
      setBusy(false);
    }
  }

  async function createOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const formElement = event.currentTarget;
    const values = Object.fromEntries(new FormData(formElement));
    try {
      const result = await jsonRequest("/api/organizations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      setMessage({ tone: "success", text: `${result.organization.name} was created with Director ${result.director.empId}.` });
      formElement.reset();
      await loadOrganizations();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Unable to create organization." });
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/platform-admin/auth/logout", { method: "POST" });
    setAdmin(null);
    setOrganizations([]);
    setMessage(null);
  }

  if (checking) return <main className="grid min-h-screen place-items-center bg-slate-950 text-white"><RefreshCw className="size-8 animate-spin text-cyan-400" /></main>;

  if (!admin) {
    return (
      <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_right,#164e63_0,#020617_48%)] p-5">
        <form onSubmit={login} className="w-full max-w-md rounded-3xl border border-white/10 bg-white p-8 shadow-2xl">
          <div className="mb-7 flex size-14 items-center justify-center rounded-2xl bg-slate-950 text-cyan-400"><ShieldCheck className="size-7" /></div>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-cyan-700">TrakAgile Platform</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">System Admin</h1>
          <p className="mt-2 text-sm text-slate-500">Secure access for organization provisioning and platform operations.</p>
          <label className="mt-7 block text-sm font-semibold text-slate-700">Username<input name="username" autoComplete="username" required className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100" /></label>
          <label className="mt-4 block text-sm font-semibold text-slate-700">Password<input name="password" type="password" autoComplete="current-password" required className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100" /></label>
          {message ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{message.text}</p> : null}
          <button disabled={busy} className="mt-6 w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white hover:bg-cyan-800 disabled:opacity-60">{busy ? "Signing in…" : "Sign in securely"}</button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">TrakAgile Platform</p><h1 className="text-xl font-bold">Organization Administration</h1></div><div className="flex items-center gap-4"><div className="hidden text-right sm:block"><p className="font-semibold">{admin.name}</p><p className="text-xs text-slate-400">@{admin.username}</p></div><button onClick={() => void logout()} className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"><LogOut className="size-4" />Sign out</button></div></div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 p-5 lg:grid-cols-[1fr_420px]">
        <section>
          <div className="mb-5 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border bg-white p-5 shadow-sm"><Building2 className="size-6 text-cyan-700" /><p className="mt-4 text-3xl font-bold">{organizations.length}</p><p className="text-sm text-slate-500">Total organizations</p></div><div className="rounded-2xl border bg-white p-5 shadow-sm"><Users className="size-6 text-emerald-600" /><p className="mt-4 text-3xl font-bold">{organizations.filter((item) => item.status === "ACTIVE").length}</p><p className="text-sm text-slate-500">Active tenants</p></div></div>
          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="flex items-center justify-between border-b p-5"><div><h2 className="text-lg font-bold">Organizations</h2><p className="text-sm text-slate-500">Each organization has isolated users and business data.</p></div><button onClick={() => void loadOrganizations()} className="rounded-lg border p-2 hover:bg-slate-50" aria-label="Refresh organizations"><RefreshCw className="size-4" /></button></div><div className="divide-y">{organizations.map((item) => <div key={item._id} className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="flex items-center gap-2"><h3 className="font-bold">{item.name}</h3><span className="rounded-full bg-cyan-50 px-2 py-1 font-mono text-xs font-bold text-cyan-800">{item.code}</span></div><p className="mt-1 text-sm text-slate-500">{item.contactPerson || "No contact"} · {item.contactEmail || "No email"}</p><p className="mt-1 text-xs text-slate-400">{item.timeZone || "Asia/Kolkata"}{item.createdAt ? ` · Created ${new Date(item.createdAt).toLocaleDateString()}` : ""}</p></div><span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${item.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{item.status}</span></div>)}{organizations.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No organizations created.</p> : null}</div></div>
        </section>
        <section className="h-fit rounded-2xl border bg-white p-5 shadow-sm lg:sticky lg:top-5"><div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-cyan-50 p-2 text-cyan-700"><Plus className="size-5" /></div><div><h2 className="font-bold">Create organization</h2><p className="text-xs text-slate-500">Creates the tenant and its first Director.</p></div></div>
          <form onSubmit={createOrganization} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            <Field name="name" label="Organization name" placeholder="GAAR" /><Field name="code" label="Organization code" placeholder="GAAR" /><Field name="contactPerson" label="Contact person" /><Field name="contactEmail" label="Contact email" type="email" /><Field name="contactPhone" label="Contact phone" /><Field name="address" label="Address" /><Field name="adminName" label="Director name" /><Field name="adminEmpId" label="Director employee ID" /><Field name="adminEmail" label="Director email" type="email" /><Field name="adminPhone" label="Director phone" /><Field name="adminPassword" label="Temporary password" type="password" minLength={8} /><Field name="timeZone" label="Timezone" defaultValue="Asia/Kolkata" />
            <input type="hidden" name="locale" value="en-IN" /><input type="hidden" name="currency" value="INR" /><input type="hidden" name="countryCode" value="IN" /><input type="hidden" name="weekStartsOn" value="1" />
            {message ? <p role="status" className={`rounded-xl p-3 text-sm sm:col-span-2 ${message.tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{message.text}</p> : null}
            <button disabled={busy} className="rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white hover:bg-cyan-800 disabled:opacity-60 sm:col-span-2">{busy ? "Creating…" : "Create organization and Director"}</button>
          </form>
        </section>
      </div>
    </main>
  );
}

function Field({ name, label, type = "text", ...props }: { name: string; label: string; type?: string; placeholder?: string; defaultValue?: string; minLength?: number }) {
  return <label className="block text-xs font-semibold text-slate-600">{label}<input name={name} type={type} required {...props} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100" /></label>;
}
