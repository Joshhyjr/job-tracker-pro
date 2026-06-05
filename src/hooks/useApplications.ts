import { useState, useEffect, useCallback } from "react";
import type { JobApplication } from "@/lib/types";
import { getApplications, saveApplications, loadSeedData, isSeeded, markSeeded } from "@/lib/storage";

export async function loadInitialApplications(): Promise<JobApplication[]> {
  const savedApplications = getApplications();
  // Prefer the user's persisted workbook rows so browser refreshes and dev restarts do not reload seed data.
  if (savedApplications.length > 0 || isSeeded()) {
    return savedApplications;
  }

  const seed = await loadSeedData();
  saveApplications(seed);
  markSeeded();
  return seed;
}

export function useApplications() {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      setApplications(await loadInitialApplications());
      setLoading(false);
    }
    init();
  }, []);

  const refresh = useCallback(() => {
    setApplications(getApplications());
  }, []);

  return { applications, loading, refresh };
}
