import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Building2, LocateFixed, MapPin, MinusCircle, Move, Search } from "lucide-react";
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent, Marker as MapLibreMarker, StyleSpecification } from "maplibre-gl";
import type { Feature, FeatureCollection, MultiPolygon } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import type { JobApplication } from "@/lib/types";
import { buildJobLocationGroups, buildJobLocationGroupsAsync, getApplicationLocationLabel, type JobLocationGroup, type JobLocationGroupsResult } from "@/lib/locations";
import { getEffectiveCurrentStatus } from "@/lib/responseStatus";

// OpenFreeMap provides the detailed vector basemap without an account, API key, or billing setup.
const OPEN_FREE_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const DEFAULT_MAP_CENTER: [number, number] = [10, 20];
const DEFAULT_MAP_ZOOM = 1.25;
const INITIAL_MAP_LOAD_TIMEOUT_MS = 15_000;
const COUNTRY_BOUNDARIES_URL = "/world-countries-50m.geojson";
const COUNTRY_SHADING_SOURCE_ID = "job-country-shading";
const COUNTRY_SHADING_LAYER_ID = "job-country-shading-fill";
const MARKER_BASE_CLASSES = "flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-full border px-2 text-xs font-semibold shadow-md transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const MARKER_ACTIVE_CLASSES = "scale-110 border-primary bg-primary text-primary-foreground";
const MARKER_IDLE_CLASSES = "border-background bg-[hsl(var(--status-applied))] text-white hover:scale-110";
const MARKER_BASE_CLASS_LIST = MARKER_BASE_CLASSES.split(" ");
const MARKER_ACTIVE_CLASS_LIST = MARKER_ACTIVE_CLASSES.split(" ");
const MARKER_IDLE_CLASS_LIST = MARKER_IDLE_CLASSES.split(" ");

function buildSummaryMapStyle(): StyleSpecification {
  // The overview uses a local, provider-free canvas so the country data remains the visual focus.
  return {
    version: 8,
    sources: {},
    layers: [{
      id: "summary-map-background",
      type: "background",
      paint: { "background-color": "#f8fafc" },
    }],
  };
}

type MapLibreModule = typeof import("maplibre-gl");
type CountryBoundaryProperties = { iso3: string; name: string };
type ShadedCountryProperties = CountryBoundaryProperties & { applicationCount: number };
type CountryBoundaryCollection = FeatureCollection<MultiPolygon, CountryBoundaryProperties>;
type ShadedCountryCollection = FeatureCollection<MultiPolygon, ShadedCountryProperties>;
type MarkerBinding = {
  key: string;
  element: HTMLButtonElement;
  marker: MapLibreMarker;
  removeListeners: () => void;
};

let countryBoundaryPromise: Promise<CountryBoundaryCollection> | null = null;

const COUNTRY_NAME_ALIASES: Record<string, string> = {
  america: "united states",
  england: "united kingdom",
  "great britain": "united kingdom",
  uae: "united arab emirates",
  uk: "united kingdom",
  us: "united states",
  usa: "united states",
};

function normalizeCountryName(country: string) {
  const normalized = country.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return COUNTRY_NAME_ALIASES[normalized] ?? normalized;
}

function loadCountryBoundaries() {
  if (!countryBoundaryPromise) {
    // Reuse the repository's Natural Earth boundaries so shading remains local, keyless, and available for imported countries.
    countryBoundaryPromise = fetch(COUNTRY_BOUNDARIES_URL).then(async (response) => {
      if (!response.ok) throw new Error("Country boundaries could not be loaded");
      return response.json() as Promise<CountryBoundaryCollection>;
    });
  }
  return countryBoundaryPromise;
}

function buildShadedCountryCollection(
  boundaries: CountryBoundaryCollection,
  groups: JobLocationGroup[],
  includeEmptyCountries = false,
): ShadedCountryCollection {
  const counts = new Map<string, number>();
  groups.forEach((group) => {
    const countryKey = normalizeCountryName(group.country);
    counts.set(countryKey, (counts.get(countryKey) ?? 0) + group.applications.length);
  });

  const features = boundaries.features.flatMap((feature) => {
    const applicationCount = counts.get(normalizeCountryName(feature.properties.name)) ?? 0;
    if (!includeEmptyCountries && applicationCount === 0) return [];
    return [{
      ...feature,
      properties: { ...feature.properties, applicationCount },
    } satisfies Feature<MultiPolygon, ShadedCountryProperties>];
  });

  return { type: "FeatureCollection", features };
}

function setMarkerAppearance(element: HTMLButtonElement, active: boolean) {
  // Toggle only app-owned classes so MapLibre retains its absolute positioning and anchor classes.
  element.classList.add(...MARKER_BASE_CLASS_LIST);
  element.classList.remove(...MARKER_ACTIVE_CLASS_LIST, ...MARKER_IDLE_CLASS_LIST);
  element.classList.add(...(active ? MARKER_ACTIVE_CLASS_LIST : MARKER_IDLE_CLASS_LIST));
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

export function JobLocationsMap({
  applications,
  variant = "interactive",
}: {
  applications: JobApplication[];
  variant?: "interactive" | "summary";
}) {
  const isSummary = variant === "summary";
  const initialLocationResult = useMemo(() => buildJobLocationGroups(applications), [applications]);
  const [locationResult, setLocationResult] = useState<JobLocationGroupsResult>(initialLocationResult);
  const { groups: allGroups, unresolved, ignored } = locationResult;
  const [countryFilter, setCountryFilter] = useState("");
  // Filter the resolved groups once so map markers, counts, fitting, and details always describe the same country results.
  const groups = useMemo(() => {
    const query = countryFilter.trim().toLocaleLowerCase();
    if (!query) return allGroups;
    return allGroups.filter((group) => group.country.toLocaleLowerCase().includes(query));
  }, [allGroups, countryFilter]);
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
          style: isSummary ? buildSummaryMapStyle() : OPEN_FREE_MAP_STYLE_URL,
          center: DEFAULT_MAP_CENTER,
          zoom: isSummary ? -0.5 : DEFAULT_MAP_ZOOM,
          minZoom: isSummary ? -2 : 1,
          maxZoom: 18,
          interactive: true,
          ...(isSummary ? {
            attributionControl: false,
            renderWorldCopies: false,
            dragPan: false,
            scrollZoom: false,
            boxZoom: false,
            doubleClickZoom: false,
            keyboard: false,
            touchZoomRotate: false,
          } : {}),
          // Interactive mode keeps MapLibre's default attribution; summary mode uses only local public-domain boundaries.
          dragRotate: false,
          pitchWithRotate: false,
        });
        mapRef.current = map;
        if (!isSummary) map.addControl(new maplibre.NavigationControl({ showCompass: false, showZoom: true }), "top-right");
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
  }, [isSummary]);

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
    if (!mapReady || !map) return;
    let cancelled = false;
    let removeHoverHandlers: (() => void) | null = null;

    loadCountryBoundaries()
      .then((boundaries) => {
        if (cancelled) return;
        const shadedCountries = buildShadedCountryCollection(boundaries, groups, isSummary);
        const existingSource = map.getSource(COUNTRY_SHADING_SOURCE_ID) as GeoJSONSource | undefined;

        if (existingSource) {
          existingSource.setData(shadedCountries);
        } else {
          map.addSource(COUNTRY_SHADING_SOURCE_ID, { type: "geojson", data: shadedCountries });
          const firstLabelLayer = map.getStyle().layers?.find((layer) => layer.type === "symbol")?.id;
          map.addLayer({
            id: COUNTRY_SHADING_LAYER_ID,
            type: "fill",
            source: COUNTRY_SHADING_SOURCE_ID,
            paint: {
              "fill-color": [
                "interpolate", ["linear"], ["get", "applicationCount"],
                0, "#eef2ff",
                1, "#c7d2fe",
                10, "#818cf8",
                25, "#4f46e5",
                50, "#1e3a8a",
              ],
              "fill-opacity": isSummary ? 1 : 0.5,
              "fill-outline-color": isSummary ? "#cbd5e1" : "#1d4ed8",
            },
          }, firstLabelLayer);
        }

        if (isSummary) {
          const maplibre = mapLibreModuleRef.current;
          if (!maplibre) return;
          const popup = new maplibre.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: "job-country-popup" });
          const canvas = map.getCanvas();
          const showCountryName = (event: MapLayerMouseEvent) => {
            const properties = event.features?.[0]?.properties as ShadedCountryProperties | undefined;
            if (!properties?.name) return;
            // Keep the hover label focused on geographic identification, as requested.
            popup
              .setLngLat(event.lngLat)
              .setText(properties.name)
              .addTo(map);
            canvas.style.cursor = "pointer";
          };
          const hideCountryName = () => {
            popup.remove();
            canvas.style.cursor = "";
          };

          map.on("mousemove", COUNTRY_SHADING_LAYER_ID, showCountryName);
          map.on("mouseleave", COUNTRY_SHADING_LAYER_ID, hideCountryName);

          removeHoverHandlers = () => {
            map.off("mousemove", COUNTRY_SHADING_LAYER_ID, showCountryName);
            map.off("mouseleave", COUNTRY_SHADING_LAYER_ID, hideCountryName);
            hideCountryName();
          };
        }
      })
      .catch(() => {
        // Boundary shading is progressive enhancement; markers and location details remain fully usable if it fails.
      });

    return () => {
      cancelled = true;
      removeHoverHandlers?.();
    };
  }, [groups, isSummary, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = mapLibreModuleRef.current;
    if (!mapReady || !map || !maplibre) return;

    if (isSummary) {
      // Summary mode is a stable choropleth overview, so it deliberately omits pins and interaction.
      removeMarkerBindings(markerBindingsRef.current);
      markerBindingsRef.current = [];
      map.fitBounds([[-179, -60], [179, 85]], { padding: 10, duration: 0 });
      return;
    }

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
  }, [groups, isSummary, mapReady]);

  useEffect(() => {
    markerBindingsRef.current.forEach(({ key, element }) => {
      setMarkerAppearance(element, key === selectedKey);
    });
  }, [selectedKey]);

  if (isSummary) {
    return (
      <div className="space-y-3">
        <div className="job-locations-map relative aspect-[1.7/1] min-h-[240px] overflow-hidden rounded-lg border border-border/50 bg-muted/30">
          <div
            ref={mapContainerRef}
            data-testid="job-locations-map-canvas"
            role="region"
            aria-label="Applications by country shaded map"
            className="absolute inset-0"
          />
          {!mapReady && !mapError && groups.length > 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60 text-sm text-muted-foreground backdrop-blur-[1px]">Loading country map…</div>
          )}
          {mapError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/90 p-8 text-center">
              <AlertTriangle className="h-8 w-8 text-muted-foreground" />
              <p className="max-w-sm text-sm text-muted-foreground">The country map could not be loaded. Your saved job locations are unchanged.</p>
            </div>
          )}
          {groups.length === 0 && !mapError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 p-8 text-center">
              <MapPin className="h-8 w-8 text-muted-foreground" />
              <p className="max-w-sm text-sm text-muted-foreground">No applications have enough country data to shade the map yet.</p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>Darker countries have more applications</span>
          <span className="tabular-nums">{mappedApplicationCount} mapped application{mappedApplicationCount === 1 ? "" : "s"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <label className="relative block w-full sm:w-72">
          <span className="sr-only">Filter map by country</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={countryFilter}
            onChange={(event) => setCountryFilter(event.target.value)}
            placeholder="Search country..."
            aria-label="Filter map by country"
            className="pl-9"
          />
        </label>
      </div>
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
                <p className="max-w-sm text-sm text-muted-foreground">
                  {countryFilter.trim()
                    ? `No mapped job locations match “${countryFilter.trim()}”.`
                    : "No applications have enough city, country, or coordinate data to place on the map yet."}
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><LocateFixed className="h-3.5 w-3.5" /> {groups.length} location{groups.length === 1 ? "" : "s"}</span>
            <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {mappedApplicationCount} pinned job{mappedApplicationCount === 1 ? "" : "s"}</span>
            {groups.length > 0 && (
              <span className="inline-flex items-center gap-1"><Move className="h-3.5 w-3.5" /> Drag or scroll to explore</span>
            )}
            {groups.length > 0 && (
              <span>Countries are shaded by application volume</span>
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
    </div>
  );
}
