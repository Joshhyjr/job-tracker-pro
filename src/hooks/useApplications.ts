import { useState, useEffect, useCallback } from "react";
import type { JobApplication } from "@/lib/types";
import { getApplications, saveApplications, loadSeedData, isSeeded, markSeeded } from "@/lib/storage";

export function useApplications() {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      if (!isSeeded()) {
        const seed = await loadSeedData();
        saveApplications(seed);
        markSeeded();
        setApplications(seed);
      } else {
        setApplications(getApplications());
      }
      setLoading(false);
    }
    init();
  }, []);

  const refresh = useCallback(() => {
    setApplications(getApplications());
  }, []);

  return { applications, loading, refresh };
}
