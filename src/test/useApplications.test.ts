import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadInitialApplications } from "@/hooks/useApplications";
import { markSeeded, saveApplications } from "@/lib/storage";
import type { JobApplication } from "@/lib/types";

function application(overrides: Partial<JobApplication> = {}): JobApplication {
  return {
    id: "saved-app",
    jobTitle: "Security Analyst",
    companyName: "Beacon Systems",
    location: "Halifax, Canada",
    currentStatus: "Interview",
    responseStatus: "Interview",
    followUps: true,
    dateApplied: "2026-03-01",
    notes: "",
    followUpDate: "",
    activityLog: [],
    ...overrides,
  };
}

describe("loadInitialApplications", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads saved imported rows before seed data even when the seed flag is missing", async () => {
    const saved = application({ id: "imported-row", companyName: "Imported Co" });
    saveApplications([saved]);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await loadInitialApplications();

    // Persisted rows are the user's workbook state, so they should survive reloads and dev-server restarts.
    expect(result).toMatchObject([{ id: "imported-row", companyName: "Imported Co" }]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps an intentionally empty seeded workspace empty on reload", async () => {
    markSeeded();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await loadInitialApplications();

    // Once bootstrapped, an empty saved list should not be replaced by the bundled sample workbook.
    expect(result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
