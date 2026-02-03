/**
 * PageGuard Component
 * ใช้ครอบหน้าเพื่อตรวจสอบสิทธิ์ระดับหน้า
 *
 * Usage:
 * ```tsx
 * export default function AdminUsersPage() {
 *   return (
 *     <PageGuard action="admin_users.read">
 *       <YourPageContent />
 *     </PageGuard>
 *   );
 * }
 * ```
 */

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useActionPermission } from '~/hooks/usePermission';
import { useAuth } from '~/hooks/useAuth';

interface PageGuardProps {
  /**
   * Action key format: "table.action"
   * ตัวอย่าง: "admin_users.read", "pr_tracking.read"
   */
  action: string;

  /**
   * ชื่อหน้า (สำหรับแสดงใน title และ error message)
   */
  pageName?: string;

  /**
   * Content ที่จะแสดงเมื่อมีสิทธิ์
   */
  children: React.ReactNode;

  /**
   * Redirect ไปหน้าอื่นถ้าไม่มีสิทธิ์ (optional)
   * ถ้าไม่ระบุจะแสดง Access Denied
   */
  redirectTo?: string;
}

export default function PageGuard({
  action,
  pageName,
  children,
  redirectTo,
}: PageGuardProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { allowed, loading: permLoading, isAdmin } = useActionPermission(action);

  const isLoading = authLoading || permLoading;
  const hasAccess = isAdmin || allowed;

  // Redirect ถ้าไม่มีสิทธิ์และระบุ redirectTo
  useEffect(() => {
    if (!isLoading && !hasAccess && redirectTo) {
      void router.push(redirectTo);
    }
  }, [isLoading, hasAccess, redirectTo, router]);

  // Not logged in - redirect to login
  useEffect(() => {
    if (!authLoading && !user) {
      void router.push('/login');
    }
  }, [authLoading, user, router]);

  // Loading state
  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
          <p className="text-gray-600">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    );
  }

  // No access - show Access Denied (unless redirectTo is set)
  if (!hasAccess && !redirectTo) {
    return (
      <>
        <Head>
          <title>ไม่มีสิทธิ์เข้าถึง{pageName ? ` - ${pageName}` : ''}</title>
        </Head>
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg text-center">
            <div className="mb-6 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
                <svg className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h1>
            <p className="text-gray-600 mb-6">
              คุณไม่มีสิทธิ์เข้าถึง{pageName ? `หน้า${pageName}` : 'หน้านี้'}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => router.back()}
                className="w-full rounded-lg bg-gray-200 px-4 py-3 font-medium text-gray-700 hover:bg-gray-300 transition"
              >
                ย้อนกลับ
              </button>
              <button
                onClick={() => router.push('/pr-tracking')}
                className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700 transition"
              >
                ไปหน้าหลัก
              </button>
            </div>
            <p className="mt-6 text-sm text-gray-500">
              หากต้องการสิทธิ์เพิ่มเติม กรุณาติดต่อผู้ดูแลระบบ
            </p>
          </div>
        </div>
      </>
    );
  }

  // Has access - show children
  return <>{children}</>;
}

/**
 * ActionGuard Component
 * ใช้ครอบ section/button ที่ต้องการตรวจสอบสิทธิ์
 * (เหมือน CanAccess แต่ชื่อต่างกันเพื่อความชัดเจน)
 */
export { default as CanAccess, NoPermissionModal, PermissionGate } from './CanAccess';
