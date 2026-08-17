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

  it("removes rejected URL fields from demo updates without dropping unrelated data", async () => {
    saveDemoApplications([application({
      jobLink: "https://jobs.example/demo",
      companyLogoUrl: "https://cdn.example/logo.png",
      salary: "$120k",
      customFields: { Portfolio: "Keep this field" },
      createdAt: "2026-08-10T10:00:00.000Z",
    })]);
    markDemoSeeded();
    const { result } = renderHook(() => useDemoApplications());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let updated: JobApplication | undefined;
    await act(async () => {
      updated = await result.current.updateApplication({
        ...result.current.applications[0],
        jobLink: "javascript:alert(document.domain)",
        companyLogoUrl: "data:image/svg+xml,<svg onload='alert(1)' />",
        salary: "$125k",
        customFields: { Portfolio: "Still present" },
      });
    });

    const [stored] = JSON.parse(localStorage.getItem("job-tracker-demo-data") || "[]") as JobApplication[];
    // Return value, visible state, and raw demo persistence must all exclude sanitizer-rejected URLs.
    [updated, result.current.applications[0], stored].forEach((record) => {
      expect(record).not.toHaveProperty("jobLink");
      expect(record).not.toHaveProperty("companyLogoUrl");
      expect(record).toMatchObject({
        salary: "$125k",
        customFields: { Portfolio: "Still present" },
        createdAt: "2026-08-10T10:00:00.000Z",
        notes: "Synthetic demo record",
      });
    });
  });

  it("merges signed-out spreadsheet changes without replacing current demo jobs", async () => {
    const ibm = application({ id: "ibm-job", companyName: "IBM" });
    const apple = application({ id: "apple-job", companyName: "Apple", dateApplied: "2026-08-05" });
    saveDemoApplications([ibm]);
    markDemoSeeded();

    const { result } = renderHook(() => useDemoApplications());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.mergeApplications([apple]);
    });

    // The demo merge contract mirrors owner imports: IBM remains and Apple is appended locally.
    expect(result.current.applications).toMatchObject([{ companyName: "IBM" }, { companyName: "Apple" }]);
    expect(getDemoApplications()).toMatchObject([{ companyName: "IBM" }, { companyName: "Apple" }]);
  });

  it("replaces signed-out demo jobs only after the replacement action is selected", async () => {
    const ibm = application({ id: "ibm-job", companyName: "IBM" });
    const apple = application({ id: "apple-job", companyName: "Apple", dateApplied: "2026-08-05" });
    saveApplications([application({ id: "owner-job", companyName: "Private Company" })]);
    saveDemoApplications([ibm]);
    markDemoSeeded();

    const { result } = renderHook(() => useDemoApplications());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.replaceApplications([apple]);
    });

    // Replacement is scoped to the public sandbox; the private owner namespace remains unchanged.
    expect(result.current.applications).toMatchObject([{ companyName: "Apple" }]);
    expect(getDemoApplications()).toMatchObject([{ companyName: "Apple" }]);
    expect(getApplications()).toMatchObject([{ companyName: "Private Company" }]);
  });

  it("rejects duplicate replacement IDs without changing the demo dataset", async () => {
    const current = application({ id: "current-job", companyName: "IBM" });
    saveDemoApplications([current]);
    markDemoSeeded();

    const { result } = renderHook(() => useDemoApplications());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const beforeReplacement = result.current.applications;

    await act(async () => {
      await expect(result.current.replaceApplications([
        application({ id: "duplicate-id", companyName: "Apple" }),
        application({ id: " duplicate-id ", companyName: "Microsoft" }),
      ])).rejects.toThrow("duplicate Application IDs");
    });

    // Direct hook callers receive the same protection as owner imports, with no local overwrite or row coupling.
    expect(result.current.applications).toEqual(beforeReplacement);
    expect(getDemoApplications()).toEqual(beforeReplacement);
    expect(result.current.syncError).toContain("duplicate Application IDs");
  });
});
