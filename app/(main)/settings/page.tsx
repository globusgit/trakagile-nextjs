"use client";

import { useRouter } from "next/navigation";
import PageHeader from "@/app/_components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarPlus } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const nextYear = new Date().getFullYear() + 1;

  return (
    <div className="space-y-4 px-0 md:px-4 lg:px-8">
      <PageHeader title="Settings" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card
          onClick={() => router.push("/settings/future-holidays")}
          className="shadow-sm cursor-pointer hover:shadow-md hover:border-cyan-700 transition"
        >
          <CardContent className="p-5 flex items-start gap-4">
            <div className="rounded-lg bg-cyan-50 p-3">
              <CalendarPlus className="h-6 w-6 text-cyan-900" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Future Holidays</p>
              <p className="text-xs text-gray-500 mt-1">
                Add holidays for {nextYear}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
