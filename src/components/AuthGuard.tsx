import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "~/hooks/useAuth";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import { SidebarProvider, useSidebar } from "~/contexts/SidebarContext";

interface AuthGuardProps {
  children: React.ReactNode;
}

// Pages that don't require authentication
const publicPages = ["/login"];

// Pages that should not have layout (TopBar + Sidebar)
const noLayoutPages = ["/print/pr/[prNo]"];

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const isPublicPage = publicPages.includes(router.pathname);
  const isNoLayoutPage = noLayoutPages.includes(router.pathname) || router.pathname.startsWith("/print/");

  useEffect(() => {
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
  }, [loading, user, isPublicPage, router]);

  // Show loading spinner while checking authentication
  if (loading || isRedirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
          <p className="text-gray-600">
            {isRedirecting ? "กำลังเปลี่ยนหน้า..." : "กำลังตรวจสอบสิทธิ์..."}
          </p>
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

  return (
    <SidebarProvider>
      <AuthenticatedLayout>{children}</AuthenticatedLayout>
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
