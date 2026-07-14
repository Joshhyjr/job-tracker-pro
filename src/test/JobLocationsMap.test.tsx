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
    expect(mapCanvas).toHaveStyle({ transform: "scale(1)" });
    expect(zoomOut).toBeDisabled();

    fireEvent.click(zoomIn);
    expect(mapCanvas).toHaveStyle({ transform: "scale(1.25)" });
    expect(screen.getByText("125%")).toBeInTheDocument();
    expect(zoomOut).toBeEnabled();

    fireEvent.click(zoomOut);
    expect(mapCanvas).toHaveStyle({ transform: "scale(1)" });

    // Four steps reach the maximum supported scale and disable further zooming.
    for (let step = 0; step < 4; step += 1) fireEvent.click(zoomIn);
    expect(mapCanvas).toHaveStyle({ transform: "scale(2)" });
    expect(screen.getByText("200%")).toBeInTheDocument();
    expect(zoomIn).toBeDisabled();
  });
});
