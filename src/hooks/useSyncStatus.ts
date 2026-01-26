/**
 * Hook for monitoring auto-sync status and auto-refreshing data when sync completes
 */

import { useEffect, useRef, useState } from "react";
import { api } from "~/utils/api";

interface UseSyncStatusOptions {
  /** Callback to refresh data when sync completes */
  onSyncComplete?: () => void;
  /** Whether to enable polling (default: true) */
  enabled?: boolean;
  /** Poll interval in milliseconds (default: 5000) */
  pollInterval?: number;
  /** Log prefix for debugging (default: '[SYNC-STATUS]') */
  logPrefix?: string;
}

interface UseSyncStatusReturn {
  /** Whether auto-sync is currently in progress */
  isAutoSyncing: boolean;
  /** Current sync type (PR, PO, BOTH) */
  syncType: "PR" | "PO" | "BOTH" | null;
  /** Sync start time */
  startTime: Date | null;
  /** Last sync end time */
  lastEndTime: Date | null;
}

export function useSyncStatus(options: UseSyncStatusOptions = {}): UseSyncStatusReturn {
  const {
    onSyncComplete,
    enabled = true,
    pollInterval = 5000,
    logPrefix = '[SYNC-STATUS]',
  } = options;

  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const wasAutoSyncingRef = useRef(false);

  // Polling for sync status
  const { data: syncStatus } = api.sync.getStatus.useQuery(undefined, {
    refetchInterval: pollInterval,
    refetchIntervalInBackground: true,
    enabled,
  });

  // Monitor sync status changes and trigger callback when sync completes
  useEffect(() => {
    if (!syncStatus) return;

    const currentlyAutoSyncing = syncStatus.isInProgress;

    // Update state
    setIsAutoSyncing(currentlyAutoSyncing);

    // If auto-sync just completed (changed from true -> false)
    if (wasAutoSyncingRef.current && !currentlyAutoSyncing) {
      console.log(`${logPrefix} Auto-sync completed, triggering refresh...`);
      onSyncComplete?.();
    }

    // Store current state for next check
    wasAutoSyncingRef.current = currentlyAutoSyncing;
  }, [syncStatus, onSyncComplete, logPrefix]);

  return {
    isAutoSyncing,
    syncType: syncStatus?.syncType ?? null,
    startTime: syncStatus?.startTime ?? null,
    lastEndTime: syncStatus?.lastEndTime ?? null,
  };
}
