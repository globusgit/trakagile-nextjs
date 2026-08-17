"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import PageHeader from "@/app/_components/PageHeader";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Designation {
  _id: string;
  listItem: string;
}

export default function CreateEmployee() {
  const router = useRouter();
  const { data: session } = useSession();
  const orgId = session?.user?.orgId ?? "";

  const [form, setForm] = useState({
    name: "",
    employeeId: "",
    phone: "",
    email: "",
    designation: "",
    isManager: false,
    managerName: "",
  });

  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [photo, setPhoto] = useState<File | null>(null);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    if (!orgId) return;
    const fetchDesignations = async () => {
      try {
        const res = await fetch(`/api/system-list?listName=Designation&orgId=${orgId}`);
        const data = await res.json();
        setDesignations(Array.isArray(data?.data?.[0]) ? data.data[0] : []);
      } catch (err) {
        console.error("Failed to fetch designations:", err);
        setDesignations([]);
      }
    };
    fetchDesignations();
  }, [orgId]);

  const photoPreview = useMemo(() => photo ? URL.createObjectURL(photo) : "", [photo]);
  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  const validate = () => {
    const newErrors: Record<string, boolean> = {
      name: !form.name.trim(),
      employeeId: !form.employeeId.trim(),
      phone: !form.phone.trim(),
      email: !form.email.trim(),
      designation: !form.designation.trim(),
    };
    setErrors(newErrors);
    return !Object.values(newErrors).some(Boolean);
  };

  const handleSubmit = async () => {
    setServerError("");
    if (!validate()) return;

    setLoading(true);
    const fd = new FormData();
    Object.entries(form).forEach(([key, value]) => fd.append(key, String(value)));
    fd.append("orgId", orgId);
    if (photo) fd.append("photo", photo);

    try {
      const res = await fetch("/api/employee", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setServerError(data.message || "Failed to create employee.");
        return;
      }

      router.push("/employees");
      router.refresh();
    } catch (err) {
      console.error(err);
      setServerError("Something went wrong while saving the employee.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 px-0 md:px-4 lg:px-8">
      <PageHeader title="Create Employees" />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Employee Information</CardTitle>
        </CardHeader>

        <CardContent className="space-y-8">
          {serverError && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
              {serverError}
            </div>
          )}

          <div className="flex items-center gap-6">
            <img
              src={photoPreview || "/default-avatar.jpg"}
              alt="Employee"
              className="h-28 w-28 rounded-full object-cover border"
            />
            <div className="space-y-2">
              <Label>Employee Photo</Label>
              <Input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
              <p className="text-xs text-gray-400">
                Leave empty to use the default avatar
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>Name <span className="text-red-500">*</span></Label>
              <Input
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value });
                  if (errors.name) setErrors({ ...errors, name: false });
                }}
                className={errors.name ? "border-red-500" : ""}
              />
              {errors.name && <p className="text-red-500 text-xs">* This is Mandatory</p>}
            </div>

            <div className="space-y-2">
              <Label>Employee ID <span className="text-red-500">*</span></Label>
              <Input
                value={form.employeeId}
                onChange={(e) => {
                  setForm({ ...form, employeeId: e.target.value });
                  if (errors.employeeId) setErrors({ ...errors, employeeId: false });
                }}
                className={errors.employeeId ? "border-red-500" : ""}
              />
              {errors.employeeId && <p className="text-red-500 text-xs">* This is Mandatory</p>}
            </div>

            <div className="space-y-2">
              <Label>Designation <span className="text-red-500">*</span></Label>
              <Select
                value={form.designation}
                onValueChange={(v) => { if (!v) return;
                  setForm({ ...form, designation: v });
                  if (errors.designation) setErrors({ ...errors, designation: false });
                }}
              >
                <SelectTrigger className={errors.designation ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select designation" />
                </SelectTrigger>
                <SelectContent>
                  {designations.map((d) => (
                    <SelectItem key={d._id} value={d.listItem}>{d.listItem}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.designation && <p className="text-red-500 text-xs">* This is Mandatory</p>}
            </div>

            <div className="space-y-2">
              <Label>Phone <span className="text-red-500">*</span></Label>
              <Input
                value={form.phone}
                onChange={(e) => {
                  setForm({ ...form, phone: e.target.value });
                  if (errors.phone) setErrors({ ...errors, phone: false });
                }}
                className={errors.phone ? "border-red-500" : ""}
              />
              {errors.phone && <p className="text-red-500 text-xs">* This is Mandatory</p>}
            </div>

            <div className="space-y-2">
              <Label>Email <span className="text-red-500">*</span></Label>
              <Input
                value={form.email}
                onChange={(e) => {
                  setForm({ ...form, email: e.target.value });
                  if (errors.email) setErrors({ ...errors, email: false });
                }}
                className={errors.email ? "border-red-500" : ""}
              />
              {errors.email && <p className="text-red-500 text-xs">* This is Mandatory</p>}
            </div>

            <div className="flex items-center space-x-2 pt-6">
              <Checkbox
                checked={form.isManager}
                onCheckedChange={(checked) => setForm({ ...form, isManager: checked === true })}
                className="border-2 border-gray-500"
              />
              <Label>Is Manager</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reporting Manager</Label>
            <Input
              placeholder="Enter reporting manager"
              value={form.managerName}
              onChange={(e) => setForm({ ...form, managerName: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-4">
            <Button
              variant="outline"
              onClick={() => router.push("/employees")}
              className="bg-orange-700 hover:bg-orange-500 text-white"
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading} className="bg-cyan-900 hover:bg-cyan-700">
              {loading ? "Saving..." : "Save Employee"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
