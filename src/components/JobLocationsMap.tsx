import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Building2, LocateFixed, MapPin, MinusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import type { JobApplication } from "@/lib/types";
import { buildJobLocationGroups, buildJobLocationGroupsAsync, getApplicationLocationLabel, projectGeoPoint, type JobLocationGroup, type JobLocationGroupsResult } from "@/lib/locations";
import { getEffectiveCurrentStatus } from "@/lib/responseStatus";
import { cn } from "@/lib/utils";

function WorldMapBackground() {
  return (
    <div className="absolute inset-0 bg-white" aria-hidden="true">
      {/* Public-domain Natural Earth equirectangular map; object-fill keeps pins aligned to percentage projection. */}
      <img src="/worldmap-location-ned-50m.svg" alt="" className="h-full w-full object-fill" draggable={false} />
      <div className="absolute inset-0 bg-background/10 mix-blend-multiply dark:bg-background/20" />
    </div>
  );
}

function LocationDetails({ group }: { group: JobLocationGroup }) {
  const navigate = useNavigate();
  const visibleApplications = group.applications.slice(0, 6);

  return (
    <div className="space-y-4 rounded-lg border border-border/50 bg-card/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{group.label}</p>
          <p className="text-xs text-muted-foreground">{group.applications.length} application{group.applications.length === 1 ? "" : "s"}</p>
        </div>
        <Badge variant="outline" className="shrink-0 capitalize">{group.source}</Badge>
      </div>
      <div className="space-y-2">
        {visibleApplications.map((application) => (
          <button
            key={application.id}
            type="button"
            onClick={() => navigate(`/app/applications/${application.id}`)}
            className="w-full rounded-md border border-border/40 px-3 py-2 text-left transition-colors hover:bg-muted/50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{application.companyName}</p>
                <p className="truncate text-xs text-muted-foreground">{application.jobTitle}</p>
              </div>
              <StatusBadge status={getEffectiveCurrentStatus(application)} />
            </div>
          </button>
        ))}
        {group.applications.length > visibleApplications.length && (
          <p className="text-xs text-muted-foreground">+{group.applications.length - visibleApplications.length} more in this location</p>
        )}
      </div>
    </div>
  );
}

export function JobLocationsMap({ applications }: { applications: JobApplication[] }) {
  const initialLocationResult = useMemo(() => buildJobLocationGroups(applications), [applications]);
  const [locationResult, setLocationResult] = useState<JobLocationGroupsResult>(initialLocationResult);
  const { groups, unresolved, ignored } = locationResult;
  const mappedApplicationCount = groups.reduce((total, group) => total + group.applications.length, 0);
  const [activeKey, setActiveKey] = useState<string | null>(groups[0]?.key ?? null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const activeGroup = groups.find((group) => group.key === (hoveredKey ?? activeKey)) ?? groups[0];

  useEffect(() => {
    let cancelled = false;
    setLocationResult(initialLocationResult);

    buildJobLocationGroupsAsync(applications)
      .then((result) => {
        if (!cancelled) setLocationResult(result);
      })
      .catch(() => {
        if (!cancelled) setLocationResult(initialLocationResult);
      });

    return () => {
      cancelled = true;
    };
  }, [applications, initialLocationResult]);

  useEffect(() => {
    if (!groups.some((group) => group.key === activeKey)) {
      setActiveKey(groups[0]?.key ?? null);
    }
  }, [activeKey, groups]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-3">
        <div className="relative aspect-[2/1] overflow-hidden rounded-lg border border-border/50 bg-white">
          <WorldMapBackground />
          {groups.map((group) => {
            const point = projectGeoPoint(group.latitude, group.longitude);
            const count = group.applications.length;
            const isActive = activeGroup?.key === group.key;

            return (
              <button
                key={group.key}
                type="button"
                aria-label={`${group.label}, ${count} application${count === 1 ? "" : "s"}`}
                onMouseEnter={() => setHoveredKey(group.key)}
                onMouseLeave={() => setHoveredKey(null)}
                onFocus={() => setHoveredKey(group.key)}
                onBlur={() => setHoveredKey(null)}
                onClick={() => setActiveKey(group.key)}
                className={cn(
                  "absolute flex h-8 min-w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-xs font-semibold shadow-sm transition-all",
                  isActive ? "z-20 scale-110 border-primary bg-primary text-primary-foreground" : "z-10 border-background bg-[hsl(var(--status-applied))] text-white hover:scale-110",
                )}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
              >
                {count}
              </button>
            );
          })}
          {groups.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-8 text-center">
              <MapPin className="h-8 w-8 text-muted-foreground" />
              <p className="max-w-sm text-sm text-muted-foreground">No applications have enough city, country, or coordinate data to place on the map yet.</p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><LocateFixed className="h-3.5 w-3.5" /> {groups.length} location{groups.length === 1 ? "" : "s"}</span>
          <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {mappedApplicationCount} pinned job{mappedApplicationCount === 1 ? "" : "s"}</span>
          {ignored.length > 0 && (
            <span className="inline-flex items-center gap-1"><MinusCircle className="h-3.5 w-3.5" /> {ignored.length} remote/blank ignored</span>
          )}
          {unresolved.length > 0 && (
            <span className="inline-flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> {unresolved.length} unresolved</span>
          )}
        </div>
      </div>
      <aside className="space-y-4">
        {activeGroup ? <LocationDetails group={activeGroup} /> : null}
        {unresolved.length > 0 && (
          <div className="rounded-lg border border-border/50 p-4">
            <p className="text-sm font-semibold">Needs location cleanup</p>
            <p className="mt-1 text-xs text-muted-foreground">These rows could not be resolved against the local city database. Add city/country, correct typos, or provide valid coordinates.</p>
            <div className="mt-3 space-y-2">
              {unresolved.slice(0, 5).map((application) => (
                <div key={application.id} className="rounded-md bg-muted/40 px-3 py-2">
                  <p className="truncate text-sm font-medium">{application.companyName}</p>
                  <p className="truncate text-xs text-muted-foreground">{getApplicationLocationLabel(application)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
