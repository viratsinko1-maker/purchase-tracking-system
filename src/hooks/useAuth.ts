import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { getComputerName } from "~/utils/getComputerName";

export interface User {
  id: string;
  userId: string | null;
  username: string | null;
  name: string | null;
  role: string | null;
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

  const logout = async () => {
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
        }),
      });
    } catch (error) {
      console.error("Logout error:", error);
    }

    sessionStorage.removeItem("user");
    setUser(null);

    // Force full page reload to clear state
    window.location.href = "/login";
  };

  const requireAuth = () => {
    if (!loading && !user) {
      void router.push("/login");
    }
  };

  const requireAdmin = () => {
    if (!loading && !user) {
      void router.push("/login");
    } else if (!loading && user && user.role !== "Admin") {
      // Not admin - show error and redirect
      alert("⚠️ คุณไม่มีสิทธิ์เข้าถึงหน้านี้\n\nโปรดติดต่อผู้ดูแลระบบ");
      void router.push("/pr-tracking");
    }
  };

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
    isAdmin: user?.role === "Admin",
  };
}
