"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const router = useRouter();
  const [empId, setEmpId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-sm shadow-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Sign In</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label>Employee ID</Label>
              <Input
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                placeholder="Enter your Employee ID"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-cyan-900 hover:bg-cyan-700">
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
