import { useCallback, useRef, useState } from "react";

export function useMutationStatus(fallbackError: string) {
  const pendingCount = useRef(0);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");

  const runMutation = useCallback(async <T,>(mutation: () => T | Promise<T>): Promise<T> => {
    // Every overlapping operation owns one slot; an early completion must not report all writes as saved.
    pendingCount.current += 1;
    setSyncing(true);
    setSyncError("");
    try {
      return await mutation();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : fallbackError);
      throw error;
    } finally {
      pendingCount.current -= 1;
      setSyncing(pendingCount.current > 0);
    }
  }, [fallbackError]);

  return { syncing, syncError, setSyncError, runMutation };
}
