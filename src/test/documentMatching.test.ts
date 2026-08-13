import { describe, expect, it } from "vitest";
import {
  buildApplicationDocumentAttachment,
  findDocumentApplicationMatch,
  getDocumentSelectionError,
  inferDocumentCategory,
} from "@/lib/documentMatching";
import type { JobApplication } from "@/lib/types";

function application(id: string, companyName: string, jobTitle: string): JobApplication {
  return {
    id,
    companyName,
    jobTitle,
    location: "Halifax, NS",
    currentStatus: "Applied",
    responseStatus: "Applied",
    followUps: false,
    dateApplied: "2026-08-12",
    notes: "",
    followUpDate: "",
    activityLog: [],
  };
}

describe("document filename matching", () => {
  it("matches a company named in a resume or cover-letter filename", () => {
    const mariner = application("mariner", "Mariner", "Data Analyst");
    const other = application("other", "Acme Health", "Data Analyst");

    // Document labels do not affect the company-token match.
    expect(findDocumentApplicationMatch("Josh - Mariner - Cover Letter.pdf", [other, mariner])).toEqual({ status: "matched", application: mariner });
    expect(findDocumentApplicationMatch("Mariner_Resume.docx", [other, mariner])).toEqual({ status: "matched", application: mariner });
  });

  it("uses job-title words to distinguish applications at the same company", () => {
    const analyst = application("analyst", "Mariner Innovations", "Data Analyst");
    const support = application("support", "Mariner Innovations", "Technical Support Specialist");

    // A company-only filename is deliberately ambiguous, while a role-specific name is safe to attach.
    expect(findDocumentApplicationMatch("Mariner Cover Letter.pdf", [analyst, support])).toEqual({ status: "ambiguous" });
    expect(findDocumentApplicationMatch("Mariner Data Analyst Cover Letter.pdf", [analyst, support])).toEqual({ status: "matched", application: analyst });
  });

  it("does not guess when no distinctive company term is present", () => {
    expect(findDocumentApplicationMatch("General Resume.pdf", [application("one", "The Company Inc", "Analyst")])).toEqual({ status: "none" });
  });

  it("infers common document types from the filename", () => {
    expect(inferDocumentCategory("Mariner Cover Letter.pdf", "Resumes")).toBe("Cover letters");
    expect(inferDocumentCategory("Mariner CV.pdf", "Other files")).toBe("Resumes");
  });

  it("allows one resume and one cover letter in a manual attachment batch", () => {
    const files = [
      { id: "resume", name: "Mariner Resume.pdf", category: "Resumes" as const },
      { id: "cover", name: "Mariner Cover Letter.pdf", category: "Cover letters" as const },
    ];

    expect(getDocumentSelectionError(files)).toBeNull();
    expect(getDocumentSelectionError([...files, { id: "resume-2", name: "Other Resume.pdf", category: "Resumes" }])).toMatch(/at most one resume/);

    const result = buildApplicationDocumentAttachment(application("mariner", "Mariner", "Data Analyst"), files, "2026-08-12T12:00:00.000Z", () => crypto.randomUUID());
    expect(result).toEqual(expect.objectContaining({
      status: "updated",
      application: expect.objectContaining({
        customFields: {
          "Resume Used": "Mariner Resume.pdf",
          "Cover Letter Used": "Mariner Cover Letter.pdf",
        },
      }),
    }));
  });

  it("refuses to overwrite a different existing document during manual attachment", () => {
    const mariner = { ...application("mariner", "Mariner", "Data Analyst"), customFields: { "Resume Used": "Original Resume.pdf" } };
    const result = buildApplicationDocumentAttachment(
      mariner,
      [{ id: "resume", name: "Replacement Resume.pdf", category: "Resumes" }],
      "2026-08-12T12:00:00.000Z",
      () => "activity",
    );

    expect(result).toEqual({ status: "conflict", field: "Resume Used", existingName: "Original Resume.pdf" });
  });
});
