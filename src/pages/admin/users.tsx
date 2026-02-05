import { useState, useEffect, useMemo } from "react";
import Head from "next/head";
import { useAuth } from "~/hooks/useAuth";
import { authFetch } from "~/lib/authFetch";
import { api } from "~/utils/api";
import PageGuard from "~/components/PageGuard";
import CanAccess from "~/components/CanAccess";
import { useMultipleActionPermissions } from "~/hooks/usePermission";

interface User {
  id: string;
  userId: string | null;
  username: string | null;
  name: string | null;
  password: string | null;
  role: string | null;
  isActive: boolean;
}

interface UserProduction {
  id: string;
  email: string;
  userId: string | null;
  username: string | null;
  name: string | null;
  password: string | null;
  role: string;
  isActive: boolean;
  sourceId: string | null;
  telegramChatId: string | null;
  linked_req_name: string | null;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SystemRole {
  id: number;
  name: string;
  code: string;
  priority: number;
  description: string | null;
  isActive: boolean;
}

type TabType = "user" | "user_production";

// Helper function for role badge color
const getRoleBadgeColor = (roleCode: string | null): string => {
  switch (roleCode) {
    case "Admin": return "bg-purple-100 text-purple-800";
    case "Approval": return "bg-pink-100 text-pink-800";
    case "Manager": return "bg-blue-100 text-blue-800";
    case "POPR": return "bg-green-100 text-green-800";
    case "Warehouse": return "bg-amber-100 text-amber-800";
    case "PR": return "bg-gray-100 text-gray-800";
    default: return "bg-indigo-100 text-indigo-800";
  }
};

function AdminUsersContent() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("user");

  // Permission checks สำหรับปุ่มต่างๆ
  const actionKeys = useMemo(() => [
    'admin_users.create',
    'admin_users.update',
    'admin_users.delete',
    'admin_users.sync',
  ], []);
  const { permissions, isAdmin } = useMultipleActionPermissions(actionKeys);
  const canDo = (action: string) => isAdmin || permissions[action];

  // User state
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // User Production state
  const [usersProduction, setUsersProduction] = useState<UserProduction[]>([]);
  const [loadingUsersProduction, setLoadingUsersProduction] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Roles state
  const [roles, setRoles] = useState<SystemRole[]>([]);

  const [error, setError] = useState("");

  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingUserProduction, setEditingUserProduction] = useState<UserProduction | null>(null);
  const [formData, setFormData] = useState({
    userId: "",
    username: "",
    name: "",
    password: "",
    role: "PR",
    isActive: true,
    telegramChatId: "",
    linkedReqName: "",
  });

  // Query available req names for dropdown (only when editing user production)
  const { data: availableReqNames = [], refetch: refetchReqNames } = api.notification.getAvailableReqNames.useQuery(
    { currentUserId: editingUserProduction?.id },
    { enabled: isModalOpen && !!editingUserProduction }
  );

  // Searchable dropdown state for linked_req_name
  const [reqNameSearch, setReqNameSearch] = useState("");
  const [isReqNameDropdownOpen, setIsReqNameDropdownOpen] = useState(false);

  // Filter req names based on search
  const filteredReqNames = useMemo(() => {
    if (!reqNameSearch.trim()) return availableReqNames;
    const searchLower = reqNameSearch.toLowerCase();
    return availableReqNames.filter(r =>
      r.req_name.toLowerCase().includes(searchLower)
    );
  }, [availableReqNames, reqNameSearch]);

  // Load users
  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await authFetch("/api/admin/users");
      const data = await response.json();
      if (response.ok) {
        const sortedUsers = [...data.users].sort((a: User, b: User) => {
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
      setLoadingUsers(false);
    }
  };

  // Load users production
  const loadUsersProduction = async () => {
    try {
      setLoadingUsersProduction(true);
      const response = await authFetch("/api/admin/users-production");
      const data = await response.json();
      if (response.ok) {
        const sortedUsers = [...data.users].sort((a: UserProduction, b: UserProduction) => {
          const nameA = a.username || '';
          const nameB = b.username || '';
          return nameA.localeCompare(nameB, 'th');
        });
        setUsersProduction(sortedUsers);
      } else {
        setError(data.error || "ไม่สามารถโหลดข้อมูลผู้ใช้ Production ได้");
      }
    } catch (err) {
      console.error("Load users production error:", err);
      setError("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoadingUsersProduction(false);
    }
  };

  // Load roles from system_role table
  const loadRoles = async () => {
    try {
      const response = await authFetch("/api/admin/roles");
      const data = await response.json();
      if (response.ok) {
        // Sort by priority and filter active only
        const sortedRoles = [...data.roles]
          .filter((r: SystemRole) => r.isActive)
          .sort((a: SystemRole, b: SystemRole) => a.priority - b.priority);
        setRoles(sortedRoles);
      }
    } catch (err) {
      console.error("Load roles error:", err);
    }
  };

  // Sync users from TMK_PDPJ01
  const handleSyncProduction = async () => {
    if (!confirm("ต้องการ Sync ข้อมูลผู้ใช้จาก TMK_PDPJ01 ใช่หรือไม่?")) {
      return;
    }

    try {
      setSyncing(true);
      setError("");
      const response = await authFetch("/api/admin/users-production", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync",
          userId: user?.id,
          userName: user?.name ?? user?.username,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "ไม่สามารถ Sync ข้อมูลได้");
        return;
      }

      alert(data.message);
      await loadUsersProduction();
    } catch (err) {
      console.error("Sync error:", err);
      setError("เกิดข้อผิดพลาดในการ Sync");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    void loadUsers();
    void loadUsersProduction();
    void loadRoles();
  }, []);

  // Open modal for create (User tab only)
  const handleCreate = () => {
    setEditingUser(null);
    // Use the last role (lowest priority) as default, or "PR" if no roles
    const defaultRole = roles.length > 0 ? roles[roles.length - 1]?.code || "PR" : "PR";
    setFormData({ userId: "", username: "", name: "", password: "", role: defaultRole, isActive: true, telegramChatId: "", linkedReqName: "" });
    setIsModalOpen(true);
  };

  // Open modal for edit User
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditingUserProduction(null);
    setFormData({
      userId: user.userId || "",
      username: user.username || "",
      name: user.name || "",
      password: "",
      role: user.role || "PR",
      isActive: user.isActive,
      telegramChatId: "",
      linkedReqName: "",
    });
    setIsModalOpen(true);
  };

  // Open modal for edit User Production
  const handleEditUserProduction = (user: UserProduction) => {
    setEditingUserProduction(user);
    setEditingUser(null);
    setFormData({
      userId: user.email,
      username: user.username || "",
      name: user.name || "",
      password: "",
      role: user.role || "PR",
      isActive: user.isActive,
      telegramChatId: user.telegramChatId || "",
      linkedReqName: user.linked_req_name || "",
    });
    // Reset searchable dropdown state
    setReqNameSearch("");
    setIsReqNameDropdownOpen(false);
    setIsModalOpen(true);
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      if (editingUserProduction) {
        // Update User Production
        const response = await authFetch("/api/admin/users-production", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingUserProduction.id,
            username: formData.username,
            name: formData.name,
            password: formData.password || undefined,
            role: formData.role,
            isActive: formData.isActive,
            telegramChatId: formData.telegramChatId,
            linkedReqName: formData.linkedReqName,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          setError(data.error || "เกิดข้อผิดพลาด");
          return;
        }

        setIsModalOpen(false);
        await loadUsersProduction();
      } else {
        // User table operations
        const url = "/api/admin/users";
        const method = editingUser ? "PUT" : "POST";
        const body = editingUser
          ? { id: editingUser.id, ...formData }
          : formData;

        const response = await authFetch(url, {
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
      }
    } catch (err) {
      console.error("Submit error:", err);
      setError("เกิดข้อผิดพลาดในการบันทึก");
    }
  };

  // Delete user
  const handleDeleteUser = async (user: User) => {
    if (!confirm(`คุณต้องการลบผู้ใช้ "${user.username}" ใช่หรือไม่?`)) {
      return;
    }

    try {
      const response = await authFetch("/api/admin/users", {
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

  // Delete user production
  const handleDeleteUserProduction = async (user: UserProduction) => {
    if (!confirm(`คุณต้องการลบผู้ใช้ "${user.username}" (${user.email}) อย่างถาวรใช่หรือไม่?\n\nการลบนี้ไม่สามารถกู้คืนได้!`)) {
      return;
    }

    try {
      const response = await authFetch("/api/admin/users-production", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "ไม่สามารถลบผู้ใช้ได้");
        return;
      }

      await loadUsersProduction();
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
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-800">
              จัดการผู้ใช้งาน
            </h1>
          </div>

          {/* Tabs */}
          <div className="mb-4 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab("user")}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "user"
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                User (Local)
                <span className="ml-2 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                  {users.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("user_production")}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "user_production"
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                User Production (TMK)
                <span className="ml-2 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                  {usersProduction.length}
                </span>
              </button>
            </nav>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-600">
              {error}
            </div>
          )}

          {/* User Tab */}
          {activeTab === "user" && (
            <>
              <div className="mb-4 flex justify-end">
                <CanAccess action="admin_users.create" showDisabled disabledTooltip="คุณไม่มีสิทธิ์เพิ่มผู้ใช้">
                  <button
                    onClick={handleCreate}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
                  >
                    + เพิ่มผู้ใช้ใหม่
                  </button>
                </CanAccess>
              </div>

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
                    {loadingUsers ? (
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
                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getRoleBadgeColor(user.role)}`}>
                              {user.role || "PR"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-center text-sm">
                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              user.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                            }`}>
                              {user.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                            <CanAccess action="admin_users.update" fallback={<span className="mr-3 text-gray-400 cursor-not-allowed" title="คุณไม่มีสิทธิ์แก้ไข">แก้ไข</span>}>
                              <button
                                onClick={() => handleEditUser(user)}
                                className="mr-3 text-indigo-600 hover:text-indigo-900"
                              >
                                แก้ไข
                              </button>
                            </CanAccess>
                            <CanAccess action="admin_users.delete" fallback={<span className="text-gray-400 cursor-not-allowed" title="คุณไม่มีสิทธิ์ลบ">ลบ</span>}>
                              <button
                                onClick={() => handleDeleteUser(user)}
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
            </>
          )}

          {/* User Production Tab */}
          {activeTab === "user_production" && (
            <>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  ข้อมูลผู้ใช้จาก TMK_PDPJ01 - ใช้ Email เป็น Login และ Password เริ่มต้นคือ 1234
                </p>
                <CanAccess action="admin_users.sync" showDisabled disabledTooltip="คุณไม่มีสิทธิ์ Sync ผู้ใช้">
                  <button
                    onClick={handleSyncProduction}
                    disabled={syncing}
                    className={`rounded-lg px-4 py-2 text-white ${
                      syncing
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-orange-600 hover:bg-orange-700"
                    }`}
                  >
                    {syncing ? "กำลัง Sync..." : "Sync จาก TMK_PDPJ01"}
                  </button>
                </CanAccess>
              </div>

              <div className="overflow-x-auto rounded-lg bg-white shadow">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Email (Login)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        ชื่อ
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Password
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        สิทธิ์
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                        Active
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Telegram ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Linked Req Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Last Sync
                      </th>
                      <th className="sticky right-0 bg-gray-50 px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 shadow-[-2px_0_4px_rgba(0,0,0,0.05)]">
                        จัดการ
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {loadingUsersProduction ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-4 text-center">
                          กำลังโหลด...
                        </td>
                      </tr>
                    ) : usersProduction.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                          ไม่มีข้อมูลผู้ใช้ - กดปุ่ม &quot;Sync จาก TMK_PDPJ01&quot; เพื่อดึงข้อมูล
                        </td>
                      </tr>
                    ) : (
                      usersProduction.map((user) => (
                        <tr key={user.id} className={`hover:bg-gray-50 ${!user.isActive ? 'bg-gray-100 opacity-60' : ''}`}>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-900">
                            {user.email}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-900">
                            {user.username || user.name || "-"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-900">
                            {user.password ? "••••••" : "-"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-900">
                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getRoleBadgeColor(user.role)}`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-center text-sm">
                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              user.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                            }`}>
                              {user.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-500 font-mono">
                            {user.telegramChatId || "-"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-500">
                            {user.linked_req_name || "-"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-500">
                            {user.lastSyncAt
                              ? new Date(user.lastSyncAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
                              : "-"}
                          </td>
                          <td className={`sticky right-0 whitespace-nowrap px-4 py-4 text-right text-sm font-medium shadow-[-2px_0_4px_rgba(0,0,0,0.05)] ${!user.isActive ? 'bg-gray-100' : 'bg-white'}`}>
                            <CanAccess action="admin_users.update" fallback={<span className="mr-3 text-gray-400 cursor-not-allowed" title="คุณไม่มีสิทธิ์แก้ไข">แก้ไข</span>}>
                              <button
                                onClick={() => handleEditUserProduction(user)}
                                className="mr-3 text-indigo-600 hover:text-indigo-900"
                              >
                                แก้ไข
                              </button>
                            </CanAccess>
                            <CanAccess action="admin_users.delete" fallback={<span className="text-gray-400 cursor-not-allowed" title="คุณไม่มีสิทธิ์ลบ">ลบ</span>}>
                              <button
                                onClick={() => handleDeleteUserProduction(user)}
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
            </>
          )}
        </div>
      </div>

      {/* Modal - ไม่ต้องครอบด้วย CanAccess เพราะ form จะถูกเปิดได้ก็ต่อเมื่อกดปุ่มที่ถูกครอบแล้ว */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-bold">
              {editingUserProduction
                ? "แก้ไขผู้ใช้ Production"
                : editingUser
                ? "แก้ไขผู้ใช้"
                : "เพิ่มผู้ใช้ใหม่"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingUserProduction && (
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
              )}

              {editingUserProduction && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Email (Login)
                  </label>
                  <input
                    type="text"
                    value={formData.userId}
                    disabled
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-gray-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {editingUserProduction ? "ชื่อ-นามสกุล" : "Username"} {!editingUserProduction && !editingUser && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  required={!editingUserProduction && !editingUser}
                  placeholder={editingUserProduction ? "ชื่อเต็ม" : "ชื่อผู้ใช้"}
                />
              </div>

              {!editingUserProduction && (
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
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Password {!editingUser && !editingUserProduction && <span className="text-red-500">*</span>}
                  {(editingUser || editingUserProduction) && <span className="text-sm text-gray-500"> (เว้นว่างหากไม่ต้องการเปลี่ยน)</span>}
                </label>
                <input
                  type="text"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  required={!editingUser && !editingUserProduction}
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
                  {roles.length > 0 ? (
                    roles.map((role) => (
                      <option key={role.id} value={role.code}>
                        {role.name} ({role.code})
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Admin">Admin</option>
                      <option value="PR">PR</option>
                    </>
                  )}
                </select>
                {roles.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">
                    ยังไม่มี Role ในระบบ - กรุณาไปที่หน้า &quot;จัดการ Role&quot; เพื่อเพิ่ม Role
                  </p>
                )}
              </div>

              {editingUserProduction && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Telegram Chat ID
                    </label>
                    <input
                      type="text"
                      value={formData.telegramChatId}
                      onChange={(e) =>
                        setFormData({ ...formData, telegramChatId: e.target.value })
                      }
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                      placeholder="เช่น 123456789"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      ใช้สำหรับส่งการแจ้งเตือน Telegram โดยตรง
                    </p>
                  </div>
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700">
                      ชื่อผู้ขอ PR (Linked Req Name)
                    </label>
                    {/* Searchable Dropdown */}
                    <div className="relative mt-1">
                      <input
                        type="text"
                        value={isReqNameDropdownOpen ? reqNameSearch : formData.linkedReqName}
                        onChange={(e) => {
                          setReqNameSearch(e.target.value);
                          if (!isReqNameDropdownOpen) setIsReqNameDropdownOpen(true);
                        }}
                        onFocus={() => {
                          setIsReqNameDropdownOpen(true);
                          setReqNameSearch("");
                        }}
                        onBlur={() => {
                          // Delay to allow click on dropdown item
                          setTimeout(() => setIsReqNameDropdownOpen(false), 200);
                        }}
                        placeholder="พิมพ์เพื่อค้นหา หรือเลือกจากรายการ..."
                        className="block w-full rounded-md border border-gray-300 px-3 py-2 pr-10"
                      />
                      {/* Clear button */}
                      {formData.linkedReqName && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, linkedReqName: "" });
                            setReqNameSearch("");
                          }}
                          className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                      {/* Dropdown arrow */}
                      <button
                        type="button"
                        onClick={() => setIsReqNameDropdownOpen(!isReqNameDropdownOpen)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                      >
                        <svg className={`h-5 w-5 transition-transform ${isReqNameDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Dropdown List */}
                      {isReqNameDropdownOpen && (
                        <div className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-md bg-white shadow-lg border border-gray-200">
                          {/* ไม่ระบุ option */}
                          <div
                            onClick={() => {
                              setFormData({ ...formData, linkedReqName: "" });
                              setReqNameSearch("");
                              setIsReqNameDropdownOpen(false);
                            }}
                            className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${
                              !formData.linkedReqName ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500'
                            }`}
                          >
                            -- ไม่ระบุ --
                          </div>

                          {/* Current value ถ้ามี */}
                          {editingUserProduction?.linked_req_name && (
                            <div
                              onClick={() => {
                                setFormData({ ...formData, linkedReqName: editingUserProduction.linked_req_name || "" });
                                setReqNameSearch("");
                                setIsReqNameDropdownOpen(false);
                              }}
                              className={`px-3 py-2 cursor-pointer hover:bg-gray-100 border-b border-gray-100 ${
                                formData.linkedReqName === editingUserProduction.linked_req_name ? 'bg-indigo-50 text-indigo-700' : ''
                              }`}
                            >
                              <span className="font-medium">{editingUserProduction.linked_req_name}</span>
                              <span className="ml-2 text-xs text-green-600">(ปัจจุบัน)</span>
                            </div>
                          )}

                          {/* Filtered options */}
                          {filteredReqNames.length > 0 ? (
                            filteredReqNames.map((r) => (
                              <div
                                key={r.req_name}
                                onClick={() => {
                                  setFormData({ ...formData, linkedReqName: r.req_name });
                                  setReqNameSearch("");
                                  setIsReqNameDropdownOpen(false);
                                }}
                                className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${
                                  formData.linkedReqName === r.req_name ? 'bg-indigo-50 text-indigo-700' : ''
                                }`}
                              >
                                <span>{r.req_name}</span>
                                <span className="ml-2 text-xs text-gray-400">({r.pr_count} PR)</span>
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-gray-500 text-sm">
                              ไม่พบผลลัพธ์ที่ตรงกับ &quot;{reqNameSearch}&quot;
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      ใช้ match กับ req_name ใน PR เพื่อรับแจ้งเตือนเมื่อ warehouse confirm รับของ หรือมีการตอบ Q&amp;A
                    </p>
                  </div>
                </>
              )}

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

// Export default with PageGuard wrapper
export default function AdminUsersPage() {
  return (
    <PageGuard action="admin_users.read" pageName="จัดการผู้ใช้">
      <AdminUsersContent />
    </PageGuard>
  );
}
