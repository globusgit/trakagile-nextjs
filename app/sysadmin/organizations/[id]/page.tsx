"use client";
 
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
 
import PageHeader from "@/app/_components/PageHeader";
import OrganizationForm, { OrganizationFormValues } from "../../_components/OrganizationForm";
 
export default function EditOrganizationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [initial, setInitial] = useState<OrganizationFormValues | null>(null);
  const [error, setError] = useState("");
 
  useEffect(() => {
    let active = true;
    fetch(`/api/organizations/${params.id}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Unable to load organization.");
        return data.organization;
      })
      .then((org) => {
        if (!active) return;
        setInitial({
          name: org.name, contactPerson: org.contactPerson, contactDesignation: org.contactDesignation,
          contactPhone: org.contactPhone, contactEmail: org.contactEmail, website: org.website, address: org.address,
          city: org.city, district: org.district, country: org.country, state: org.state, pincode: org.pincode,
          industryType: org.industryType, registrationMode: org.registrationMode, organizationType: org.organizationType,
          panNumber: org.panNumber, gstNumber: org.gstNumber, status: org.status,
        });
      })
      .catch((err: Error) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [params.id]);
 
  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Edit Organization" backHref="/sysadmin" />
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>
        <button onClick={() => router.push("/sysadmin")} className="text-sm text-cyan-800 underline">Back to organizations</button>
      </div>
    );
  }
  if (!initial) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  return <OrganizationForm mode="edit" organizationId={params.id} initial={initial} />;
}
 