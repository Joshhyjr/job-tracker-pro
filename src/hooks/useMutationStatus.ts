import { useCallback, useRef, useState } from "react";

export function useMutationStatus(fallbackErrorMessage: string) {
  const pendingMutations = useRef(0);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");

  const runMutation = useCallback(async <T,>(mutation: () => T | Promise<T>): Promise<T> => {
    // Count overlapping writes so one completion cannot report a fully synced workspace too early.
    pendingMutations.current += 1;
    setSyncing(true);
    setSyncError("");

    try {
      return await mutation();
    } catch (error) {
      const message = error instanceof Error ? error.message : fallbackErrorMessage;
      setSyncError(message);
      throw error;
    } finally {
      pendingMutations.current = Math.max(0, pendingMutations.current - 1);
      if (pendingMutations.current === 0) setSyncing(false);
    }
  }, [fallbackErrorMessage]);

  return { syncing, syncError, setSyncError, runMutation };
}
