"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

export type ReferenceValue = {
  number: string;
  description: string;
  vertical: string;
  subVertical: string;
  status: string;
  state: string;
};

export const EMPTY_REFERENCE: ReferenceValue = {
  number: "",
  description: "",
  vertical: "",
  subVertical: "",
  status: "",
  state: "",
};

// Number is the primary field always visible; Description/Vertical/Sub-Vertical/
// Status/State are optional context shown in that column's hover card on the
// Tasks list, tucked behind an "Add details" toggle to keep the form compact.
export default function ReferenceFieldGroup({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ReferenceValue;
  onChange: (value: ReferenceValue) => void;
}) {
  const hasDetails = Boolean(
    value.description || value.vertical || value.subVertical || value.status || value.state,
  );
  const [expanded, setExpanded] = useState(hasDetails);

  const set = (field: keyof ReferenceValue) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [field]: e.target.value });

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Hide details" : "Add details"}
          {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </Button>
      </div>

      <Input placeholder="Optional - number" value={value.number} onChange={set("number")} />

      {expanded && (
        <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
          <Input placeholder="Description" value={value.description} onChange={set("description")} />
          <Input placeholder="Vertical" value={value.vertical} onChange={set("vertical")} />
          <Input placeholder="Sub-Vertical(s), comma separated" value={value.subVertical} onChange={set("subVertical")} />
          <Input placeholder="Status" value={value.status} onChange={set("status")} />
          <Input placeholder="State" value={value.state} onChange={set("state")} />
        </div>
      )}
    </div>
  );
}