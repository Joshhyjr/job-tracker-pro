import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Building2, LocateFixed, MapPin, Minus, MinusCircle, Move, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import type { JobApplication } from "@/lib/types";
import { buildJobLocationGroups, buildJobLocationGroupsAsync, getApplicationLocationLabel, projectGeoPoint, type JobLocationGroup, type JobLocationGroupsResult } from "@/lib/locations";
import { getEffectiveCurrentStatus } from "@/lib/responseStatus";
import { cn } from "@/lib/utils";

// Bounded zoom steps keep the static map readable and prevent controls from pushing pins permanently out of view.
const MIN_MAP_ZOOM = 1;
const MAX_MAP_ZOOM = 2;
const MAP_ZOOM_STEP = 0.25;
const DRAG_THRESHOLD_PX = 3;

type MapPan = { x: number; y: number };
type MapDragStart = MapPan & { pointerId: number; clientX: number; clientY: number };

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
  const [mapZoom, setMapZoom] = useState(MIN_MAP_ZOOM);
  const [mapPan, setMapPan] = useState<MapPan>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const mapViewportRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<MapDragStart | null>(null);
  const didDragRef = useRef(false);
  const suppressClickUntilRef = useRef(0);
  const activeGroup = groups.find((group) => group.key === (hoveredKey ?? activeKey)) ?? groups[0];

  // Limit panning to the scaled overflow so the map always continues covering its viewport.
  const clampMapPan = (pan: MapPan, zoom: number): MapPan => {
    const viewport = mapViewportRef.current?.getBoundingClientRect();
    if (!viewport || zoom <= MIN_MAP_ZOOM) return { x: 0, y: 0 };

    const maxX = (viewport.width * (zoom - MIN_MAP_ZOOM)) / 2;
    const maxY = (viewport.height * (zoom - MIN_MAP_ZOOM)) / 2;
    return {
      x: Math.min(maxX, Math.max(-maxX, pan.x)),
      y: Math.min(maxY, Math.max(-maxY, pan.y)),
    };
  };

  // Clamp every zoom update and recenter axes that no longer have scaled overflow.
  const changeMapZoom = (direction: 1 | -1) => {
    const nextZoom = Math.min(MAX_MAP_ZOOM, Math.max(MIN_MAP_ZOOM, mapZoom + direction * MAP_ZOOM_STEP));
    setMapZoom(nextZoom);
    setMapPan((currentPan) => clampMapPan(currentPan, nextZoom));
  };

  const handleMapPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const startedOnControls = event.target instanceof Element && event.target.closest("[data-map-zoom-controls]");
    if (mapZoom <= MIN_MAP_ZOOM || event.button !== 0 || startedOnControls) return;

    didDragRef.current = false;
    dragStartRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      ...mapPan,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setIsDragging(true);
  };

  const handleMapPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragStart = dragStartRef.current;
    if (!dragStart || dragStart.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - dragStart.clientX;
    const deltaY = event.clientY - dragStart.clientY;
    if (!didDragRef.current && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX) return;

    didDragRef.current = true;
    event.preventDefault();
    setMapPan(clampMapPan({ x: dragStart.x + deltaX, y: dragStart.y + deltaY }, mapZoom));
  };

  const finishMapDrag = (event: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    if (dragStartRef.current?.pointerId !== event.pointerId) return;

    if (!cancelled && didDragRef.current) {
      // Ignore the synthetic click emitted immediately after a completed drag, without blocking later pin clicks.
      suppressClickUntilRef.current = Date.now() + 100;
    }
    dragStartRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setIsDragging(false);
  };

  const handleMapClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    const clickedControls = event.target instanceof Element && event.target.closest("[data-map-zoom-controls]");
    if (clickedControls) {
      suppressClickUntilRef.current = 0;
      return;
    }
    if (Date.now() >= suppressClickUntilRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickUntilRef.current = 0;
  };

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
        <div
          ref={mapViewportRef}
          data-testid="job-locations-map-viewport"
          role="region"
          aria-label="Interactive job locations map"
          onPointerDown={handleMapPointerDown}
          onPointerMove={handleMapPointerMove}
          onPointerUp={(event) => finishMapDrag(event)}
          onPointerCancel={(event) => finishMapDrag(event, true)}
          onClickCapture={handleMapClickCapture}
          className={cn(
            "relative aspect-[2/1] select-none overflow-hidden rounded-lg border border-border/50 bg-white",
            mapZoom > MIN_MAP_ZOOM && (isDragging ? "cursor-grabbing touch-none" : "cursor-grab touch-none"),
          )}
        >
          {/* The image and pins share one transform layer so geographic alignment stays exact at every zoom level. */}
          <div
            data-testid="job-locations-map-canvas"
            className={cn(
              "absolute inset-0 origin-center ease-out motion-reduce:transition-none",
              !isDragging && "transition-transform duration-200",
            )}
            style={{ transform: `translate3d(${mapPan.x}px, ${mapPan.y}px, 0) scale(${mapZoom})` }}
          >
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
          </div>
          {groups.length > 0 && (
            <div data-map-zoom-controls className="absolute right-3 top-3 z-30 flex items-center gap-1 rounded-md border border-border/60 bg-background/90 p-1 shadow-sm backdrop-blur-sm" role="group" aria-label="Map zoom controls">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Zoom out"
                title="Zoom out"
                disabled={mapZoom <= MIN_MAP_ZOOM}
                onClick={() => changeMapZoom(-1)}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-11 text-center text-xs font-medium tabular-nums" aria-live="polite">
                {Math.round(mapZoom * 100)}%
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Zoom in"
                title="Zoom in"
                disabled={mapZoom >= MAX_MAP_ZOOM}
                onClick={() => changeMapZoom(1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
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
          {groups.length > 0 && (
            <span className="inline-flex items-center gap-1"><Move className="h-3.5 w-3.5" /> Zoom in, then drag to explore</span>
          )}
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
