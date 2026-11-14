import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTransfer, parseTransfer, restoreTransfer } from "@/lib/localTransfer";

const owner = "owner-a";
const document = { id: "doc", name: "resume.pdf", category: "Resumes", size: 1, updatedAt: "2026-11-14", dataUrl: "data:application/pdf;base64,AA==" };

// Exercise durable storage and identity failures rather than mirroring implementation internals.
describe("local transfer", () => {
  beforeEach(() => localStorage.clear());
  it("round trips known data without credentials or another owner's files", () => {
    localStorage.setItem(`job-tracker-documents-v2:owner:${owner}`, JSON.stringify([document]));
    localStorage.setItem("job-tracker-documents-v2:owner:other", JSON.stringify([document]));
    localStorage.setItem("firebase:authUser:secret", "credential");
    localStorage.setItem("unrelated", "private");
    localStorage.setItem("theme", "dark");
    const backup = parseTransfer(JSON.stringify(createTransfer(localStorage, owner)));
    expect(Object.keys(backup.entries).sort()).toEqual([`job-tracker-documents-v2:owner:${owner}`, "theme"]);
    localStorage.clear();
    restoreTransfer(backup, localStorage, owner);
    expect(localStorage.getItem(`job-tracker-documents-v2:owner:${owner}`)).toBe(JSON.stringify([document]));
  });
  it("excludes legacy private data while signed out and requires the matching owner to restore", () => {
    localStorage.setItem("job-tracker-documents-v1", JSON.stringify([document]));
    expect(createTransfer(localStorage).entries).toEqual({});
    const backup = createTransfer(localStorage, owner);
    expect(() => restoreTransfer(backup, localStorage)).toThrow(/sign in/i);
    expect(() => restoreTransfer(backup, localStorage, "other")).toThrow(/same owner/i);
  });
  it("rejects unknown keys, versions and malformed documents", () => {
    const backup = createTransfer(localStorage, owner);
    expect(() => parseTransfer(JSON.stringify({ ...backup, version: 99 }))).toThrow();
    expect(() => parseTransfer(JSON.stringify({ ...backup, entries: { token: "secret" } }))).toThrow();
    expect(() => parseTransfer(JSON.stringify({ ...backup, entries: { "job-tracker-documents-v1": "[{}]" } }))).toThrow();
    expect(() => parseTransfer("not json")).toThrow();
  });
  it("restores replaced destination values after a failed write", () => {
    localStorage.setItem("theme", "dark");
    localStorage.setItem("job-tracker-demo-seeded", "true");
    const backup = createTransfer(localStorage);
    localStorage.setItem("theme", "light");
    localStorage.removeItem("job-tracker-demo-seeded");
    const original = localStorage.setItem.bind(localStorage);
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
      if (key === "job-tracker-demo-seeded") throw new Error("quota");
      original(key, value);
    });
    expect(() => restoreTransfer(backup, localStorage)).toThrow(/restored/i);
    spy.mockRestore();
    expect(localStorage.getItem("theme")).toBe("light");
    expect(localStorage.getItem("job-tracker-demo-seeded")).toBeNull();
  });
});

it("maps legacy documents to the authenticated owner namespace", () => {
  localStorage.clear();
  localStorage.setItem("job-tracker-documents-v1", JSON.stringify([document]));
  const backup = createTransfer(localStorage, owner);
  expect(backup.entries["job-tracker-documents-v1"]).toBeUndefined();
  expect(backup.entries[`job-tracker-documents-v2:owner:${owner}`]).toBe(JSON.stringify([document]));
  expect(localStorage.getItem("job-tracker-documents-v1")).not.toBeNull();
});

it("retains distinct legacy and scoped documents in one replacement preview", () => {
  localStorage.clear();
  localStorage.setItem("job-tracker-documents-v1", JSON.stringify([{ ...document, id: "legacy" }]));
  localStorage.setItem(`job-tracker-documents-v2:owner:${owner}`, JSON.stringify([document]));
  const backup = createTransfer(localStorage, owner);
  expect(JSON.parse(backup.entries[`job-tracker-documents-v2:owner:${owner}`]).map((item: { id: string }) => item.id).sort()).toEqual(["doc", "legacy"]);
});

it("rejects oversized transfers and invalid preferences", () => {
  localStorage.clear();
  const backup = createTransfer(localStorage);
  expect(() => parseTransfer(JSON.stringify({ ...backup, entries: { theme: "invalid" } }))).toThrow();
  expect(() => parseTransfer(" ".repeat(20 * 1024 * 1024 + 1))).toThrow(/20 MB/);
});

it("does not accept silently dropped writes as successful imports", () => {
  localStorage.clear();
  localStorage.setItem("theme", "dark");
  const backup = createTransfer(localStorage);
  localStorage.setItem("theme", "light");
  const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
  expect(() => restoreTransfer(backup, localStorage)).toThrow(/restored/);
  spy.mockRestore();
  expect(localStorage.getItem("theme")).toBe("light");
});
