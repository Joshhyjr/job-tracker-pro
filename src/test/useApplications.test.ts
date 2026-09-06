import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadInitialApplications, useApplications } from "@/hooks/useApplications";
import { markSeeded, saveApplications } from "@/lib/storage";
import type { JobApplication } from "@/lib/types";
import type { User } from "firebase/auth";
import * as repository from "@/lib/applicationRepository";

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
  it.each([false, true])("keeps syncing until every concurrent write settles (first fails: %s)", async (failFirst) => {
    markSeeded();
    vi.spyOn(repository, "subscribeApplications").mockImplementation((_uid, onData) => {
      onData([], false);
      return () => undefined;
    });
    vi.spyOn(repository, "mergeLocalApplicationsOnce").mockResolvedValue();
    let finishFirst!: () => void;
    let finishSecond!: () => void;
    const first = new Promise<JobApplication>((resolve, reject) => {
      finishFirst = () => failFirst ? reject(new Error("First save failed")) : resolve(application());
    });
    const second = new Promise<JobApplication>((resolve) => { finishSecond = () => resolve(application()); });
    vi.spyOn(repository, "updateApplication").mockReturnValueOnce(first).mockReturnValueOnce(second);
    const user = { uid: "owner" } as User;
    const { result } = renderHook(() => useApplications(user));
    await waitFor(() => expect(result.current.loading).toBe(false));
    let firstMutation!: Promise<unknown>;
    let secondMutation!: Promise<unknown>;
    act(() => {
      firstMutation = result.current.updateApplication(application()).catch((error) => error);
      secondMutation = result.current.updateApplication(application());
    });
    expect(result.current.syncing).toBe(true);
    await act(async () => { finishFirst(); await firstMutation; });
    // Neither a success nor a failure may hide the remaining pending cloud write.
    expect(result.current.syncing).toBe(true);
    await act(async () => { finishSecond(); await secondMutation; });
    expect(result.current.syncing).toBe(false);
    expect(result.current.syncError).toBe(failFirst ? "First save failed" : "");
  });

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

  it("replaces a saved application in visible state without waiting for a full storage refresh", async () => {
    saveApplications([application({ id: "saved-app", jobTitle: "Original Role" })]);
    const { result } = renderHook(() => useApplications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      // Detail-page saves pass the updated record directly so the route cannot keep rendering stale props.
      result.current.refresh(application({ id: "saved-app", jobTitle: "Updated Role" }));
    });

    expect(result.current.applications).toMatchObject([{ id: "saved-app", jobTitle: "Updated Role" }]);
  });
});
