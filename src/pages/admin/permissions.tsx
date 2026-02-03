import { useState, useEffect, useCallback, useMemo } from "react";
import Head from "next/head";
import { useAuth } from "~/hooks/useAuth";
import { authFetch } from "~/lib/authFetch";
import { PROTECTED_TABLES, CATEGORY_LABELS, getPermissionsByCategory, type PermissionCategory } from "~/lib/permissions";
import PageGuard from "~/components/PageGuard";
import CanAccess from "~/components/CanAccess";
import { useMultipleActionPermissions } from "~/hooks/usePermission";

// =====================================================
// TYPES
// =====================================================

interface RolePermission {
  id: number;
  roleId: number;
  tableName: string;
  canRead: boolean; // ใช้ canRead เป็น "allowed"
}

interface Role {
  id: number;
  name: string;
  code: string;
  priority: number;
  permissions: RolePermission[];
}

interface PermissionMatrix {
  [roleId: number]: {
    [actionName: string]: boolean;
  };
}

// =====================================================
// COMPONENT
// =====================================================

function AdminPermissionsContent() {
  const { user } = useAuth();

  // Permission checks
  const actionKeys = useMemo(() => [
    'admin_permissions.update',
  ], []);
  const { permissions, isAdmin } = useMultipleActionPermissions(actionKeys);
  const canDo = (action: string) => isAdmin || permissions[action];

  // Data states
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissionMatrix, setPermissionMatrix] = useState<PermissionMatrix>({});

  // UI states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["pr_tracking", "pr_approval"]));
  const [hasChanges, setHasChanges] = useState(false);

  // Get organized permissions (filter out admin categories - admin pages are Admin-only)
  const allPermissionsByCategory = getPermissionsByCategory();
  const permissionsByCategory = Object.fromEntries(
    Object.entries(allPermissionsByCategory).filter(
      ([category]) => !category.startsWith('admin_')
    )
  ) as ReturnType<typeof getPermissionsByCategory>;

  // =====================================================
  // LOAD DATA
  // =====================================================

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await authFetch("/api/admin/permissions", {
        headers: {
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "ไม่สามารถโหลดข้อมูลได้");
        return;
      }

      setRoles(data.roles);

      // Build permission matrix from roles
      const matrix: PermissionMatrix = {};
      data.roles.forEach((role: Role) => {
        matrix[role.id] = {};
        role.permissions.forEach((perm) => {
          const roleMatrix = matrix[role.id];
          if (roleMatrix) {
            roleMatrix[perm.tableName] = perm.canRead;
          }
        });
      });
      setPermissionMatrix(matrix);
    } catch (err) {
      console.error("Load error:", err);
      setError("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user?.id && user?.role) {
      void loadData();
    }
  }, [loadData, user]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // =====================================================
  // HANDLERS
  // =====================================================

  const handlePermissionChange = (roleId: number, actionName: string, value: boolean) => {
    setPermissionMatrix((prev) => {
      const newMatrix = { ...prev };
      if (!newMatrix[roleId]) {
        newMatrix[roleId] = {};
      }
      newMatrix[roleId][actionName] = value;
      return newMatrix;
    });
    setHasChanges(true);
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      setError("");

      // Build permissions for non-admin actions only
      const visibleActions = Object.keys(PROTECTED_TABLES).filter(
        (action) => !action.startsWith('admin_')
      );

      // Save each role (except Admin)
      const rolesToSave = roles.filter((r) => r.code !== "Admin");
      let savedCount = 0;

      for (const role of rolesToSave) {
        const permissions = visibleActions.map((actionName) => ({
          tableName: actionName,
          canCreate: false,
          canRead: permissionMatrix[role.id]?.[actionName] || false,
          canUpdate: false,
          canDelete: false,
        }));

        const response = await authFetch("/api/admin/permissions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": user?.id || "",
            "x-user-role": user?.role || "",
          },
          body: JSON.stringify({
            roleId: role.id,
            permissions,
            userName: user?.name || user?.username || "",
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          setError(data.error || `ไม่สามารถบันทึกสิทธิ์ของ ${role.name} ได้`);
          return;
        }
        savedCount++;
      }

      setSuccessMessage(`บันทึกสิทธิ์ทั้งหมด ${savedCount} roles สำเร็จ`);
      setHasChanges(false);
    } catch (err) {
      console.error("Save error:", err);
      setError("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setSaving(false);
    }
  };

  const handleSetCategoryPermissions = (roleId: number, category: PermissionCategory, value: boolean) => {
    const actions = permissionsByCategory[category] || [];
    setPermissionMatrix((prev) => {
      const newMatrix = { ...prev };
      if (!newMatrix[roleId]) {
        newMatrix[roleId] = {};
      }
      const rolePerms = newMatrix[roleId]!;
      actions.forEach(({ key }) => {
        rolePerms[key] = value;
      });
      return newMatrix;
    });
    setHasChanges(true);
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const expandAllCategories = () => {
    setExpandedCategories(new Set(Object.keys(permissionsByCategory)));
  };

  const collapseAllCategories = () => {
    setExpandedCategories(new Set());
  };

  // =====================================================
  // RENDER
  // =====================================================

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mx-auto"></div>
          <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  const categories = Object.keys(permissionsByCategory) as PermissionCategory[];

  return (
    <>
      <Head>
        <title>จัดการสิทธิ์ - Admin</title>
      </Head>

      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-full">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-800">
              จัดการสิทธิ์ (Permission Matrix)
            </h1>
            <p className="text-gray-600 mt-1">
              กำหนดสิทธิ์การเข้าถึงของแต่ละ Role ต่อแต่ละ Action
              ({Object.values(permissionsByCategory).reduce((sum, arr) => sum + arr.length, 0)} actions)
            </p>
            <p className="text-xs text-gray-400 mt-1">
              หมายเหตุ: หน้า Admin (/admin/*) เข้าได้เฉพาะ Role &quot;Admin&quot; เท่านั้น จึงไม่แสดงในตารางนี้
            </p>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-100 p-4 text-red-700">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="mb-4 rounded-lg bg-green-100 p-4 text-green-700">
              {successMessage}
            </div>
          )}

          {/* Expand/Collapse Buttons */}
          <div className="mb-4 flex items-center gap-2">
            <button
              onClick={expandAllCategories}
              className="rounded-lg bg-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-300"
            >
              ขยายทั้งหมด
            </button>
            <button
              onClick={collapseAllCategories}
              className="rounded-lg bg-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-300"
            >
              ย่อทั้งหมด
            </button>
          </div>

          {/* Permission Matrix by Category */}
          <div className="space-y-4">
            {categories.map((category) => {
              const actions = permissionsByCategory[category] || [];
              const isExpanded = expandedCategories.has(category);
              const categoryLabel = CATEGORY_LABELS[category] || category;

              return (
                <div key={category} className="overflow-hidden rounded-lg bg-white shadow">
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className="flex w-full items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-3 text-left hover:from-indigo-100 hover:to-purple-100"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`transform transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                        ▶
                      </span>
                      <span className="font-semibold text-gray-800">{categoryLabel}</span>
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-600">
                        {actions.length} actions
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {isExpanded ? "คลิกเพื่อย่อ" : "คลิกเพื่อขยาย"}
                    </span>
                  </button>

                  {/* Category Content */}
                  {isExpanded && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 min-w-[280px]">
                              Action
                            </th>
                            {roles.map((role) => (
                              <th
                                key={role.id}
                                className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 min-w-[100px]"
                              >
                                <div className="mb-1">{role.name}</div>
                                <div className="text-[10px] text-gray-400">
                                  ({role.code})
                                </div>
                              </th>
                            ))}
                          </tr>
                          {/* Quick actions row */}
                          <tr className="bg-gray-100">
                            <th className="sticky left-0 z-10 bg-gray-100 px-4 py-2 text-left text-xs text-gray-500">
                              ตั้งค่าทั้งหมวด:
                            </th>
                            {roles.map((role) => {
                              const isAdmin = role.code === "Admin";
                              return (
                                <th key={role.id} className="px-4 py-2">
                                  {!isAdmin && (
                                    <div className="flex justify-center gap-2">
                                      <button
                                        onClick={() => handleSetCategoryPermissions(role.id, category, true)}
                                        className="text-[10px] text-green-600 hover:underline font-medium"
                                      >
                                        ให้สิทธิ์
                                      </button>
                                      <span className="text-gray-300">|</span>
                                      <button
                                        onClick={() => handleSetCategoryPermissions(role.id, category, false)}
                                        className="text-[10px] text-red-600 hover:underline font-medium"
                                      >
                                        ยกเลิก
                                      </button>
                                    </div>
                                  )}
                                  {isAdmin && (
                                    <span className="text-[10px] text-gray-400">มีสิทธิ์ทั้งหมด</span>
                                  )}
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {actions.map(({ key, meta }) => (
                            <tr key={key} className="hover:bg-gray-50">
                              <td className="sticky left-0 z-10 bg-white px-4 py-3 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  {meta.friendlyName}
                                </div>
                                <div className="text-xs text-gray-400">
                                  {key}
                                </div>
                                {meta.description && (
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    {meta.description}
                                  </div>
                                )}
                              </td>
                              {roles.map((role) => {
                                const isAdmin = role.code === "Admin";
                                const allowed = permissionMatrix[role.id]?.[key] || false;

                                return (
                                  <td
                                    key={role.id}
                                    className="px-4 py-3 text-center"
                                  >
                                    {isAdmin ? (
                                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600">
                                        ✓
                                      </span>
                                    ) : (
                                      <label className="flex items-center justify-center cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={allowed}
                                          onChange={(e) =>
                                            handlePermissionChange(role.id, key, e.target.checked)
                                          }
                                          className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                      </label>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Save Button */}
          <div className="mt-6 flex items-center gap-4 p-4 bg-white rounded-lg shadow">
            <CanAccess action="admin_permissions.update" showDisabled disabledTooltip="คุณไม่มีสิทธิ์บันทึกการเปลี่ยนแปลง">
              <button
                onClick={handleSaveAll}
                disabled={saving || !hasChanges}
                className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
              </button>
            </CanAccess>
            {hasChanges && (
              <span className="text-sm text-yellow-600">มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก</span>
            )}
          </div>

          {/* Note */}
          <div className="mt-6 rounded-lg bg-blue-50 p-4 text-sm text-blue-700">
            <p className="font-medium">หมายเหตุ:</p>
            <ul className="mt-1 list-inside list-disc space-y-1">
              <li>Role &quot;Admin&quot; มีสิทธิ์ทุกอย่างโดยอัตโนมัติ (ไม่สามารถแก้ไขได้)</li>
              <li>แต่ละ Action แสดงชื่อไทย + รหัส + คำอธิบาย</li>
              <li>กดปุ่ม &quot;ให้สิทธิ์&quot; / &quot;ยกเลิก&quot; เพื่อตั้งค่าทั้งหมวดหมู่</li>
              <li>กดปุ่ม &quot;บันทึก [ชื่อ Role]&quot; เพื่อบันทึกการเปลี่ยนแปลงของ Role นั้น</li>
            </ul>
          </div>

          {/* Permission Categories Summary */}
          <div className="mt-6 rounded-lg bg-gray-100 p-4">
            <h3 className="font-semibold text-gray-800 mb-3">สรุปหมวดหมู่สิทธิ์ทั้งหมด</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {categories.map((category) => {
                const actions = permissionsByCategory[category] || [];
                const categoryLabel = CATEGORY_LABELS[category] || category;
                return (
                  <button
                    key={category}
                    onClick={() => {
                      if (!expandedCategories.has(category)) {
                        toggleCategory(category);
                      }
                      // Scroll to category
                      document.getElementById(`cat-${category}`)?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex items-center justify-between p-2 rounded bg-white hover:bg-indigo-50 text-left text-sm"
                  >
                    <span className="text-gray-700">{categoryLabel}</span>
                    <span className="text-xs text-indigo-600 font-medium">{actions.length}</span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

// Export default with PageGuard wrapper
export default function AdminPermissionsPage() {
  return (
    <PageGuard action="admin_permissions.read" pageName="จัดการสิทธิ์">
      <AdminPermissionsContent />
    </PageGuard>
  );
}
