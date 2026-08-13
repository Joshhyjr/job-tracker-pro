import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getLocationEmoji } from "@/lib/locationEmoji";
import Locations from "@/pages/Locations";
import type { JobApplication } from "@/lib/types";

vi.mock("@/components/JobLocationsMap", () => ({
  // Keep this page test focused on the location summary cards.
  JobLocationsMap: ({ variant }: { variant?: string }) => <div data-variant={variant}>Map</div>,
}));
vi.mock("recharts", () => ({
  BarChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => <div data-testid="city-bar-chart" data-points={data.length}>{children}</div>,
  Bar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LabelList: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const application = (id: string, location: string, country?: string): JobApplication => ({
  id,
  jobTitle: "Analyst",
  companyName: "Acme",
  location,
  country,
  currentStatus: "Applied",
  responseStatus: "Awaiting Response",
  followUps: false,
  dateApplied: "2026-08-01",
  notes: "",
  followUpDate: "",
  activityLog: [],
});

describe("Locations", () => {
  it("shows country flags while keeping remote rows out of country rankings", () => {
    render(<Locations applications={[application("1", "Halifax, Canada", "Canada"), application("2", "Remote")]} />);

    expect(screen.getByText("🇨🇦")).toBeInTheDocument();
    expect(screen.getByText("Remote roles").previousElementSibling).toHaveTextContent("1");
    expect(within(screen.getByTestId("locations-top-row")).queryByText("Remote")).not.toBeInTheDocument();
  });

  it("uses a globe for unrecognized location labels", () => {
    // Aliases in the current dataset resolve before the generic fallback.
    expect(getLocationEmoji("UAE")).toBe("🇦🇪");
    expect(getLocationEmoji("Croatia")).toBe("🇭🇷");
    expect(getLocationEmoji("Unknown")).toBe("🌐");
  });

  it("uses the compact map beside the rankings and a full-width city chart below", () => {
    render(<Locations applications={[application("1", "Halifax, Canada", "Canada")]} />);

    // The supplied layout groups country cards together and keeps the city visualization beneath that row.
    const topRow = screen.getByTestId("locations-top-row");
    expect(within(topRow).getByText("Applications by Country")).toBeInTheDocument();
    expect(within(topRow).getByText("Top Countries")).toBeInTheDocument();
    expect(within(topRow).getByText("Map")).toHaveAttribute("data-variant", "summary");
    expect(within(topRow).queryByText("Applications by City (Top 6)")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Applications by city bar chart" })).toContainElement(screen.getByTestId("city-bar-chart"));
  });
});
