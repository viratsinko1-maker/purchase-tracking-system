import { useEffect, useRef } from "react";
import { useAuth } from "~/hooks/useAuth";
import { getComputerName } from "~/utils/getComputerName";

// Send heartbeat every 1 minute
const HEARTBEAT_INTERVAL = 60 * 1000;

export default function HeartbeatSender() {
  const { user, isAuthenticated } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      // Clear interval if not authenticated
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const sendHeartbeat = async () => {
      try {
        const computerName = getComputerName();
        await fetch("/api/auth/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            userName: user.name ?? user.username ?? undefined,
            computerName,
          }),
        });
      } catch (error) {
        // Silently fail - heartbeat is best effort
        console.error("Heartbeat failed:", error);
      }
    };

    // Send initial heartbeat
    void sendHeartbeat();

    // Set up interval
    intervalRef.current = setInterval(() => {
      void sendHeartbeat();
    }, HEARTBEAT_INTERVAL);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated, user]);

  // This component doesn't render anything
  return null;
}
