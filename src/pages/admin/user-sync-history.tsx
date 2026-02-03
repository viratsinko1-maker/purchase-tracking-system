import { useState, useEffect } from "react";
import Head from "next/head";
import { useAuth } from "~/hooks/useAuth";
import { authFetch } from "~/lib/authFetch";
import PageGuard from "~/components/PageGuard";

interface UserSyncStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  lastSyncAt: string | null;
  roleDistribution: {
    role: string;
    count: number;
  }[];
  recentSyncedUsers: {
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    lastSyncAt: string | null;
  }[];
}

function UserSyncHistoryContent() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserSyncStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await authFetch("/api/admin/user-sync-stats");
      const data = await response.json();

      if (response.ok) {
        setStats(data);
      } else {
        setError(data.error || "ไม่สามารถโหลดข้อมูลได้");
      }
    } catch (err) {
      console.error("Load stats error:", err);
      setError("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStats();
  }, []);

  const handleManualSync = async () => {
    if (syncing) return;

    try {
      setSyncing(true);
      setError("");
      setSyncResult(null);

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

      if (response.ok) {
        setSyncResult(data.message);
        void loadStats();
      } else {
        setError(data.error || "ไม่สามารถ Sync ได้");
      }
    } catch (err) {
      console.error("Sync error:", err);
      setError("เกิดข้อผิดพลาดในการ Sync");
    } finally {
      setSyncing(false);
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "Admin":
        return "bg-red-100 text-red-800";
      case "Approval":
        return "bg-purple-100 text-purple-800";
      case "Purchasing":
        return "bg-blue-100 text-blue-800";
      case "Warehouse":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <>
      <Head>
        <title>User Sync History - Admin</title>
      </Head>

      <main className="min-h-screen bg-gray-50 px-4 py-8">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">ประวัติ User Sync</h1>
              <p className="mt-1 text-sm text-gray-600">
                สถานะการ Sync ผู้ใช้จาก TMK Production
              </p>
            </div>
            <button
              onClick={handleManualSync}
              disabled={syncing || loading}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-300"
            >
              {syncing ? "กำลัง Sync..." : "🔄 Sync Users"}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-600">
              {error}
            </div>
          )}

          {/* Sync Result Message */}
          {syncResult && (
            <div className="mb-4 rounded-lg bg-green-50 p-4 text-green-700">
              {syncResult}
            </div>
          )}

          {/* Info Box */}
          <div className="mb-6 rounded-lg bg-blue-50 p-4">
            <h3 className="font-semibold text-blue-800">ข้อมูล User Sync</h3>
            <ul className="mt-2 list-disc pl-5 text-sm text-blue-700">
              <li>User sync ดึงข้อมูลจาก TMK_PDPJ01 (Production Database)</li>
              <li>ผู้ใช้ใหม่จะได้รับ password เริ่มต้น และ role เป็น &quot;PR&quot;</li>
              <li>ผู้ใช้ที่ไม่พบในระบบ Production จะถูกปิดใช้งาน (Deactivate)</li>
              <li>Role และ Password ที่ตั้งไว้จะไม่ถูก overwrite เมื่อ sync</li>
            </ul>
          </div>

          {/* Stats Cards */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-lg text-gray-600">กำลังโหลด...</div>
            </div>
          ) : stats ? (
            <>
              {/* Summary Cards */}
              <div className="mb-6 grid gap-4 md:grid-cols-4">
                <div className="rounded-lg bg-white p-6 shadow">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                      <span className="text-2xl">👥</span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">ผู้ใช้ทั้งหมด</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {stats.totalUsers.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-white p-6 shadow">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                      <span className="text-2xl">✅</span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Active</p>
                      <p className="text-2xl font-bold text-green-600">
                        {stats.activeUsers.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-white p-6 shadow">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                      <span className="text-2xl">⏸️</span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Inactive</p>
                      <p className="text-2xl font-bold text-gray-500">
                        {stats.inactiveUsers.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-white p-6 shadow">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                      <span className="text-2xl">🕐</span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Last Sync</p>
                      <p className="text-sm font-medium text-gray-700">
                        {formatDateTime(stats.lastSyncAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Role Distribution */}
              <div className="mb-6 rounded-lg bg-white p-6 shadow">
                <h3 className="mb-4 text-lg font-semibold text-gray-900">Role Distribution</h3>
                <div className="flex flex-wrap gap-3">
                  {stats.roleDistribution.map((item) => (
                    <div
                      key={item.role}
                      className={`flex items-center gap-2 rounded-full px-4 py-2 ${getRoleBadgeColor(item.role)}`}
                    >
                      <span className="font-medium">{item.role}</span>
                      <span className="rounded-full bg-white/50 px-2 py-0.5 text-sm font-bold">
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recently Synced Users */}
              <div className="rounded-lg bg-white shadow">
                <div className="border-b px-6 py-4">
                  <h3 className="text-lg font-semibold text-gray-900">ผู้ใช้ที่ Sync ล่าสุด</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          ชื่อ
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          สถานะ
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Last Sync
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {stats.recentSyncedUsers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                            ไม่มีข้อมูลผู้ใช้
                          </td>
                        </tr>
                      ) : (
                        stats.recentSyncedUsers.map((user) => (
                          <tr key={user.id} className="hover:bg-gray-50">
                            <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                              {user.name || "-"}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                              {user.email}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4">
                              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getRoleBadgeColor(user.role)}`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4">
                              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                user.isActive
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}>
                                {user.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                              {formatDateTime(user.lastSyncAt)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-lg bg-white px-6 py-12 text-center shadow">
              <p className="text-gray-500">ไม่พบข้อมูล</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

// Export default with PageGuard wrapper
export default function UserSyncHistoryPage() {
  return (
    <PageGuard action="admin_sync_user.read" pageName="User Sync History">
      <UserSyncHistoryContent />
    </PageGuard>
  );
}
