import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { getComputerName } from "~/utils/getComputerName";

export default function SsoPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    if (!router.isReady) return;

    const token = router.query.token as string | undefined;

    if (!token) {
      setError("ไม่พบ SSO token");
      setProcessing(false);
      return;
    }

    const handleSso = async () => {
      try {
        const computerName = getComputerName();

        const response = await fetch("/api/auth/sso", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, computerName }),
        });

        const data = (await response.json()) as {
          success?: boolean;
          user?: Record<string, unknown>;
          error?: string;
        };

        if (!response.ok) {
          setError(data.error ?? "SSO authentication failed");
          setProcessing(false);
          return;
        }

        // Store user in sessionStorage (same as login.tsx)
        sessionStorage.setItem("user", JSON.stringify(data.user));

        // Redirect to main page
        window.location.href = "/pr-tracking";
      } catch (err) {
        console.error("SSO error:", err);
        setError("เกิดข้อผิดพลาดในการเข้าสู่ระบบ SSO");
        setProcessing(false);
      }
    };

    void handleSso();
  }, [router.isReady, router.query.token]);

  return (
    <>
      <Head>
        <title>SSO - PR/PO Tracking</title>
      </Head>
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg text-center">
          {processing && !error && (
            <>
              <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
              <p className="text-gray-600">กำลังเข้าสู่ระบบ SSO...</p>
            </>
          )}
          {error && (
            <div className="space-y-4">
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
                {error}
              </div>
              <a
                href="/login"
                className="inline-block rounded-md bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700"
              >
                ไปหน้าเข้าสู่ระบบ
              </a>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
