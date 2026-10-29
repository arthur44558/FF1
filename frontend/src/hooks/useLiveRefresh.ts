import { useCallback, useEffect, useRef, useState } from "react";

interface UseLiveRefreshOptions {
  onRefresh: () => Promise<void> | void;
  intervalMs?: number;
  enabled?: boolean;
}

export interface UseLiveRefreshReturn {
  lastUpdated: Date | null;
  formattedLastUpdated: string;
  isRefreshing: boolean;
  refreshNow: () => Promise<void>;
  refreshError: string | null;
}

export function useLiveRefresh({
  onRefresh,
  intervalMs = 15000,
  enabled = true,
}: UseLiveRefreshOptions): UseLiveRefreshReturn {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const inFlightRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const executeRefresh = useCallback(async () => {
    if (inFlightRef.current || !enabled) return;
    inFlightRef.current = true;
    setIsRefreshing(true);
    setRefreshError(null);

    try {
      await onRefreshRef.current();
      setLastUpdated(new Date());
    } catch (err: any) {
      setRefreshError(err.message || "Failed to sync live data with backend");
    } finally {
      setIsRefreshing(false);
      inFlightRef.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    // Initial load
    executeRefresh();

    // Controlled interval polling
    const timer = setInterval(() => {
      // Only poll if document is visible
      if (document.visibilityState === "visible") {
        executeRefresh();
      }
    }, intervalMs);

    // Refresh when user returns to the tab or window regains focus
    const handleFocus = () => {
      executeRefresh();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        executeRefresh();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      inFlightRef.current = false;
    };
  }, [enabled, intervalMs, executeRefresh]);

  const formattedLastUpdated = lastUpdated
    ? lastUpdated.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "Syncing...";

  return {
    lastUpdated,
    formattedLastUpdated,
    isRefreshing,
    refreshNow: executeRefresh,
    refreshError,
  };
}
