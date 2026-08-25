import { beforeEach, describe, expect, it, vi } from "vitest";
import { FALLBACK_PORTFOLIO_CONTENT } from "@/lib/portfolioContent";
import { loadPortfolioContent, savePortfolioContent } from "@/lib/portfolioRepository";

const firestoreMocks = vi.hoisted(() => ({
  getDocFromServer: vi.fn(),
  getDocsFromServer: vi.fn(),
  writeBatch: vi.fn(),
}));

function referencePath(segments: unknown[]) {
  return segments.flatMap((segment) => {
    if (typeof segment === "string") return [segment];
    if (segment && typeof segment === "object" && "path" in segment) return [String(segment.path)];
    return [];
  }).join("/");
}

vi.mock("@/lib/firebase", () => ({
  getFirestoreDatabase: () => ({}),
  isFirebaseConfigured: true,
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((...segments: unknown[]) => ({ path: referencePath(segments) })),
  doc: vi.fn((...segments: unknown[]) => {
    const path = referencePath(segments);
    return { id: String(segments[segments.length - 1]), path };
  }),
  getDocFromServer: firestoreMocks.getDocFromServer,
  getDocsFromServer: firestoreMocks.getDocsFromServer,
  writeBatch: firestoreMocks.writeBatch,
}));

const collectionContent = {
  portfolioInterests: FALLBACK_PORTFOLIO_CONTENT.interests,
  portfolioActivities: FALLBACK_PORTFOLIO_CONTENT.activities,
  portfolioProjects: FALLBACK_PORTFOLIO_CONTENT.projects.map(({ preview: _preview, previewAlt: _previewAlt, ...project }) => project),
  portfolioSkills: FALLBACK_PORTFOLIO_CONTENT.skills,
  portfolioCertifications: FALLBACK_PORTFOLIO_CONTENT.certifications,
};

function snapshot(records: ReadonlyArray<{ id: string }>) {
  return {
    empty: records.length === 0,
    docs: records.map(({ id, ...data }) => ({
      id,
      ref: { id, path: `collection/${id}` },
      data: () => data,
    })),
  };
}

beforeEach(() => {
  firestoreMocks.getDocFromServer.mockReset();
  firestoreMocks.getDocsFromServer.mockReset();
  firestoreMocks.writeBatch.mockReset();
});

describe("portfolio repository", () => {
  it("reconstructs one validated page from all public Firestore collections", async () => {
    firestoreMocks.getDocFromServer.mockResolvedValue({
      exists: () => true,
      data: () => FALLBACK_PORTFOLIO_CONTENT.profile,
    });
    firestoreMocks.getDocsFromServer.mockImplementation(async (reference: { path: keyof typeof collectionContent }) => (
      snapshot(collectionContent[reference.path])
    ));

    const content = await loadPortfolioContent();

    // Local project artwork is restored by stable ID without trusting arbitrary remote image URLs.
    expect(content).toEqual(FALLBACK_PORTFOLIO_CONTENT);
    expect(content?.projects[0].preview).toMatch(/^\/project-screenshots\//);
  });

  it("returns no cloud page when any required collection is incomplete", async () => {
    firestoreMocks.getDocFromServer.mockResolvedValue({
      exists: () => true,
      data: () => FALLBACK_PORTFOLIO_CONTENT.profile,
    });
    firestoreMocks.getDocsFromServer.mockImplementation(async (reference: { path: keyof typeof collectionContent }) => (
      reference.path === "portfolioSkills" ? snapshot([]) : snapshot(collectionContent[reference.path])
    ));

    // The caller can display the complete checked-in fallback instead of mixing page versions.
    await expect(loadPortfolioContent()).resolves.toBeNull();
  });

  it("publishes every page section and removal in one atomic batch", async () => {
    const set = vi.fn();
    const remove = vi.fn();
    const commit = vi.fn().mockResolvedValue(undefined);
    firestoreMocks.getDocsFromServer.mockImplementation(async (reference: { path: string }) => (
      reference.path === "portfolioInterests" ? snapshot([{ id: "stale-interest" }]) : snapshot([])
    ));
    firestoreMocks.writeBatch.mockReturnValue({ set, delete: remove, commit });

    const saved = await savePortfolioContent(FALLBACK_PORTFOLIO_CONTENT);

    const recordCount = Object.values(collectionContent).reduce((total, records) => total + records.length, 0);
    expect(set).toHaveBeenCalledTimes(recordCount + 1);
    expect(remove).toHaveBeenCalledWith(expect.objectContaining({ id: "stale-interest" }));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(saved).toEqual(FALLBACK_PORTFOLIO_CONTENT);
    const projectWrite = set.mock.calls.find(([reference]) => reference.path === "portfolioProjects/job-tracker");
    expect(projectWrite?.[1]).not.toHaveProperty("preview");
    expect(projectWrite?.[1]).not.toHaveProperty("previewAlt");
  });
});
