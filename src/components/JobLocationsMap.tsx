import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Building2, LocateFixed, MapPin, MinusCircle, Move } from "lucide-react";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import type { JobApplication } from "@/lib/types";
import { buildJobLocationGroups, buildJobLocationGroupsAsync, getApplicationLocationLabel, type JobLocationGroup, type JobLocationGroupsResult } from "@/lib/locations";
import { getEffectiveCurrentStatus } from "@/lib/responseStatus";
import { cn } from "@/lib/utils";

// OpenFreeMap provides the detailed vector basemap without an account, API key, or billing setup.
const OPEN_FREE_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const DEFAULT_MAP_CENTER: [number, number] = [10, 20];
const DEFAULT_MAP_ZOOM = 1.25;
const INITIAL_MAP_LOAD_TIMEOUT_MS = 15_000;
const MARKER_BASE_CLASSES = "flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-full border px-2 text-xs font-semibold shadow-md transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const MARKER_ACTIVE_CLASSES = "scale-110 border-primary bg-primary text-primary-foreground";
const MARKER_IDLE_CLASSES = "border-background bg-[hsl(var(--status-applied))] text-white hover:scale-110";

type MapLibreModule = typeof import("maplibre-gl");
type MarkerBinding = {
  key: string;
  element: HTMLButtonElement;
  marker: MapLibreMarker;
  removeListeners: () => void;
};

function setMarkerAppearance(element: HTMLButtonElement, active: boolean) {
  element.className = cn(MARKER_BASE_CLASSES, active ? MARKER_ACTIVE_CLASSES : MARKER_IDLE_CLASSES);
  element.setAttribute("aria-pressed", String(active));
  element.style.zIndex = active ? "2" : "1";
}

function removeMarkerBindings(bindings: MarkerBinding[]) {
  // Explicit listener cleanup keeps marker replacement safe when async location resolution updates the groups.
  bindings.forEach(({ marker, removeListeners }) => {
    removeListeners();
    marker.remove();
  });
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
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapLibreModuleRef = useRef<MapLibreModule | null>(null);
  const markerBindingsRef = useRef<MarkerBinding[]>([]);
  const selectedKey = hoveredKey ?? activeKey;
  const selectedKeyRef = useRef(selectedKey);
  selectedKeyRef.current = selectedKey;
  const activeGroup = groups.find((group) => group.key === selectedKey) ?? groups[0];

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    let initialErrorHandler: (() => void) | null = null;
    let loadTimeoutId: number | null = null;

    const clearLoadTimeout = () => {
      if (loadTimeoutId !== null) window.clearTimeout(loadTimeoutId);
      loadTimeoutId = null;
    };

    const markInitialLoadFailed = () => {
      clearLoadTimeout();
      if (map && initialErrorHandler) map.off("error", initialErrorHandler);
      if (!cancelled) {
        setMapReady(false);
        setMapError(true);
      }
    };

    const initializeMap = async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (cancelled || !mapContainerRef.current) return;

        mapLibreModuleRef.current = maplibre;
        map = new maplibre.Map({
          container: mapContainerRef.current,
          style: OPEN_FREE_MAP_STYLE_URL,
          center: DEFAULT_MAP_CENTER,
          zoom: DEFAULT_MAP_ZOOM,
          minZoom: 1,
          maxZoom: 18,
          attributionControl: true,
          dragRotate: false,
          pitchWithRotate: false,
        });
        mapRef.current = map;
        map.addControl(new maplibre.NavigationControl({ showCompass: false, showZoom: true }), "top-right");
        map.touchZoomRotate.disableRotation();
        // Surface asynchronous style, tile, CSP, and worker failures instead of leaving the loading overlay indefinitely.
        initialErrorHandler = markInitialLoadFailed;
        map.on("error", initialErrorHandler);
        loadTimeoutId = window.setTimeout(markInitialLoadFailed, INITIAL_MAP_LOAD_TIMEOUT_MS);
        map.once("load", () => {
          clearLoadTimeout();
          if (map && initialErrorHandler) map.off("error", initialErrorHandler);
          if (!cancelled) {
            setMapError(false);
            setMapReady(true);
          }
        });
      } catch {
        markInitialLoadFailed();
      }
    };

    void initializeMap();

    return () => {
      cancelled = true;
      clearLoadTimeout();
      if (map && initialErrorHandler) map.off("error", initialErrorHandler);
      map?.remove();
      mapRef.current = null;
      mapLibreModuleRef.current = null;
    };
  }, []);

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

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = mapLibreModuleRef.current;
    if (!mapReady || !map || !maplibre) return;

    const bindings: MarkerBinding[] = groups.map((group) => {
      const count = group.applications.length;
      const element = document.createElement("button");
      element.type = "button";
      element.textContent = String(count);
      element.title = group.label;
      element.setAttribute("aria-label", `${group.label}, ${count} application${count === 1 ? "" : "s"}`);
      setMarkerAppearance(element, group.key === selectedKeyRef.current);

      const handleClick = (event: MouseEvent) => {
        event.stopPropagation();
        setActiveKey(group.key);
      };
      const handleMouseEnter = () => setHoveredKey(group.key);
      const handleMouseLeave = () => setHoveredKey(null);
      const handleFocus = () => setHoveredKey(group.key);
      const handleBlur = () => setHoveredKey(null);

      element.addEventListener("click", handleClick);
      element.addEventListener("mouseenter", handleMouseEnter);
      element.addEventListener("mouseleave", handleMouseLeave);
      element.addEventListener("focus", handleFocus);
      element.addEventListener("blur", handleBlur);

      const marker = new maplibre.Marker({ element, anchor: "center" })
        .setLngLat([group.longitude, group.latitude])
        .addTo(map);

      return {
        key: group.key,
        element,
        marker,
        removeListeners: () => {
          element.removeEventListener("click", handleClick);
          element.removeEventListener("mouseenter", handleMouseEnter);
          element.removeEventListener("mouseleave", handleMouseLeave);
          element.removeEventListener("focus", handleFocus);
          element.removeEventListener("blur", handleBlur);
        },
      };
    });

    markerBindingsRef.current = bindings;

    // Fit all job locations into view while retaining useful street-level detail for a single location.
    if (groups.length === 1) {
      const group = groups[0];
      map.easeTo({
        center: [group.longitude, group.latitude],
        zoom: group.source === "country" ? 3 : 6,
        duration: 500,
      });
    } else if (groups.length > 1) {
      const bounds = new maplibre.LngLatBounds();
      groups.forEach((group) => bounds.extend([group.longitude, group.latitude]));
      map.fitBounds(bounds, { padding: 52, maxZoom: 7, duration: 500 });
    } else {
      map.easeTo({ center: DEFAULT_MAP_CENTER, zoom: DEFAULT_MAP_ZOOM, duration: 0 });
    }

    return () => {
      removeMarkerBindings(bindings);
      if (markerBindingsRef.current === bindings) markerBindingsRef.current = [];
    };
  }, [groups, mapReady]);

  useEffect(() => {
    markerBindingsRef.current.forEach(({ key, element }) => {
      setMarkerAppearance(element, key === selectedKey);
    });
  }, [selectedKey]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-3">
        <div className="job-locations-map relative aspect-[2/1] overflow-hidden rounded-lg border border-border/50 bg-muted/30">
          <div
            ref={mapContainerRef}
            data-testid="job-locations-map-canvas"
            role="region"
            aria-label="Interactive job locations map"
            className="absolute inset-0"
          />
          {!mapReady && !mapError && groups.length > 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60 text-sm text-muted-foreground backdrop-blur-[1px]">
              Loading detailed map…
            </div>
          )}
          {mapError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/90 p-8 text-center">
              <AlertTriangle className="h-8 w-8 text-muted-foreground" />
              <p className="max-w-sm text-sm text-muted-foreground">The detailed map could not be loaded. Your saved job locations are unchanged.</p>
            </div>
          )}
          {groups.length === 0 && !mapError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 p-8 text-center">
              <MapPin className="h-8 w-8 text-muted-foreground" />
              <p className="max-w-sm text-sm text-muted-foreground">No applications have enough city, country, or coordinate data to place on the map yet.</p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><LocateFixed className="h-3.5 w-3.5" /> {groups.length} location{groups.length === 1 ? "" : "s"}</span>
          <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {mappedApplicationCount} pinned job{mappedApplicationCount === 1 ? "" : "s"}</span>
          {groups.length > 0 && (
            <span className="inline-flex items-center gap-1"><Move className="h-3.5 w-3.5" /> Drag or scroll to explore</span>
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
