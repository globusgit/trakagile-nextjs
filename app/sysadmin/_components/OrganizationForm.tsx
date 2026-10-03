
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";

import PageHeader from "@/app/_components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  COUNTRIES,
  INDUSTRY_TYPES,
  ORGANIZATION_TYPES,
  REGISTRATION_MODES,
  statesForCountry,
  validateOrganizationInput,
} from "@/lib/organizationOptions.mjs";

const FIELDS = [
  "name", "contactPerson", "contactDesignation", "contactPhone", "contactEmail", "website", "address",
  "city", "district", "country", "state", "pincode", "industryType", "registrationMode", "organizationType",
  "panNumber", "gstNumber", "status",
] as const;

type FieldKey = (typeof FIELDS)[number];
export type OrganizationFormValues = Partial<Record<FieldKey, string>>;
type FormState = Record<FieldKey, string>;

const EMPTY: FormState = Object.fromEntries(FIELDS.map((key) => [key, ""])) as FormState;

type CreatedResult = {
  name: string;
  code: string;
  employeeId: string;
  password?: string;
  designationCount: number;
};

function TextField({ label, required, value, onChange, error, hint, type = "text" }: {
  label: string; required?: boolean; value: string; onChange: (value: string) => void; error?: string; hint?: string; type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label} {required && <span className="text-red-500">*</span>}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={error ? "border-red-500" : ""} />
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  );
}

function SelectField({ label, required, value, onChange, options, error, placeholder = "Select" }: {
  label: string; required?: boolean; value: string; onChange: (value: string) => void; options: readonly string[]; error?: string; placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label} {required && <span className="text-red-500">*</span>}</Label>
      <Select value={value} onValueChange={(next) => { if (next) onChange(next); }}>
        <SelectTrigger className={error ? "border-red-500 w-full" : "w-full"}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
        </SelectContent>
      </Select>
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  );
}

export default function OrganizationForm({ mode, organizationId, initial }: {
  mode: "create" | "edit";
  organizationId?: string;
  initial?: OrganizationFormValues;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  // Only take values that exist: older organizations lack some of the newer fields.
  const [form, setForm] = useState<FormState>(() => ({
    ...EMPTY,
    status: "ACTIVE",
    ...Object.fromEntries(Object.entries(initial ?? {}).filter(([, value]) => typeof value === "string")),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);
  const [designations, setDesignations] = useState<string[]>([]);
  const [created, setCreated] = useState<CreatedResult | null>(null);

  useEffect(() => {
    fetch("/api/organizations/options", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => { if (Array.isArray(result?.designations)) setDesignations(result.designations); })
      .catch(() => {});
  }, []);

  const designationOptions = useMemo(
    () => (form.contactDesignation && !designations.includes(form.contactDesignation) ? [form.contactDesignation, ...designations] : designations),
    [designations, form.contactDesignation],
  );
  const countryNames = useMemo(() => COUNTRIES.map((country) => country.name), []);
  const stateOptions: string[] = useMemo(() => statesForCountry(form.country), [form.country]);
  const stateValue = form.state;
  const stateChoices = stateValue && stateOptions.length && !stateOptions.includes(stateValue) ? [stateValue, ...stateOptions] : stateOptions;

  const set = (key: FieldKey) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => { const next = { ...current }; delete next[key]; return next; });
  };

  const changeCountry = (country: string) => {
    setForm((current) => ({ ...current, country, state: "" }));
    setErrors((current) => { const next = { ...current }; delete next.country; delete next.state; return next; });
  };

  const submit = async () => {
    setServerError("");
    const { errors: found } = validateOrganizationInput(form, { partial: mode === "edit" });
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      const response = await fetch(mode === "create" ? "/api/organizations" : `/api/organizations/${organizationId}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.errors) setErrors(data.errors);
        setServerError(data.message || "Unable to save the organization.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["sysadmin-organizations"] });
      if (mode === "create") {
        setCreated({
          name: data.organization?.name ?? form.name,
          code: data.login?.organizationCode ?? data.organization?.code ?? "",
          employeeId: data.login?.employeeId ?? "",
          password: data.login?.password,
          designationCount: data.designationCount ?? 0,
        });
      } else {
        router.push("/sysadmin");
      }
    } catch {
      setServerError("Something went wrong while saving the organization.");
    } finally {
      setSaving(false);
    }
  };

  if (created) {
    return (
      <div className="space-y-4">
        <PageHeader title="Create Organization" backHref="/sysadmin" />
        <Card className="shadow-sm">
          <CardContent className="space-y-5 pt-6">
            <div className="flex items-center gap-3 text-emerald-700">
              <CheckCircle2 className="size-6" />
              <h2 className="text-xl font-semibold">{created.name} was created</h2>
            </div>
            <p className="text-sm text-slate-600">
              The organization has all currently enabled modules and {created.designationCount} designations.
              Its first user can now sign in on the normal login page with these details and will be asked to change the password:
            </p>
            <div className="grid gap-3 rounded-xl border border-cyan-100 bg-cyan-50 p-4 text-sm sm:grid-cols-3">
              <div><p className="text-xs text-slate-500">Employee ID (mobile number)</p><p className="font-semibold text-slate-900">{created.employeeId}</p></div>
              <div><p className="text-xs text-slate-500">Password</p><p className="font-semibold text-slate-900">{created.password ?? "As set by the administrator"}</p></div>
              <div><p className="text-xs text-slate-500">Organization code</p><p className="font-semibold text-slate-900">{created.code}</p></div>
            </div>
            <p className="text-xs text-slate-500">After signing in, the Director creates the organization&apos;s employees from the Employees module.</p>
            <div className="flex gap-3">
              <Button onClick={() => router.push("/sysadmin")} className="bg-cyan-900 hover:bg-cyan-700">Back to organizations</Button>
              <Button variant="outline" onClick={() => { setCreated(null); setForm({ ...EMPTY, status: "ACTIVE" }); }}>Create another</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title={mode === "create" ? "Create Organization" : "Edit Organization"} backHref="/sysadmin" />

      <Card className="shadow-sm">
        <CardContent className="space-y-6 pt-6">
          {serverError && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{serverError}</div>
          )}

          <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
            <TextField label="Organization Name" required value={form.name} onChange={set("name")} error={errors.name} />
            <TextField label="Contact Name" value={form.contactPerson} onChange={set("contactPerson")} error={errors.contactPerson} />

            <SelectField label="Designation" value={form.contactDesignation} onChange={set("contactDesignation")} options={designationOptions} error={errors.contactDesignation} />
            <TextField
              label="Phone" required value={form.contactPhone} onChange={set("contactPhone")} error={errors.contactPhone}
              hint={mode === "create" ? "Used as the first user's Employee ID." : "Changing this does not change the existing login Employee ID."}
            />

            <TextField label="Email" required type="email" value={form.contactEmail} onChange={set("contactEmail")} error={errors.contactEmail} />
            <TextField label="Website" value={form.website} onChange={set("website")} error={errors.website} />

            <div className="space-y-2 md:col-span-2">
              <Label>Address <span className="text-red-500">*</span></Label>
              <Textarea value={form.address} onChange={(e) => set("address")(e.target.value)} rows={3} className={errors.address ? "border-red-500" : ""} />
              {errors.address && <p className="text-red-500 text-xs">{errors.address}</p>}
            </div>

            <TextField label="City" required={mode === "create"} value={form.city} onChange={set("city")} error={errors.city} />
            <TextField label="District" value={form.district} onChange={set("district")} error={errors.district} />

            <SelectField label="Country" required={mode === "create"} value={form.country} onChange={changeCountry} options={countryNames} error={errors.country} />
            {stateOptions.length || !form.country ? (
              <SelectField label="State" required={mode === "create"} value={form.state} onChange={set("state")} options={stateChoices} error={errors.state} />
            ) : (
              <TextField label="State" required={mode === "create"} value={form.state} onChange={set("state")} error={errors.state} />
            )}

            <TextField label="Pincode" value={form.pincode} onChange={set("pincode")} error={errors.pincode} />
            <SelectField label="Industry Type" required={mode === "create"} value={form.industryType} onChange={set("industryType")} options={INDUSTRY_TYPES} error={errors.industryType} />

            <SelectField label="Registration Mode" required={mode === "create"} value={form.registrationMode} onChange={set("registrationMode")} options={REGISTRATION_MODES} error={errors.registrationMode} />
            <SelectField label="Organization Type" required={mode === "create"} value={form.organizationType} onChange={set("organizationType")} options={ORGANIZATION_TYPES} error={errors.organizationType} />

            <TextField label="PAN" value={form.panNumber} onChange={set("panNumber")} error={errors.panNumber} />
            <TextField label="GST No" value={form.gstNumber} onChange={set("gstNumber")} error={errors.gstNumber} />

            {mode === "edit" && (
              <SelectField label="Status" required value={form.status} onChange={set("status")} options={["ACTIVE", "INACTIVE"]} error={errors.status} />
            )}
          </div>

          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => router.push("/sysadmin")} className="bg-orange-700 hover:bg-orange-500 text-white">Cancel</Button>
            <Button onClick={submit} disabled={saving} className="bg-cyan-900 hover:bg-cyan-700">
              {saving ? "Saving..." : mode === "create" ? "Save Organization" : "Update Organization"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}