import { useCallback, useEffect, useRef, useState } from "react";
import {
  generateId,
  getDemoApplications,
  isDemoSeeded,
  loadSeedData,
  markDemoSeeded,
  saveDemoApplications,
} from "@/lib/storage";
import { sanitizeActivityLog, sanitizeApplicationInput, sanitizeSingleLineText } from "@/lib/security";
import type { JobApplication } from "@/lib/types";

export async function loadInitialDemoApplications(): Promise<JobApplication[]> {
  const savedApplications = getDemoApplications();
  if (savedApplications.length > 0 || isDemoSeeded()) return savedApplications;

  try {
    // The public seed is synthetic, and its status order must stay isolated from the owner's workspace.
    const seed = await loadSeedData({ persistPreferredOrder: false });
    saveDemoApplications(seed);
    markDemoSeeded();
    return seed;
  } catch {
    return [];
  }
}

function normalizeDemoApplication(application: JobApplication): JobApplication {
  const sanitized = sanitizeApplicationInput(application);
  // Treat demo edits as untrusted browser input while preserving optional application fields.
  return {
    ...application,
    ...sanitized,
    id: sanitizeSingleLineText(application.id) || generateId(),
    createdAt: sanitizeSingleLineText(application.createdAt),
    updatedAt: sanitizeSingleLineText(application.updatedAt),
    activityLog: sanitizeActivityLog(application.activityLog),
  };
}

export function useDemoApplications() {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const applicationsRef = useRef<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");

  const commitApplications = useCallback((nextApplications: JobApplication[]) => {
    // Keep the ref, visible state, and isolated demo storage aligned for rapid consecutive edits.
    applicationsRef.current = nextApplications;
    saveDemoApplications(nextApplications);
    setApplications(nextApplications);
  }, []);

  useEffect(() => {
    let active = true;
    loadInitialDemoApplications().then((initial) => {
      if (!active) return;
      applicationsRef.current = initial;
      setApplications(initial);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const runMutation = useCallback(async <T,>(mutation: () => T | Promise<T>): Promise<T> => {
    setSyncing(true);
    setSyncError("");
    try {
      return await mutation();
    } catch (error) {
      const message = error instanceof Error ? error.message : "The demo workspace could not be updated.";
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
    offline: false,
    syncError,
    createApplication: (input: Omit<JobApplication, "id" | "activityLog" | "createdAt" | "updatedAt">) => runMutation(() => {
      const now = new Date().toISOString();
      const application = normalizeDemoApplication({
        ...sanitizeApplicationInput(input),
        id: generateId(),
        createdAt: now,
        updatedAt: now,
        activityLog: [{ id: generateId(), date: now, type: "note", message: "Application created" }],
      });
      commitApplications([application, ...applicationsRef.current]);
      return application;
    }),
    updateApplication: (application: JobApplication) => runMutation(() => {
      const updated = normalizeDemoApplication({
        ...application,
        createdAt: application.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      commitApplications(applicationsRef.current.map((item) => item.id === updated.id ? updated : item));
      return updated;
    }),
    deleteApplication: (applicationId: string) => runMutation(() => {
      commitApplications(applicationsRef.current.filter((item) => item.id !== applicationId));
    }),
    replaceApplications: (nextApplications: JobApplication[]) => runMutation(() => {
      commitApplications(nextApplications.map(normalizeDemoApplication));
    }),
    resetDemo: () => runMutation(async () => {
      // Reset always returns the public sandbox to the repository's known synthetic dataset.
      const seed = await loadSeedData({ persistPreferredOrder: false });
      markDemoSeeded();
      commitApplications(seed);
    }),
  };
}
