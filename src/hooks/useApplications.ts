import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import type { JobApplication } from "@/lib/types";
import { createImportBackup, getApplications, loadSeedData, isSeeded, markSeeded, saveApplications } from "@/lib/storage";
import { learnCompanyDomains } from "@/lib/companyLogos";
import {
  acknowledgePendingApplicationSync,
  enqueuePendingApplicationSync,
  getPendingApplicationSync,
  overlayPendingApplications,
} from "@/lib/pendingApplicationSync";
import {
  createApplication,
  deleteApplication,
  mergeLocalApplicationsOnce,
  replaceApplications as replaceCloudApplications,
  subscribeApplications,
  synchronizeCompanyDirectory,
  upsertApplications,
  updateApplication,
} from "@/lib/applicationRepository";

export async function loadInitialApplications(): Promise<JobApplication[]> {
  const savedApplications = getApplications();
  // Prefer the user's persisted workbook rows so a first cloud migration never loses browser data.
  if (savedApplications.length > 0 || isSeeded()) return savedApplications;

  try {
    const seed = await loadSeedData();
    saveApplications(seed);
    markSeeded();
    return seed;
  } catch {
    return [];
  }
}

export function useApplications(user?: User) {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pendingSyncing, setPendingSyncing] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [syncError, setSyncError] = useState("");
  const pendingSyncAttemptRef = useRef<Promise<void> | null>(null);
  const pendingSyncIndicatorTimerRef = useRef<number | undefined>(undefined);
  const pendingSyncRetryTimerRef = useRef<number | undefined>(undefined);

  const startPendingSync = useCallback(function startPendingSyncAttempt() {
    if (!user || pendingSyncAttemptRef.current || !navigator.onLine) return;
    const pendingEntries = getPendingApplicationSync(user.uid);
    if (pendingEntries.length === 0) {
      setPendingSyncCount(0);
      return;
    }

    const additions = pendingEntries.flatMap((entry) => entry.operation === "add" ? [entry.application] : []);
    const updates = pendingEntries.flatMap((entry) => entry.operation === "update" ? [entry.application] : []);
    const additionSyncTokens = new Map(pendingEntries.flatMap((entry) => entry.operation === "add" ? [[entry.application.id, entry.entryId] as const] : []));
    const attemptedEntryIds = pendingEntries.map((entry) => entry.entryId);
    setPendingSyncing(true);
    // Stop presenting a permanent spinner while Firestore internally backs off; the durable pending count remains visible.
    pendingSyncIndicatorTimerRef.current = window.setTimeout(() => setPendingSyncing(false), 8_000);

    const attempt = upsertApplications(user.uid, additions, updates, { additionSyncTokens });
    pendingSyncAttemptRef.current = attempt;
    void attempt
      .then(() => {
        const remaining = acknowledgePendingApplicationSync(user.uid, attemptedEntryIds);
        setPendingSyncCount(remaining.length);
        setSyncError("");
        // Keep confirmed rows visible until the realtime snapshot catches up, while overlaying any newer pending edits.
        setApplications((current) => overlayPendingApplications(current, remaining));
      })
      .catch((error: Error & { code?: string }) => {
        // Quota and offline failures are recoverable because the UID-scoped browser outbox remains authoritative.
        if (error.code === "resource-exhausted" || error.code === "unavailable") {
          if (!pendingSyncRetryTimerRef.current) {
            // A bounded retry avoids tight quota loops while still recovering without another import or page reload.
            pendingSyncRetryTimerRef.current = window.setTimeout(() => {
              pendingSyncRetryTimerRef.current = undefined;
              startPendingSyncAttempt();
            }, 60_000);
          }
        } else {
          setSyncError(error.message || "Pending jobs could not synchronize with Firestore yet.");
        }
      })
      .finally(() => {
        if (pendingSyncIndicatorTimerRef.current) window.clearTimeout(pendingSyncIndicatorTimerRef.current);
        pendingSyncAttemptRef.current = null;
        setPendingSyncing(false);
        const remaining = getPendingApplicationSync(user.uid);
        setPendingSyncCount(remaining.length);
        // A newer local edit queued during this attempt receives its own background synchronization pass.
        if (remaining.some((entry) => !attemptedEntryIds.includes(entry.entryId))) startPendingSyncAttempt();
      });
  }, [user]);

  useEffect(() => {
    let active = true;
    const handleOnline = () => {
      setOffline(false);
      // Connectivity recovery is an opportunity to flush the durable browser outbox.
      startPendingSync();
    };
    const handleOffline = () => setOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (!user) {
      // Local mode remains available to unit tests and non-authenticated component previews only.
      loadInitialApplications().then((initial) => {
        if (active) {
          setApplications(initial);
          setLoading(false);
        }
      });
      return () => {
        active = false;
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }

    const pendingEntries = getPendingApplicationSync(user.uid);
    const cachedApplications = getApplications(user.uid);
    setPendingSyncCount(pendingEntries.length);
    if (cachedApplications.length > 0 || pendingEntries.length > 0) {
      // Render the verified browser cache immediately instead of blocking the workspace on Firestore availability.
      setApplications(overlayPendingApplications(cachedApplications, pendingEntries));
      setLoading(false);
    }

    // Start listening immediately; migration writes flow back through the same realtime subscription.
    const unsubscribe = subscribeApplications(
      user.uid,
      (nextApplications, fromCache) => {
        if (!active) return;
        const currentPendingEntries = getPendingApplicationSync(user.uid);
        const visibleApplications = overlayPendingApplications(nextApplications, currentPendingEntries);
        setApplications(visibleApplications);
        setPendingSyncCount(currentPendingEntries.length);
        // The browser cache is a recoverable local view, including jobs still waiting for cloud acceptance.
        saveApplications(visibleApplications, user.uid);
        setOffline(!navigator.onLine || fromCache);
        setLoading(false);
        setSyncError("");
      },
      (error) => {
        if (!active) return;
        setSyncError(error.message || "Could not synchronize applications.");
        setLoading(false);
      },
    );

    loadInitialApplications()
      .then((localApplications) => {
        const pendingIds = new Set(getPendingApplicationSync(user.uid).map((entry) => entry.application.id));
        // The legacy one-time migration must not bypass the outbox's conflict-safe synchronization contract.
        return mergeLocalApplicationsOnce(user.uid, localApplications.filter((application) => !pendingIds.has(application.id)));
      })
      .catch((error: Error) => {
        if (active) setSyncError(error.message || "Could not migrate local applications.");
      });
    startPendingSync();

    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (pendingSyncRetryTimerRef.current) window.clearTimeout(pendingSyncRetryTimerRef.current);
      pendingSyncRetryTimerRef.current = undefined;
    };
  }, [startPendingSync, user]);

  useEffect(() => {
    // Cache verified employer domains so a company keeps the same logo on rows without a direct link.
    learnCompanyDomains(applications);
  }, [applications]);

  useEffect(() => {
    if (!user || loading || applications.length === 0 || pendingSyncCount > 0) return;
    // Existing free-text records are normalized in place after their safe realtime read completes.
    void synchronizeCompanyDirectory(user.uid, applications).catch((error: Error) => {
      setSyncError(error.message || "Could not synchronize the company directory.");
    });
  }, [applications, loading, pendingSyncCount, user]);

  const runMutation = useCallback(async <T,>(mutation: () => Promise<T>): Promise<T> => {
    setSyncing(true);
    setSyncError("");
    try {
      return await mutation();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cloud synchronization failed.";
      setSyncError(message);
      throw error;
    } finally {
      setSyncing(false);
    }
  }, []);

  return {
    applications,
    loading,
    syncing: syncing || pendingSyncing,
    pendingSyncCount,
    offline,
    syncError,
    refresh: (updatedApplication?: JobApplication) => {
      // Realtime owns production refreshes; this fallback preserves immediate local preview behavior.
      if (updatedApplication) setApplications((current) => current.map((item) => item.id === updatedApplication.id ? updatedApplication : item));
      else if (!user) setApplications(getApplications());
    },
    createApplication: (input: Omit<JobApplication, "id" | "activityLog" | "createdAt" | "updatedAt">) =>
      runMutation(() => createApplication(user!.uid, input)),
    updateApplication: (application: JobApplication) => runMutation(() => updateApplication(user!.uid, application)),
    deleteApplication: (applicationId: string) => runMutation(() => deleteApplication(user!.uid, applicationId)),
    backupApplications: (applicationsToBackup: JobApplication[], fileName: string, mode: "merge" | "replace") => runMutation(async () => {
      // Import recovery stays in the owner's browser so Firestore quota can never block backup creation.
      return createImportBackup(applicationsToBackup, fileName, "owner", mode === "replace" ? "full" : "changes", user!.uid);
    }),
    mergeApplications: async (additions: JobApplication[], updates: JobApplication[]) => {
      const pendingEntries = enqueuePendingApplicationSync(user!.uid, additions, updates);
      setPendingSyncCount(pendingEntries.length);
      setSyncError("");
      setApplications((current) => {
        const visibleApplications = overlayPendingApplications(current, pendingEntries);
        // The local cache and outbox are durable before any background Firestore attempt begins.
        saveApplications(visibleApplications, user!.uid);
        return visibleApplications;
      });
      startPendingSync();
    },
    replaceApplications: (nextApplications: JobApplication[]) => runMutation(() => {
      // A destructive replacement cannot safely overtake local rows that Firestore has not accepted yet.
      if (getPendingApplicationSync(user!.uid).length > 0) {
        throw new Error("Cloud sync is still pending for browser-saved jobs. Replace is unavailable until those jobs are synchronized.");
      }
      return replaceCloudApplications(user!.uid, nextApplications);
    }),
  };
}
