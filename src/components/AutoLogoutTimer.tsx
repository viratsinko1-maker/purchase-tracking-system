import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "~/hooks/useAuth";

// Configuration
const IDLE_TIMEOUT = 15 * 60 * 1000; // 15 minutes in ms
const WARNING_BEFORE = 8 * 60 * 1000; // Show warning 8 minutes before logout
const WARNING_AT = IDLE_TIMEOUT - WARNING_BEFORE; // 7 minutes of inactivity

interface AutoLogoutTimerProps {
  enabled?: boolean;
}

export default function AutoLogoutTimer({ enabled = true }: AutoLogoutTimerProps) {
  const { logout, isAuthenticated } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(WARNING_BEFORE);

  const lastActivityRef = useRef<number>(Date.now());
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const isLoggingOutRef = useRef<boolean>(false);

  // Format time as M:SS
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Perform logout
  const performLogout = useCallback(async () => {
    // Prevent multiple logout calls
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    try {
      await logout('auto_logout_idle');
    } catch (error) {
      console.error("Auto logout error:", error);
      // Force redirect on error
      window.location.href = "/login?reason=idle";
    }
  }, [logout]);

  // Clear all timers
  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // Start countdown display
  const startCountdown = useCallback(() => {
    setRemainingTime(WARNING_BEFORE);

    countdownRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      const remaining = IDLE_TIMEOUT - elapsed;

      if (remaining <= 0) {
        clearAllTimers();
        performLogout();
      } else {
        setRemainingTime(remaining);
      }
    }, 1000);
  }, [clearAllTimers, performLogout]);

  // Reset activity timer
  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    setRemainingTime(WARNING_BEFORE);
    clearAllTimers();

    // Set warning timer (7 minutes)
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      startCountdown();
    }, WARNING_AT);

    // Set logout timer (15 minutes)
    logoutTimerRef.current = setTimeout(() => {
      performLogout();
    }, IDLE_TIMEOUT);
  }, [clearAllTimers, performLogout, startCountdown]);

  // Handle user activity
  const handleActivity = useCallback(() => {
    // Only reset if warning is not shown
    if (!showWarning) {
      lastActivityRef.current = Date.now();
    }
  }, [showWarning]);

  // Handle continue button click
  const handleContinue = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  // Setup activity listeners
  useEffect(() => {
    if (!enabled || !isAuthenticated) return;

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click"];

    // Throttle activity handler
    let throttleTimeout: NodeJS.Timeout | null = null;
    const throttledHandler = () => {
      if (throttleTimeout) return;
      throttleTimeout = setTimeout(() => {
        throttleTimeout = null;
        handleActivity();
      }, 1000); // Throttle to once per second
    };

    // Add event listeners
    events.forEach((event) => {
      document.addEventListener(event, throttledHandler, { passive: true });
    });

    // Initialize timer
    resetTimer();

    // Cleanup
    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, throttledHandler);
      });
      clearAllTimers();
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
  }, [enabled, isAuthenticated, handleActivity, resetTimer, clearAllTimers]);

  if (!enabled || !isAuthenticated || !showWarning) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        {/* Warning Icon */}
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
            <svg
              className="h-8 w-8 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 className="mb-2 text-center text-xl font-bold text-gray-900">
          ระบบจะออกจากระบบอัตโนมัติ
        </h2>

        {/* Message */}
        <p className="mb-4 text-center text-gray-600">
          เนื่องจากไม่มีการใช้งานเป็นเวลานาน
        </p>

        {/* Countdown Timer */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center rounded-lg bg-red-50 px-6 py-3">
            <span className="text-lg text-red-700">เหลืออีก</span>
            <span className="mx-2 font-mono text-3xl font-bold text-red-600">
              {formatTime(remainingTime)}
            </span>
            <span className="text-lg text-red-700">นาที</span>
          </div>
        </div>

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-lg font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          ตกลง - ใช้งานต่อ
        </button>

        {/* Sub text */}
        <p className="mt-3 text-center text-sm text-gray-500">
          กดปุ่มเพื่อรีเซ็ตเวลาและใช้งานต่อ
        </p>
      </div>
    </div>
  );
}
