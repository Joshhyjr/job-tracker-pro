import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadInitialApplications, useApplications } from "@/hooks/useApplications";
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

  it("falls back to an empty workspace when the bundled seed workbook cannot be loaded", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("seed fetch failed"));

    const result = await loadInitialApplications();

    // Startup should stay usable when the sample workbook is missing or temporarily unavailable.
    expect(result).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});

describe("useApplications", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clears the loading state even when bootstrap falls back after a seed-load failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("seed fetch failed"));

    const { result } = renderHook(() => useApplications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // The hook should recover into an empty state instead of leaving the app shell on a loading spinner forever.
    expect(result.current.applications).toEqual([]);
  });
});
