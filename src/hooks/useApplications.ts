import { useState, useEffect, useCallback } from "react";
import type { JobApplication } from "@/lib/types";
import { getApplications, saveApplications, loadSeedData, isSeeded, markSeeded } from "@/lib/storage";

export async function loadInitialApplications(): Promise<JobApplication[]> {
  const savedApplications = getApplications();
  // Prefer the user's persisted workbook rows so browser refreshes and dev restarts do not reload seed data.
  if (savedApplications.length > 0 || isSeeded()) {
    return savedApplications;
  }

  try {
    const seed = await loadSeedData();
    saveApplications(seed);
    markSeeded();
    return seed;
  } catch {
    // Fall back to an empty workspace when the bundled workbook is unavailable instead of leaving boot stuck.
    return [];
  }
}

export function useApplications() {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const initialApplications = await loadInitialApplications();
        if (!cancelled) {
          setApplications(initialApplications);
        }
      } finally {
        // Always release the loading state so the app shell can recover from bootstrap failures.
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback((updatedApplication?: JobApplication) => {
    if (updatedApplication) {
      // Save actions already wrote to storage; replace the visible row immediately so the page cannot show a stale draft.
      setApplications((currentApplications) =>
        currentApplications.map((application) => application.id === updatedApplication.id ? updatedApplication : application)
      );
      return;
    }

    setApplications(getApplications());
  }, []);

  return { applications, loading, refresh };
}
