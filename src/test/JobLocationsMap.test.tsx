import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  }>,
  markers: [] as Array<{
    element: HTMLButtonElement;
    coordinates: [number, number] | null;
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
    touchZoomRotate = { disableRotation: vi.fn() };

    constructor(options: Record<string, unknown>) {
      this.options = options;
      this.container = options.container as HTMLElement;
      mapLibreMocks.maps.push(this);
    }

    once(event: string, callback: () => void) {
      // MapLibre's load event is asynchronous; mirror that timing so React effects settle naturally.
      if (event === "load") queueMicrotask(callback);
      return this;
    }
  }

  class MockMarker {
    element: HTMLButtonElement;
    coordinates: [number, number] | null = null;
    remove = vi.fn(() => this.element.remove());

    constructor(options: { element: HTMLButtonElement }) {
      this.element = options.element;
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
      attributionControl: true,
      dragRotate: false,
      pitchWithRotate: false,
    });
    expect(map.addControl).toHaveBeenCalledOnce();
    expect(await screen.findByRole("button", { name: "Halifax, Canada, 1 application" })).toBeInTheDocument();
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
});
