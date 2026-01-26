import { useState } from "react";
import { useAuth } from "~/hooks/useAuth";
import { api } from "~/utils/api";
import { useRouter } from "next/router";

export default function TopBar() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Query pending approvals count
  const { data: pendingCount = 0 } = api.pr.getMyPendingApprovalsCount.useQuery(
    {
      userId: user?.id || '',
      userName: user?.name || undefined,
      userRole: user?.role || undefined,
    },
    { enabled: !!user?.id, refetchInterval: 30000 } // Refetch every 30 seconds
  );

  if (!user) {
    return null;
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validate
    if (!oldPassword || !newPassword || !confirmPassword) {
      setError("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("รหัสผ่านใหม่ไม่ตรงกัน");
      return;
    }

    if (newPassword.length < 1) {
      setError("รหัสผ่านใหม่ต้องมีอย่างน้อย 1 ตัวอักษร");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          oldPassword,
          newPassword,
          source: user.source,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "เกิดข้อผิดพลาด");
        setLoading(false);
        return;
      }

      setSuccess("เปลี่ยนรหัสผ่านสำเร็จ!");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // Close modal after 2 seconds
      setTimeout(() => {
        setIsModalOpen(false);
        setSuccess("");
      }, 2000);

    } catch (err) {
      console.error("Change password error:", err);
      setError("เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน");
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess("");
  };

  // Navigate to PR Approval page
  const handleNotificationClick = () => {
    void router.push('/pr-approval');
  };

  return (
    <>
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md">
        <div className="container mx-auto flex items-center justify-end gap-4 px-4 py-3">
          {/* Notification Bell - Navigate to /pr-approval */}
          <button
            onClick={handleNotificationClick}
            className="relative rounded-full bg-white/20 p-2 text-white transition hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-600"
            title={`รอการอนุมัติของฉัน (${pendingCount} รายการ)`}
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            {/* Badge */}
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
          </button>

          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold">
              ชื่อ: {user.name || user.username || user.userId || "User"}
            </span>
            <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
              Role: {user.role || "N/A"}
            </span>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="rounded-md bg-white/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-600"
          >
            เปลี่ยนรหัสผ่าน
          </button>

          <button
            onClick={() => void logout()}
            className="rounded-md bg-white/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-600"
          >
            ออกจากระบบ
          </button>
        </div>
      </div>

      {/* Change Password Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-bold text-gray-800">
              เปลี่ยนรหัสผ่าน
            </h2>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-600">
                {success}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  รหัสผ่านเดิม <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  disabled={loading || !!success}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  รหัสผ่านใหม่ <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  disabled={loading || !!success}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  ยืนยันรหัสผ่านใหม่ <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  disabled={loading || !!success}
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={loading || !!success}
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {loading ? "กำลังบันทึก..." : "บันทึก"}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={loading}
                  className="flex-1 rounded-lg bg-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-400 disabled:opacity-50"
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
