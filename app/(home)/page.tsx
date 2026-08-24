"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Fingerprint, ShieldCheck, Sparkles } from "lucide-react";
import styles from "./Login.module.css";

export default function HomePage() {
  const router = useRouter();
  const [empId, setEmpId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const queryCode = new URLSearchParams(window.location.search).get("org");
    const hostname = window.location.hostname;
    const isLocalHost = hostname === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
    const subdomainCode = !isLocalHost && hostname.split(".").length >= 3
      ? hostname.split(".")[0]
      : "";
    const organizationCode = (
      queryCode || subdomainCode || process.env.NEXT_PUBLIC_ORGANIZATION_CODE || ""
    ).trim().toUpperCase();

    const res = await signIn("credentials", {
      empId,
      organizationCode,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("Invalid Employee ID or password.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className="absolute -right-40 -top-40 size-[520px] rounded-full border border-white/10 bg-white/5" />
        <div className="absolute -bottom-52 -left-40 size-[560px] rounded-full border border-cyan-200/10 bg-cyan-300/5" />
        <div className="relative flex items-center gap-3 text-2xl font-bold tracking-tight"><span className="grid size-12 place-items-center rounded-2xl bg-white/12 ring-1 ring-white/20"><Sparkles className="size-6" /></span>TrakAgile</div>
        <div className="relative max-w-2xl">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-cyan-50"><ShieldCheck className="size-4" />Secure workforce operations</p>
          <h1 className="text-5xl font-semibold leading-[1.08] tracking-[-0.045em] xl:text-6xl">Everything your team needs for a <span className="text-cyan-300">better workday.</span></h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-sky-100/80">Attendance, leave, field work and employee operations—organized in one secure workspace.</p>
          <div className="mt-9 grid gap-4 text-sm text-sky-50 sm:grid-cols-2">
            {["Daily attendance tracking", "Leave and approval workflows", "Field and remote work", "Organization-isolated data"].map((item) => <div key={item} className="flex items-center gap-2.5"><CheckCircle2 className="size-4 text-cyan-300" />{item}</div>)}
          </div>
        </div>
        <p className="relative text-sm text-sky-200/60">© 2026 TrakAgile · Employee management platform</p>
      </section>

      <section className={styles.formPanel}>
        <div className="absolute right-0 top-0 h-52 w-52 rounded-bl-full bg-sky-100/60" />
      <Card className={`${styles.loginCard} gap-0 py-0 ring-0`}>
        <div className="mb-10 flex items-center gap-3 text-xl font-bold tracking-tight text-cyan-950 lg:hidden"><span className="grid size-11 place-items-center rounded-xl bg-cyan-900 text-white"><Sparkles className="size-5" /></span>TrakAgile</div>
        <CardHeader className="px-0 pb-7">
          <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-cyan-100 text-cyan-900"><Fingerprint className="size-6" /></div>
          <CardTitle className="text-4xl font-semibold tracking-[-0.04em] text-slate-950">Welcome back</CardTitle>
          <p className="mt-2 text-base text-slate-500">Enter your employee credentials to access your workspace.</p>
        </CardHeader>
        <CardContent className="px-0">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Employee ID</Label>
              <Input
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                placeholder="Enter your Employee ID"
                className="h-13 rounded-xl border-slate-300 bg-white px-4 text-base shadow-xs focus-visible:border-sky-600 focus-visible:ring-sky-100"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Password</Label>
              <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="h-13 rounded-xl border-slate-300 bg-white px-4 pr-12 text-base shadow-xs focus-visible:border-sky-600 focus-visible:ring-sky-100"
                required
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="mt-2 h-13 w-full rounded-xl bg-linear-to-r from-cyan-950 to-sky-700 text-base font-semibold shadow-lg shadow-cyan-950/20 hover:from-cyan-800 hover:to-sky-600">
              {loading ? "Signing in..." : <span className="flex items-center gap-2">Sign in to workspace <ArrowRight className="size-4" /></span>}
            </Button>
            <p className="flex items-center justify-center gap-1.5 pt-1 text-xs text-slate-400"><ShieldCheck className="size-3.5" />Organization-isolated secure login</p>
          </form>
        </CardContent>
      </Card>
      </section>
    </main>
  );
}
