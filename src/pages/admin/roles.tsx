import { useState, useEffect, useMemo } from "react";
import Head from "next/head";
import { useAuth } from "~/hooks/useAuth";
import { authFetch } from "~/lib/authFetch";
import PageGuard from "~/components/PageGuard";
import CanAccess from "~/components/CanAccess";
import { useMultipleActionPermissions } from "~/hooks/usePermission";

interface SystemRole {
  id: number;
  name: string;
  code: string;
  priority: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function AdminRolesContent() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Permission checks สำหรับปุ่มต่างๆ
  const actionKeys = useMemo(() => [
    'admin_roles.create',
    'admin_roles.update',
    'admin_roles.delete',
  ], []);
  const { permissions, isAdmin } = useMultipleActionPermissions(actionKeys);
  const canDo = (action: string) => isAdmin || permissions[action];

  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<SystemRole | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    priority: 1,
    description: "",
    isActive: true,
  });

  // Load roles
  const loadRoles = async () => {
    try {
      setLoading(true);
      const response = await authFetch("/api/admin/roles");
      const data = await response.json();
      if (response.ok) {
        // Sort by priority
        const sortedRoles = [...data.roles].sort(
          (a: SystemRole, b: SystemRole) => a.priority - b.priority
        );
        setRoles(sortedRoles);
      } else {
        setError(data.error || "ไม่สามารถโหลดข้อมูล Role ได้");
      }
    } catch (err) {
      console.error("Load roles error:", err);
      setError("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRoles();
  }, []);

  // Clear messages after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Open modal for create
  const handleCreate = () => {
    setEditingRole(null);
    // Calculate next priority
    const nextPriority = roles.length > 0
      ? Math.max(...roles.map(r => r.priority)) + 1
      : 1;
    setFormData({
      name: "",
      code: "",
      priority: nextPriority,
      description: "",
      isActive: true,
    });
    setIsModalOpen(true);
  };

  // Open modal for edit
  const handleEdit = (role: SystemRole) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      code: role.code,
      priority: role.priority,
      description: role.description || "",
      isActive: role.isActive,
    });
    setIsModalOpen(true);
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.name.trim()) {
      setError("กรุณาระบุชื่อ Role");
      return;
    }
    if (!formData.code.trim()) {
      setError("กรุณาระบุรหัส Role");
      return;
    }
    if (formData.priority < 1) {
      setError("ลำดับความสำคัญต้องมากกว่า 0");
      return;
    }

    try {
      const url = "/api/admin/roles";
      const method = editingRole ? "PUT" : "POST";
      const body = editingRole
        ? { id: editingRole.id, ...formData }
        : formData;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "เกิดข้อผิดพลาด");
        return;
      }

      setIsModalOpen(false);
      setSuccessMessage(editingRole ? "แก้ไข Role สำเร็จ" : "เพิ่ม Role สำเร็จ");
      await loadRoles();
    } catch (err) {
      console.error("Submit error:", err);
      setError("เกิดข้อผิดพลาดในการบันทึก");
    }
  };

  // Delete role
  const handleDelete = async (role: SystemRole) => {
    if (!confirm(`คุณต้องการลบ Role "${role.name}" ใช่หรือไม่?\n\nการลบนี้ไม่สามารถกู้คืนได้!`)) {
      return;
    }

    try {
      const response = await authFetch("/api/admin/roles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: role.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "ไม่สามารถลบ Role ได้");
        return;
      }

      setSuccessMessage("ลบ Role สำเร็จ");
      await loadRoles();
    } catch (err) {
      console.error("Delete error:", err);
      setError("เกิดข้อผิดพลาดในการลบ");
    }
  };

  // Seed default roles
  const handleSeedDefaults = async () => {
    if (!confirm("ต้องการเพิ่ม Role เริ่มต้น (Admin, Approval, Manager, POPR, Warehouse, PR) หรือไม่?\n\nRole ที่มีอยู่แล้วจะไม่ถูกเพิ่มซ้ำ")) {
      return;
    }

    try {
      const response = await authFetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed" }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "เกิดข้อผิดพลาด");
        return;
      }

      setSuccessMessage(data.message || "เพิ่ม Role เริ่มต้นสำเร็จ");
      await loadRoles();
    } catch (err) {
      console.error("Seed error:", err);
      setError("เกิดข้อผิดพลาดในการเพิ่ม Role เริ่มต้น");
    }
  };

  // Get priority badge color
  const getPriorityColor = (priority: number) => {
    if (priority === 1) return "bg-red-100 text-red-800";
    if (priority === 2) return "bg-orange-100 text-orange-800";
    if (priority === 3) return "bg-yellow-100 text-yellow-800";
    if (priority <= 5) return "bg-blue-100 text-blue-800";
    return "bg-gray-100 text-gray-800";
  };

  // Get role badge color
  const getRoleColor = (code: string) => {
    switch (code) {
      case "Admin": return "bg-purple-100 text-purple-800";
      case "Approval": return "bg-pink-100 text-pink-800";
      case "Manager": return "bg-blue-100 text-blue-800";
      case "POPR": return "bg-green-100 text-green-800";
      case "Warehouse": return "bg-amber-100 text-amber-800";
      case "PR": return "bg-gray-100 text-gray-800";
      default: return "bg-indigo-100 text-indigo-800";
    }
  };

  return (
    <>
      <Head>
        <title>จัดการ Role - Admin</title>
      </Head>

      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                จัดการ Role
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                กำหนด Role และลำดับความสำคัญ (Priority) - ลำดับ 1 = สูงสุด
              </p>
            </div>
            <div className="flex gap-2">
              <CanAccess action="admin_roles.create" showDisabled disabledTooltip="คุณไม่มีสิทธิ์เพิ่ม Role">
                <button
                  onClick={handleSeedDefaults}
                  className="rounded-lg bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
                >
                  เพิ่ม Role เริ่มต้น
                </button>
              </CanAccess>
              <CanAccess action="admin_roles.create" showDisabled disabledTooltip="คุณไม่มีสิทธิ์เพิ่ม Role">
                <button
                  onClick={handleCreate}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
                >
                  + เพิ่ม Role ใหม่
                </button>
              </CanAccess>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-600">
              {error}
              <button
                onClick={() => setError("")}
                className="ml-2 text-red-800 hover:text-red-900"
              >
                ✕
              </button>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 rounded-lg bg-green-50 p-4 text-green-600">
              {successMessage}
            </div>
          )}

          {/* Info Box */}
          <div className="mb-4 rounded-lg bg-blue-50 p-4 text-sm text-blue-700">
            <strong>หมายเหตุ:</strong> ลำดับความสำคัญ (Priority) ใช้สำหรับควบคุมสิทธิ์การเข้าถึง
            <ul className="mt-2 ml-4 list-disc">
              <li>Priority 1 = สูงสุด (Admin)</li>
              <li>ตัวเลขยิ่งน้อย = สิทธิ์ยิ่งสูง</li>
              <li>สามารถกำหนดได้ว่า &quot;ตั้งแต่ Priority X ขึ้นไปถึงเข้าถึงได้&quot;</li>
            </ul>
          </div>

          {/* Roles Table */}
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    ชื่อ Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    รหัส (Code)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    คำอธิบาย
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                    สถานะ
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center">
                      กำลังโหลด...
                    </td>
                  </tr>
                ) : roles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      ไม่มีข้อมูล Role - กดปุ่ม &quot;เพิ่ม Role เริ่มต้น&quot; เพื่อสร้าง Role พื้นฐาน
                    </td>
                  </tr>
                ) : (
                  roles.map((role) => (
                    <tr key={role.id} className={`hover:bg-gray-50 ${!role.isActive ? 'bg-gray-100 opacity-60' : ''}`}>
                      <td className="whitespace-nowrap px-6 py-4 text-center text-sm">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${getPriorityColor(role.priority)}`}>
                          {role.priority}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                        {role.name}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getRoleColor(role.code)}`}>
                          {role.code}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {role.description || "-"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-center text-sm">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          role.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}>
                          {role.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                        <CanAccess action="admin_roles.update" fallback={<span className="mr-3 text-gray-400 cursor-not-allowed" title="คุณไม่มีสิทธิ์แก้ไข">แก้ไข</span>}>
                          <button
                            onClick={() => handleEdit(role)}
                            className="mr-3 text-indigo-600 hover:text-indigo-900"
                          >
                            แก้ไข
                          </button>
                        </CanAccess>
                        <CanAccess action="admin_roles.delete" fallback={<span className="text-gray-400 cursor-not-allowed" title="คุณไม่มีสิทธิ์ลบ">ลบ</span>}>
                          <button
                            onClick={() => handleDelete(role)}
                            className="text-red-600 hover:text-red-900"
                          >
                            ลบ
                          </button>
                        </CanAccess>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-bold">
              {editingRole ? "แก้ไข Role" : "เพิ่ม Role ใหม่"}
            </h2>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  ชื่อ Role <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="เช่น ผู้ดูแลระบบ"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  รหัส (Code) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="เช่น Admin"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  ใช้ในระบบสำหรับอ้างอิง (ไม่ควรมีช่องว่าง)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  ลำดับความสำคัญ (Priority) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  min="1"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  1 = สูงสุด, ตัวเลขยิ่งน้อยยิ่งมีสิทธิ์สูง
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  คำอธิบาย
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  rows={2}
                  placeholder="คำอธิบายเพิ่มเติม"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="isActive" className="ml-2 block text-sm font-medium text-gray-700">
                  เปิดใช้งาน (Active)
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
                >
                  บันทึก
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setError("");
                  }}
                  className="flex-1 rounded-lg bg-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-400"
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// Export default with PageGuard wrapper
export default function AdminRolesPage() {
  return (
    <PageGuard action="admin_roles.read" pageName="จัดการ Role">
      <AdminRolesContent />
    </PageGuard>
  );
}
