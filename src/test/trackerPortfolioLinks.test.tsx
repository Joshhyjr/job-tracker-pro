import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import AppNavbar from "@/components/AppNavbar";
import JobTrackerSidebar from "@/components/JobTrackerSidebar";

// Simulate the production tracker hostname for every desktop and mobile portfolio escape link.
vi.mock("@/lib/siteDomains", async (original) => {
  const actual = await original<typeof import("@/lib/siteDomains")>();
  return { ...actual, portfolioUrl: () => actual.portfolioUrl("job-tracker-pro-joshhyjr-s-projects.vercel.app") };
});

it("links navbar, mobile menu and sidebar back to the portfolio domain", () => {
  const actions = { onExportCSV: vi.fn(), onExportXLSX: vi.fn(), onImportXLSX: vi.fn() };
  render(<MemoryRouter initialEntries={["/app"]}>
    <AppNavbar {...actions} mode="demo" syncing={false} offline={false} />
    <JobTrackerSidebar {...actions} />
  </MemoryRouter>);
  expect(screen.getByRole("link", { name: "JK.space" })).toHaveAttribute("href", "https://www.jkivaria.com/");
  fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
  for (const link of screen.getAllByRole("link", { name: "Back to JK.space" })) {
    expect(link).toHaveAttribute("href", "https://www.jkivaria.com/");
  }
});
