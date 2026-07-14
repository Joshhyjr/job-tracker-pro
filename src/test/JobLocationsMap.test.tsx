import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { JobLocationsMap } from "@/components/JobLocationsMap";
import type { JobApplication } from "@/lib/types";

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

describe("JobLocationsMap", () => {
  it("zooms the map canvas in and out while respecting its limits", async () => {
    render(
      <MemoryRouter>
        <JobLocationsMap applications={[mappedApplication]} />
      </MemoryRouter>,
    );

    const mapCanvas = screen.getByTestId("job-locations-map-canvas");
    const zoomIn = screen.getByRole("button", { name: "Zoom in" });
    const zoomOut = screen.getByRole("button", { name: "Zoom out" });

    // Flush the component's asynchronous location enhancement before exercising zoom state.
    await act(async () => undefined);

    // The default full-world view cannot zoom out past 100%.
    expect(mapCanvas).toHaveStyle({ transform: "translate3d(0px, 0px, 0) scale(1)" });
    expect(zoomOut).toBeDisabled();

    fireEvent.click(zoomIn);
    expect(mapCanvas).toHaveStyle({ transform: "translate3d(0px, 0px, 0) scale(1.25)" });
    expect(screen.getByText("125%")).toBeInTheDocument();
    expect(zoomOut).toBeEnabled();

    fireEvent.click(zoomOut);
    expect(mapCanvas).toHaveStyle({ transform: "translate3d(0px, 0px, 0) scale(1)" });

    // Four steps reach the maximum supported scale and disable further zooming.
    for (let step = 0; step < 4; step += 1) fireEvent.click(zoomIn);
    expect(mapCanvas).toHaveStyle({ transform: "translate3d(0px, 0px, 0) scale(2)" });
    expect(screen.getByText("200%")).toBeInTheDocument();
    expect(zoomIn).toBeDisabled();
  });

  it("pans a zoomed map by pointer drag and keeps it within the viewport", async () => {
    render(
      <MemoryRouter>
        <JobLocationsMap applications={[mappedApplication]} />
      </MemoryRouter>,
    );

    const mapViewport = screen.getByTestId("job-locations-map-viewport");
    const mapCanvas = screen.getByTestId("job-locations-map-canvas");
    const zoomIn = screen.getByRole("button", { name: "Zoom in" });
    const zoomOut = screen.getByRole("button", { name: "Zoom out" });

    // A stable viewport size makes the pan boundary deterministic in JSDOM.
    mapViewport.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      width: 800,
      height: 400,
      top: 0,
      right: 800,
      bottom: 400,
      left: 0,
      toJSON: () => ({}),
    });
    await act(async () => undefined);

    // The full-world view has no overflow and therefore does not start a drag.
    fireEvent.pointerDown(mapViewport, { pointerId: 1, button: 0, clientX: 400, clientY: 200 });
    fireEvent.pointerMove(mapViewport, { pointerId: 1, clientX: 500, clientY: 250 });
    fireEvent.pointerUp(mapViewport, { pointerId: 1, clientX: 500, clientY: 250 });
    expect(mapCanvas).toHaveStyle({ transform: "translate3d(0px, 0px, 0) scale(1)" });

    fireEvent.click(zoomIn);
    fireEvent.pointerDown(mapViewport, { pointerId: 2, button: 0, clientX: 400, clientY: 200 });
    fireEvent.pointerMove(mapViewport, { pointerId: 2, clientX: 650, clientY: 350 });
    fireEvent.pointerUp(mapViewport, { pointerId: 2, clientX: 650, clientY: 350 });

    // At 125%, the 800x400 viewport permits at most 100px horizontal and 50px vertical movement.
    expect(mapCanvas).toHaveStyle({ transform: "translate3d(100px, 50px, 0) scale(1.25)" });

    fireEvent.click(zoomOut);
    expect(mapCanvas).toHaveStyle({ transform: "translate3d(0px, 0px, 0) scale(1)" });
  });
});
