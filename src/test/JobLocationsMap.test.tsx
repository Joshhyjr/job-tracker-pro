import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JobLocationsMap } from "@/components/JobLocationsMap";
import type { JobApplication } from "@/lib/types";

const mapLibreMocks = vi.hoisted(() => ({
  maps: [] as Array<{
    options: Record<string, unknown>;
    container: HTMLElement;
    addControl: ReturnType<typeof vi.fn>;
    easeTo: ReturnType<typeof vi.fn>;
    fitBounds: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    addSource: ReturnType<typeof vi.fn>;
    addLayer: ReturnType<typeof vi.fn>;
    sources: Map<string, { setData: ReturnType<typeof vi.fn> }>;
  }>,
  markers: [] as Array<{
    element: HTMLButtonElement;
    coordinates: [number, number] | null;
    remove: ReturnType<typeof vi.fn>;
  }>,
  autoLoad: true,
  initialErrorListeners: [] as Array<() => void>,
  layerListeners: new Map<string, (event: Record<string, unknown>) => void>(),
  popups: [] as Array<{
    text: string;
    coordinates: unknown;
    addTo: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("maplibre-gl", () => {
  class MockMap {
    options: Record<string, unknown>;
    container: HTMLElement;
    addControl = vi.fn();
    easeTo = vi.fn();
    fitBounds = vi.fn();
    remove = vi.fn();
    sources = new globalThis.Map<string, { setData: ReturnType<typeof vi.fn> }>();
    layers = new globalThis.Map<string, Record<string, unknown>>();
    addSource = vi.fn((id: string, source: Record<string, unknown>) => {
      this.sources.set(id, { ...source, setData: vi.fn() } as { setData: ReturnType<typeof vi.fn> });
    });
    getSource = vi.fn((id: string) => this.sources.get(id));
    addLayer = vi.fn((layer: Record<string, unknown>) => this.layers.set(layer.id as string, layer));
    getLayer = vi.fn((id: string) => this.layers.get(id));
    getStyle = vi.fn(() => ({ layers: [{ id: "place-labels", type: "symbol" }] }));
    touchZoomRotate = { disableRotation: vi.fn() };

    getCanvas = vi.fn(() => this.container);

    on(event: string, layerOrCallback: string | (() => void), callback?: (event: Record<string, unknown>) => void) {
      if (event === "error" && typeof layerOrCallback === "function") mapLibreMocks.initialErrorListeners.push(layerOrCallback);
      if (typeof layerOrCallback === "string" && callback) mapLibreMocks.layerListeners.set(`${event}:${layerOrCallback}`, callback);
      return this;
    }

    off(event: string, layerOrCallback: string | (() => void), callback?: (event: Record<string, unknown>) => void) {
      if (event === "error" && typeof layerOrCallback === "function") {
        const listenerIndex = mapLibreMocks.initialErrorListeners.indexOf(layerOrCallback);
        if (listenerIndex >= 0) mapLibreMocks.initialErrorListeners.splice(listenerIndex, 1);
      }
      if (typeof layerOrCallback === "string" && callback) mapLibreMocks.layerListeners.delete(`${event}:${layerOrCallback}`);
      return this;
    }

    constructor(options: Record<string, unknown>) {
      this.options = options;
      this.container = options.container as HTMLElement;
      mapLibreMocks.maps.push(this);
    }

    once(event: string, callback: () => void) {
      // MapLibre's load event is asynchronous; mirror that timing so React effects settle naturally.
      if (event === "load" && mapLibreMocks.autoLoad) queueMicrotask(callback);
      return this;
    }
  }

  class MockMarker {
    element: HTMLButtonElement;
    coordinates: [number, number] | null = null;
    remove = vi.fn(() => this.element.remove());

    constructor(options: { element: HTMLButtonElement }) {
      this.element = options.element;
      // Mirror the positioning classes that the real Marker constructor owns and app state must preserve.
      this.element.classList.add("maplibregl-marker", "maplibregl-marker-anchor-center");
      mapLibreMocks.markers.push(this);
    }

    setLngLat(coordinates: [number, number]) {
      this.coordinates = coordinates;
      return this;
    }

    addTo(map: MockMap) {
      map.container.appendChild(this.element);
      return this;
    }
  }

  class MockNavigationControl {
    options: Record<string, unknown>;

    constructor(options: Record<string, unknown>) {
      this.options = options;
    }
  }

  class MockPopup {
    text = "";
    coordinates: unknown = null;
    addTo = vi.fn(() => this);
    remove = vi.fn(() => this);

    constructor() {
      mapLibreMocks.popups.push(this);
    }

    setLngLat(coordinates: unknown) {
      this.coordinates = coordinates;
      return this;
    }

    setText(text: string) {
      this.text = text;
      return this;
    }
  }

  class MockLngLatBounds {
    coordinates: Array<[number, number]> = [];

    extend(coordinates: [number, number]) {
      this.coordinates.push(coordinates);
      return this;
    }
  }

  return {
    Map: MockMap,
    Marker: MockMarker,
    NavigationControl: MockNavigationControl,
    Popup: MockPopup,
    LngLatBounds: MockLngLatBounds,
  };
});

const mappedApplication: JobApplication = {
  id: "application-1",
  jobTitle: "Frontend Engineer",
  companyName: "Example Company",
  location: "Halifax, Canada",
  latitude: 44.6488,
  longitude: -63.5752,
  currentStatus: "Applied",
  responseStatus: "Applied",
  followUps: false,
  dateApplied: "2026-07-01",
  notes: "",
  followUpDate: "",
  activityLog: [],
};

const londonApplication: JobApplication = {
  ...mappedApplication,
  id: "application-2",
  companyName: "London Company",
  location: "London, United Kingdom",
  latitude: 51.5072,
  longitude: -0.1276,
};

describe("JobLocationsMap", () => {
  beforeEach(() => {
    mapLibreMocks.maps.length = 0;
    mapLibreMocks.markers.length = 0;
    mapLibreMocks.autoLoad = true;
    mapLibreMocks.initialErrorListeners.length = 0;
    mapLibreMocks.layerListeners.clear();
    mapLibreMocks.popups.length = 0;
    // A compact fixture keeps the test focused on data-driven country matching rather than boundary complexity.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        type: "FeatureCollection",
        features: [
          { type: "Feature", properties: { iso3: "CAN", name: "Canada" }, geometry: { type: "MultiPolygon", coordinates: [[[[-140, 60], [-60, 60], [-60, 40], [-140, 40], [-140, 60]]]] } },
          { type: "Feature", properties: { iso3: "GBR", name: "United Kingdom" }, geometry: { type: "MultiPolygon", coordinates: [[[[-8, 59], [2, 59], [2, 50], [-8, 50], [-8, 59]]]] } },
        ],
      }),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses MapLibre with the free OpenFreeMap style and native controls", async () => {
    const { unmount } = render(
      <MemoryRouter>
        <JobLocationsMap applications={[mappedApplication]} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mapLibreMocks.maps).toHaveLength(1));
    const map = mapLibreMocks.maps[0];

    expect(map.options).toMatchObject({
      style: "https://tiles.openfreemap.org/styles/liberty",
      dragRotate: false,
      pitchWithRotate: false,
    });
    // MapLibre v5 enables its standards-compliant attribution by default without a boolean option.
    expect(map.options).not.toHaveProperty("attributionControl");
    expect(map.addControl).toHaveBeenCalledOnce();
    await waitFor(() => expect(map.addSource).toHaveBeenCalledWith(
      "job-country-shading",
      expect.objectContaining({ type: "geojson" }),
    ));
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: "job-country-shading-fill", type: "fill" }),
      "place-labels",
    );
    const halifaxMarker = await screen.findByRole("button", { name: "Halifax, Canada, 1 application" });
    expect(halifaxMarker).toHaveClass("maplibregl-marker", "maplibregl-marker-anchor-center");
    expect(mapLibreMocks.markers.some((marker) => marker.coordinates?.[0] === -63.5752 && marker.coordinates?.[1] === 44.6488)).toBe(true);
    expect(map.easeTo).toHaveBeenCalledWith(expect.objectContaining({ center: [-63.5752, 44.6488], zoom: 6 }));
    expect(screen.getByText("Drag or scroll to explore")).toBeInTheDocument();

    unmount();
    expect(map.remove).toHaveBeenCalledOnce();
  });

  it("fits multiple locations and keeps marker selection connected to the details panel", async () => {
    render(
      <MemoryRouter>
        <JobLocationsMap applications={[mappedApplication, londonApplication]} />
      </MemoryRouter>,
    );

    const londonMarker = await screen.findByRole("button", { name: "London, United Kingdom, 1 application" });
    const map = mapLibreMocks.maps[0];
    await waitFor(() => expect(map.fitBounds).toHaveBeenCalled());

    fireEvent.click(londonMarker);
    expect(screen.getByText("London, United Kingdom")).toBeInTheDocument();
    expect(screen.getByText("London Company")).toBeInTheDocument();
    expect(londonMarker).toHaveAttribute("aria-pressed", "true");
  });

  it("renders summary mode as a static shaded world map without markers or controls", async () => {
    render(
      <MemoryRouter>
        <JobLocationsMap applications={[mappedApplication, londonApplication]} variant="summary" />
      </MemoryRouter>,
    );

    const mapRegion = screen.getByRole("region", { name: "Applications by country shaded map" });
    expect(mapRegion).toBeInTheDocument();
    await waitFor(() => expect(mapLibreMocks.maps).toHaveLength(1));
    const map = mapLibreMocks.maps[0];
    expect(map.options).toMatchObject({
      interactive: true,
      zoom: -0.5,
      minZoom: -2,
      renderWorldCopies: false,
      attributionControl: false,
      dragPan: false,
      scrollZoom: false,
      boxZoom: false,
      doubleClickZoom: false,
      keyboard: false,
      touchZoomRotate: false,
    });
    expect(map.options.style).toEqual(expect.objectContaining({
      version: 8,
      layers: [expect.objectContaining({ id: "summary-map-background", type: "background" })],
    }));
    expect(map.options.style).not.toBe("https://tiles.openfreemap.org/styles/liberty");
    expect(map.addControl).not.toHaveBeenCalled();
    expect(mapLibreMocks.markers).toHaveLength(0);
    await waitFor(() => expect(map.addSource).toHaveBeenCalledWith(
      "job-country-shading",
      expect.objectContaining({ type: "geojson" }),
    ));
    const source = map.addSource.mock.calls.find(([id]) => id === "job-country-shading")?.[1] as { data: { features: unknown[] } };
    expect(source.data.features).toHaveLength(2);
    expect(map.fitBounds).toHaveBeenCalledWith([[-179, -60], [179, 85]], { padding: 10, duration: 0 });
    expect(screen.queryByRole("searchbox", { name: "Filter map by country" })).not.toBeInTheDocument();
    expect(screen.getByText("Darker countries have more applications")).toBeInTheDocument();

    const hoverCountry = mapLibreMocks.layerListeners.get("mousemove:job-country-shading-fill");
    expect(hoverCountry).toBeDefined();
    hoverCountry?.({
      lngLat: { lng: -100, lat: 60 },
      features: [{ properties: { name: "Canada", applicationCount: 1 } }],
    });
    expect(mapLibreMocks.popups[0]).toMatchObject({ text: "Canada", coordinates: { lng: -100, lat: 60 } });
    expect(mapLibreMocks.popups[0].addTo).toHaveBeenCalledWith(map);
    expect(map.container.style.cursor).toBe("pointer");

    mapLibreMocks.layerListeners.get("mouseleave:job-country-shading-fill")?.({});
    expect(mapLibreMocks.popups[0].remove).toHaveBeenCalled();
    expect(map.container.style.cursor).toBe("");
  });

  it("filters map pins and details by country search", async () => {
    render(
      <MemoryRouter>
        <JobLocationsMap applications={[mappedApplication, londonApplication]} />
      </MemoryRouter>,
    );

    await screen.findByRole("button", { name: "London, United Kingdom, 1 application" });
    const countrySearch = screen.getByRole("searchbox", { name: "Filter map by country" });

    // Country filtering updates the visible marker set and selected details together.
    fireEvent.change(countrySearch, { target: { value: "Canada" } });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "London, United Kingdom, 1 application" })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Halifax, Canada, 1 application" })).toBeInTheDocument();
    expect(screen.getByText("Halifax, Canada")).toBeInTheDocument();
    expect(screen.queryByText("London Company")).not.toBeInTheDocument();
    const shadingSource = mapLibreMocks.maps[0].sources.get("job-country-shading");
    await waitFor(() => expect(shadingSource?.setData).toHaveBeenCalled());
    const latestShading = shadingSource?.setData.mock.calls.at(-1)?.[0];
    expect(latestShading.features).toEqual([
      expect.objectContaining({ properties: expect.objectContaining({ name: "Canada", applicationCount: 1 }) }),
    ]);

    fireEvent.change(countrySearch, { target: { value: "Japan" } });
    expect(screen.getByText("No mapped job locations match “Japan”.")).toBeInTheDocument();
  });

  it("replaces the loading overlay when MapLibre reports an initial error", async () => {
    mapLibreMocks.autoLoad = false;
    render(
      <MemoryRouter>
        <JobLocationsMap applications={[mappedApplication]} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mapLibreMocks.initialErrorListeners).toHaveLength(1));
    expect(screen.getByText("Loading detailed map…")).toBeInTheDocument();

    // CSP, worker, and style-fetch failures arrive asynchronously through MapLibre's error event.
    act(() => mapLibreMocks.initialErrorListeners[0]());

    expect(screen.queryByText("Loading detailed map…")).not.toBeInTheDocument();
    expect(screen.getByText("The detailed map could not be loaded. Your saved job locations are unchanged.")).toBeInTheDocument();
  });
});
