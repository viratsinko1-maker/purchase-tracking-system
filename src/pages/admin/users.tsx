import { useState, useEffect } from "react";
import Head from "next/head";
import { useAuth } from "~/hooks/useAuth";

interface User {
  id: string;
  userId: string | null;
  username: string | null;
  name: string | null;
  password: string | null;
  role: string | null;
  isActive: boolean;
}

export default function AdminUsersPage() {
  const { requireAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    userId: "",
    username: "",
    name: "",
    password: "",
    role: "PR",
    isActive: true,
  });

  // Load users
  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/users");
      const data = await response.json();
      if (response.ok) {
        // เรียงตาม userId (null/undefined จะอยู่ท้ายสุด)
        const sortedUsers = [...data.users].sort((a, b) => {
          const userIdA = a.userId || '';
          const userIdB = b.userId || '';
          return userIdA.localeCompare(userIdB);
        });
        setUsers(sortedUsers);
      } else {
        setError(data.error || "ไม่สามารถโหลดข้อมูลผู้ใช้ได้");
      }
    } catch (err) {
      console.error("Load users error:", err);
      setError("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    requireAdmin();
    void loadUsers();
  }, []);

  useEffect(() => {
    requireAdmin();
  }, [requireAdmin]);

  // Open modal for create
  const handleCreate = () => {
    setEditingUser(null);
    setFormData({ userId: "", username: "", name: "", password: "", role: "PR", isActive: true });
    setIsModalOpen(true);
  };

  // Open modal for edit
  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      userId: user.userId || "",
      username: user.username || "",
      name: user.name || "",
      password: "", // Don't show existing password
      role: user.role || "PR",
      isActive: user.isActive,
    });
    setIsModalOpen(true);
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const url = "/api/admin/users";
      const method = editingUser ? "PUT" : "POST";
      const body = editingUser
        ? { id: editingUser.id, ...formData }
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
      await loadUsers();
    } catch (err) {
      console.error("Submit error:", err);
      setError("เกิดข้อผิดพลาดในการบันทึก");
    }
  };

  // Delete user
  const handleDelete = async (user: User) => {
    if (!confirm(`คุณต้องการลบผู้ใช้ "${user.username}" ใช่หรือไม่?`)) {
      return;
    }

    try {
      const response = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "ไม่สามารถลบผู้ใช้ได้");
        return;
      }

      await loadUsers();
    } catch (err) {
      console.error("Delete error:", err);
      setError("เกิดข้อผิดพลาดในการลบ");
    }
  };

  return (
    <>
      <Head>
        <title>จัดการผู้ใช้ - Admin</title>
      </Head>

      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-800">
              จัดการผู้ใช้งาน
            </h1>
            <div className="flex gap-2">
              <button
                onClick={() => window.location.href = '/activity-trail'}
                className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm text-white hover:bg-purple-700"
              >
                📋 Activity
              </button>
              <button
                onClick={() => window.location.href = '/sync-history'}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
              >
                PR Sync
              </button>
              <button
                onClick={() => window.location.href = '/po-sync-history'}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
              >
                PO Sync
              </button>
              <button
                onClick={handleCreate}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
              >
                ➕ เพิ่มผู้ใช้ใหม่
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-600">
              {error}
            </div>
          )}

          {/* Users Table */}
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    User ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Username
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    ชื่อ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Password
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    สิทธิ์
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                    Active
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center">
                      กำลังโหลด...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      ไม่มีข้อมูลผู้ใช้
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                        {user.userId || "-"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                        {user.username || "-"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                        {user.name || "-"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                        {user.password ? "••••••" : "-"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          user.role === "Admin" ? "bg-purple-100 text-purple-800" :
                          user.role === "Manager" ? "bg-blue-100 text-blue-800" :
                          user.role === "POPR" ? "bg-green-100 text-green-800" :
                          "bg-gray-100 text-gray-800"
                        }`}>
                          {user.role || "PR"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-center text-sm">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          user.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}>
                          {user.isActive ? "✓ Active" : "✗ Inactive"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(user)}
                          className="mr-3 text-indigo-600 hover:text-indigo-900"
                        >
                          แก้ไข
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          className="text-red-600 hover:text-red-900"
                        >
                          ลบ
                        </button>
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
              {editingUser ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้ใหม่"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  User ID (ไม่จำเป็น)
                </label>
                <input
                  type="text"
                  value={formData.userId}
                  onChange={(e) =>
                    setFormData({ ...formData, userId: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="Admin, User01, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  required
                  placeholder="ชื่อผู้ใช้"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  ชื่อ-นามสกุล
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="ชื่อเต็ม"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Password {!editingUser && <span className="text-red-500">*</span>}
                  {editingUser && <span className="text-sm text-gray-500"> (เว้นว่างหากไม่ต้องการเปลี่ยน)</span>}
                </label>
                <input
                  type="text"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  required={!editingUser}
                  placeholder="รหัสผ่าน"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  สิทธิ์ <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  required
                >
                  <option value="Admin">Admin</option>
                  <option value="Manager">Manager</option>
                  <option value="POPR">POPR</option>
                  <option value="PR">PR</option>
                </select>
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
                  onClick={() => setIsModalOpen(false)}
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
