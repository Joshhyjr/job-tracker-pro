import { describe, expect, it } from "vitest";
import {
  buildQuickActionResponseStatuses,
  buildResponseStatusChangeApplication,
  buildEditedApplicationWithStatusHistory,
  buildResponseStatusOptions,
  buildStatusChangeApplication,
  computeStatusBreakdown,
  isInterviewPipelineResponseStatus,
  mapResponseStatusToCurrentStatus,
  normalizeResponseStatus,
  normalizeResponseStatusList,
  syncEditedResponseStatus,
} from "@/lib/responseStatus";
import { RESPONSE_STATUSES, type JobApplication } from "@/lib/types";

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
    expect(normalizeResponseStatus("hold")).toBe("On Hold");
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

describe("buildStatusChangeApplication", () => {
  it("updates both status fields and prepends a status-change entry", () => {
    const updated = buildStatusChangeApplication(
      app("No Response"),
      "Interview",
      "entry-1",
      "2026-06-23T12:00:00.000Z",
    );

    expect(updated).toMatchObject({
      currentStatus: "Interview",
      responseStatus: "Interview",
    });
    expect(updated.activityLog[0]).toEqual({
      id: "entry-1",
      date: "2026-06-23T12:00:00.000Z",
      type: "status_change",
      message: "Status changed from Applied to Interview",
      fromStatus: "Applied",
      toStatus: "Interview",
    });
  });

  it("preserves a custom response status during quick status changes", () => {
    const updated = buildStatusChangeApplication(
      app("Human reply received"),
      "Interview",
      "entry-2",
      "2026-06-29T12:00:00.000Z",
    );

    // Imported or manually curated response stages carry more detail than the coarse current-status enum.
    expect(updated).toMatchObject({
      currentStatus: "Interview",
      responseStatus: "Human reply received",
    });
  });
});

describe("syncEditedResponseStatus", () => {
  it("keeps the paired response status aligned during standard status edits", () => {
    expect(syncEditedResponseStatus("Applied", "Interview", "Applied")).toBe("Interview");
    expect(syncEditedResponseStatus("No Response", "Offer", "No Response")).toBe("Offer");
  });

  it("preserves a deliberate custom response-status override", () => {
    expect(syncEditedResponseStatus("Applied", "Interview", "Human reply received")).toBe("Human reply received");
  });
});

describe("buildResponseStatusOptions", () => {
  it("keeps exact imported custom labels available in edit menus", () => {
    expect(buildResponseStatusOptions("Interview scheduled", RESPONSE_STATUSES)).toContain("Interview scheduled");
    expect(buildResponseStatusOptions("Interview", RESPONSE_STATUSES).filter((status) => status === "Interview")).toHaveLength(1);
  });

  it("includes On Hold in the default response-status options", () => {
    expect(buildResponseStatusOptions("", RESPONSE_STATUSES)).toContain("On Hold");
  });
});

describe("buildQuickActionResponseStatuses", () => {
  it("prefers XLSX-provided statuses when an imported order exists", () => {
    expect(buildQuickActionResponseStatuses(["Custom Stage", "Offer"], RESPONSE_STATUSES, "Applied")).toEqual([
      "Custom Stage",
      "Offer",
    ]);
  });

  it("falls back to defaults including On Hold when no XLSX status list exists", () => {
    expect(buildQuickActionResponseStatuses([], RESPONSE_STATUSES, "Applied")).toContain("On Hold");
  });
});

describe("isInterviewPipelineResponseStatus", () => {
  it("counts pre-screens, assessments, interviews, and offers as pipeline progress", () => {
    expect(isInterviewPipelineResponseStatus("Pre-screen call")).toBe(true);
    expect(isInterviewPipelineResponseStatus("Assessment")).toBe(true);
    expect(isInterviewPipelineResponseStatus("Interview scheduled")).toBe(true);
    expect(isInterviewPipelineResponseStatus("Offer received")).toBe(true);
    expect(isInterviewPipelineResponseStatus("Human reply received")).toBe(false);
    expect(isInterviewPipelineResponseStatus("Applied")).toBe(false);
  });
});

describe("buildResponseStatusChangeApplication", () => {
  it("saves the selected dynamic response status and maps to the closest current status", () => {
    const updated = buildResponseStatusChangeApplication(
      app("Applied"),
      "On Hold",
      "entry-3",
      "2026-07-07T12:00:00.000Z",
    );

    // On Hold remains a dynamic response status while currentStatus stays in the closest fixed bucket.
    expect(updated).toMatchObject({
      currentStatus: "Applied",
      responseStatus: "On Hold",
    });
    expect(updated.activityLog[0]).toMatchObject({
      message: "Status changed from Applied to On Hold",
      fromStatus: "Applied",
      toStatus: "On Hold",
    });
    expect(mapResponseStatusToCurrentStatus("On Hold")).toBe("Applied");
  });
});

describe("buildEditedApplicationWithStatusHistory", () => {
  it("records manual response-stage edits with their previous and next values", () => {
    const previous = app("Interview");
    const updated = buildEditedApplicationWithStatusHistory(
      previous,
      { ...previous, currentStatus: "Applied", responseStatus: "On Hold" },
      "entry-4",
      "2026-07-13T12:00:00.000Z",
    );

    // Manual edits should be indistinguishable from Quick Actions in the visible status timeline.
    expect(updated.activityLog[0]).toMatchObject({
      message: "Status changed from Interview to On Hold",
      fromStatus: "Interview",
      toStatus: "On Hold",
    });
  });

  it("does not add history when an edit leaves both status fields unchanged", () => {
    const previous = app("Interview");

    expect(buildEditedApplicationWithStatusHistory(previous, { ...previous, notes: "Updated" }, "entry-5", "2026-07-13T12:00:00.000Z").activityLog).toEqual([]);
  });
});
