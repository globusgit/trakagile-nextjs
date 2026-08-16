"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

export default function EditEmployee() {
  const router = useRouter();
  const params = useParams();
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
    status: "",
    photo: "",
  });

  const [photo, setPhoto] = useState<File | null>(null);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const loadEmployee = async () => {
      try {
        const res = await fetch(`/api/employee/${params.id}`);
        if (!res.ok) {
          setLoadError(`Failed to load employee (status ${res.status})`);
          setPageLoading(false);
          return;
        }
        const data = await res.json();
        setForm({
          name: data.name || "",
          employeeId: data.empId || "",
          phone: data.phone || "",
          email: data.email || "",
          designation: data.designation || "",
          isManager: data.isManager || false,
          managerName: data.reportingManager || "",
          status: data.status || "",
          photo: data.photo || "",
        });
      } catch (err) {
        console.error("Failed to load employee:", err);
        setLoadError("Failed to load employee details.");
      } finally {
        setPageLoading(false);
      }
    };
    if (params.id) loadEmployee();
  }, [params.id]);

  useEffect(() => {
    if (!orgId) return;
    const fetchDesignations = async () => {
      const res = await fetch(`/api/system-list?listName=Designation&orgId=${orgId}`);
      const data = await res.json();
      setDesignations(Array.isArray(data?.data?.[0]) ? data.data[0] : []);
    };
    fetchDesignations();
  }, [orgId]);

  const photoPreview = useMemo(() => photo ? URL.createObjectURL(photo) : "", [photo]);
  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  const currentPhotoSrc = photoPreview
    ? photoPreview
    : form.photo
    ? `/api/files/employees/${encodeURIComponent(form.photo)}`
    : "/default-avatar.jpg";

  const handleSubmit = async () => {
    setLoading(true);
    const fd = new FormData();
    fd.append("name", form.name);
    fd.append("employeeId", form.employeeId);
    fd.append("phone", form.phone);
    fd.append("email", form.email);
    fd.append("designation", form.designation);
    fd.append("isManager", String(form.isManager));
    fd.append("managerName", form.managerName);
    fd.append("status", form.status);
    if (photo) fd.append("photo", photo);

    try {
      const res = await fetch(`/api/employee/${params.id}`, { method: "PUT", body: fd });
      if (!res.ok) throw new Error("Failed to update employee");
      router.push("/employees");
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Something went wrong while updating the employee.");
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="space-y-4 px-0 md:px-4 lg:px-8">
        <PageHeader title="Edit Employee" />
        <div className="p-8 text-center text-gray-500">Loading employee details...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4 px-0 md:px-4 lg:px-8">
        <PageHeader title="Edit Employee" />
        <div className="p-8 text-center text-red-500">{loadError}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-0 md:px-4 lg:px-8">
      <PageHeader title="Edit Employee" />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Employee Information</CardTitle>
        </CardHeader>

        <CardContent className="space-y-8">
          <div className="flex items-center gap-6">
            <img
              src={currentPhotoSrc}
              alt={form.name}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = "/default-avatar.jpg";
              }}
              className="h-28 w-28 rounded-full object-cover border"
            />
            <div className="space-y-2">
              <Label>Employee Photo</Label>
              <Input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
              <p className="text-xs text-gray-400">Leave empty to keep the current photo</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Employee ID</Label>
              <Input value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Designation</Label>
              <Select value={form.designation} onValueChange={(v) => { if (v) setForm({ ...form, designation: v }); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {designations.map((d) => (
                    <SelectItem key={d._id} value={d.listItem}>{d.listItem}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => { if (v) setForm({ ...form, status: v }); }}>
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Reporting Manager</Label>
              <Input
                placeholder="Enter reporting manager"
                value={form.managerName}
                onChange={(e) => setForm({ ...form, managerName: e.target.value })}
              />
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

          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => router.push("/employees")} className="bg-orange-700 hover:bg-orange-500 text-white">
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
