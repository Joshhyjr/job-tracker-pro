import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDemoApplications } from "@/hooks/useDemoApplications";
import { getApplications, getDemoApplications, markDemoSeeded, saveApplications, saveDemoApplications } from "@/lib/storage";
import type { JobApplication } from "@/lib/types";

function application(overrides: Partial<JobApplication> = {}): JobApplication {
  return {
    id: "demo-app",
    jobTitle: "Demo Engineer",
    companyName: "Sample Company",
    location: "Remote",
    currentStatus: "Applied",
    responseStatus: "Applied",
    followUps: false,
    dateApplied: "2026-07-01",
    notes: "Synthetic demo record",
    followUpDate: "",
    activityLog: [],
    ...overrides,
  };
}

describe("useDemoApplications", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("loads demo records without exposing the owner's local migration store", async () => {
    const ownerRecord = application({ id: "owner-app", companyName: "Private Company" });
    const demoRecord = application({ id: "public-demo", companyName: "Public Sample" });
    saveApplications([ownerRecord]);
    saveDemoApplications([demoRecord]);
    markDemoSeeded();

    const { result } = renderHook(() => useDemoApplications());

    await waitFor(() => expect(result.current.loading).toBe(false));

    // The public shell reads only the dedicated demo namespace, even on the owner's browser.
    expect(result.current.applications).toMatchObject([{ id: "public-demo", companyName: "Public Sample" }]);
    expect(getApplications()).toMatchObject([{ id: "owner-app", companyName: "Private Company" }]);
  });

  it("persists interactive demo edits only in the sandbox namespace", async () => {
    saveApplications([application({ id: "owner-app", companyName: "Private Company" })]);
    saveDemoApplications([application()]);
    markDemoSeeded();

    const { result } = renderHook(() => useDemoApplications());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createApplication({
        jobTitle: "Product Analyst",
        companyName: "Example Studio",
        location: "Halifax, Canada",
        currentStatus: "Interview",
        responseStatus: "Interview",
        followUps: true,
        dateApplied: "2026-07-10",
        notes: "Demo-only edit",
        followUpDate: "2026-07-20",
      });
    });

    // Demo mutations survive refreshes but never change data eligible for owner cloud migration.
    expect(getDemoApplications()).toHaveLength(2);
    expect(getDemoApplications()[0]).toMatchObject({ jobTitle: "Product Analyst", companyName: "Example Studio" });
    expect(getApplications()).toMatchObject([{ id: "owner-app", companyName: "Private Company" }]);
  });
});
