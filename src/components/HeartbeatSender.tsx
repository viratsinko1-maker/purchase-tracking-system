import { useEffect, useRef } from "react";
import { useAuth } from "~/hooks/useAuth";
import { getComputerName } from "~/utils/getComputerName";

// Send heartbeat every 1 minute
const HEARTBEAT_INTERVAL = 60 * 1000;
// Auto logout after 15 minutes of inactivity
const INACTIVITY_TIMEOUT = 15 * 60 * 1000;

export default function HeartbeatSender() {
  const { user, isAuthenticated, logout } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Track user activity
  useEffect(() => {
    if (!isAuthenticated) return;

    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    // Events to track user activity
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

    events.forEach(event => {
      window.addEventListener(event, updateActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
    };
  }, [isAuthenticated]);

  // Heartbeat and inactivity check
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

    const checkActivityAndSendHeartbeat = () => {
      const now = Date.now();
      const inactiveTime = now - lastActivityRef.current;

      if (inactiveTime >= INACTIVITY_TIMEOUT) {
        // User has been inactive for 15+ minutes - auto logout
        console.log('[HEARTBEAT] Auto logout due to inactivity:', Math.round(inactiveTime / 60000), 'minutes');
        void logout('auto_logout_idle');
        return;
      }

      // User is still active - send heartbeat
      void sendHeartbeat();
    };

    // Send initial heartbeat
    void sendHeartbeat();

    // Set up interval
    intervalRef.current = setInterval(checkActivityAndSendHeartbeat, HEARTBEAT_INTERVAL);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated, user, logout]);

  // This component doesn't render anything
  return null;
}
