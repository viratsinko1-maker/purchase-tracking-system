/**
 * CanAccess Component
 * Component wrapper สำหรับแสดง/ซ่อน elements ตาม permission
 *
 * Usage:
 * ```tsx
 * <CanAccess action="pr_print.execute">
 *   <PrintButton />
 * </CanAccess>
 *
 * <CanAccess action="wo_detail.read" fallback={<span className="text-gray-400">ไม่มีสิทธิ์</span>}>
 *   <WOLink />
 * </CanAccess>
 *
 * <CanAccess action="pr_qa.create" showDisabled>
 *   <button>ถามคำถาม</button> // จะแสดงเป็น disabled แทนการซ่อน
 * </CanAccess>
 * ```
 */

import React from 'react';
import { useActionPermission } from '~/hooks/usePermission';

interface CanAccessProps {
  /**
   * Action key format: "table.action"
   * ตัวอย่าง: "pr_print.execute", "wo_detail.read", "pr_qa.create"
   */
  action: string;

  /**
   * Content ที่จะแสดงเมื่อมีสิทธิ์
   */
  children: React.ReactNode;

  /**
   * Content ที่จะแสดงเมื่อไม่มีสิทธิ์ (optional)
   * ถ้าไม่ระบุจะไม่แสดงอะไรเลย (null)
   */
  fallback?: React.ReactNode;

  /**
   * แสดง loading spinner ขณะตรวจสอบสิทธิ์ (optional)
   * Default: false - ซ่อนทั้งหมดขณะ loading
   */
  showLoading?: boolean;

  /**
   * แสดงเป็น disabled state แทนการซ่อน (optional)
   * ใช้สำหรับ buttons ที่ต้องการแสดงแต่ไม่ให้กดได้
   * Default: false
   */
  showDisabled?: boolean;

  /**
   * Title/tooltip ที่จะแสดงเมื่อ disabled (optional)
   */
  disabledTooltip?: string;
}

export default function CanAccess({
  action,
  children,
  fallback = null,
  showLoading = false,
  showDisabled = false,
  disabledTooltip = 'คุณไม่มีสิทธิ์ดำเนินการนี้',
}: CanAccessProps) {
  const { allowed, loading, isAdmin } = useActionPermission(action);

  // Loading state
  if (loading) {
    if (showLoading) {
      return (
        <span className="inline-block h-4 w-4 animate-pulse rounded bg-gray-200" />
      );
    }
    // ซ่อนทั้งหมดขณะ loading
    return null;
  }

  // มีสิทธิ์ - แสดง children
  if (allowed || isAdmin) {
    return <>{children}</>;
  }

  // ไม่มีสิทธิ์ + showDisabled = แสดงเป็น disabled
  if (showDisabled) {
    return (
      <span
        className="cursor-not-allowed opacity-50"
        title={disabledTooltip}
      >
        {React.Children.map(children, child => {
          if (React.isValidElement(child)) {
            // Clone element and add disabled prop
            return React.cloneElement(child as React.ReactElement<any>, {
              disabled: true,
              onClick: (e: React.MouseEvent) => e.preventDefault(),
              title: disabledTooltip,
              className: `${(child.props as any).className || ''} cursor-not-allowed opacity-50`,
            });
          }
          return child;
        })}
      </span>
    );
  }

  // ไม่มีสิทธิ์ - แสดง fallback หรือ null
  return <>{fallback}</>;
}

// =====================================================
// PERMISSION GATE COMPONENT (สำหรับ section/page level)
// =====================================================

interface PermissionGateProps {
  /**
   * Action key format: "table.action"
   */
  action: string;

  /**
   * Content ที่จะแสดงเมื่อมีสิทธิ์
   */
  children: React.ReactNode;

  /**
   * Content ที่จะแสดงเมื่อไม่มีสิทธิ์
   * Default: Access Denied message
   */
  fallback?: React.ReactNode;
}

/**
 * PermissionGate Component
 * ใช้สำหรับ page-level หรือ section-level access control
 * จะแสดง Access Denied message เมื่อไม่มีสิทธิ์
 *
 * Usage:
 * ```tsx
 * <PermissionGate action="admin_users.read">
 *   <UserManagementPage />
 * </PermissionGate>
 * ```
 */
export function PermissionGate({
  action,
  children,
  fallback,
}: PermissionGateProps) {
  const { allowed, loading, isAdmin } = useActionPermission(action);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
      </div>
    );
  }

  // มีสิทธิ์
  if (allowed || isAdmin) {
    return <>{children}</>;
  }

  // ไม่มีสิทธิ์ - แสดง fallback หรือ default Access Denied
  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
        <svg className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
      <p className="text-gray-600 text-center max-w-md">
        คุณไม่มีสิทธิ์ดำเนินการนี้ กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์เพิ่มเติม
      </p>
    </div>
  );
}

// =====================================================
// NO PERMISSION MODAL (สำหรับแสดง modal เตือน)
// =====================================================

interface NoPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionName?: string;
}

/**
 * NoPermissionModal Component
 * แสดง modal เตือนเมื่อไม่มีสิทธิ์
 *
 * Usage:
 * ```tsx
 * const [showNoPermission, setShowNoPermission] = useState(false);
 *
 * const handleClick = async () => {
 *   const hasPermission = await checkPermission('pr_qa.create', 'create', user);
 *   if (!hasPermission) {
 *     setShowNoPermission(true);
 *     return;
 *   }
 *   // do action
 * };
 *
 * <NoPermissionModal isOpen={showNoPermission} onClose={() => setShowNoPermission(false)} />
 * ```
 */
export function NoPermissionModal({
  isOpen,
  onClose,
  actionName = 'ดำเนินการนี้',
}: NoPermissionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex flex-col items-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">ไม่มีสิทธิ์</h3>
          <p className="text-center text-gray-600 mb-6">
            คุณไม่มีสิทธิ์{actionName}
            <br />
            <span className="text-sm">กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์เพิ่มเติม</span>
          </p>
          <button
            onClick={onClose}
            className="w-full rounded-md bg-gray-600 px-6 py-3 text-white font-medium hover:bg-gray-700 transition"
          >
            ตกลง
          </button>
        </div>
      </div>
    </div>
  );
}
