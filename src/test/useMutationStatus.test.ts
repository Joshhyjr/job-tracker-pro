import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useMutationStatus } from "@/hooks/useMutationStatus";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("useMutationStatus", () => {
  it("stays syncing until every overlapping mutation settles", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const { result } = renderHook(() => useMutationStatus("Sync failed."));
    let firstResult!: Promise<string>;
    let secondResult!: Promise<string>;

    act(() => {
      // Start both operations before either resolves to reproduce rapid consecutive saves.
      firstResult = result.current.runMutation(() => first.promise);
      secondResult = result.current.runMutation(() => second.promise);
    });
    expect(result.current.syncing).toBe(true);

    await act(async () => {
      first.resolve("first");
      await firstResult;
    });
    // The second save is still pending, so navigation must not claim the workspace is synced.
    expect(result.current.syncing).toBe(true);

    await act(async () => {
      second.resolve("second");
      await secondResult;
    });
    expect(result.current.syncing).toBe(false);
  });

  it("keeps syncing after one overlapping mutation rejects", async () => {
    const failed = deferred<string>();
    const pending = deferred<string>();
    const { result } = renderHook(() => useMutationStatus("Sync failed."));
    let failedResult!: Promise<string>;
    let pendingResult!: Promise<string>;

    act(() => {
      // A failed request must decrement only its own pending slot.
      failedResult = result.current.runMutation(() => failed.promise);
      pendingResult = result.current.runMutation(() => pending.promise);
    });

    await act(async () => {
      failed.reject(new Error("First save failed."));
      await expect(failedResult).rejects.toThrow("First save failed.");
    });
    expect(result.current.syncing).toBe(true);
    expect(result.current.syncError).toBe("First save failed.");

    await act(async () => {
      pending.resolve("saved");
      await pendingResult;
    });
    expect(result.current.syncing).toBe(false);
  });
});
