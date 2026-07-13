import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import type { JobApplication } from "@/lib/types";
import { getApplications, loadSeedData, isSeeded, markSeeded, saveApplications } from "@/lib/storage";
import {
  createApplication,
  deleteApplication,
  mergeLocalApplicationsOnce,
  replaceApplications,
  subscribeApplications,
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
  const [offline, setOffline] = useState(!navigator.onLine);
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    let active = true;
    const handleOnline = () => setOffline(false);
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

    // Start listening immediately; migration writes flow back through the same realtime subscription.
    const unsubscribe = subscribeApplications(
      user.uid,
      (nextApplications, fromCache) => {
        if (!active) return;
        setApplications(nextApplications);
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
      .then((localApplications) => mergeLocalApplicationsOnce(user.uid, localApplications))
      .catch((error: Error) => {
        if (active) setSyncError(error.message || "Could not migrate local applications.");
      });

    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [user]);

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
    syncing,
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
    replaceApplications: (nextApplications: JobApplication[]) => runMutation(() => replaceApplications(user!.uid, nextApplications)),
  };
}
