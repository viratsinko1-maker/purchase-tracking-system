import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "~/hooks/useAuth";
import { usePagePermission } from "~/hooks/usePermission";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import AdminSidebar from "./AdminSidebar";
import WSeriesSidebar from "./WSeriesSidebar";
import AutoLogoutTimer from "./AutoLogoutTimer";
import HeartbeatSender from "./HeartbeatSender";
import { SidebarProvider, useSidebar } from "~/contexts/SidebarContext";

interface AuthGuardProps {
  children: React.ReactNode;
}

// Pages that don't require authentication
const publicPages = ["/login", "/forgot-password", "/reset-password"];

// Pages that should not have layout (TopBar + Sidebar)
const noLayoutPages = ["/print/pr/[prNo]"];

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Wait for client-side mount to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isPublicPage = publicPages.includes(router.pathname);
  const isNoLayoutPage = noLayoutPages.includes(router.pathname) || router.pathname.startsWith("/print/");
  const isAdminPage = router.pathname.startsWith("/admin/");
  const isWSeriesPage = router.pathname.startsWith("/w-series/");

  useEffect(() => {
    // Wait for router to be ready before making any redirect decisions
    if (!router.isReady) {
      return;
    }

    // ถ้ายังไม่ได้ล็อกอินและไม่ใช่หน้า public -> redirect ไปหน้า login
    if (!loading && !user && !isPublicPage) {
      setIsRedirecting(true);
      void router.replace("/login");
      return;
    }

    // ถ้าล็อกอินแล้วแต่ user ถูกปิดใช้งาน -> บังคับ logout
    if (!loading && user && !user.isActive && !isPublicPage) {
      alert("⚠️ บัญชีของคุณถูกปิดใช้งาน\n\nกรุณาติดต่อผู้ดูแลระบบ");
      sessionStorage.removeItem("user");
      setIsRedirecting(true);
      void router.replace("/login");
      return;
    }

    // ถ้าล็อกอินแล้วแต่อยู่หน้า login -> redirect ไป pr-tracking
    if (!loading && user && router.pathname === "/login") {
      setIsRedirecting(true);
      void router.replace("/pr-tracking");
      return;
    }

    setIsRedirecting(false);
  }, [loading, user, isPublicPage, router, router.isReady]);

  // Show loading spinner while checking authentication or waiting for router
  if (!isMounted || loading || isRedirecting || !router.isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
          <p className="text-gray-600">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  // ถ้ายังไม่ได้ล็อกอินและไม่ใช่หน้า public -> แสดง loading (กำลัง redirect)
  if (!user && !isPublicPage) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
          <p className="text-gray-600">กรุณาเข้าสู่ระบบ...</p>
        </div>
      </div>
    );
  }

  // Don't show TopBar on login page
  if (isPublicPage) {
    return <>{children}</>;
  }

  // Don't show layout on print pages
  if (isNoLayoutPage) {
    return <>{children}</>;
  }

  // Use permission-protected layout for all authenticated pages
  return (
    <SidebarProvider>
      <HeartbeatSender />
      <AutoLogoutTimer />
      <PermissionProtectedLayout isAdminPage={isAdminPage} isWSeriesPage={isWSeriesPage}>
        {children}
      </PermissionProtectedLayout>
    </SidebarProvider>
  );
}

// Layout component that uses sidebar context
function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { isExpanded } = useSidebar();

  return (
    <>
      <TopBar />
      <Sidebar />
      <div
        className={`transition-all duration-300 ${
          isExpanded ? "ml-64" : "ml-16"
        }`}
      >
        {children}
      </div>
    </>
  );
}

// Admin layout with AdminSidebar
function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isExpanded } = useSidebar();

  return (
    <>
      <TopBar />
      <AdminSidebar />
      <div
        className={`transition-all duration-300 ${
          isExpanded ? "ml-64" : "ml-16"
        }`}
      >
        {children}
      </div>
    </>
  );
}

// W Series layout with WSeriesSidebar
function WSeriesLayout({ children }: { children: React.ReactNode }) {
  const { isExpanded } = useSidebar();

  return (
    <>
      <TopBar />
      <WSeriesSidebar />
      <div
        className={`transition-all duration-300 ${
          isExpanded ? "ml-64" : "ml-16"
        }`}
      >
        {children}
      </div>
    </>
  );
}

// Access Denied component
function AccessDenied() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="mb-6 text-6xl">🚫</div>
        <h1 className="mb-2 text-2xl font-bold text-gray-800">ไม่มีสิทธิ์เข้าถึง</h1>
        <p className="mb-6 text-gray-600">คุณไม่มีสิทธิ์ในการเข้าถึงหน้านี้</p>
        <button
          onClick={() => void router.push("/pr-tracking")}
          className="rounded-lg bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700"
        >
          กลับหน้าหลัก
        </button>
      </div>
    </div>
  );
}

// Permission-protected layout wrapper
function PermissionProtectedLayout({
  children,
  isAdminPage,
  isWSeriesPage,
}: {
  children: React.ReactNode;
  isAdminPage: boolean;
  isWSeriesPage: boolean;
}) {
  const router = useRouter();
  const { canAccess, loading: permLoading } = usePagePermission(router.pathname);

  // Show loading while checking permission
  if (permLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
          <p className="text-gray-600">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    );
  }

  // Show access denied if no permission
  if (!canAccess) {
    return <AccessDenied />;
  }

  // Render the appropriate layout
  if (isAdminPage) {
    return <AdminLayout>{children}</AdminLayout>;
  }

  if (isWSeriesPage) {
    return <WSeriesLayout>{children}</WSeriesLayout>;
  }

  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}
