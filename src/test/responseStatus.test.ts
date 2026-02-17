import { describe, expect, it } from "vitest";
import { computeStatusBreakdown, normalizeResponseStatus, normalizeResponseStatusList } from "@/lib/responseStatus";
import type { JobApplication } from "@/lib/types";

function app(responseStatus: string): JobApplication {
  return {
    id: Math.random().toString(36),
    jobTitle: "Engineer",
    companyName: "Acme",
    location: "Remote",
    currentStatus: "Applied",
    responseStatus,
    followUps: false,
    dateApplied: "2026-02-01",
    notes: "",
    followUpDate: "",
    activityLog: [],
  };
}

describe("normalizeResponseStatus", () => {
  it("normalizes expected variants", () => {
    expect(normalizeResponseStatus("")).toBe("Applied");
    expect(normalizeResponseStatus(" Offer received ")).toBe("Offer");
    expect(normalizeResponseStatus("Interview ")).toBe("Interview");
    expect(normalizeResponseStatus("interview scheduled")).toBe("Interview");
    expect(normalizeResponseStatus("Rejected")).toBe("Rejected");
    expect(normalizeResponseStatus("No Response")).toBe("No Response");
    expect(normalizeResponseStatus("assessment")).toBe("Assessment");
    expect(normalizeResponseStatus("AUTO-REPLY RECEIVED")).toBe("Auto-reply received");
    expect(normalizeResponseStatus("human reply received")).toBe("Human reply received");
  });
});

describe("computeStatusBreakdown", () => {
  it("applies preferred order and appends unknown statuses alphabetically", () => {
    const applications = [
      app("Interview "),
      app("Offer received"),
      app("Assessment"),
      app("No Response"),
      app("Custom stage"),
    ];
    const preferred = normalizeResponseStatusList(["No Response", "Interview", "Offer received", "Rejected", "Assessment"]);

    expect(computeStatusBreakdown(applications, preferred)).toEqual([
      { key: "No Response", label: "No Response", count: 1 },
      { key: "Interview", label: "Interview", count: 1 },
      { key: "Offer", label: "Offer", count: 1 },
      { key: "Assessment", label: "Assessment", count: 1 },
      { key: "Custom Stage", label: "Custom Stage", count: 1 },
    ]);
  });

  it("defaults blank values to Applied", () => {
    const applications = [app(""), app(" "), app("")];
    expect(computeStatusBreakdown(applications)).toEqual([{ key: "Applied", label: "Applied", count: 3 }]);
  });
});
