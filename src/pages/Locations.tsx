import { Globe2 } from "lucide-react";
import { JobLocationsMap } from "@/components/JobLocationsMap";
import type { JobApplication } from "@/lib/types";

export default function Locations({ applications }: { applications: JobApplication[] }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Globe2 className="h-6 w-6 text-[hsl(var(--status-applied))]" />
          <h1 className="text-3xl font-semibold tracking-tight">Job Locations</h1>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Pins are grouped by parsed coordinates, city/country, or country fallback while preserving the existing application table data.
        </p>
      </div>
      <JobLocationsMap applications={applications} />
    </div>
  );
}
