import { useState, useRef, useEffect, useMemo } from "react";
import { useAuth } from "~/hooks/useAuth";
import { api } from "~/utils/api";
import { useRouter } from "next/router";
import Link from "next/link";

export default function TopBar() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Query pending approvals list (not just count)
  const { data: pendingApprovals = [] } = api.pr.getMyPendingApprovals.useQuery(
    {
      userId: user?.id || '',
      userName: user?.name || undefined,
      userRole: user?.role || undefined,
    },
    { enabled: !!user?.id, refetchInterval: 30000 } // Refetch every 30 seconds
  );

  // Query user notifications (receive confirmed, etc.)
  const { data: myNotifications = [] } = api.notification.getMyNotifications.useQuery(
    {
      userId: user?.id || '',
      limit: 20,
      unreadOnly: false,
    },
    { enabled: !!user?.id, refetchInterval: 30000 }
  );

  const markAsReadMutation = api.notification.markAsRead.useMutation({
    onSuccess: () => {
      void utils.notification.getMyNotifications.invalidate();
    },
  });
  const utils = api.useUtils();
  const deleteReadMutation = api.notification.deleteReadNotifications.useMutation({
    onSuccess: () => {
      void utils.notification.getMyNotifications.invalidate();
    },
  });

  // รวม pending approvals กับ notifications
  type NotificationItem = {
    id: string;
    type: 'approval' | 'goods_ready' | 'qa_answered' | 'approval_rejected' | 'qa_pending';
    title: string;
    subtitle?: string;
    prNo?: number;
    createdAt: Date | null;
    isRead: boolean;
    notificationId?: number;
  };

  const allNotifications = useMemo(() => {
    const notifications: NotificationItem[] = [];

    // Add pending approvals (always unread)
    pendingApprovals.forEach(approval => {
      notifications.push({
        id: `approval-${approval.prNo}`,
        type: 'approval',
        title: `PR #${approval.prNo}`,
        subtitle: `รอ: ${approval.stageName}`,
        prNo: approval.prNo,
        createdAt: approval.createdAt ? new Date(approval.createdAt) : null,
        isRead: false,
      });
    });

    // Add notifications (goods_ready, qa_answered, etc.)
    myNotifications.forEach((notif: (typeof myNotifications)[number]) => {
      // Map type จาก database ไป type ที่ใช้ใน frontend
      const notifType = notif.type === 'qa_answered' ? 'qa_answered'
        : notif.type === 'approval_rejected' ? 'approval_rejected'
        : notif.type === 'qa_pending' ? 'qa_pending'
        : 'goods_ready';
      notifications.push({
        id: `notif-${notif.id}`,
        type: notifType,
        title: notif.title,
        subtitle: notif.message || undefined,
        prNo: notif.pr_doc_num || undefined,
        createdAt: notif.created_at ? new Date(notif.created_at) : null,
        isRead: notif.is_read,
        notificationId: notif.id,
      });
    });

    // Sort by date (newest first)
    return notifications.sort((a, b) => {
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }, [pendingApprovals, myNotifications]);

  // นับ unread (approval นับทุกตัว + notification ที่ยังไม่อ่าน)
  const unreadCount = allNotifications.filter(n => !n.isRead).length;
  const hasReadNotifications = myNotifications.some((n: (typeof myNotifications)[number]) => n.is_read);
  const pendingCount = pendingApprovals.length;

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

  // Toggle notification dropdown
  const handleNotificationClick = () => {
    setIsNotificationOpen(!isNotificationOpen);
  };

  // Navigate to PR page and mark notification as read
  const handleItemClick = (item: NotificationItem) => {
    setIsNotificationOpen(false);

    // Mark as read if it's a notification (not approval)
    if (item.notificationId && !item.isRead) {
      markAsReadMutation.mutate({ notificationIds: [item.notificationId] });
    }

    // Navigate based on type
    if (item.prNo) {
      if (item.type === 'approval') {
        void router.push(`/pr-approval?prNo=${item.prNo}`);
      } else if (item.type === 'approval_rejected' || item.type === 'qa_pending') {
        void router.push(`/pr-tracking?prNo=${item.prNo}`);
      } else if (item.type === 'goods_ready') {
        void router.push(`/receive-good`);
      } else {
        void router.push(`/pr-overview?prNo=${item.prNo}`);
      }
    }
  };

  return (
    <>
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md">
        <div className="container mx-auto flex items-center justify-end gap-4 px-4 py-3">
          {/* Notification Bell - Dropdown */}
          <div className="relative" ref={notificationRef}>
            <button
              onClick={handleNotificationClick}
              className="relative rounded-full bg-white/20 p-2 text-white transition hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-600"
              title={`การแจ้งเตือน (${unreadCount} รายการ)`}
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
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {isNotificationOpen && (
              <div className="absolute right-0 mt-2 w-80 origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-gray-900">การแจ้งเตือน</span>
                    {unreadCount > 0 && (
                      <span className="ml-2 text-sm text-gray-500">({unreadCount} รายการ)</span>
                    )}
                  </div>
                  {hasReadNotifications && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (user?.id) {
                          deleteReadMutation.mutate({ userId: user.id });
                        }
                      }}
                      disabled={deleteReadMutation.isPending}
                      className="text-xs text-red-500 hover:text-red-700 transition"
                      title="ล้างการแจ้งเตือนที่อ่านแล้ว"
                    >
                      {deleteReadMutation.isPending ? 'กำลังล้าง...' : 'ล้างที่อ่านแล้ว'}
                    </button>
                  )}
                </div>

                {/* List */}
                <div className="max-h-80 overflow-y-auto">
                  {allNotifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-500">
                      <svg className="mx-auto h-12 w-12 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      ไม่มีรายการรอดำเนินการ
                    </div>
                  ) : (
                    allNotifications.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleItemClick(item)}
                        className={`px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition ${
                          !item.isRead ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {item.type === 'approval' ? (
                                <span className="text-orange-500 text-sm">🔔</span>
                              ) : item.type === 'approval_rejected' ? (
                                <span className="text-red-500 text-sm">❌</span>
                              ) : item.type === 'qa_pending' ? (
                                <span className="text-orange-500 text-sm">❓</span>
                              ) : item.type === 'qa_answered' ? (
                                <span className="text-blue-500 text-sm">💬</span>
                              ) : (
                                <span className="text-green-500 text-sm">📦</span>
                              )}
                              <span className="font-medium text-gray-900">{item.title}</span>
                            </div>
                            {item.subtitle && (
                              <div className={`text-xs mt-0.5 truncate ${
                                item.type === 'approval' ? 'text-orange-600' :
                                item.type === 'approval_rejected' ? 'text-red-600' :
                                item.type === 'qa_pending' ? 'text-orange-600' :
                                item.type === 'qa_answered' ? 'text-blue-600' : 'text-gray-500'
                              }`}>
                                {item.subtitle}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            {!item.isRead && (
                              <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                            )}
                            <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

              </div>
            )}
          </div>

          {/* User Menu Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-600"
            >
              <span className="text-lg font-semibold">
                {user.name || user.username || user.userId || "User"}
              </span>
              <svg
                className={`h-4 w-4 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                <div className="py-1">
                  {/* User Info Header */}
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{user.name || user.username}</p>
                    <p className="text-xs text-gray-500">Role: {user.role || "N/A"}</p>
                  </div>

                  {/* Menu Items */}
                  <Link
                    href="/my-kpi"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <svg className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    KPI ของฉัน
                  </Link>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsModalOpen(true);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    เปลี่ยนรหัสผ่าน
                  </button>

                  <div className="border-t border-gray-100">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        void logout();
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      ออกจากระบบ
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Role Badge */}
          <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
            Role: {user.role || "N/A"}
          </span>
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
