/**
 * Permission Hook
 * Hook สำหรับตรวจสอบสิทธิ์ใน Frontend
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import {
  isAdminRole,
  isElevatedRole,
  getPagePermission,
  PROTECTED_TABLES,
  type PermissionAction,
  type TablePermissions,
} from '~/lib/permissions';

// =====================================================
// TYPES
// =====================================================

interface PermissionState extends TablePermissions {
  loading: boolean;
  isAdmin: boolean;
}

interface UserPermissions {
  permissions: Record<string, TablePermissions>;
  loading: boolean;
  isAdmin: boolean;
}

// =====================================================
// SINGLE TABLE PERMISSION HOOK
// =====================================================

/**
 * Hook สำหรับตรวจสอบสิทธิ์ของ table เดียว
 *
 * Usage:
 * ```typescript
 * const { canRead, canUpdate, loading } = useTablePermission('admin_users');
 *
 * if (loading) return <Spinner />;
 * if (!canRead) return <AccessDenied />;
 * ```
 */
export function useTablePermission(tableName: string): PermissionState {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<PermissionState>({
    canCreate: false,
    canRead: false,
    canUpdate: false,
    canDelete: false,
    loading: true,
    isAdmin: false,
  });

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setState({
        canCreate: false,
        canRead: false,
        canUpdate: false,
        canDelete: false,
        loading: false,
        isAdmin: false,
      });
      return;
    }

    // Admin bypass - full access
    if (isAdminRole(user.role)) {
      setState({
        canCreate: true,
        canRead: true,
        canUpdate: true,
        canDelete: true,
        loading: false,
        isAdmin: true,
      });
      return;
    }

    // Fetch permissions from API
    fetch(`/api/permissions/check?table=${encodeURIComponent(tableName)}&userId=${encodeURIComponent(user.id)}`, {
      headers: {
        'x-user-id': user.id,
        'x-user-role': user.role || '',
      },
    })
      .then((res) => res.json())
      .then((data: Partial<TablePermissions>) => {
        setState({
          canCreate: data.canCreate ?? false,
          canRead: data.canRead ?? false,
          canUpdate: data.canUpdate ?? false,
          canDelete: data.canDelete ?? false,
          loading: false,
          isAdmin: false,
        });
      })
      .catch(() => {
        // On error, default to no permissions
        setState({
          canCreate: false,
          canRead: false,
          canUpdate: false,
          canDelete: false,
          loading: false,
          isAdmin: false,
        });
      });
  }, [user, authLoading, tableName]);

  return state;
}

// =====================================================
// PAGE PERMISSION HOOK
// =====================================================

/**
 * Hook สำหรับตรวจสอบว่าเข้าหน้านี้ได้หรือไม่
 *
 * Usage:
 * ```typescript
 * const { canAccess, loading } = usePagePermission('/admin/users');
 *
 * if (loading) return <Spinner />;
 * if (!canAccess) return <AccessDenied />;
 * ```
 */
export function usePagePermission(pagePath: string): {
  canAccess: boolean;
  loading: boolean;
  isAdmin: boolean;
} {
  const { user, loading: authLoading } = useAuth();
  const [canAccess, setCanAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  const pagePermission = getPagePermission(pagePath);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setCanAccess(false);
      setLoading(false);
      return;
    }

    // Admin bypass
    if (isAdminRole(user.role)) {
      setCanAccess(true);
      setLoading(false);
      return;
    }

    // If no permission defined for this page, allow access
    if (!pagePermission) {
      setCanAccess(true);
      setLoading(false);
      return;
    }

    // Check permission
    fetch(
      `/api/permissions/check?table=${encodeURIComponent(pagePermission.table)}&action=${pagePermission.action}&userId=${encodeURIComponent(user.id)}`,
      {
        headers: {
          'x-user-id': user.id,
          'x-user-role': user.role || '',
        },
      }
    )
      .then((res) => res.json())
      .then((data: { allowed?: boolean }) => {
        setCanAccess(data.allowed ?? false);
        setLoading(false);
      })
      .catch(() => {
        setCanAccess(false);
        setLoading(false);
      });
  }, [user, authLoading, pagePermission]);

  return {
    canAccess,
    loading,
    isAdmin: isAdminRole(user?.role),
  };
}

// =====================================================
// ALL PERMISSIONS HOOK
// =====================================================

/**
 * Hook สำหรับดึงสิทธิ์ทั้งหมดของ user (สำหรับ Sidebar filtering)
 *
 * Usage:
 * ```typescript
 * const { permissions, loading, isAdmin } = useUserPermissions();
 *
 * if (isAdmin || permissions['pr_tracking']?.canRead) {
 *   // Show PR Tracking menu
 * }
 * ```
 */
export function useUserPermissions(): UserPermissions {
  const { user, loading: authLoading } = useAuth();
  const [permissions, setPermissions] = useState<Record<string, TablePermissions>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setPermissions({});
      setLoading(false);
      return;
    }

    // Admin bypass - all permissions
    if (isAdminRole(user.role)) {
      const allPermissions: Record<string, TablePermissions> = {};
      Object.keys(PROTECTED_TABLES).forEach((table) => {
        allPermissions[table] = {
          canCreate: true,
          canRead: true,
          canUpdate: true,
          canDelete: true,
        };
      });
      setPermissions(allPermissions);
      setLoading(false);
      return;
    }

    // Fetch all permissions
    fetch(`/api/permissions/user?userId=${encodeURIComponent(user.id)}`, {
      headers: {
        'x-user-id': user.id,
        'x-user-role': user.role || '',
      },
    })
      .then((res) => res.json())
      .then((data: Record<string, TablePermissions>) => {
        setPermissions(data);
        setLoading(false);
      })
      .catch(() => {
        setPermissions({});
        setLoading(false);
      });
  }, [user, authLoading]);

  return {
    permissions,
    loading,
    isAdmin: isAdminRole(user?.role),
  };
}

// =====================================================
// PERMISSION CHECK FUNCTION (NON-HOOK)
// =====================================================

/**
 * Function สำหรับตรวจสอบ permission แบบ one-time (ไม่ใช่ hook)
 *
 * Usage:
 * ```typescript
 * const canDelete = await checkPermission('admin_users', 'delete', user);
 * if (!canDelete) {
 *   alert('ไม่มีสิทธิ์ลบ');
 *   return;
 * }
 * ```
 */
export async function checkPermission(
  tableName: string,
  action: PermissionAction,
  user: { id: string; role: string | null }
): Promise<boolean> {
  if (!user.role) return false;

  // Admin bypass
  if (isAdminRole(user.role)) {
    return true;
  }

  try {
    const res = await fetch(
      `/api/permissions/check?table=${encodeURIComponent(tableName)}&action=${action}&userId=${encodeURIComponent(user.id)}`,
      {
        headers: {
          'x-user-id': user.id,
          'x-user-role': user.role,
        },
      }
    );
    const data = (await res.json()) as { allowed?: boolean };
    return data.allowed ?? false;
  } catch {
    return false;
  }
}

// =====================================================
// MENU VISIBILITY HOOK
// =====================================================

interface MenuItem {
  name: string;
  path: string;
  icon?: string;
  permission?: {
    table: string;
    action: PermissionAction;
  };
  adminOnly?: boolean;
  restrictedFor?: string[];
}

/**
 * Hook สำหรับ filter menu items ตาม permission
 *
 * Usage:
 * ```typescript
 * const visibleMenuItems = useMenuVisibility(menuItems);
 * ```
 */
export function useMenuVisibility(menuItems: MenuItem[]): MenuItem[] {
  const { user } = useAuth();
  const { permissions, loading, isAdmin } = useUserPermissions();

  return useMemo(() => {
    if (loading || !user) return [];

    return menuItems.filter((item) => {
      // Admin gets everything
      if (isAdmin) return true;

      // adminOnly items - only for elevated roles
      if (item.adminOnly) {
        return isElevatedRole(user.role);
      }

      // restrictedFor - hide if user role is in restricted list
      if (item.restrictedFor && user.role) {
        if (item.restrictedFor.includes(user.role)) {
          return false;
        }
      }

      // Permission-based visibility
      if (item.permission) {
        const tablePerms = permissions[item.permission.table];
        if (!tablePerms) return false;

        switch (item.permission.action) {
          case 'create':
            return tablePerms.canCreate;
          case 'read':
            return tablePerms.canRead;
          case 'update':
            return tablePerms.canUpdate;
          case 'delete':
            return tablePerms.canDelete;
        }
      }

      // Default: show
      return true;
    });
  }, [menuItems, user, permissions, loading, isAdmin]);
}

// =====================================================
// ACTION PERMISSION HOOK (สำหรับตรวจสอบ action เฉพาะ)
// =====================================================

/**
 * Hook สำหรับตรวจสอบ permission ของ action เฉพาะ
 *
 * Usage:
 * ```typescript
 * const { allowed, loading } = useActionPermission('pr_print.execute');
 * const { allowed: canWO } = useActionPermission('wo_detail.read');
 *
 * if (!allowed) return null; // ซ่อน element
 * ```
 */
export function useActionPermission(actionKey: string): {
  allowed: boolean;
  loading: boolean;
  isAdmin: boolean;
} {
  const { user, loading: authLoading } = useAuth();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setAllowed(false);
      setLoading(false);
      return;
    }

    // Admin bypass
    if (isAdminRole(user.role)) {
      setAllowed(true);
      setLoading(false);
      return;
    }

    // Parse actionKey (format: "table.action")
    const parts = actionKey.split('.');
    if (parts.length !== 2) {
      console.warn(`Invalid actionKey format: ${actionKey}. Expected format: "table.action"`);
      setAllowed(false);
      setLoading(false);
      return;
    }

    const [table, action] = parts;

    // Check permission via API
    fetch(
      `/api/permissions/check?table=${encodeURIComponent(table!)}&action=${encodeURIComponent(action!)}&userId=${encodeURIComponent(user.id)}`,
      {
        headers: {
          'x-user-id': user.id,
          'x-user-role': user.role || '',
        },
      }
    )
      .then((res) => res.json())
      .then((data: { allowed?: boolean }) => {
        setAllowed(data.allowed ?? false);
        setLoading(false);
      })
      .catch(() => {
        setAllowed(false);
        setLoading(false);
      });
  }, [user, authLoading, actionKey]);

  return {
    allowed,
    loading,
    isAdmin: isAdminRole(user?.role),
  };
}

// =====================================================
// MULTIPLE ACTIONS HOOK (ตรวจสอบหลาย actions พร้อมกัน)
// =====================================================

/**
 * Hook สำหรับตรวจสอบหลาย actions พร้อมกัน
 * ลดจำนวน API calls ด้วยการรวมเป็น batch
 *
 * Usage:
 * ```typescript
 * const { permissions, loading, isAdmin } = useMultipleActionPermissions([
 *   'pr_print.execute',
 *   'wo_detail.read',
 *   'po_detail.read',
 *   'pr_qa.create',
 * ]);
 *
 * if (permissions['pr_print.execute']) { ... }
 * ```
 */
export function useMultipleActionPermissions(actionKeys: string[]): {
  permissions: Record<string, boolean>;
  loading: boolean;
  isAdmin: boolean;
} {
  const { user, loading: authLoading } = useAuth();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      const noPerms: Record<string, boolean> = {};
      actionKeys.forEach(key => noPerms[key] = false);
      setPermissions(noPerms);
      setLoading(false);
      return;
    }

    // Admin bypass - all permissions
    if (isAdminRole(user.role)) {
      const allPerms: Record<string, boolean> = {};
      actionKeys.forEach(key => allPerms[key] = true);
      setPermissions(allPerms);
      setLoading(false);
      return;
    }

    // Fetch all permissions in parallel
    const fetchPromises = actionKeys.map(async (actionKey) => {
      const parts = actionKey.split('.');
      if (parts.length !== 2) return { key: actionKey, allowed: false };

      const [table, action] = parts;
      try {
        const res = await fetch(
          `/api/permissions/check?table=${encodeURIComponent(table!)}&action=${encodeURIComponent(action!)}&userId=${encodeURIComponent(user.id)}`,
          {
            headers: {
              'x-user-id': user.id,
              'x-user-role': user.role || '',
            },
          }
        );
        const data = await res.json() as { allowed?: boolean };
        return { key: actionKey, allowed: data.allowed ?? false };
      } catch {
        return { key: actionKey, allowed: false };
      }
    });

    Promise.all(fetchPromises)
      .then((results) => {
        const perms: Record<string, boolean> = {};
        results.forEach(r => perms[r.key] = r.allowed);
        setPermissions(perms);
        setLoading(false);
      })
      .catch(() => {
        const noPerms: Record<string, boolean> = {};
        actionKeys.forEach(key => noPerms[key] = false);
        setPermissions(noPerms);
        setLoading(false);
      });
  }, [user, authLoading, actionKeys.join(',')]);

  return {
    permissions,
    loading,
    isAdmin: isAdminRole(user?.role),
  };
}
