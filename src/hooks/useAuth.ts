import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { getComputerName } from "~/utils/getComputerName";
import { isAdminRole, isElevatedRole } from "~/lib/permissions";

export interface User {
  id: string;
  userId: string | null;
  username: string | null;
  name: string | null;
  role: string | null;
  isActive: boolean;
  source?: "local" | "production";
}

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in (ใช้ sessionStorage แทน localStorage)
    const storedUser = sessionStorage.getItem("user");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as User;
        setUser(parsedUser);
      } catch (error) {
        console.error("Error parsing user data:", error);
        sessionStorage.removeItem("user");
      }
    }
    setLoading(false);
  }, []);

  const logout = async (reason?: 'manual' | 'auto_logout_idle') => {
    try {
      const computerName = getComputerName();

      // Send user info to log activity before clearing localStorage
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user?.id,
          userName: user?.name ?? user?.username ?? undefined,
          computerName,
          reason: reason ?? 'manual',
        }),
      });
    } catch (error) {
      console.error("Logout error:", error);
    }

    sessionStorage.removeItem("user");
    setUser(null);

    // Force full page reload to clear state
    const redirectUrl = reason === 'auto_logout_idle' ? "/login?reason=idle" : "/login";
    window.location.href = redirectUrl;
  };

  const requireAuth = () => {
    if (!loading && !user) {
      void router.push("/login");
    }
  };

  const requireAdmin = useCallback(() => {
    if (!loading && !user) {
      void router.push("/login");
    } else if (!loading && user && !isElevatedRole(user.role)) {
      // Not admin or approval - show error and redirect
      alert("⚠️ คุณไม่มีสิทธิ์เข้าถึงหน้านี้\n\nโปรดติดต่อผู้ดูแลระบบ");
      void router.push("/pr-tracking");
    }
  }, [loading, user, router]);

  const requireRole = (allowedRoles: string[]) => {
    if (!loading && !user) {
      void router.push("/login");
    } else if (!loading && user && !allowedRoles.includes(user.role || "")) {
      // Not in allowed roles - show error and redirect
      alert("⚠️ คุณไม่มีสิทธิ์เข้าถึงหน้านี้\n\nโปรดติดต่อผู้ดูแลระบบ");
      void router.push("/pr-tracking");
    }
  };

  return {
    user,
    loading,
    logout,
    requireAuth,
    requireAdmin,
    requireRole,
    isAuthenticated: !!user,
    isAdmin: isElevatedRole(user?.role),          // Admin or Approval
    isSystemAdmin: isAdminRole(user?.role),        // Only Admin
  };
}
