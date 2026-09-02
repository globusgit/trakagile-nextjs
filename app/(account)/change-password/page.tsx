"use client";

import { FormEvent, useState } from "react";
import { signOut } from "next-auth/react";
import { KeyRound, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/account/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Unable to change password.");
      await signOut({ redirect: false });
      window.location.assign("/?passwordChanged=1");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to change password.");
      setSaving(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-slate-100 p-4">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="space-y-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-cyan-100 text-cyan-900"><KeyRound /></div>
          <CardTitle className="text-3xl">Change your password</CardTitle>
          <p className="text-sm text-muted-foreground">Temporary passwords must be replaced before accessing workforce data.</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
            <Label>Current password<Input className="mt-1" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></Label>
            <Label>New password<Input className="mt-1" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={12} required /></Label>
            <Label>Confirm new password<Input className="mt-1" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={12} required /></Label>
            <p className="text-xs text-muted-foreground">Use at least 12 characters with uppercase, lowercase, and numeric characters.</p>
            <Button className="w-full" type="submit" disabled={saving}>{saving ? "Changing password..." : "Change password and sign in again"}</Button>
            <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4" />Other signed-in sessions will be revoked.</p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
